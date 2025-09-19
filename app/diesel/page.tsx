import { Suspense } from "react"
import DieselInventory from "@/components/diesel-inventory/DieselInventory"

export const dynamic = "force-dynamic"

export default function DieselPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando Inventario Diesel...</div>}>
      <DieselInventory />
    </Suspense>
  )
}


