-- Full procurement parity: CFDI fields, credit notes, 3-way validation.

-- ---------------------------------------------------------------------------
-- 1) CFDI columns on po_supplier_invoices
-- ---------------------------------------------------------------------------
ALTER TABLE public.po_supplier_invoices
  ADD COLUMN IF NOT EXISTS cfdi_uuid text,
  ADD COLUMN IF NOT EXISTS cfdi_serie text,
  ADD COLUMN IF NOT EXISTS cfdi_folio text,
  ADD COLUMN IF NOT EXISTS cfdi_emisor_rfc text,
  ADD COLUMN IF NOT EXISTS cfdi_receptor_rfc text,
  ADD COLUMN IF NOT EXISTS cfdi_metodo_pago text,
  ADD COLUMN IF NOT EXISTS cfdi_forma_pago text,
  ADD COLUMN IF NOT EXISTS cfdi_uso text,
  ADD COLUMN IF NOT EXISTS cfdi_tipo_comprobante text,
  ADD COLUMN IF NOT EXISTS cfdi_fecha_emision timestamptz,
  ADD COLUMN IF NOT EXISTS cfdi_fecha_timbrado timestamptz,
  ADD COLUMN IF NOT EXISTS cfdi_capture_mode text NOT NULL DEFAULT 'manual'
    CHECK (cfdi_capture_mode IN ('manual', 'cfdi')),
  ADD COLUMN IF NOT EXISTS xml_url text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_po_supplier_invoices_cfdi_uuid
  ON public.po_supplier_invoices (cfdi_uuid)
  WHERE cfdi_uuid IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) po_credit_notes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.po_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id),
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  credit_number text,
  credit_date date NOT NULL,
  reason text NOT NULL CHECK (reason IN ('price_adjustment', 'return', 'defect', 'other')),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  tax_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total numeric(12, 2) NOT NULL CHECK (total >= 0),
  vat_rate numeric(5, 4) NOT NULL DEFAULT 0.16,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'partially_applied', 'fully_applied', 'void')),
  notes text,
  cfdi_uuid text,
  cfdi_serie text,
  cfdi_folio text,
  cfdi_emisor_rfc text,
  cfdi_receptor_rfc text,
  cfdi_relacionado_uuid text,
  cfdi_capture_mode text NOT NULL DEFAULT 'manual',
  xml_url text,
  applied_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_po_credit_notes_cfdi_uuid
  ON public.po_credit_notes (cfdi_uuid)
  WHERE cfdi_uuid IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) po_credit_note_invoice_allocations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.po_credit_note_invoice_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES public.po_credit_notes(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.po_supplier_invoices(id) ON DELETE CASCADE,
  allocated_subtotal numeric(12, 2) NOT NULL CHECK (allocated_subtotal > 0),
  allocated_tax numeric(12, 2) NOT NULL DEFAULT 0 CHECK (allocated_tax >= 0),
  allocated_total numeric(12, 2) GENERATED ALWAYS AS (allocated_subtotal + allocated_tax) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credit_note_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_po_cn_alloc_invoice ON public.po_credit_note_invoice_allocations (invoice_id);

-- ---------------------------------------------------------------------------
-- 4) Invoice credit applied view helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.po_invoice_credit_summary AS
SELECT
  inv.id AS invoice_id,
  COALESCE(SUM(alloc.allocated_subtotal), 0) AS credit_applied_subtotal,
  COALESCE(SUM(alloc.allocated_tax), 0) AS credit_applied_tax,
  COALESCE(SUM(alloc.allocated_total), 0) AS credit_applied_total
FROM public.po_supplier_invoices inv
LEFT JOIN public.po_credit_note_invoice_allocations alloc ON alloc.invoice_id = inv.id
LEFT JOIN public.po_credit_notes cn ON cn.id = alloc.credit_note_id AND cn.status <> 'void'
GROUP BY inv.id;

-- ---------------------------------------------------------------------------
-- 5) 3-way validation: OC amount (sin IVA) vs invoice vs receipt
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_po_invoice_vs_oc(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice record;
  v_po record;
  v_expected numeric(12, 2);
  v_taxable_base numeric(12, 2);
  v_has_receipt boolean;
  v_warnings jsonb := '[]'::jsonb;
  v_tolerance numeric(12, 2) := 0.02;
  v_pct_tolerance numeric := 1.05;
BEGIN
  SELECT inv.*, (inv.subtotal - COALESCE(inv.discount_amount, 0)) AS taxable
  INTO v_invoice
  FROM public.po_supplier_invoices inv
  WHERE inv.id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_array(jsonb_build_object('type', 'not_found', 'message', 'Factura no encontrada'));
  END IF;

  SELECT po.*,
    COALESCE(NULLIF(po.actual_amount, 0), NULLIF(po.approval_amount, 0), po.total_amount, 0) AS expected_net
  INTO v_po
  FROM public.purchase_orders po
  WHERE po.id = v_invoice.purchase_order_id;

  v_expected := round(COALESCE(v_po.expected_net, 0)::numeric, 2);
  v_taxable_base := round(v_invoice.taxable::numeric, 2);

  SELECT EXISTS (
    SELECT 1 FROM public.purchase_order_receipts r
    WHERE r.purchase_order_id = v_po.id
  ) INTO v_has_receipt;

  IF v_expected > 0 AND v_taxable_base > v_expected * v_pct_tolerance THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'type', 'invoice_exceeds_po',
      'message', format('La factura (sin IVA: %s) excede el monto de la OC (sin IVA: %s). Verifique IVA y retenciones.', v_taxable_base, v_expected),
      'invoice_pre_tax', v_taxable_base,
      'po_pre_tax', v_expected
    ));
  ELSIF v_expected > 0 AND abs(v_taxable_base - v_expected) > v_tolerance THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'type', 'invoice_po_mismatch',
      'message', format('Diferencia entre factura sin IVA (%s) y monto OC sin IVA (%s).', v_taxable_base, v_expected),
      'invoice_pre_tax', v_taxable_base,
      'po_pre_tax', v_expected
    ));
  END IF;

  IF NOT v_has_receipt AND v_po.status NOT IN ('fulfilled') THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'type', 'no_receipt',
      'message', 'No hay comprobante registrado para esta OC.'
    ));
  END IF;

  IF v_invoice.total > 0 AND v_po.expected_net > 0 THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'type', 'vat_reminder',
      'message', format(
        'Recordatorio: el monto de la OC (%s) es sin IVA. El pago al proveedor es %s (neto con impuestos).',
        v_expected,
        round(v_invoice.total::numeric, 2)
      ),
      'po_pre_tax', v_expected,
      'invoice_net_payable', round(v_invoice.total::numeric, 2)
    ));
  END IF;

  RETURN v_warnings;
