"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle, CheckCircle2, Package, Printer, Truck } from "lucide-react"
import type { CotizadorOrderItemRow } from "@/lib/agenda/cotizador-orders"
import type { ConsolidatedKitLine } from "@/lib/agenda/aggregate-daily-kit"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type DailyKitResponse = {
  kit: ConsolidatedKitLine[]
  summary: {
    total_parts: number
    insufficient: number
    unknown: number
    sufficient: number
  }
  plant_ids: string[]
}

type OrdersResponse = {
  orders: CotizadorOrderItemRow[]
  configured: boolean
  error?: string
}

interface AgendaDayDetailPanelProps {
  date: string
  technicianId?: string
  onPrint?: () => void
  className?: string
}

function StockBadge({ sufficient }: { sufficient: boolean | null }) {
  if (sufficient === true) {
    return (
      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        OK
      </Badge>
    )
  }
  if (sufficient === false) {
    return (
      <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Falta
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-xs">
      Sin catálogo
    </Badge>
  )
}

export function AgendaDayDetailPanel({
  date,
  technicianId,
  onPrint,
  className,
}: AgendaDayDetailPanelProps) {
  const [kitData, setKitData] = useState<DailyKitResponse | null>(null)
  const [ordersData, setOrdersData] = useState<OrdersResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const kitParams = new URLSearchParams({ date })
      if (technicianId && technicianId !== "all") {
        kitParams.set("technicianId", technicianId)
      }

      const kitRes = await fetch(`/api/work-orders/agenda/daily-kit?${kitParams}`)
      const kitJson: DailyKitResponse | null = kitRes.ok ? await kitRes.json() : null
      setKitData(kitJson)

      const ordersParams = new URLSearchParams({ from: date, to: date })
      if (kitJson?.plant_ids?.length) {
        ordersParams.set("plantIds", kitJson.plant_ids.join(","))
      }

      const ordersRes = await fetch(`/api/integrations/cotizador/orders?${ordersParams}`)
      if (ordersRes.ok) {
        setOrdersData(await ordersRes.json())
      } else {
        const body = (await ordersRes.json().catch(() => null)) as { error?: string } | null
        setOrdersData({
          orders: [],
          configured: true,
          error: body?.error ?? `Error al cargar pedidos (${ordersRes.status})`,
        })
      }
    } catch {
      setKitData(null)
      setOrdersData(null)
    } finally {
      setLoading(false)
    }
  }, [date, technicianId])

  useEffect(() => {
    load()
  }, [load])

  const dayLabel = useMemo(
    () => format(parseISO(date), "EEEE d MMMM yyyy", { locale: es }),
    [date],
  )

  const handlePrint = () => {
    if (onPrint) {
      onPrint()
      return
    }
    window.print()
  }

  return (
    <Card className={cn("print:shadow-none print:border-0", className)} id="agenda-day-detail">
      <CardHeader className="flex flex-row items-start justify-between gap-4 print:pb-2">
        <div>
          <CardTitle className="text-base capitalize">{dayLabel}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Planeación diaria — insumos y producción programada
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir kit del día
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading ? (
          <div className="h-40 rounded-lg bg-muted animate-pulse" />
        ) : (
          <>
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4" />
                <h3 className="font-semibold text-sm">Kit de insumos del día</h3>
                {kitData?.summary && (
                  <span className="text-xs text-muted-foreground">
                    {kitData.summary.total_parts} partes · {kitData.summary.insufficient} faltantes
                  </span>
                )}
              </div>

              {!kitData?.kit?.length ? (
                <p className="text-sm text-muted-foreground">Sin repuestos programados para este día.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parte</TableHead>
                      <TableHead className="w-20 text-right">Cant.</TableHead>
                      <TableHead className="w-24 text-right">Stock</TableHead>
                      <TableHead className="w-24">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kitData.kit.map((line) => (
                      <TableRow key={line.key}>
                        <TableCell>
                          <p className="font-medium text-sm">{line.name}</p>
                          {line.part_number && (
                            <p className="text-xs text-muted-foreground">{line.part_number}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{line.required_quantity}</TableCell>
                        <TableCell className="text-right">
                          {line.total_available != null ? line.total_available : "—"}
                        </TableCell>
                        <TableCell>
                          <StockBadge sufficient={line.sufficient} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <Truck className="h-4 w-4" />
                <h3 className="font-semibold text-sm">Producción del día</h3>
                <span className="text-xs text-muted-foreground">
                  Pedidos Cotizador (plantas de activos en agenda)
                </span>
              </div>

              {ordersData?.error ? (
                <p className="text-sm text-destructive">
                  No se pudo cargar producción Cotizador: {ordersData.error}
                </p>
              ) : ordersData?.configured === false ? (
                <p className="text-sm text-muted-foreground">
                  Integración Cotizador no configurada en este entorno.
                </p>
              ) : !ordersData?.orders?.length ? (
                <p className="text-sm text-muted-foreground">
                  Sin pedidos de concreto programados para las plantas de la agenda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Cliente / Obra</TableHead>
                      <TableHead>Planta</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Vol.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersData.orders.map((row, idx) => (
                      <TableRow key={`${row.order_id}-${row.product_type}-${idx}`}>
                        <TableCell className="font-mono text-xs">{row.order_number}</TableCell>
                        <TableCell>{row.delivery_time?.slice(0, 5) ?? "—"}</TableCell>
                        <TableCell>
                          <p className="text-sm">{row.client_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{row.construction_site}</p>
                        </TableCell>
                        <TableCell className="text-sm">{row.plant_name ?? row.plant_id}</TableCell>
                        <TableCell className="text-sm">{row.product_type}</TableCell>
                        <TableCell className="text-right">{row.volume ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}
