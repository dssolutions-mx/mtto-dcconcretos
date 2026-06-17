import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Portal de proveedores | DC Concretos",
  description:
    "Acceso para proveedores: seguimiento de órdenes de compra, facturas y pagos.",
  robots: { index: false, follow: false },
}

export default function PortalProveedoresLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
