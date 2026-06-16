import { redirect } from "next/navigation"

export default function FacturasRedirectPage() {
  redirect("/compras/procurement?tab=facturas")
}
