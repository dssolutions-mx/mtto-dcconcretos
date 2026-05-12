"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info, Loader2 } from "lucide-react"

export type WarehouseOpt = { id: string; name: string }

type AssetOption = {
  value: string
  label: string
  assetId: string | null
  exceptionName: string | null
}

type MonthlyRow = {
  year_month: string
  total_liters: number
  transaction_count: number
  total_hours_consumed: number | null
  total_km_consumed: number | null
}

type ValidationTx = {
  id: string
  transaction_date: string
  quantity_liters: number
  horometer_reading: number | null
  previous_horometer: number | null
  hours_consumed: number | null
  requires_validation: boolean | null
  validated_at: string | null
  validated_by_name: string | null
  notes: string | null
  validation_notes: string | null
  validation_difference: number | null
  created_by_name: string
}

type TrustedEffRow = {
  year_month: string
  total_liters: number
  hours_merged: number
  hours_sum_raw: number
  hours_trusted: number
  liters_per_hour_trusted: number | null
}

function defaultYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function parseAssetSelection(value: string): { assetId: string | null; exceptionName: string | null } {
  if (value.startsWith("asset:")) return { assetId: value.slice(6), exceptionName: null }
  if (value.startsWith("ext:")) return { assetId: null, exceptionName: decodeURIComponent(value.slice(4)) }
  return { assetId: null, exceptionName: null }
}

