"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ChevronDown,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Activity,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

type OverviewTotals = {
  total_consumption: number
  total_entries: number
  total_transfer_consumption_liters: number
  consumption_transaction_count: number
}

type WarehouseRow = {
  warehouse_id: string
  warehouse_name: string
  plant_id: string
  plant_name: string
  consumption_liters: number
  entry_liters: number
  net_flow: number
}

type AssetRow = {
  warehouse_id: string
  warehouse_name: string
  plant_id: string
  plant_name: string
  asset_id: string | null
  asset_name: string | null
  asset_code: string | null
  exception_asset_name: string | null
  asset_category: string | null
  transaction_count: number
  total_consumption: number
  avg_consumption_per_transaction: number | null
  first_consumption: string
  last_consumption: string
  sum_hours_consumed: number | null
  sum_km_consumed: number | null
}

type MonthlyRow = {
  year_month: string
  total_liters: number
  transaction_count: number
  total_hours_consumed: number | null
  total_km_consumed: number | null
}

type TxRow = {
  id: string
  transaction_date: string
  quantity_liters: number
  horometer_reading: number | null
  kilometer_reading: number | null
  created_by_name: string
}

type ExceptionRow = {
  transaction_id: string
  transaction_date: string
  warehouse_id: string
  asset_id: string | null
  exception_asset_name: string | null
  quantity_liters: number
  codes: string[]
  reasons: string[]
}

function defaultDateRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 90)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function assetSlug(row: AssetRow): string {
  if (row.asset_id) return row.asset_id
  const name = row.exception_asset_name || "externo"
  return `external:${encodeURIComponent(name)}`
}

