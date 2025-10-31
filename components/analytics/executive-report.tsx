"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Download, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Clock,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Factory,
  ExternalLink,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Receipt
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts"

type BusinessUnit = {
  id: string
  name: string
  code: string
}

type Plant = {
  id: string
  name: string
  code: string
  business_unit_id: string
  business_unit_name?: string
}

type AssetMetric = {
  id: string
  asset_code: string
  asset_name: string
  model_name: string
  model_manufacturer: string
  model_category: string
  plant_name: string
  business_unit_name: string
  total_cost: number
  purchase_orders_cost: number
  service_orders_cost: number
  labor_cost: number
  parts_cost: number
  additional_expenses: number
  hours_worked: number
  preventive_cost: number
  corrective_cost: number
}

type ExecutiveData = {
  summary: {
    totalCost: number
    purchaseOrdersCost: number
    serviceOrdersCost: number
    laborCost: number
    partsCost: number
    additionalExpenses: number
    totalHours: number
    assetCount: number
    preventiveCost: number
    correctiveCost: number
  }
  businessUnits: Array<{
    id: string
    name: string
    total_cost: number
    purchase_orders_cost: number
    service_orders_cost: number
    labor_cost: number
    parts_cost: number
    additional_expenses: number
    hours_worked: number
    preventive_cost: number
    corrective_cost: number
    asset_count: number
  }>
  plants: Array<{
    id: string
    name: string
    business_unit_name: string
    total_cost: number
    purchase_orders_cost: number
    service_orders_cost: number
    labor_cost: number
    parts_cost: number
    additional_expenses: number
    hours_worked: number
    preventive_cost: number
    corrective_cost: number
    asset_count: number
  }>
  assets: {
    data: AssetMetric[]
    total: number
    page: number
    pageSize: number
  }
  filters: {
    businessUnits: BusinessUnit[]
    plants: Plant[]
  }
  unlinkedAdditionalExpenses?: Array<{
    id: string
    amount: number
    created_at: string
    description?: string
    status?: string
    work_order_id?: string
    asset_id?: string
  }>
  error?: string
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('es-MX').format(num)
}

