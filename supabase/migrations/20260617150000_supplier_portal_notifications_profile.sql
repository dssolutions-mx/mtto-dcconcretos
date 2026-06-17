-- Portal de proveedores — perfil de contacto y notificaciones in-app (Fase 5)
-- NO aplicar en producción sin revisión humana.

ALTER TABLE public.supplier_portal_users
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS notification_email text;

COMMENT ON COLUMN public.supplier_portal_users.contact_name IS
  'Nombre de contacto editable por el proveedor en el portal.';
COMMENT ON COLUMN public.supplier_portal_users.contact_phone IS
  'Teléfono de contacto editable por el proveedor en el portal.';
COMMENT ON COLUMN public.supplier_portal_users.notification_email IS
  'Correo alterno para notificaciones; si es NULL se usa el correo de auth.';

-- Proveedor: actualiza solo su membresía (campos de contacto vía API)
CREATE POLICY supplier_portal_users_self_update ON public.supplier_portal_users
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Notifica a todos los usuarios activos del portal que coincidan con la factura
CREATE OR REPLACE FUNCTION public.notify_supplier_portal_invoice_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rfc text;
  v_supplier_id uuid;
  v_invoice_number text;
  v_title text;
  v_message text;
  v_type text;
  v_user record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_rfc := upper(regexp_replace(coalesce(NEW.cfdi_emisor_rfc, ''), '\s', '', 'g'));
    v_supplier_id := NEW.supplier_id;
    v_invoice_number := NEW.invoice_number;

    IF coalesce(NEW.notes, '') NOT ILIKE '%[Portal proveedor]%' THEN
      RETURN NEW;
    END IF;

    v_title := 'Factura recibida';
    v_message := format(
      'Registramos su factura %s. Le avisaremos cuando haya novedades de pago.',
      v_invoice_number
    );
    v_type := 'portal_invoice_received';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_rfc := upper(regexp_replace(coalesce(NEW.cfdi_emisor_rfc, ''), '\s', '', 'g'));
    v_supplier_id := NEW.supplier_id;
    v_invoice_number := NEW.invoice_number;

    IF NEW.status = 'paid' THEN
      v_title := 'Factura pagada';
      v_message := format('Su factura %s fue pagada en su totalidad.', v_invoice_number);
      v_type := 'portal_invoice_paid';
    ELSIF NEW.status = 'partially_paid' THEN
      v_title := 'Pago parcial registrado';
      v_message := format(
        'Se registró un pago parcial contra su factura %s.',
        v_invoice_number
      );
      v_type := 'portal_invoice_partial_payment';
    ELSIF NEW.status = 'void' THEN
      v_title := 'Factura anulada';
      v_message := format(
        'Su factura %s fue anulada. Contacte a compras si tiene dudas.',
        v_invoice_number
      );
      v_type := 'portal_invoice_void';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  FOR v_user IN
    SELECT spu.auth_user_id
    FROM public.supplier_portal_users spu
    WHERE spu.status = 'active'
      AND (
        (v_supplier_id IS NOT NULL AND spu.mtto_supplier_id = v_supplier_id)
        OR (v_rfc <> '' AND upper(regexp_replace(spu.rfc, '\s', '', 'g')) = v_rfc)
      )
  LOOP
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      related_entity,
      entity_id,
      status,
      priority,
      created_at
    ) VALUES (
      v_user.auth_user_id,
      v_title,
      v_message,
      v_type,
      'po_supplier_invoice',
      NEW.id,
      'unread',
      'medium',
      now()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_supplier_portal_invoice ON public.po_supplier_invoices;
CREATE TRIGGER trg_notify_supplier_portal_invoice
  AFTER INSERT OR UPDATE OF status ON public.po_supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_supplier_portal_invoice_event();

CREATE OR REPLACE FUNCTION public.notify_supplier_portal_payment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_user record;
BEGIN
  SELECT
    i.id,
    i.invoice_number,
    i.cfdi_emisor_rfc,
    i.supplier_id
  INTO v_invoice
  FROM public.po_supplier_invoices i
  WHERE i.id = NEW.invoice_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  FOR v_user IN
    SELECT spu.auth_user_id
    FROM public.supplier_portal_users spu
    WHERE spu.status = 'active'
      AND (
        (v_invoice.supplier_id IS NOT NULL AND spu.mtto_supplier_id = v_invoice.supplier_id)
        OR (
          coalesce(v_invoice.cfdi_emisor_rfc, '') <> ''
          AND upper(regexp_replace(spu.rfc, '\s', '', 'g'))
            = upper(regexp_replace(v_invoice.cfdi_emisor_rfc, '\s', '', 'g'))
        )
      )
  LOOP
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      related_entity,
      entity_id,
      status,
      priority,
      created_at
    ) VALUES (
      v_user.auth_user_id,
      'Pago registrado',
      format(
        'Se aplicó un pago de $%s MXN a su factura %s.',
        trim(to_char(NEW.amount, 'FM999,999,990.00')),
        v_invoice.invoice_number
      ),
      'portal_payment_received',
      'po_invoice_payment',
      NEW.id,
      'unread',
      'medium',
      now()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_supplier_portal_payment ON public.po_invoice_payments;
CREATE TRIGGER trg_notify_supplier_portal_payment
  AFTER INSERT ON public.po_invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_supplier_portal_payment_event();