export function HorometerValidationTab({ warehouses }: { warehouses: WarehouseOpt[] }) {
  const [yearMonth, setYearMonth] = useState(defaultYearMonth)
  const [warehouseId, setWarehouseId] = useState<string>(warehouses[0]?.id ?? "")
  const [assetValue, setAssetValue] = useState<string>("")

  useEffect(() => {
    if (warehouses.length === 0) return
    queueMicrotask(() => {
      setWarehouseId((cur) => (cur && warehouses.some((w) => w.id === cur) ? cur : warehouses[0].id))
    })
  }, [warehouses])

  const monthBounds = useMemo(() => {
    const [ys, ms] = yearMonth.split("-")
    const y = Number(ys)
    const m = Number(ms)
    const from = new Date(y, m - 1, 1).toISOString().slice(0, 10)
    const to = new Date(y, m, 0).toISOString().slice(0, 10)
    return { from, to }
  }, [yearMonth])

  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [loadingRun, setLoadingRun] = useState(false)
  const [monthlyRow, setMonthlyRow] = useState<MonthlyRow | null>(null)
  const [trustedRow, setTrustedRow] = useState<TrustedEffRow | null>(null)
  const [transactions, setTransactions] = useState<ValidationTx[]>([])

  useEffect(() => {
    if (!warehouseId) return
    let cancelled = false
    ;(async () => {
      setLoadingAssets(true)
      try {
        const p = new URLSearchParams()
        p.set("warehouseId", warehouseId)
        p.set("dateFrom", monthBounds.from)
        p.set("dateTo", monthBounds.to)
        const res = await fetch(`/api/diesel/analytics/assets?${p.toString()}`)
        const j = await res.json()
        if (!res.ok || cancelled) return
        const rows = (j.assets || []) as {
          asset_id: string | null
          asset_name: string | null
          asset_code: string | null
          exception_asset_name: string | null
        }[]
        const opts: AssetOption[] = []
        for (const r of rows) {
          if (r.asset_id) {
            const label =
              r.asset_name && r.asset_code
                ? `${r.asset_name} (${r.asset_code})`
                : r.asset_name || r.asset_code || r.asset_id
            opts.push({
              value: `asset:${r.asset_id}`,
              label,
              assetId: r.asset_id,
              exceptionName: null,
            })
          } else if (r.exception_asset_name) {
            const name = r.exception_asset_name
            opts.push({
              value: `ext:${encodeURIComponent(name)}`,
              label: `Externo: ${name}`,
              assetId: null,
              exceptionName: name,
            })
          }
        }
        setAssetOptions(opts)
        setAssetValue((cur) => {
          if (cur && opts.some((o) => o.value === cur)) return cur
          return opts[0]?.value ?? ""
        })
      } finally {
        if (!cancelled) setLoadingAssets(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [warehouseId, monthBounds.from, monthBounds.to])

  const runLoad = useCallback(async () => {
    if (!warehouseId || !assetValue) return
    const { assetId, exceptionName } = parseAssetSelection(assetValue)
    if (!assetId && !exceptionName) return

    setLoadingRun(true)
    try {
      const mParams = new URLSearchParams()
      mParams.set("warehouseId", warehouseId)
      mParams.set("yearMonthFrom", yearMonth)
      mParams.set("yearMonthTo", yearMonth)
      if (assetId) mParams.set("assetId", assetId)
      else if (exceptionName) mParams.set("exceptionName", exceptionName)

      const tParams = new URLSearchParams()
      tParams.set("warehouseId", warehouseId)
      if (assetId) tParams.set("assetId", assetId)
      else if (exceptionName) tParams.set("exceptionName", exceptionName)
      tParams.set("yearMonth", yearMonth)
      tParams.set("pageSize", "100")

      const [mRes, tRes] = await Promise.all([
        fetch(`/api/diesel/analytics/monthly?${mParams.toString()}`),
        fetch(`/api/diesel/analytics/transactions?${tParams.toString()}`),
      ])

      const mJson = await mRes.json()
      if (mRes.ok) {
        const months = (mJson.months || []) as MonthlyRow[]
        setMonthlyRow(months.find((x) => x.year_month === yearMonth) ?? months[0] ?? null)
      } else {
        setMonthlyRow(null)
      }

      const tJson = await tRes.json()
      if (tRes.ok) setTransactions(tJson.transactions || [])
      else setTransactions([])

      if (assetId) {
        const trRes = await fetch(
          `/api/reports/asset-diesel-efficiency?yearMonth=${encodeURIComponent(yearMonth)}&assetId=${encodeURIComponent(assetId)}`
        )
        const trJson = await trRes.json()
        if (trRes.ok) {
          const rows = (trJson.rows || []) as TrustedEffRow[]
          setTrustedRow(rows[0] ?? null)
        } else setTrustedRow(null)
      } else {
        setTrustedRow(null)
      }
    } finally {
      setLoadingRun(false)
    }
  }, [warehouseId, assetValue, yearMonth])

  return (
    <div className="space-y-4">
      <Alert className="rounded-2xl border-border/60">
        <Info className="h-4 w-4" />
        <AlertTitle>Metodología (resumen)</AlertTitle>
        <AlertDescription className="text-sm space-y-2 mt-1">
          <p>
            Las <strong>horas consumidas</strong> por transacción vienen de la cadena de lecturas en{" "}
            <code className="text-xs">diesel_transactions</code> (lectura actual menos anterior). La
            vista <code className="text-xs">diesel_monthly_consumption_by_asset</code> resume{" "}
            <strong>Σ horas</strong> en el mes calendario (zona México).
          </p>
          <p>
            El reporte ejecutivo de eficiencia usa además <strong>horas fusionadas</strong> (diesel +
            checklist, política merged-first) en{" "}
            <code className="text-xs">asset_diesel_efficiency_monthly</code>; por eso los L/h
            &quot;trusted&quot; pueden diferir del cociente litros / Σ horas de esta pestaña.
          </p>
          <p>
            Las columnas de <strong>validación</strong> reflejan revisión manual opcional en
            transacciones (requiere validación, quién validó, notas).
          </p>
        </AlertDescription>
      </Alert>

      <Card className="rounded-2xl border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Filtros</CardTitle>
          <CardDescription>Mes calendario, almacén y activo (o equipo externo).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Mes (YYYY-MM)</Label>
            <Select value={yearMonth} onValueChange={setYearMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((ym) => (
                  <SelectItem key={ym} value={ym}>
                    {ym}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Almacén</Label>
            <Select
              value={warehouseId || undefined}
              onValueChange={(v) => {
                setWarehouseId(v)
                setAssetValue("")
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elegir almacén" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Activo</Label>
            <Select value={assetValue || undefined} onValueChange={setAssetValue} disabled={loadingAssets}>
              <SelectTrigger>
                <SelectValue placeholder={loadingAssets ? "Cargando…" : "Elegir activo"} />
              </SelectTrigger>
              <SelectContent>
                {assetOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <Button onClick={() => void runLoad()} disabled={!warehouseId || !assetValue || loadingRun}>
              {loadingRun ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Cargar resumen y transacciones
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Resumen SQL (mes)</CardTitle>
            <CardDescription>
              <code className="text-xs">diesel_monthly_consumption_by_asset</code> · {yearMonth}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!monthlyRow ? (
              <p className="text-sm text-muted-foreground">Pulse &quot;Cargar&quot; para ver datos.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Litros</dt>
                <dd className="font-mono text-right">{Number(monthlyRow.total_liters).toFixed(1)}</dd>
                <dt className="text-muted-foreground">Cargas</dt>
                <dd className="font-mono text-right">{monthlyRow.transaction_count}</dd>
                <dt className="text-muted-foreground">Σ horas</dt>
                <dd className="font-mono text-right">
                  {monthlyRow.total_hours_consumed != null
                    ? Number(monthlyRow.total_hours_consumed).toFixed(2)
                    : "—"}
                </dd>
                <dt className="text-muted-foreground">Σ km</dt>
                <dd className="font-mono text-right">
                  {monthlyRow.total_km_consumed != null
                    ? Number(monthlyRow.total_km_consumed).toFixed(2)
                    : "—"}
                </dd>
                <dt className="text-muted-foreground">L/h (ΣL/Σh)</dt>
                <dd className="font-mono text-right">
                  {monthlyRow.total_hours_consumed && Number(monthlyRow.total_hours_consumed) > 0
                    ? (Number(monthlyRow.total_liters) / Number(monthlyRow.total_hours_consumed)).toFixed(3)
                    : "—"}
                </dd>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Eficiencia materializada (trusted)</CardTitle>
            <CardDescription>
              Solo activos mapeados. <code className="text-xs">asset_diesel_efficiency_monthly</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!parseAssetSelection(assetValue).assetId ? (
              <p className="text-sm text-muted-foreground">
                Seleccione un activo interno (no externo) para ver la fila trusted.
              </p>
            ) : !trustedRow ? (
              <p className="text-sm text-muted-foreground">
                Sin fila para este mes o aún no calculada. Vea{" "}
                <code className="text-xs">/reportes/eficiencia-diesel</code>.
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Horas merged</dt>
                <dd className="font-mono text-right">{Number(trustedRow.hours_merged).toFixed(2)}</dd>
                <dt className="text-muted-foreground">Horas Σ raw</dt>
                <dd className="font-mono text-right">{Number(trustedRow.hours_sum_raw).toFixed(2)}</dd>
                <dt className="text-muted-foreground">Horas trusted</dt>
                <dd className="font-mono text-right">{Number(trustedRow.hours_trusted).toFixed(2)}</dd>
                <dt className="text-muted-foreground">L/h trusted</dt>
                <dd className="font-mono text-right">
                  {trustedRow.liters_per_hour_trusted != null
                    ? Number(trustedRow.liters_per_hour_trusted).toFixed(3)
                    : "—"}
                </dd>
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Transacciones del mes</CardTitle>
          <CardDescription>
            Validación manual, notas de operación y deltas de horómetro en el periodo.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loadingRun && transactions.length === 0 ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">L</TableHead>
                  <TableHead className="text-right">Prev h</TableHead>
                  <TableHead className="text-right">Lectura h</TableHead>
                  <TableHead className="text-right">Δ h</TableHead>
                  <TableHead>Validación</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(t.transaction_date).toLocaleString("es-MX")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {Number(t.quantity_liters).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {t.previous_horometer ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {t.horometer_reading ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {t.hours_consumed != null ? Number(t.hours_consumed).toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {t.requires_validation ? (
                          <Badge variant="outline" className="text-[10px]">
                            requiere
                          </Badge>
                        ) : null}
                        {t.validated_at ? (
                          <Badge variant="secondary" className="text-[10px]">
                            validado
                          </Badge>
                        ) : null}
                      </div>
                      {t.validated_by_name ? (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{t.validated_by_name}</p>
                      ) : null}
                      {t.validation_difference != null ? (
                        <p className="text-[10px] text-muted-foreground">
                          Δ val: {Number(t.validation_difference).toFixed(2)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px]">
                      <span className="line-clamp-3 text-muted-foreground">
                        {[t.notes, t.validation_notes].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.created_by_name}</TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 && !loadingRun && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">
                      Sin transacciones o pulse &quot;Cargar&quot;.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
