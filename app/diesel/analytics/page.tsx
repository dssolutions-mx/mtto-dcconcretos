"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  TrendingUp,
  Calendar,
  Fuel,
  ChevronLeft,
  Loader2,
  Download
} from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface AssetConsumption {
  asset_id: string | null
  asset_name: string
  total_liters: number
  transaction_count: number
  avg_per_transaction: number
  last_consumption: string
}

interface WarehouseConsumption {
  warehouse_id: string
  warehouse_name: string
  total_consumption: number
  total_entries: number
  net_flow: number
}

export default function DieselAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [assetConsumptions, setAssetConsumptions] = useState<AssetConsumption[]>([])
  const [warehouseStats, setWarehouseStats] = useState<WarehouseConsumption[]>([])
  
  // Filters
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  
  // Summary stats
  const [totalConsumption, setTotalConsumption] = useState(0)
  const [totalEntries, setTotalEntries] = useState(0)
  const [uniqueAssets, setUniqueAssets] = useState(0)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    loadAnalytics()
  }, [dateFrom, dateTo])

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      // Build date filter
      let consumptionQuery = supabase
        .from('diesel_transactions')
        .select('*')
        .eq('transaction_type', 'consumption')

      let entryQuery = supabase
        .from('diesel_transactions')
        .select('*')
        .eq('transaction_type', 'entry')

      if (dateFrom) {
        consumptionQuery = consumptionQuery.gte('transaction_date', dateFrom)
        entryQuery = entryQuery.gte('transaction_date', dateFrom)
      }
      if (dateTo) {
        consumptionQuery = consumptionQuery.lte('transaction_date', dateTo + 'T23:59:59')
        entryQuery = entryQuery.lte('transaction_date', dateTo + 'T23:59:59')
      }

      // Get consumptions
      const { data: consumptions, error: consumptionsError } = await consumptionQuery

      // Get entries
      const { data: entries, error: entriesError } = await entryQuery

      if (consumptionsError || entriesError) {
        console.error('Error loading analytics:', consumptionsError || entriesError)
        return
      }

      // Calculate asset consumption stats
      const assetMap = new Map<string, any>()
      
      for (const c of (consumptions || [])) {
        const key = c.asset_id || 'external'
        const existing = assetMap.get(key) || {
          asset_id: c.asset_id,
          asset_name: c.asset_id ? 'Loading...' : 'Equipos Externos',
          total_liters: 0,
          transaction_count: 0,
          last_consumption: c.transaction_date
        }

        existing.total_liters += parseFloat(c.quantity_liters)
        existing.transaction_count += 1
        if (new Date(c.transaction_date) > new Date(existing.last_consumption)) {
          existing.last_consumption = c.transaction_date
        }

        assetMap.set(key, existing)
      }

      // Fetch asset names
      const assetIds = Array.from(assetMap.keys()).filter(id => id !== 'external')
      if (assetIds.length > 0) {
        const { data: assets } = await supabase
          .from('assets')
          .select('id, asset_id, name')
          .in('id', assetIds)

        if (assets) {
          assets.forEach(asset => {
            const stats = assetMap.get(asset.id)
            if (stats) {
              stats.asset_name = `${asset.name} (${asset.asset_id})`
            }
          })
        }
      }

      const assetStats = Array.from(assetMap.values()).map(a => ({
        ...a,
        avg_per_transaction: a.total_liters / a.transaction_count
      }))

      assetStats.sort((a, b) => b.total_liters - a.total_liters)
      setAssetConsumptions(assetStats)

      // Calculate warehouse stats
      const warehouseMap = new Map<string, any>()

      for (const c of (consumptions || [])) {
        const key = c.warehouse_id
        const existing = warehouseMap.get(key) || {
          warehouse_id: key,
          warehouse_name: 'Loading...',
          total_consumption: 0,
          total_entries: 0
        }

        existing.total_consumption += parseFloat(c.quantity_liters)
        warehouseMap.set(key, existing)
      }

      for (const e of (entries || [])) {
        const key = e.warehouse_id
        const existing = warehouseMap.get(key) || {
          warehouse_id: key,
          warehouse_name: 'Loading...',
          total_consumption: 0,
          total_entries: 0
        }

        existing.total_entries += parseFloat(e.quantity_liters)
        warehouseMap.set(key, existing)
      }

      // Fetch warehouse names
      const warehouseIds = Array.from(warehouseMap.keys())
      if (warehouseIds.length > 0) {
        const { data: warehouses } = await supabase
          .from('diesel_warehouses')
          .select('id, name')
          .in('id', warehouseIds)

        if (warehouses) {
          warehouses.forEach(warehouse => {
            const stats = warehouseMap.get(warehouse.id)
            if (stats) {
              stats.warehouse_name = warehouse.name
            }
          })
        }
      }

      const warehouseStatsArray = Array.from(warehouseMap.values()).map(w => ({
        ...w,
        net_flow: w.total_entries - w.total_consumption
      }))

      warehouseStatsArray.sort((a, b) => b.total_consumption - a.total_consumption)
      setWarehouseStats(warehouseStatsArray)

      // Calculate totals
      const totalCons = consumptions?.reduce((sum, c) => sum + parseFloat(c.quantity_liters), 0) || 0
      const totalEnt = entries?.reduce((sum, e) => sum + parseFloat(e.quantity_liters), 0) || 0
      const uniqueAst = new Set(consumptions?.map(c => c.asset_id).filter(Boolean)).size

      setTotalConsumption(totalCons)
      setTotalEntries(totalEnt)
      setUniqueAssets(uniqueAst)
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Analíticas de Diesel
          </h1>
          <p className="text-muted-foreground mt-1">
            Consumos por equipo y estadísticas de almacenes
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/diesel">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Volver
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Periodo de Análisis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("")
                setDateTo("")
              }}
              className="mt-2"
            >
              Limpiar filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Consumo Total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {totalConsumption.toFixed(1)}L
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Entradas Totales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {totalEntries.toFixed(1)}L
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Equipos Activos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {uniqueAssets}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Asset Consumption Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Consumo por Equipo
          </CardTitle>
          <CardDescription>
            Equipos ordenados por consumo total de diesel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assetConsumptions.map((asset, index) => (
              <div
                key={asset.asset_id || 'external'}
                className="flex items-center gap-4 p-4 rounded-lg border"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold">
                  #{index + 1}
                </div>

                <div className="flex-1">
                  <div className="font-semibold">{asset.asset_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {asset.transaction_count} {asset.transaction_count === 1 ? 'consumo' : 'consumos'}
                    {' • '}
                    Promedio: {asset.avg_per_transaction.toFixed(1)}L por consumo
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Último consumo: {new Date(asset.last_consumption).toLocaleDateString('es-MX')}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-red-600">
                    {asset.total_liters.toFixed(1)}L
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total consumido
                  </div>
                </div>
              </div>
            ))}

            {assetConsumptions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay datos de consumo para el periodo seleccionado
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Warehouse Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Estadísticas por Almacén
          </CardTitle>
          <CardDescription>
            Flujo de diesel por almacén (entradas vs consumos)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {warehouseStats.map((warehouse) => (
              <div
                key={warehouse.warehouse_id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex-1">
                  <div className="font-semibold">{warehouse.warehouse_name}</div>
                  <div className="text-sm text-muted-foreground space-x-4">
                    <span className="text-green-600">
                      ↑ {warehouse.total_entries.toFixed(1)}L entradas
                    </span>
                    <span className="text-red-600">
                      ↓ {warehouse.total_consumption.toFixed(1)}L consumos
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <Badge
                    variant={warehouse.net_flow >= 0 ? "default" : "destructive"}
                    className="text-lg px-3 py-1"
                  >
                    {warehouse.net_flow >= 0 ? '+' : ''}
                    {warehouse.net_flow.toFixed(1)}L
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    Flujo neto
                  </div>
                </div>
              </div>
            ))}

            {warehouseStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay datos de almacenes para el periodo seleccionado
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

