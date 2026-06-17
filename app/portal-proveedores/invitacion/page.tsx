import type { Metadata } from "next"
import { PortalProveedoresInvitacionForm } from "@/components/portal-proveedores/portal-invitacion-form"

export const metadata: Metadata = {
  title: "Aceptar invitación | Portal de proveedores",
  robots: { index: false, follow: false },
}

export default function PortalProveedoresInvitacionPage() {
  return <PortalProveedoresInvitacionForm />
}
