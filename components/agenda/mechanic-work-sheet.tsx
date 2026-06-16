"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ORIGIN_LABELS, type AgendaWorkOrder } from "@/lib/agenda/agenda-utils"

export function MechanicWorkSheet() {
  const searchParams = useSearchParams()
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""
  const technicianId = searchParams.get("technician")

  const [items, setItems] = useState<AgendaWorkOrder[]>([])
  const [technicianName, setTechnicianName] = useState("Todos los técnicos")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!from || !to) return
    const params = new URLSearchParams({ from, to })
    if (technicianId) params.set("assigned_to", technicianId)

    fetch(`/api/work-orders/agenda?${params}`)
      .then((r) => (r.ok ? r.json() : { scheduled: [], technicians: [] }))
      .then((data) => {
        setItems(data.scheduled ?? [])
        if (technicianId) {
          const tech = (data.technicians ?? []).find(
            (t: { id: string; name: string }) => t.id === technicianId,
          )
          if (tech) setTechnicianName(tech.name)
        }
      })
      .finally(() => setLoading(false))
  }, [from, to, technicianId])

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaWorkOrder[]>()
    for (const item of items) {
      if (!item.planned_date) continue
      const key = item.planned_date.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  if (!from || !to) {
    return (
      <p className="text-sm text-muted-foreground p-8">
        Parámetros from y to requeridos.{" "}
        <Link href="/ordenes/agenda" className="underline">
          Volver a la agenda
        </Link>
      </p>
    )
  }

  return (
    <div className="print:p-0 p-6 max-w-4xl mx-auto bg-white text-black min-h-screen">
      <div className="print:hidden mb-6 flex gap-2">
        <Button onClick={() => window.print()}>Imprimir</Button>
        <Button variant="outline" asChild>
          <Link href="/ordenes/agenda">Volver a agenda</Link>
        </Button>
      </div>

      <header className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold">Hoja de trabajo — Mantenimiento</h1>
        <p className="text-sm mt-1">
          Técnico: <strong>{technicianName}</strong>
        </p>
        <p className="text-sm">
          Periodo: {format(parseISO(from), "d MMM yyyy", { locale: es })} –{" "}
          {format(parseISO(to), "d MMM yyyy", { locale: es })}
        </p>
        <p className="text-xs text-gray-600 mt-2">
          Generado {format(new Date(), "PPpp", { locale: es })}
        </p>
      </header>

      {loading ? (
        <p>Cargando…</p>
      ) : items.length === 0 ? (
        <p>No hay trabajos programados en este periodo.</p>
      ) : (
        <div className="space-y-8">
          {byDay.map(([dayKey, dayItems]) => (
            <section key={dayKey}>
              <h2 className="text-lg font-semibold border-b border-gray-400 mb-3 capitalize">
                {format(parseISO(dayKey), "EEEE d MMMM", { locale: es })}
              </h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 text-left">
                    <th className="py-2 pr-2 w-20">OT</th>
                    <th className="py-2 pr-2 w-24">Unidad</th>
                    <th className="py-2 pr-2">Trabajo</th>
                    <th className="py-2 pr-2 w-16">Prior.</th>
                    <th className="py-2 w-24">Hecho</th>
                  </tr>
                </thead>
                <tbody>
                  {dayItems.map((wo) => (
                    <tr key={wo.id} className="border-b border-gray-200 align-top">
                      <td className="py-3 pr-2 font-mono text-xs">{wo.order_id}</td>
                      <td className="py-3 pr-2">{wo.asset_code ?? wo.asset_name}</td>
                      <td className="py-3 pr-2">
                        <p>{wo.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {ORIGIN_LABELS[wo.origin]}
                          {wo.hours_open != null && wo.origin === "incident"
                            ? ` · ${wo.hours_open}d abierto`
                            : ""}
                        </p>
                      </td>
                      <td className="py-3 pr-2">{wo.priority ?? "—"}</td>
                      <td className="py-3">
                        <span className="inline-block w-5 h-5 border border-gray-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-12 pt-4 border-t text-xs text-gray-500 print:mt-8">
        Firmas: Técnico _________________ Supervisor _________________
      </footer>
    </div>
  )
}