END;
$function$;

COMMENT ON FUNCTION public.validate_po_invoice_vs_oc(uuid) IS
  'Validación 3 vías suave: OC sin IVA vs factura sin IVA, comprobante, recordatorio IVA al pagar.';

-- ---------------------------------------------------------------------------
-- 6) RLS credit notes
-- ---------------------------------------------------------------------------
ALTER TABLE public.po_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_credit_note_invoice_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_credit_notes_select" ON public.po_credit_notes;
CREATE POLICY "po_credit_notes_select" ON public.po_credit_notes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "po_credit_notes_insert" ON public.po_credit_notes;
CREATE POLICY "po_credit_notes_insert" ON public.po_credit_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA')
    )
  );

DROP POLICY IF EXISTS "po_cn_alloc_select" ON public.po_credit_note_invoice_allocations;
CREATE POLICY "po_cn_alloc_select" ON public.po_credit_note_invoice_allocations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "po_cn_alloc_insert" ON public.po_credit_note_invoice_allocations;
CREATE POLICY "po_cn_alloc_insert" ON public.po_credit_note_invoice_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA')
    )
  );

-- ---------------------------------------------------------------------------
-- 7) Wire credit notes into balances and payment recalc
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.po_invoice_balances AS
SELECT
  inv.id AS invoice_id,
  inv.purchase_order_id,
  inv.plant_id,
  inv.supplier_id,
  inv.invoice_number,
  inv.invoice_date,
  inv.due_date,
  inv.subtotal,
  inv.discount_amount,
  inv.vat_rate,
  inv.tax,
  inv.retention_isr_amount,
  inv.retention_iva_amount,
  inv.total,
  inv.status AS invoice_status,
  inv.expense_category,
  inv.document_url,
  inv.notes,
  inv.created_at,
  inv.updated_at,
  po.order_id,
  po.supplier,
  po.po_type,
  po.po_purpose,
  po.status AS po_status,
  COALESCE(pay.paid_to_date, 0) AS paid_to_date,
  COALESCE(cred.credit_applied_total, 0) AS credit_applied_total,
  GREATEST(
    inv.total - COALESCE(pay.paid_to_date, 0) - COALESCE(cred.credit_applied_total, 0),
    0
  ) AS balance,
  CASE
    WHEN inv.due_date IS NOT NULL AND inv.due_date < CURRENT_DATE
      AND inv.status IN ('open', 'partially_paid')
    THEN true
    ELSE false
  END AS is_overdue,
  CASE
    WHEN inv.due_date IS NOT NULL
    THEN (inv.due_date - CURRENT_DATE)
    ELSE NULL
  END AS days_until_due
FROM public.po_supplier_invoices inv
JOIN public.purchase_orders po ON po.id = inv.purchase_order_id
LEFT JOIN (
  SELECT invoice_id, SUM(amount) AS paid_to_date
  FROM public.po_invoice_payments
  GROUP BY invoice_id
) pay ON pay.invoice_id = inv.id
LEFT JOIN public.po_invoice_credit_summary cred ON cred.invoice_id = inv.id
WHERE inv.status <> 'void';

CREATE OR REPLACE FUNCTION public.recalc_po_invoice_status(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric(12, 2);
  v_credits numeric(12, 2);
  v_net_payable numeric(12, 2);
  v_paid numeric(12, 2);
  v_new_status text;
  v_po_id uuid;
BEGIN
  SELECT total, purchase_order_id
  INTO v_total, v_po_id
  FROM public.po_supplier_invoices
  WHERE id = p_invoice_id;

  IF v_total IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(credit_applied_total, 0)
  INTO v_credits
  FROM public.po_invoice_credit_summary
  WHERE invoice_id = p_invoice_id;

  v_net_payable := GREATEST(v_total - COALESCE(v_credits, 0), 0);

  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid
  FROM public.po_invoice_payments
  WHERE invoice_id = p_invoice_id;

  IF v_paid <= 0 THEN
    v_new_status := 'open';
  ELSIF v_paid + 0.01 >= v_net_payable THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  UPDATE public.po_supplier_invoices
  SET status = v_new_status, updated_at = now()
  WHERE id = p_invoice_id
    AND status <> 'void';

  UPDATE public.purchase_orders
  SET accounting_status = CASE
    WHEN v_new_status = 'paid' THEN 'paid'
    ELSE 'invoiced'
  END,
  updated_at = now()
  WHERE id = v_po_id;
END;
$function$;
