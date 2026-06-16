"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
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
import { Badge } from "@/components/ui/badge"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { CreateTireDialog } from "@/components/tires/create-tire-dialog"
import { ArrowLeft, Loader2, Plus, RefreshCw } from "lucide-react"
import type { Tire, TireCostReportRow } from "@/types/tires"

const STATUS_LABELS: Record<string, string> = {
  en_almacen: "En almacén",
  montada: "Montada",
  baja: "Baja",
}

export default function TiresInventoryPage() {
  const [loading, setLoading] = useState(true)
  const [tires, setTires] = useState<Tire[]>([])
  const [report, setReport] = useState<TireCostReportRow[]>([])
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tiresRes, reportRes] = await Promise.all([
        fetch("/api/tires"),
        fetch("/api/tires/report"),
      ])
      const tiresData = await tiresRes.json()
      const reportData = await reportRes.json()
      if (tiresRes.ok) setTires(tiresData.tires ?? [])
      if (reportRes.ok) setReport(reportData.report ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Inventario de llantas"
        text="Catálogo global, estado y reporte básico de costo por desgaste."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/activos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Activos
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar llanta
          </Button>
        </div>
      </DashboardHeader>

      {loading && tires.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Catálogo ({tires.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marca / Medida</TableHead>
                    <TableHead>DOT</TableHead>
                    <TableHead>Condición</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Costo compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tires.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay llantas registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tires.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          {t.brand} {t.size}
                          {t.model ? ` · ${t.model}` : ""}
                        </TableCell>
                        <TableCell>{t.serial_number ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.condition}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              t.status === "montada"
                                ? "default"
                                : t.status === "baja"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {STATUS_LABELS[t.status] ?? t.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {t.purchase_cost != null
                            ? `$${t.purchase_cost.toLocaleString("es-MX")}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reporte de costo y desgaste</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Llanta</TableHead>
                    <TableHead>Activo actual</TableHead>
                    <TableHead>Banda (mm)</TableHead>
                    <TableHead>Km recorridos</TableHead>
                    <TableHead>Costo total</TableHead>
                    <TableHead>$/km</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Sin datos para el reporte.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.map((row) => (
                      <TableRow key={row.tire_id}>
                        <TableCell>
                          {row.brand} {row.size}
                          {row.serial_number ? ` (${row.serial_number})` : ""}
                        </TableCell>
                        <TableCell>{row.asset_name ?? "—"}</TableCell>
                        <TableCell>{row.current_tread_mm ?? "—"}</TableCell>
                        <TableCell>
                          {row.km_traveled != null ? row.km_traveled.toFixed(0) : "—"}
                        </TableCell>
                        <TableCell>${row.total_cost.toLocaleString("es-MX")}</TableCell>
                        <TableCell>
                          {row.cost_per_km != null
                            ? `$${row.cost_per_km.toFixed(2)}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <CreateTireDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
    </DashboardShell>
  )
}
