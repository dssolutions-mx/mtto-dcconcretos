-- Post-approval procurement: partial payments, retentions, and workspace views.
-- Extends po_supplier_invoices (20260616120000) toward cotizador AP parity.

-- ---------------------------------------------------------------------------
-- 1) Retentions + discount on po_supplier_invoices
-- ---------------------------------------------------------------------------
ALTER TABLE public.po_supplier_invoices
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0);

ALTER TABLE public.po_supplier_invoices
  ADD COLUMN IF NOT EXISTS retention_isr_rate numeric(5, 4) NOT NULL DEFAULT 0
    CHECK (retention_isr_rate >= 0 AND retention_isr_rate <= 1);

ALTER TABLE public.po_supplier_invoices
  ADD COLUMN IF NOT EXISTS retention_isr_amount numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (retention_isr_amount >= 0);

ALTER TABLE public.po_supplier_invoices
  ADD COLUMN IF NOT EXISTS retention_iva_rate numeric(5, 4) NOT NULL DEFAULT 0
    CHECK (retention_iva_rate >= 0 AND retention_iva_rate <= 1);

ALTER TABLE public.po_supplier_invoices
  ADD COLUMN IF NOT EXISTS retention_iva_amount numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (retention_iva_amount >= 0);

ALTER TABLE public.po_supplier_invoices
  ADD COLUMN IF NOT EXISTS payment_reference text;

COMMENT ON COLUMN public.po_supplier_invoices.discount_amount IS
  'Descuento pre-IVA (CFDI Descuento).';

-- ---------------------------------------------------------------------------
-- 2) po_invoice_payments — partial payments against supplier invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.po_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.po_supplier_invoices(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  payment_date date NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  payment_method text CHECK (payment_method IN ('cash', 'transfer', 'card')),
  reference text,
  notes text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_invoice_payments_invoice
  ON public.po_invoice_payments (invoice_id);

CREATE INDEX IF NOT EXISTS idx_po_invoice_payments_po
  ON public.po_invoice_payments (purchase_order_id);

COMMENT ON TABLE public.po_invoice_payments IS
  'Pagos parciales o totales aplicados a facturas de proveedor de OC de mantenimiento.';

-- ---------------------------------------------------------------------------
-- 3) View: POs post-approval without supplier invoice (sin factura)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.po_without_supplier_invoice AS
SELECT
  po.id AS purchase_order_id,
  po.order_id,
  po.plant_id,
  pl.name AS plant_name,
  po.supplier,
  po.supplier_id,
  po.po_type,
  po.po_purpose,
  po.status AS po_status,
  po.enhanced_status,
  po.total_amount,
  po.actual_amount,
  po.approval_date,
  po.purchased_at,
  po.max_payment_date,
  po.payment_condition,
  po.accounting_status,
  po.created_at,
  po.updated_at,
  EXISTS (
    SELECT 1 FROM public.purchase_order_receipts r
    WHERE r.purchase_order_id = po.id
  ) AS has_receipt,
  (
    SELECT COUNT(*)::int FROM public.purchase_order_receipts r
    WHERE r.purchase_order_id = po.id
  ) AS receipt_count
FROM public.purchase_orders po
LEFT JOIN public.plants pl ON pl.id = po.plant_id
WHERE po.status IN (
  'approved', 'purchased', 'ordered', 'received',
  'receipt_uploaded', 'fulfilled', 'validated'
)
AND NOT EXISTS (
  SELECT 1 FROM public.po_supplier_invoices inv
  WHERE inv.purchase_order_id = po.id
    AND inv.status <> 'void'
);

COMMENT ON VIEW public.po_without_supplier_invoice IS
  'OC post-aprobación sin factura de proveedor registrada (cola sin factura).';

-- ---------------------------------------------------------------------------
-- 4) View: invoice balances (paid_to_date, balance)
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
  GREATEST(inv.total - COALESCE(pay.paid_to_date, 0), 0) AS balance,
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
WHERE inv.status <> 'void';

COMMENT ON VIEW public.po_invoice_balances IS
  'Facturas de proveedor con saldo pendiente y antigüedad (CxP).';

-- ---------------------------------------------------------------------------
-- 5) Recalculate invoice status after payment insert/delete
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_po_invoice_status(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric(12, 2);
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

  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid
  FROM public.po_invoice_payments
  WHERE invoice_id = p_invoice_id;

  IF v_paid <= 0 THEN
    v_new_status := 'open';
  ELSIF v_paid + 0.01 >= v_total THEN
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

CREATE OR REPLACE FUNCTION public.trg_po_invoice_payment_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_po_invoice_status(OLD.invoice_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_po_invoice_status(NEW.invoice_id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_po_invoice_payment_recalc ON public.po_invoice_payments;
CREATE TRIGGER trg_po_invoice_payment_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.po_invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_po_invoice_payment_recalc();

-- ---------------------------------------------------------------------------
-- 6) RLS for payments
-- ---------------------------------------------------------------------------
ALTER TABLE public.po_invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_invoice_payments_select" ON public.po_invoice_payments;
CREATE POLICY "po_invoice_payments_select" ON public.po_invoice_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.po_supplier_invoices inv
      WHERE inv.id = po_invoice_payments.invoice_id
    )
  );

DROP POLICY IF EXISTS "po_invoice_payments_insert" ON public.po_invoice_payments;
CREATE POLICY "po_invoice_payments_insert" ON public.po_invoice_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA')
    )
  );
