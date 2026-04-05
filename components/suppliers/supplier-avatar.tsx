import { TYPE_COLORS } from "./supplier-registry-constants"
import type { Supplier } from "@/types/suppliers"

export function SupplierAvatar({ supplier }: { supplier: Supplier }) {
  const initials = supplier.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
  const color = TYPE_COLORS[supplier.supplier_type] || "bg-gray-500"
  return (
    <div
      className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
    >
      {initials}
    </div>
  )
}
