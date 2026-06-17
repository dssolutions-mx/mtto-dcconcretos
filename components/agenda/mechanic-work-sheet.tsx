"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import type { CotizadorOrderItemRow } from "@/lib/agenda/cotizador-orders"
import type { DailyKitWorkOrderParts } from "@/app/api/work-orders/agenda/daily-kit/route"
import type { RemisionRow } from "@/app/api/integrations/cotizador/remisiones/route"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { Button } from "@/components/ui/button"
import { MechanicCompleteDialog } from "@/components/agenda/mechanic-complete-dialog"
import { ORIGIN_LABELS, type AgendaWorkOrder } from "@/lib/agenda/agenda-utils"
import { WorkOrderStatus } from "@/types"
import { useToast } from "@/hooks/use-toast"

type DayContext = {
  kitByWo: Map<string, DailyKitWorkOrderParts>
  orders: CotizadorOrderItemRow[]
  remisionesByAsset: Map<string, RemisionRow[]>
}

export function MechanicWorkSheet() {
  const searchParams = useSearchParams()
  const { profile } = useAuthZustand()
  const { toast } = useToast()

  const today = format(new Date(), "yyyy-MM-dd")
  const from = searchParams.get("from") ?? today
  const to = searchParams.get("to") ?? from
  const technicianId = searchParams.get("technician") ?? profile?.id ?? undefined

  const [items, setItems] = useState<AgendaWorkOrder[]>([])
  const [technicianName, setTechnicianName] = useState("Todos los técnicos")
  const [dayContext, setDayContext] = useState<Map<string, DayContext>>(new Map())
  const [loading, setLoading] = useState(true)
  const [completeTarget, setCompleteTarget] = useState<AgendaWorkOrder | null>(null)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)

  const loadAgenda = useCallback(() => {
    const params = new URLSearchParams({ from, to })
    if (technicianId) params.set("assigned_to", technicianId)

    setLoading(true)
    return fetch(`/api/work-orders/agenda?${params}`)
      .then((r) => (r.ok ? r.json() : { scheduled: [], technicians: [] }))
      .then(async (data) => {
        const scheduled: AgendaWorkOrder[] = data.scheduled ?? []
        setItems(scheduled)
        if (technicianId) {
          const tech = (data.technicians ?? []).find(
            (t: { id: string; name: string }) => t.id === technicianId,
          )
          if (tech) setTechnicianName(tech.name)
          else if (profile) {
            setTechnicianName(
              [profile.nombre, profile.apellido].filter(Boolean).join(" ") || "Técnico",
            )
          }
        }

        const dayKeys = [
          ...new Set(scheduled.map((wo) => wo.planned_date?.slice(0, 10)).filter(Boolean)),
        ] as string[]

        const contextMap = new Map<string, DayContext>()
        await Promise.all(
          dayKeys.map(async (dayKey) => {
            const kitParams = new URLSearchParams({ date: dayKey })
            if (technicianId) kitParams.set("technicianId", technicianId)

            const kitRes = await fetch(`/api/work-orders/agenda/daily-kit?${kitParams}`)
            const kitJson = kitRes.ok ? await kitRes.json() : null
            const kitByWo = new Map<string, DailyKitWorkOrderParts>()
            for (const row of kitJson?.by_work_order ?? []) {
              kitByWo.set(row.work_order_id, row)
            }

            const ordersParams = new URLSearchParams({ from: dayKey, to: dayKey })
            if (kitJson?.plant_ids?.length) {
              ordersParams.set("plantIds", kitJson.plant_ids.join(","))
            }
            const ordersRes = await fetch(`/api/integrations/cotizador/orders?${ordersParams}`)
            const ordersJson = ordersRes.ok ? await ordersRes.json() : { orders: [] }

            const dayAssets = [
              ...new Set(
                scheduled
                  .filter((wo) => wo.planned_date?.slice(0, 10) === dayKey)
                  .map((wo) => wo.asset_code)
                  .filter(Boolean),
              ),
            ] as string[]

            const remisionesByAsset = new Map<string, RemisionRow[]>()
            if (dayAssets.length > 0) {
              const remParams = new URLSearchParams({
                assetIds: dayAssets.join(","),
                from: dayKey,
                to: dayKey,
              })
              const remRes = await fetch(`/api/integrations/cotizador/remisiones?${remParams}`)
              const remJson = remRes.ok ? await remRes.json() : { remisiones_by_asset: {} }
              for (const [assetCode, rows] of Object.entries(
                remJson.remisiones_by_asset ?? {},
              )) {
                remisionesByAsset.set(assetCode, rows as RemisionRow[])
              }
            }

            contextMap.set(dayKey, {
              kitByWo,
              orders: ordersJson.orders ?? [],
              remisionesByAsset,
            })
          }),
        )
        setDayContext(contextMap)
      })
      .finally(() => setLoading(false))
  }, [from, to, technicianId, profile])

  useEffect(() => {
    loadAgenda()
  }, [loadAgenda])

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

  const handleStartWork = async (wo: AgendaWorkOrder) => {
    setStatusBusyId(wo.id)
    try {
      const res = await fetch(`/api/work-orders/${wo.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "En ejecución" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "No se pudo iniciar el trabajo")
      }
      toast({ title: "Trabajo iniciado", description: `OT ${wo.order_id} en ejecución.` })
      await loadAgenda()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo actualizar",
        variant: "destructive",
      })
    } finally {
      setStatusBusyId(null)
    }
  }

  const isCompleted = (status: string) => status === WorkOrderStatus.Completed
  const isInProgress = (status: string) =>
    status === "En ejecución" || status === "En Progreso"

  return (
    <div className="print:p-0 p-6 max-w-4xl mx-auto bg-white text-black min-h-screen">
      <div className="print:hidden mb-6 flex gap-2">
        <Button onClick={() => window.print()}>Imprimir</Button>
        <Button variant="outline" asChild>
          <Link href="/ordenes/agenda">Volver a agenda</Link>
        </Button>
      </div>

      <header className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold">Orden del día — Mantenimiento</h1>
        <p className="text-sm mt-1">
          Técnico: <strong>{technicianName}</strong>
        </p>
        <p className="text-sm">
          {from === to ? (
            <>Fecha: {format(parseISO(from), "d MMM yyyy", { locale: es })}</>
          ) : (
            <>
              Periodo: {format(parseISO(from), "d MMM yyyy", { locale: es })} –{" "}
              {format(parseISO(to), "d MMM yyyy", { locale: es })}
            </>
          )}
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
          {byDay.map(([dayKey, dayItems]) => {
            const ctx = dayContext.get(dayKey)
            return (
              <section key={dayKey}>
                <h2 className="text-lg font-semibold border-b border-gray-400 mb-3 capitalize">
                  {format(parseISO(dayKey), "EEEE d MMMM", { locale: es })}
                </h2>

                {ctx && ctx.orders.length > 0 && (
                  <div className="mb-4 text-xs border border-gray-300 rounded p-3">
                    <p className="font-semibold mb-2">Producción programada (planta)</p>
                    <ul className="space-y-1">
                      {ctx.orders.slice(0, 8).map((o, idx) => (
                        <li key={`${o.order_id}-${idx}`}>
                          #{o.order_number} · {o.delivery_time?.slice(0, 5) ?? "—"} ·{" "}
                          {o.client_name} ·{" "}
                          {o.is_pump_only
                            ? `Bombeo${o.pump_volume_planned != null ? ` ${o.pump_volume_planned} m³` : ""}`
                            : `${o.volume ?? "—"} m³`}
                          {o.has_pumping_service && !o.is_pump_only
                            ? ` · Bombeo${o.pump_volume_planned != null ? ` ${o.pump_volume_planned} m³` : ""}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300 text-left">
                      <th className="py-2 pr-2 w-20">OT</th>
                      <th className="py-2 pr-2 w-24">Unidad</th>
                      <th className="py-2 pr-2">Trabajo / Insumos</th>
                      <th className="py-2 pr-2 w-16">Prior.</th>
                      <th className="py-2 w-24 print:w-24">Hecho</th>
                      <th className="py-2 w-36 print:hidden">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayItems.map((wo) => {
                      const kit = ctx?.kitByWo.get(wo.id)
                      const remisiones = wo.asset_code
                        ? ctx?.remisionesByAsset.get(wo.asset_code) ?? []
                        : []
                      const done = isCompleted(wo.status)
                      const inProgress = isInProgress(wo.status)
                      return (
                        <tr
                          key={wo.id}
                          className={`border-b border-gray-200 align-top ${
                            done ? "bg-green-50/80 print:bg-transparent" : ""
                          }`}
                        >
                          <td className="py-3 pr-2 font-mono text-xs">{wo.order_id}</td>
                          <td className="py-3 pr-2">{wo.asset_code ?? wo.asset_name}</td>
                          <td className="py-3 pr-2">
                            <p>{wo.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {ORIGIN_LABELS[wo.origin]} ·{" "}
                              {done ? (
                                <span className="text-green-700 font-medium">Completada</span>
                              ) : inProgress ? (
                                <span className="text-amber-700 font-medium">En ejecución</span>
                              ) : (
                                wo.status
                              )}
                              {wo.hours_open != null && wo.origin === "incident"
                                ? ` · ${wo.hours_open}d abierto`
                                : ""}
                            </p>
                            {kit && kit.parts.length > 0 && (
                              <ul className="mt-2 text-xs text-gray-700 list-disc pl-4">
                                {kit.parts.map((p) => (
                                  <li key={`${p.part_id ?? p.part_number}-${p.name}`}>
                                    {p.quantity}× {p.name}
                                    {p.part_number ? ` (${p.part_number})` : ""}
                                    {p.sufficient === false ? " — faltante" : ""}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {remisiones.length > 0 && (
                              <p className="text-xs text-gray-600 mt-2">
                                Remisiones:{" "}
                                {remisiones
                                  .map(
                                    (r) =>
                                      `${r.remision_number} (${r.volumen_fabricado ?? "—"} m³)`,
                                  )
                                  .join(", ")}
                              </p>
                            )}
                          </td>
                          <td className="py-3 pr-2">{wo.priority ?? "—"}</td>
                          <td className="py-3">
                            {done ? (
                              <span className="text-green-700 text-xs font-semibold">✓ Hecho</span>
                            ) : (
                              <span className="inline-block w-5 h-5 border border-gray-400" />
                            )}
                          </td>
                          <td className="py-3 print:hidden">
                            {done ? (
                              <Link
                                href={`/ordenes/${wo.id}`}
                                className="text-[11px] text-primary hover:underline"
                              >
                                Ver OT
                              </Link>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {!isInProgress(wo.status) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    disabled={statusBusyId === wo.id}
                                    onClick={() => handleStartWork(wo)}
                                  >
                                    Iniciar
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setCompleteTarget(wo)}
                                >
                                  Completar
                                </Button>
                                <Link
                                  href={`/ordenes/${wo.id}/completar`}
                                  className="text-[11px] text-primary hover:underline"
                                >
                                  Formulario completo
                                </Link>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )
          })}
        </div>
      )}

      <footer className="mt-12 pt-4 border-t text-xs text-gray-500 print:mt-8">
        Firmas: Técnico _________________ Supervisor _________________
      </footer>

      <MechanicCompleteDialog
        open={!!completeTarget}
        onOpenChange={(open) => !open && setCompleteTarget(null)}
        workOrder={completeTarget}
        onCompleted={loadAgenda}
      />
    </div>
  )
}
