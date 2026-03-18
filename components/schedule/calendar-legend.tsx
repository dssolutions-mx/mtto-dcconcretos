"use client"

import { Info } from "lucide-react"

const LEGEND_ITEMS = [
  { color: "bg-violet-600", label: "OT programadas" },
  { color: "bg-red-500", label: "Vencidos" },
  { color: "bg-amber-500", label: "Próximos" },
  { color: "bg-blue-500", label: "Cubiertos" },
  { color: "bg-green-500", label: "Programados" },
  { color: "bg-slate-400", label: "Garantías" }
] as const

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {LEGEND_ITEMS.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden />
          <span>{label}</span>
        </div>
      ))}
      <span className="flex items-center gap-1 ml-2 sm:ml-0">
        <Info className="h-3 w-3" />
        Haz clic en un día con mantenimientos para ver detalles
      </span>
    </div>
  )
}
