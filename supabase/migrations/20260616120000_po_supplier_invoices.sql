-- Fiscal supplier invoices linked to maintenance purchase orders.
-- Mirrors cotizaciones-concreto supplier_invoices pattern (header + line items + status).

-- ---------------------------------------------------------------------------
-- 1) accounting_status on purchase_orders
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS accounting_status text NOT NULL DEFAULT 'pending_invoice'
    CHECK (accounting_status IN ('pending_invoice', 'invoiced', 'paid'));

COMMENT ON COLUMN public.purchase_orders.accounting_status IS
  'Contabilidad: pending_invoice → invoiced (factura registrada) → paid (pagada fiscalmente).';

-- ---------------------------------------------------------------------------
-- 2) po_supplier_invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.po_supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  plant_id uuid NOT NULL REFERENCES public.plants(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  due_date date,
  subtotal numeric(12, 2) NOT NULL CHECK (subtotal >= 0),
  vat_rate numeric(5, 4) NOT NULL DEFAULT 0.16 CHECK (vat_rate >= 0 AND vat_rate <= 1),
  tax numeric(12, 2) NOT NULL CHECK (tax >= 0),
  total numeric(12, 2) NOT NULL CHECK (total >= 0),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'partially_paid', 'paid', 'void')),
  expense_category text NOT NULL
    CHECK (expense_category IN ('refacciones', 'mano_obra', 'servicio_externo', 'otros')),
  po_purpose_snapshot text,
  po_type_snapshot text,
  document_url text,
  receipt_id uuid REFERENCES public.purchase_order_receipts(id) ON DELETE SET NULL,
  notes text,
  registered_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (purchase_order_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_po_supplier_invoices_po
  ON public.po_supplier_invoices (purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_po_supplier_invoices_plant_status
  ON public.po_supplier_invoices (plant_id, status);

COMMENT ON TABLE public.po_supplier_invoices IS
  'Facturas de proveedor vinculadas a órdenes de compra de mantenimiento (espejo de supplier_invoices en cotizaciones).';

-- ---------------------------------------------------------------------------
-- 3) po_supplier_invoice_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.po_supplier_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.po_supplier_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  expense_type text CHECK (expense_type IN ('materials', 'labor')),
  po_line_index int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_supplier_invoice_items_invoice
  ON public.po_supplier_invoice_items (invoice_id);

COMMENT ON TABLE public.po_supplier_invoice_items IS
  'Líneas de factura de proveedor para OC de mantenimiento (pre-IVA).';

-- ---------------------------------------------------------------------------
-- 4) Summary view
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.po_invoices_accounting_summary AS
SELECT
  po.id AS purchase_order_id,
  po.order_id,
  po.plant_id,
  po.supplier,
  po.supplier_id,
  po.po_type,
  po.po_purpose,
  po.accounting_status,
  po.total_amount AS po_total_amount,
  po.actual_amount AS po_actual_amount,
  inv.id AS invoice_id,
  inv.invoice_number,
  inv.invoice_date,
  inv.due_date,
  inv.subtotal,
  inv.tax,
  inv.total AS invoice_total,
  inv.status AS invoice_status,
  inv.expense_category,
  inv.document_url,
  inv.created_at AS invoice_registered_at
FROM public.purchase_orders po
LEFT JOIN public.po_supplier_invoices inv ON inv.purchase_order_id = po.id;

COMMENT ON VIEW public.po_invoices_accounting_summary IS
  'Resumen contable OC + factura de proveedor para listados y reportes.';

-- ---------------------------------------------------------------------------
-- 5) Trigger: sync purchase_orders.accounting_status on invoice insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_po_accounting_status_on_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.purchase_orders
    SET accounting_status = CASE
      WHEN NEW.status = 'paid' THEN 'paid'
      ELSE 'invoiced'
    END,
    updated_at = now()
    WHERE id = NEW.purchase_order_id
      AND accounting_status = 'pending_invoice';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.purchase_orders
    SET accounting_status = CASE
      WHEN NEW.status = 'paid' THEN 'paid'
      WHEN NEW.status = 'void' THEN 'pending_invoice'
      ELSE 'invoiced'
    END,
    updated_at = now()
    WHERE id = NEW.purchase_order_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_po_accounting_status_on_invoice ON public.po_supplier_invoices;
CREATE TRIGGER trg_sync_po_accounting_status_on_invoice
  AFTER INSERT OR UPDATE OF status ON public.po_supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_po_accounting_status_on_invoice();

-- ---------------------------------------------------------------------------
-- 6) updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_po_supplier_invoice_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_po_supplier_invoices_updated_at ON public.po_supplier_invoices;
CREATE TRIGGER trg_po_supplier_invoices_updated_at
  BEFORE UPDATE ON public.po_supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_po_supplier_invoice_updated_at();

-- ---------------------------------------------------------------------------
-- 7) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.po_supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_supplier_invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_supplier_invoices_select" ON public.po_supplier_invoices;
CREATE POLICY "po_supplier_invoices_select" ON public.po_supplier_invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = po_supplier_invoices.purchase_order_id
    )
  );

DROP POLICY IF EXISTS "po_supplier_invoices_insert" ON public.po_supplier_invoices;
CREATE POLICY "po_supplier_invoices_insert" ON public.po_supplier_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA', 'GERENTE_MANTENIMIENTO')
    )
    AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = po_supplier_invoices.purchase_order_id
    )
  );

DROP POLICY IF EXISTS "po_supplier_invoices_update" ON public.po_supplier_invoices;
CREATE POLICY "po_supplier_invoices_update" ON public.po_supplier_invoices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA')
    )
  );

DROP POLICY IF EXISTS "po_supplier_invoice_items_select" ON public.po_supplier_invoice_items;
CREATE POLICY "po_supplier_invoice_items_select" ON public.po_supplier_invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.po_supplier_invoices inv
      WHERE inv.id = po_supplier_invoice_items.invoice_id
    )
  );

DROP POLICY IF EXISTS "po_supplier_invoice_items_insert" ON public.po_supplier_invoice_items;
CREATE POLICY "po_supplier_invoice_items_insert" ON public.po_supplier_invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA', 'GERENTE_MANTENIMIENTO')
    )
    AND EXISTS (
      SELECT 1 FROM public.po_supplier_invoices inv
      WHERE inv.id = po_supplier_invoice_items.invoice_id
    )
  );
