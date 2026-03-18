-- Designated administration approver email for PO viability notifications.
-- Only this address receives approval emails at the administration level.
INSERT INTO public.app_settings (key, value)
VALUES ('po_admin_approval_email', 'administracion@dcconcretos.com.mx')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
