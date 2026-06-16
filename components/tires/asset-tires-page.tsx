"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { MountTireDialog } from "@/components/tires/mount-tire-dialog"
import { TireReadingDialog } from "@/components/tires/tire-reading-dialog"
import { TirePositionMap } from "@/components/tires/tire-position-map"
import { ArrowLeft, CircleDot, Loader2, Plus, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { AssetTireInstallation, TireEvent } from "@/types/tires"

interface AssetTiresPageProps {
  assetId: string
  assetName?: string
}

export function AssetTiresPageClient({ assetId, assetName }: AssetTiresPageProps) {
  const searchParams = useSearchParams()
  const workOrderId = searchParams.get("workOrderId")
  const [loading, setLoading] = useState(true)
  const [installations, setInstallations] = useState<AssetTireInstallation[]>([])
  const [events, setEvents] = useState<TireEvent[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [mountOpen, setMountOpen] = useState(false)
  const [readingInst, setReadingInst] = useState<AssetTireInstallation | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/assets/${assetId}/tires`)
      const data = await res.json()
      if (res.ok) {
        setInstallations(data.installations ?? [])
        setEvents(data.events ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [assetId])

  useEffect(() => {
    load()
  }, [load])

  const active = installations.filter((i) => !i.removed_at)
  const history = installations.filter((i) => i.removed_at)
  const occupied = active.map((i) => i.position_code)

  const handleUnmount = async (installationId: string, retire = false) => {
    if (!confirm(retire ? "¿Dar de baja esta llanta?" : "¿Desmontar esta llanta?")) return
    const res = await fetch(`/api/assets/${assetId}/tires`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unmount",
        installation_id: installationId,
        retire_tire: retire,
        work_order_id: workOrderId ?? undefined,
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error || "Error")
      return
    }
    load()
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={assetName ? `Llantas — ${assetName}` : "Llantas del activo"}
        text={
          workOrderId
            ? `Vinculado a OT ${workOrderId.slice(0, 8)}… — montajes y eventos se registrarán en la orden.`
            : "Mapa de posiciones, lecturas de banda/presión e historial de montajes."
        }
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/activos/${assetId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al activo
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva llanta
          </Button>
          <Button size="sm" onClick={() => setMountOpen(true)}>
            <CircleDot className="mr-2 h-4 w-4" />
            Montar llanta
          </Button>
        </div>
      </DashboardHeader>

      {loading && installations.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="layout" className="space-y-4">
          <TabsList>
            <TabsTrigger value="layout">Mapa de posiciones</TabsTrigger>
            <TabsTrigger value="active">Montadas ({active.length})</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="events">Eventos</TabsTrigger>
          </TabsList>

          <TabsContent value="layout">
            <Card>
              <CardHeader>
                <CardTitle>Distribución en el vehículo</CardTitle>
                <CardDescription>
                  Posiciones estándar (6 ruedas / 3 ejes). Las celdas en ámbar indican alerta de banda o presión.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TirePositionMap activeInstallations={active} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <CardTitle>Llantas montadas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posición</TableHead>
                      <TableHead>Llanta</TableHead>
                      <TableHead>Última lectura</TableHead>
                      <TableHead>Montaje</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay llantas montadas.
                        </TableCell>
                      </TableRow>
                    ) : (
                      active.map((inst) => (
                        <TableRow key={inst.id}>
                          <TableCell>{inst.position_label}</TableCell>
                          <TableCell>
                            {inst.tire
                              ? `${inst.tire.brand} ${inst.tire.size}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {inst.latest_reading ? (
                              <span>
                                {inst.latest_reading.tread_depth_mm ?? "—"} mm /{" "}
                                {inst.latest_reading.pressure_psi ?? "—"} psi
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Sin lectura</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(inst.installed_at), "dd MMM yyyy", { locale: es })}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReadingInst(inst)}
                            >
                              Lectura
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnmount(inst.id)}
                            >
                              Desmontar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleUnmount(inst.id, true)}
                            >
                              Baja
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historial de montajes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posición</TableHead>
                      <TableHead>Llanta</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Km</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Sin historial de desmontajes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((inst) => {
                        const km =
                          inst.km_at_install != null && inst.km_at_remove != null
                            ? inst.km_at_remove - inst.km_at_install
                            : null
                        return (
                          <TableRow key={inst.id}>
                            <TableCell>{inst.position_label}</TableCell>
                            <TableCell>
                              {inst.tire ? `${inst.tire.brand} ${inst.tire.size}` : "—"}
                            </TableCell>
                            <TableCell>
                              {format(new Date(inst.installed_at), "dd/MM/yy", { locale: es })}
                              {" — "}
                              {inst.removed_at
                                ? format(new Date(inst.removed_at), "dd/MM/yy", { locale: es })
                                : "—"}
                            </TableCell>
                            <TableCell>{km != null ? `${km.toFixed(0)} km` : "—"}</TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Eventos recientes</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Sin eventos registrados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      events.map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell>
                            {format(new Date(ev.event_at), "dd MMM yyyy HH:mm", { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{ev.event_type}</Badge>
                          </TableCell>
                          <TableCell>{ev.notes ?? "—"}</TableCell>
                          <TableCell>
                            {ev.cost != null ? `$${ev.cost.toLocaleString("es-MX")}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <CreateTireDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <MountTireDialog
        open={mountOpen}
        onOpenChange={setMountOpen}
        assetId={assetId}
        workOrderId={workOrderId}
        occupiedPositions={occupied}
        onMounted={load}
      />
      {readingInst && readingInst.tire && (
        <TireReadingDialog
          open={!!readingInst}
          onOpenChange={(o) => !o && setReadingInst(null)}
          assetId={assetId}
          installationId={readingInst.id}
          positionLabel={readingInst.position_label}
          minTreadMm={readingInst.tire.min_tread_mm}
          onSaved={load}
        />
      )}
    </DashboardShell>
  )
}