export function DieselAnalyticsDashboard() {
  const router = useRouter()
  const { from: defaultFrom, to: defaultTo } = useMemo(() => defaultDateRange(), [])
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")

  const [loadingOverview, setLoadingOverview] = useState(true)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [loadingExceptions, setLoadingExceptions] = useState(false)
  const [loadingExternal, setLoadingExternal] = useState(false)

  const [totals, setTotals] = useState<OverviewTotals | null>(null)
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([])
  const [externalItems, setExternalItems] = useState<
    Record<string, unknown>[]
  >([])

  const [expandedAssetKey, setExpandedAssetKey] = useState<string | null>(null)
  const [monthsByKey, setMonthsByKey] = useState<Record<string, MonthlyRow[]>>({})
  const [txByKey, setTxByKey] = useState<Record<string, TxRow[]>>({})
  const [loadingDrill, setLoadingDrill] = useState<string | null>(null)

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (dateFrom) p.set("dateFrom", dateFrom)
    if (dateTo) p.set("dateTo", dateTo)
    return p.toString()
  }, [dateFrom, dateTo])

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true)
    try {
      const res = await fetch(`/api/diesel/analytics/overview?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error")
      setTotals(json.totals)
      setWarehouses(json.warehouses || [])
    } catch {
      setTotals(null)
      setWarehouses([])
    } finally {
      setLoadingOverview(false)
    }
  }, [qs])

  const loadAssets = useCallback(async () => {
    setLoadingAssets(true)
    try {
      const p = new URLSearchParams(qs)
      if (warehouseFilter !== "all") p.set("warehouseId", warehouseFilter)
      const res = await fetch(`/api/diesel/analytics/assets?${p.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error")
      setAssets(json.assets || [])
    } catch {
      setAssets([])
    } finally {
      setLoadingAssets(false)
    }
  }, [qs, warehouseFilter])

  const loadExceptions = useCallback(async () => {
    setLoadingExceptions(true)
    try {
      const res = await fetch(`/api/diesel/analytics/exceptions?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error")
      setExceptions(json.exceptions || [])
    } catch {
      setExceptions([])
    } finally {
      setLoadingExceptions(false)
    }
  }, [qs])

  const loadExternal = useCallback(async () => {
    setLoadingExternal(true)
    try {
      const res = await fetch("/api/diesel/analytics/external-registry")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Error")
      setExternalItems(json.items || [])
    } catch {
      setExternalItems([])
    } finally {
      setLoadingExternal(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  useEffect(() => {
    loadExceptions()
  }, [loadExceptions])

  const loadDrillData = async (row: AssetRow, key: string) => {
    setLoadingDrill(key)
    try {
      if (!monthsByKey[key]) {
        const p = new URLSearchParams()
        p.set("warehouseId", row.warehouse_id)
        if (row.asset_id) p.set("assetId", row.asset_id)
        else if (row.exception_asset_name)
          p.set("exceptionName", row.exception_asset_name)

        const mRes = await fetch(`/api/diesel/analytics/monthly?${p.toString()}`)
        const mJson = await mRes.json()
        if (mRes.ok) {
          setMonthsByKey((prev) => ({ ...prev, [key]: mJson.months || [] }))
        }
      }

      if (!txByKey[key]) {
        const tParams = new URLSearchParams()
        tParams.set("warehouseId", row.warehouse_id)
        if (row.asset_id) tParams.set("assetId", row.asset_id)
        else if (row.exception_asset_name)
          tParams.set("exceptionName", row.exception_asset_name)
        tParams.set("dateFrom", dateFrom)
        tParams.set("dateTo", dateTo)
        tParams.set("pageSize", "25")

        const tRes = await fetch(`/api/diesel/analytics/transactions?${tParams.toString()}`)
        const tJson = await tRes.json()
        if (tRes.ok) {
          setTxByKey((prev) => ({ ...prev, [key]: tJson.transactions || [] }))
        }
      }
    } finally {
      setLoadingDrill(null)
    }
  }

  const onAssetCollapsibleChange = (row: AssetRow, key: string, open: boolean) => {
    if (open) {
      setExpandedAssetKey(key)
      void loadDrillData(row, key)
    } else {
      setExpandedAssetKey(null)
    }
  }

  const warehouseOptions = useMemo(() => {
    const m = new Map<string, string>()
    warehouses.forEach((w) => m.set(w.warehouse_id, w.warehouse_name))
    assets.forEach((a) => m.set(a.warehouse_id, a.warehouse_name))
    return Array.from(m.entries())
  }, [warehouses, assets])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={() => router.push("/diesel")}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Volver a diesel
        </Button>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Filtros
          </p>
          <p className="text-sm text-muted-foreground">
            Métricas agregadas en servidor (RLS). Definiciones en{" "}
            <code className="text-xs">docs/plans/diesel-analytics-spec.md</code>.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="daf">Desde</Label>
            <Input
              id="daf"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dat">Hasta</Label>
            <Input
              id="dat"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Almacén (tabla activos)</Label>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los almacenes</SelectItem>
                {warehouseOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button className="w-full" onClick={() => { loadOverview(); loadAssets(); loadExceptions(); }}>
              Aplicar
            </Button>
          </div>
        </div>
      </section>

      {loadingOverview ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardDescription>Consumo (periodo)</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {(totals?.total_consumption ?? 0).toLocaleString("es-MX", {
                  maximumFractionDigits: 1,
                })}{" "}
                L
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {totals?.consumption_transaction_count ?? 0} transacciones
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardDescription>Entradas (periodo)</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">
                {(totals?.total_entries ?? 0).toLocaleString("es-MX", {
                  maximumFractionDigits: 1,
                })}{" "}
                L
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardDescription>Transferencias (salida registrada)</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {(totals?.total_transfer_consumption_liters ?? 0).toLocaleString("es-MX", {
                  maximumFractionDigits: 1,
                })}{" "}
                L
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-2">
              <CardDescription>Almacenes con movimiento</CardDescription>
              <CardTitle className="text-2xl font-bold tabular-nums">
                {warehouses.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Tabs defaultValue="warehouses" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="warehouses">Por almacén</TabsTrigger>
          <TabsTrigger value="assets">Activos</TabsTrigger>
          <TabsTrigger value="exceptions">Excepciones</TabsTrigger>
          <TabsTrigger value="external" onClick={() => externalItems.length === 0 && loadExternal()}>
            Registro externos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses" className="space-y-4">
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Flujo por almacén</CardTitle>
              <CardDescription>Consumo, entradas y flujo neto en el periodo</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Almacén</TableHead>
                    <TableHead>Planta</TableHead>
                    <TableHead className="text-right tabular-nums">Consumo</TableHead>
                    <TableHead className="text-right tabular-nums">Entradas</TableHead>
                    <TableHead className="text-right tabular-nums">Neto</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses.map((w) => (
                    <TableRow key={w.warehouse_id}>
                      <TableCell className="font-medium">{w.warehouse_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{w.plant_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {w.consumption_liters.toFixed(1)} L
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-green-700 dark:text-green-400">
                        {w.entry_liters.toFixed(1)} L
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{w.net_flow.toFixed(1)} L</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/diesel/almacen/${w.warehouse_id}`}>Ver almacén</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {warehouses.length === 0 && !loadingOverview && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Sin datos en el periodo
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="space-y-4">
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Consumo por activo</CardTitle>
              <CardDescription>
                Expandir fila para ver serie mensual y transacciones. L/h y L/km cuando hay horas/km consumidos en el periodo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAssets ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {assets.map((row) => {
                    const key = `${row.warehouse_id}:${assetSlug(row)}`
                    const open = expandedAssetKey === key
                    const lph =
                      row.sum_hours_consumed && row.sum_hours_consumed > 0
                        ? row.total_consumption / row.sum_hours_consumed
                        : null
                    const lpkm =
                      row.sum_km_consumed && row.sum_km_consumed > 0
                        ? row.total_consumption / row.sum_km_consumed
                        : null
                    const label =
                      row.asset_name && row.asset_code
                        ? `${row.asset_name} (${row.asset_code})`
                        : row.exception_asset_name
                          ? `Externo: ${row.exception_asset_name}`
                          : "Sin nombre"

                    return (
                      <Collapsible
                        key={key}
                        open={open}
                        onOpenChange={(v) => onAssetCollapsibleChange(row, key, v)}
                      >
                        <div
                          className={cn(
                            "rounded-xl border border-border/60",
                            open && "bg-muted/20"
                          )}
                        >
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-muted/30 rounded-xl"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-sm truncate">{label}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {row.warehouse_name} · {row.plant_name}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                  <div className="text-sm font-semibold tabular-nums">
                                    {row.total_consumption.toFixed(1)} L
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {row.transaction_count} cargas
                                  </div>
                                </div>
                                {lph != null && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {lph.toFixed(2)} L/h
                                  </Badge>
                                )}
                                {lpkm != null && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    {lpkm.toFixed(2)} L/km
                                  </Badge>
                                )}
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 transition-transform",
                                    open && "rotate-180"
                                  )}
                                />
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t border-border/60 p-3 space-y-4">
                              {loadingDrill === key ? (
                                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                              ) : (
                                <>
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" asChild>
                                      <Link
                                        href={`/diesel/almacen/${row.warehouse_id}/equipo/${assetSlug(row)}`}
                                      >
                                        <Activity className="h-3.5 w-3.5 mr-1" />
                                        Historial del activo
                                      </Link>
                                    </Button>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                                      Por mes (todas las fechas en vista)
                                    </p>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Mes</TableHead>
                                          <TableHead className="text-right">Litros</TableHead>
                                          <TableHead className="text-right">Cargas</TableHead>
                                          <TableHead className="text-right">Σ horas</TableHead>
                                          <TableHead className="text-right">Σ km</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {(monthsByKey[key] || []).map((m) => (
                                          <TableRow key={m.year_month}>
                                            <TableCell className="font-mono text-sm">
                                              {m.year_month}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                              {Number(m.total_liters).toFixed(1)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              {m.transaction_count}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                              {m.total_hours_consumed != null
                                                ? Number(m.total_hours_consumed).toFixed(1)
                                                : "—"}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                              {m.total_km_consumed != null
                                                ? Number(m.total_km_consumed).toFixed(1)
                                                : "—"}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                                      Transacciones en el periodo filtrado
                                    </p>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Fecha</TableHead>
                                          <TableHead className="text-right">L</TableHead>
                                          <TableHead>Horómetro</TableHead>
                                          <TableHead>Km</TableHead>
                                          <TableHead>Usuario</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {(txByKey[key] || []).map((t) => (
                                          <TableRow key={t.id}>
                                            <TableCell className="text-xs whitespace-nowrap">
                                              {new Date(t.transaction_date).toLocaleString("es-MX")}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                              {t.quantity_liters.toFixed(1)}
                                            </TableCell>
                                            <TableCell className="tabular-nums text-xs">
                                              {t.horometer_reading ?? "—"}
                                            </TableCell>
                                            <TableCell className="tabular-nums text-xs">
                                              {t.kilometer_reading ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                              {t.created_by_name}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )
                  })}
                  {assets.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      Sin consumos en el periodo. Si acabas de aplicar la migración SQL, ejecuta{" "}
                      <code className="text-xs">supabase db push</code> o migra en el dashboard.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exceptions">
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Cola de excepciones (calidad de datos)
              </CardTitle>
              <CardDescription>
                Señales heurísticas sin GPS: horarios, duplicados cercanos, retroceso de lecturas, tasas extremas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingExceptions ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Códigos</TableHead>
                      <TableHead>Litros</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.map((ex) => (
                      <TableRow key={ex.transaction_id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(ex.transaction_date).toLocaleString("es-MX")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {ex.codes.map((c) => (
                              <Badge key={c} variant="outline" className="text-[10px]">
                                {c}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 max-w-md">
                            {ex.reasons.join(" ")}
                          </p>
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {ex.quantity_liters.toFixed(1)} L
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/diesel/almacen/${ex.warehouse_id}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {exceptions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No se detectaron excepciones en el periodo (o datos insuficientes).
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="external">
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Registro de equipos externos</CardTitle>
              <CardDescription>Vista exception_assets_review (mapeos y consumo acumulado)</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingExternal ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Litros</TableHead>
                      <TableHead className="text-right">Tx</TableHead>
                      <TableHead>Estado mapeo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {externalItems.map((it: Record<string, unknown>) => (
                      <TableRow key={String(it.id ?? it.exception_name)}>
                        <TableCell className="font-medium text-sm">
                          {String(it.exception_name ?? "")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {String(it.asset_type ?? "—")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(it.total_consumption_liters ?? 0).toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {String(it.total_transactions ?? "—")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {String(it.mapping_status ?? "—")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {externalItems.length === 0 && !loadingExternal && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Sin registros o sin permisos de lectura.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