export function ExecutiveReport() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 3)
    return date.toISOString().split('T')[0]
  })
  
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const [businessUnitId, setBusinessUnitId] = useState<string>("")
  const [plantId, setPlantId] = useState<string>("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ExecutiveData | null>(null)
  const [purchaseOrdersData, setPurchaseOrdersData] = useState<any>(null)
  const [loadingPOs, setLoadingPOs] = useState(false)
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set())
  const [filterByAdditionalExpenses, setFilterByAdditionalExpenses] = useState(false)

  const toggleAssetExpansion = (assetId: string) => {
    setExpandedAssets(prev => {
      const newSet = new Set(prev)
      if (newSet.has(assetId)) {
        newSet.delete(assetId)
      } else {
        newSet.add(assetId)
      }
      return newSet
    })
  }

  const loadPurchaseOrders = async (assetId?: string) => {
    setLoadingPOs(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate
      })
      
      if (assetId) {
        params.append('assetId', assetId)
      }
      
      const response = await fetch(`/api/reports/executive/purchase-orders?${params}`)
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load purchase orders')
      }
      
      setPurchaseOrdersData(result)
    } catch (err) {
      console.error('Failed to load purchase orders:', err)
    } finally {
      setLoadingPOs(false)
    }
  }

  const load = async () => {
    if (!startDate || !endDate) return
    
    setLoading(true)
    try {
      const response = await fetch("/api/reports/executive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate + 'T23:59:59').toISOString(),
          businessUnitId: businessUnitId || null,
          plantId: plantId || null,
          page,
          pageSize: 20
        })
      })

      const result = await response.json()
      if (result.error) throw new Error(result.error)
      
      setData(result)
    } catch (error: any) {
      console.error("Error loading executive report:", error)
      setData({ 
        summary: {
          totalCost: 0, purchaseOrdersCost: 0, serviceOrdersCost: 0, laborCost: 0, 
          partsCost: 0, additionalExpenses: 0, totalHours: 0, assetCount: 0,
          preventiveCost: 0, correctiveCost: 0
        },
        businessUnits: [], plants: [], 
        assets: { data: [], total: 0, page: 1, pageSize: 20 },
        filters: { businessUnits: [], plants: [] },
        error: error.message 
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, businessUnitId, plantId, page])

  const handleBusinessUnitChange = (value: string) => {
    setBusinessUnitId(value === "all" ? "" : value)
    setPlantId("")
    setPage(1)
  }

  const handlePlantChange = (value: string) => {
    setPlantId(value === "all" ? "" : value)
    setPage(1)
  }

  const exportToCSV = () => {
    if (!data) return

    const headers = [
      "Código Activo",
      "Modelo/Equipo",
      "Fabricante", 
      "Planta",
      "Unidad de Negocio",
      "Costo Total",
      "Costo Preventivo",
      "Costo Correctivo",
      "% Preventivo",
      "Órdenes de Compra",
      "Órdenes de Servicio",
      "Mano de Obra",
      "Refacciones",
      "Gastos Adicionales",
      "Horas Trabajadas",
      "Costo por Hora",
      "Eficiencia"
    ]

    const rows = data.assets.data.map(asset => {
      const preventiveRatio = asset.total_cost > 0 ? (asset.preventive_cost / asset.total_cost) * 100 : 0
      const costPerHour = asset.hours_worked > 0 ? asset.total_cost / asset.hours_worked : 0
      const efficiency = preventiveRatio >= 60 ? "Óptima" : preventiveRatio >= 30 ? "Buena" : "Reactiva"
      
      return [
        asset.asset_code,
        asset.model_name,
        asset.model_manufacturer,
        asset.plant_name,
        asset.business_unit_name,
        asset.total_cost,
        asset.preventive_cost,
        asset.corrective_cost,
        preventiveRatio.toFixed(1),
        asset.purchase_orders_cost,
        asset.service_orders_cost,
        asset.labor_cost,
        asset.parts_cost,
        asset.additional_expenses,
        asset.hours_worked,
        costPerHour.toFixed(2),
        efficiency
      ]
    })

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => 
        typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell
      ).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `reporte-ejecutivo-${startDate}-${endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const availablePlants = data?.filters.plants.filter(p => 
    !businessUnitId || p.business_unit_id === businessUnitId
  ) || []

  const costBreakdownData = data ? [
    { name: "Órdenes de Compra", value: data.summary.purchaseOrdersCost, color: "#8884d8" },
    { name: "Órdenes de Servicio", value: data.summary.serviceOrdersCost, color: "#82ca9d" },
    { name: "Gastos Adicionales", value: data.summary.additionalExpenses, color: "#ffc658" }
  ] : []

  const maintenanceTypeData = data ? [
    { name: "Preventivo", value: data.summary.preventiveCost, color: "#10b981" },
    { name: "Correctivo", value: data.summary.correctiveCost, color: "#f97316" }
  ] : []

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Filtros del Reporte
          </CardTitle>
          <CardDescription>
            Configure el período y alcance organizacional del análisis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <Label htmlFor="start-date">Fecha Inicio</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="end-date">Fecha Fin</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Unidad de Negocio</Label>
              <Select value={businessUnitId || "all"} onValueChange={handleBusinessUnitChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las unidades</SelectItem>
                  {data?.filters.businessUnits.map(bu => (
                    <SelectItem key={bu.id} value={bu.id}>{bu.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Planta</Label>
              <Select value={plantId || "all"} onValueChange={handlePlantChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las plantas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las plantas</SelectItem>
                  {availablePlants.map(plant => (
                    <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={load} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Cargando...' : 'Actualizar'}
              </Button>
              <Button variant="outline" onClick={exportToCSV} disabled={!data || loading}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterByAdditionalExpenses}
                onChange={(e) => setFilterByAdditionalExpenses(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Solo activos con gastos adicionales</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {data?.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>Error: {data.error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.summary.totalCost || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {data?.summary.assetCount || 0} activos monitoreados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes de Compra</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.summary.purchaseOrdersCost || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {((data?.summary.purchaseOrdersCost || 0) / (data?.summary.totalCost || 1) * 100).toFixed(1)}% del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Horas Operación</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data?.summary.totalHours || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Promedio: {((data?.summary.totalHours || 0) / (data?.summary.assetCount || 1)).toFixed(0)} hrs/activo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Adicionales</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.summary.additionalExpenses || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {((data?.summary.additionalExpenses || 0) / (data?.summary.totalCost || 1) * 100).toFixed(1)}% del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiencia Preventiva</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((data?.summary.preventiveCost || 0) / (data?.summary.totalCost || 1) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              vs {((data?.summary.correctiveCost || 0) / (data?.summary.totalCost || 1) * 100).toFixed(1)}% correctivo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen Ejecutivo</TabsTrigger>
          <TabsTrigger value="business-units">Unidades de Negocio</TabsTrigger>
          <TabsTrigger value="plants">Plantas</TabsTrigger>
          <TabsTrigger value="assets">Activos</TabsTrigger>
          <TabsTrigger value="purchase-orders">Órdenes de Compra</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Costos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={costBreakdownData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {costBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preventivo vs Correctivo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={maintenanceTypeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="value" fill="#8884d8">
                      {maintenanceTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="business-units">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Análisis por Unidad de Negocio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Unidad de Negocio</th>
                      <th className="text-right p-3">Activos</th>
                      <th className="text-right p-3">Costo Total</th>
                      <th className="text-right p-3">Órd. Compra</th>
                      <th className="text-right p-3">Órd. Servicio</th>
                      <th className="text-right p-3">Horas</th>
                      <th className="text-right p-3">Eficiencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.businessUnits.map(bu => (
                      <tr key={bu.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">{bu.name}</td>
                        <td className="p-3 text-right">{bu.asset_count}</td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(bu.total_cost)}</td>
                        <td className="p-3 text-right">{formatCurrency(bu.purchase_orders_cost)}</td>
                        <td className="p-3 text-right">{formatCurrency(bu.service_orders_cost)}</td>
                        <td className="p-3 text-right">{formatNumber(bu.hours_worked)}</td>
                        <td className="p-3 text-right">
                          <Badge variant={bu.preventive_cost > bu.corrective_cost ? "default" : "secondary"}>
                            {((bu.preventive_cost / (bu.total_cost || 1)) * 100).toFixed(0)}% Prev
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plants">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Análisis por Planta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Planta</th>
                      <th className="text-left p-3">Unidad de Negocio</th>
                      <th className="text-right p-3">Activos</th>
                      <th className="text-right p-3">Costo Total</th>
                      <th className="text-right p-3">Costo/Activo</th>
                      <th className="text-right p-3">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.plants.map(plant => (
                      <tr key={plant.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">{plant.name}</td>
                        <td className="p-3 text-muted-foreground">{plant.business_unit_name}</td>
                        <td className="p-3 text-right">{plant.asset_count}</td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(plant.total_cost)}</td>
                        <td className="p-3 text-right">{formatCurrency(plant.total_cost / (plant.asset_count || 1))}</td>
                        <td className="p-3 text-right">{formatNumber(plant.hours_worked)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle>Análisis Detallado por Activo</CardTitle>
              <CardDescription>
                Costos operativos y eficiencia por equipo - {data?.assets.data.length || 0} de {data?.assets.total || 0} activos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    Página {data?.assets.page || 1} - Total: {data?.assets.total || 0} activos
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={loading || (data && page * 20 >= data.assets.total)}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-center p-3 font-medium w-12"></th>
                          <th className="text-left p-3 font-medium">Código Activo</th>
                          <th className="text-left p-3 font-medium">Modelo/Equipo</th>
                          <th className="text-left p-3 font-medium">Planta</th>
                          <th className="text-right p-3 font-medium">Costo Total</th>
                          <th className="text-right p-3 font-medium">Preventivo</th>
                          <th className="text-right p-3 font-medium">Correctivo</th>
                          <th className="text-right p-3 font-medium">Horas Operación</th>
                          <th className="text-right p-3 font-medium">Eficiencia</th>
                        </tr>
                      </thead>
                    <tbody>
                      {(filterByAdditionalExpenses 
                        ? data?.assets.data.filter(asset => {
                            const hasAdditionalExpenses = (asset as any).additional_expenses_list && (asset as any).additional_expenses_list.length > 0
                            return hasAdditionalExpenses
                          })
                        : data?.assets.data
                      )?.map(asset => {
                        const preventiveRatio = asset.total_cost > 0 ? (asset.preventive_cost / asset.total_cost) * 100 : 0
                        const costPerHour = asset.hours_worked > 0 ? asset.total_cost / asset.hours_worked : 0
                        const isExpanded = expandedAssets.has(asset.id)
                        const hasPurchaseOrders = (asset as any).purchase_orders && (asset as any).purchase_orders.length > 0
                        const hasAdditionalExpenses = (asset as any).additional_expenses_list && (asset as any).additional_expenses_list.length > 0
                        const hasAnyExpenses = hasPurchaseOrders || hasAdditionalExpenses
                        
                        return (
                          <React.Fragment key={asset.id}>
                            <tr className="border-b hover:bg-muted/50">
                              <td className="p-3 text-center">
                                {hasAnyExpenses && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleAssetExpansion(asset.id)}
                                    className="h-6 w-6 p-0"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="font-mono text-sm font-medium">{asset.asset_code}</div>
                              </td>
                              <td className="p-3">
                                <div className="font-medium text-sm">{asset.model_name}</div>
                                <div className="text-xs text-muted-foreground">{asset.model_manufacturer}</div>
                              </td>
                              <td className="p-3 text-muted-foreground text-sm">{asset.plant_name}</td>
                              <td className="p-3 text-right">
                                <div className="font-semibold">{formatCurrency(asset.total_cost)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {asset.hours_worked > 0 ? `${formatCurrency(costPerHour)}/hr` : 'Sin horas'}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <div className="text-green-600 font-medium">{formatCurrency(asset.preventive_cost)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {asset.total_cost > 0 ? `${preventiveRatio.toFixed(0)}%` : '0%'}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <div className="text-orange-600 font-medium">{formatCurrency(asset.corrective_cost)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {asset.total_cost > 0 ? `${(100 - preventiveRatio).toFixed(0)}%` : '0%'}
                                </div>
                              </td>
                              <td className="p-3 text-right font-medium">{formatNumber(asset.hours_worked)}</td>
                              <td className="p-3 text-right">
                                <Badge 
                                  variant={preventiveRatio >= 60 ? "default" : preventiveRatio >= 30 ? "secondary" : "destructive"}
                                  className="text-xs"
                                >
                                  {preventiveRatio >= 60 ? "Óptima" : preventiveRatio >= 30 ? "Buena" : "Reactiva"}
                                </Badge>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {preventiveRatio.toFixed(0)}% Prev
                                </div>
                              </td>
                            </tr>
                            {isExpanded && hasAnyExpenses && (
                              <tr key={`${asset.id}-details`} className="bg-muted/20">
                                <td colSpan={9} className="p-0">
                                  <div className="p-4 border-t bg-muted/10">
                                    <div className="text-sm font-medium text-muted-foreground mb-3">
                                      Desglose de Gastos - {asset.asset_code}
                                    </div>
                                    <div className="grid gap-3">
                                      {/* Purchase Orders */}
                                      {hasPurchaseOrders && (
                                        <div>
                                          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                            <Package className="h-3 w-3" />
                                            Órdenes de Compra ({(asset as any).purchase_orders.length})
                                          </div>
                                          <div className="grid gap-2 ml-4">
                                            {(asset as any).purchase_orders.map((po: any, idx: number) => (
                                        <div key={po.id || idx} className="flex items-center justify-between p-3 bg-background rounded border">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                              <div>
                                                <div className="font-mono text-xs text-muted-foreground">{po.id}</div>
                                                <div className="font-medium text-sm">{po.order_id}</div>
                                              </div>
                                              <div>
                                                <div className="text-sm">{po.supplier}</div>
                                                <div className="text-xs text-muted-foreground">
                                                  {new Date(po.created_at).toLocaleDateString()}
                                                </div>
                                              </div>
                                              <Badge variant={po.work_order_type === 'preventive' ? 'default' : 'destructive'} className="text-xs">
                                                {po.work_order_type === 'preventive' ? 'Preventivo' : 'Correctivo'}
                                              </Badge>
                                              <Badge variant={po.status === 'validated' ? 'default' : 'secondary'} className="text-xs">
                                                {po.status}
                                              </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                              {po.items.length > 0 && po.items[0].description}
                                              {po.items.length > 1 && ` +${po.items.length - 1} más`}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <div className="font-semibold text-lg">${po.amount.toLocaleString()}</div>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              asChild
                                              className="h-6 w-6 p-0 mt-1"
                                            >
                                              <a href={`/compras/${po.id}`} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-3 w-3" />
                                              </a>
                                            </Button>
                                          </div>
                                        </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}


                                      {/* Additional Expenses */}
                                      {hasAdditionalExpenses && (
                                        <div>
                                          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                                            <DollarSign className="h-3 w-3" />
                                            Gastos Adicionales ({(asset as any).additional_expenses_list.length})
                                          </div>
                                          <div className="grid gap-2 ml-4">
                                            {(asset as any).additional_expenses_list.map((ae: any, idx: number) => (
                                              <div key={ae.id || idx} className="flex items-center justify-between p-3 bg-background rounded border">
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-3">
                                                    <div>
                                                      <div className="font-mono text-xs text-muted-foreground">{ae.id?.slice(0, 8)}...</div>
                                                      <div className="font-medium text-sm">{ae.description || 'Gasto Adicional'}</div>
                                                    </div>
                                                    <div>
                                                      <div className="text-xs text-muted-foreground">
                                                        {new Date(ae.created_at).toLocaleDateString()}
                                                      </div>
                                                      {ae.status && (
                                                        <Badge variant={ae.status === 'approved' ? 'default' : 'secondary'} className="text-xs mt-1">
                                                          {ae.status}
                                                        </Badge>
                                                      )}
                                                    </div>
                                                    <Badge variant="destructive" className="text-xs">
                                                      Correctivo
                                                    </Badge>
                                                    {ae.work_order_id && (
                                                      <Badge variant="outline" className="text-xs">
                                                        WO: {ae.work_order_id?.slice(0, 8)}...
                                                      </Badge>
                                                    )}
                                                  </div>
                                                </div>
                                                <div className="text-right">
                                                  <div className="font-semibold text-lg">${ae.amount.toLocaleString()}</div>
                                                  {ae.id && (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      asChild
                                                      className="h-6 w-6 p-0 mt-1"
                                                    >
                                                      <a href={`/compras/gastos-adicionales/${ae.id}`} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="h-3 w-3" />
                                                      </a>
                                                    </Button>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-3 pt-3 border-t text-sm space-y-2">
                                      {hasPurchaseOrders && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">Total Órdenes de Compra:</span>
                                          <span className="font-semibold">
                                            ${(asset as any).purchase_orders.reduce((sum: number, po: any) => sum + po.amount, 0).toLocaleString()}
                                          </span>
                                        </div>
                                      )}
                                      {hasAdditionalExpenses && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-muted-foreground">Total Gastos Adicionales:</span>
                                          <span className="font-semibold">
                                            ${(asset as any).additional_expenses_list.reduce((sum: number, ae: any) => sum + ae.amount, 0).toLocaleString()}
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex justify-between items-center pt-2 border-t font-semibold">
                                        <span>Total General:</span>
                                        <span className="text-lg">
                                          ${asset.total_cost.toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/30 rounded">
                  <strong>Interpretación de Eficiencia:</strong> Óptima (≥60% preventivo), Buena (30-59% preventivo), Reactiva (&lt;30% preventivo)
                </div>

                {/* Unlinked Additional Expenses - Audit Section */}
                {data?.unlinkedAdditionalExpenses && data.unlinkedAdditionalExpenses.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                        <h3 className="text-lg font-semibold">Gastos Adicionales Sin Activo Asociado (Auditoría)</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Estos gastos adicionales no están asociados a ningún activo en el período seleccionado y requieren revisión.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-3 font-medium">ID</th>
                            <th className="text-left p-3 font-medium">Descripción</th>
                            <th className="text-left p-3 font-medium">Estado</th>
                            <th className="text-left p-3 font-medium">Work Order</th>
                            <th className="text-left p-3 font-medium">Fecha</th>
                            <th className="text-right p-3 font-medium">Monto</th>
                            <th className="text-center p-3 font-medium">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.unlinkedAdditionalExpenses.map((ae: any) => (
                            <tr key={ae.id} className="border-b hover:bg-muted/50">
                              <td className="p-3 font-mono text-xs">{ae.id?.slice(0, 8)}...</td>
                              <td className="p-3">{ae.description || 'Sin descripción'}</td>
                              <td className="p-3">
                                <Badge variant={ae.status === 'approved' ? 'default' : ae.status === 'rejected' ? 'destructive' : 'secondary'}>
                                  {ae.status || 'pendiente'}
                                </Badge>
                              </td>
                              <td className="p-3">
                                {ae.work_order_id ? (
                                  <span className="font-mono text-xs">{ae.work_order_id.slice(0, 8)}...</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-3 text-muted-foreground">
                                {new Date(ae.created_at).toLocaleDateString()}
                              </td>
                              <td className="p-3 text-right font-semibold">{formatCurrency(ae.amount)}</td>
                              <td className="p-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className="h-8 w-8 p-0"
                                >
                                  <a href={`/compras/gastos-adicionales/${ae.id}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-3 p-3 bg-warning/10 rounded text-sm text-warning-foreground">
                        <strong>Total Gastos Sin Asociar:</strong> {formatCurrency(
                          data.unlinkedAdditionalExpenses.reduce((sum: number, ae: any) => sum + ae.amount, 0)
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchase-orders">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Desglose de Órdenes de Compra
              </CardTitle>
              <CardDescription>
                Detalle completo de órdenes de compra para análisis y debugging
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Button 
                    onClick={() => loadPurchaseOrders()}
                    disabled={loadingPOs}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingPOs ? 'animate-spin' : ''}`} />
                    {loadingPOs ? 'Cargando...' : 'Cargar Órdenes de Compra'}
                  </Button>
                  
                  {purchaseOrdersData && (
                    <div className="text-sm text-muted-foreground">
                      Total: {purchaseOrdersData.total} órdenes - ${purchaseOrdersData.total_amount?.toLocaleString()}
                    </div>
                  )}
                </div>

                {purchaseOrdersData && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-3 font-medium">Orden ID</th>
                            <th className="text-left p-3 font-medium">Proveedor</th>
                            <th className="text-right p-3 font-medium">Monto</th>
                            <th className="text-left p-3 font-medium">Estado</th>
                            <th className="text-left p-3 font-medium">Fecha</th>
                            <th className="text-left p-3 font-medium">Activo</th>
                            <th className="text-left p-3 font-medium">Tipo Mant.</th>
                            <th className="text-left p-3 font-medium">Items</th>
                            <th className="text-center p-3 font-medium">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchaseOrdersData.purchase_orders.map((po: any) => (
                            <tr key={po.id} className="border-b hover:bg-muted/50">
                              <td className="p-3">
                                <div className="font-mono text-xs">{po.id}</div>
                                <div className="font-medium">{po.order_id}</div>
                              </td>
                              <td className="p-3">{po.supplier}</td>
                              <td className="p-3 text-right">
                                <div className="font-semibold">${po.amount.toLocaleString()}</div>
                              </td>
                              <td className="p-3">
                                <Badge variant={
                                  po.status === 'validated' ? 'default' : 
                                  po.status === 'approved' ? 'secondary' : 'outline'
                                }>
                                  {po.status}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="text-sm">
                                  {new Date(po.created_at).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="p-3">
                                {po.work_order?.asset ? (
                                  <div>
                                    <div className="font-mono text-xs">{po.work_order.asset.code}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {po.work_order.asset.model} - {po.work_order.asset.manufacturer}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">Sin activo</span>
                                )}
                              </td>
                              <td className="p-3">
                                {po.work_order ? (
                                  <Badge variant={po.work_order.type === 'preventive' ? 'default' : 'destructive'}>
                                    {po.work_order.type === 'preventive' ? 'Preventivo' : 'Correctivo'}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-sm">N/A</span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="text-xs text-muted-foreground">
                                  {po.items.length} item(s)
                                </div>
                                {po.items.slice(0, 2).map((item: any, idx: number) => (
                                  <div key={idx} className="text-xs truncate max-w-32">
                                    {item.description}
                                  </div>
                                ))}
                                {po.items.length > 2 && (
                                  <div className="text-xs text-muted-foreground">
                                    +{po.items.length - 2} más
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild
                                  className="h-8 w-8 p-0"
                                >
                                  <a href={`/compras/${po.id}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!purchaseOrdersData && !loadingPOs && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Haz clic en "Cargar Órdenes de Compra" para ver el desglose detallado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}