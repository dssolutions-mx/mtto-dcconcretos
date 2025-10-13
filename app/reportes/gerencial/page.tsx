'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Fuel,
  Wrench,
  Package,
  Download,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Building2,
  Factory,
  Truck
} from 'lucide-react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

const COLORS = {
  primary: '#4f46e5',
  secondary: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
}

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

const formatNumber = (num: number) => 
  new Intl.NumberFormat('es-MX').format(num)

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
}

type ReportData = {
  summary: {
    totalSales: number
    totalSalesWithVat: number
    totalDieselCost: number
    totalMaintenanceCost: number
    totalConcreteM3: number
    totalDieselL: number
    costRevenueRatio: number
    // optional overall hours in case we want to show global LPH later
    totalHours?: number
  }
  businessUnits: Array<{
    id: string
    name: string
    sales_subtotal: number
    sales_with_vat: number
    diesel_cost: number
    maintenance_cost: number
    preventive_cost: number
    corrective_cost: number
    concrete_m3: number
    diesel_liters: number
    hours_worked?: number
    liters_per_hour?: number
    asset_count: number
  }>
  plants: Array<{
    id: string
    name: string
    business_unit_name: string
    sales_subtotal: number
    sales_with_vat: number
    diesel_cost: number
    maintenance_cost: number
    preventive_cost: number
    corrective_cost: number
    concrete_m3: number
    diesel_liters: number
    hours_worked?: number
    liters_per_hour?: number
    asset_count: number
  }>
  assets: Array<{
    id: string
    asset_code: string
    asset_name: string
    plant_name: string
    sales_subtotal: number
    sales_with_vat: number
    diesel_cost: number
    diesel_liters: number
    hours_worked?: number
    liters_per_hour?: number
    maintenance_cost: number
    preventive_cost: number
    corrective_cost: number
    concrete_m3: number
    remisiones_count: number
  }>
  filters: {
    businessUnits: BusinessUnit[]
    plants: Plant[]
  }
}

export default function GerencialReportPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData | null>(null)
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [includeVat, setIncludeVat] = useState(false)
  const [businessUnitId, setBusinessUnitId] = useState<string>('')
  const [plantId, setPlantId] = useState<string>('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Default to current month
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setDateFrom(first.toISOString().slice(0, 10))
    setDateTo(last.toISOString().slice(0, 10))
  }, [])

  useEffect(() => {
    if (!dateFrom || !dateTo) return
    loadData()
  }, [dateFrom, dateTo, businessUnitId, plantId])

  const loadData = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/reports/gerencial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dateFrom, 
          dateTo,
          businessUnitId: businessUnitId || null,
          plantId: plantId || null
        })
      })
      const json = await resp.json()
      setData(json)
    } catch (err) {
      console.error('Error loading gerencial report:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleBusinessUnitChange = (value: string) => {
    setBusinessUnitId(value === 'all' ? '' : value)
    setPlantId('')
  }

  const handlePlantChange = (value: string) => {
    setPlantId(value === 'all' ? '' : value)
  }

  const availablePlants = data?.filters?.plants?.filter(p => 
    !businessUnitId || p.business_unit_id === businessUnitId
  ) || []

  if (loading && !data) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mr-3" />
          <p className="text-muted-foreground">Cargando reporte gerencial…</p>
        </div>
      </div>
    )
  }

  const totalRevenue = includeVat ? 
    (data?.summary.totalSalesWithVat || 0) : 
    (data?.summary.totalSales || 0)

  const totalCost = (data?.summary.totalDieselCost || 0) + (data?.summary.totalMaintenanceCost || 0)
  const costToRevenueRatio = totalRevenue > 0 ? ((totalCost / totalRevenue) * 100).toFixed(2) : '0'

  // Chart data
  const costBreakdownData = [
    { name: 'Diésel', value: data?.summary.totalDieselCost || 0, color: COLORS.warning },
    { name: 'Mantenimiento', value: data?.summary.totalMaintenanceCost || 0, color: COLORS.primary }
  ]

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reporte Gerencial</h1>
        <p className="text-muted-foreground">
          Análisis ejecutivo integrado: ventas, diésel y mantenimiento
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="businessUnit">Unidad de Negocio</Label>
              <Select value={businessUnitId || 'all'} onValueChange={handleBusinessUnitChange}>
                <SelectTrigger id="businessUnit">
                  <SelectValue placeholder="Todas" />
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
              <Label htmlFor="plant">Planta</Label>
              <Select value={plantId || 'all'} onValueChange={handlePlantChange}>
                <SelectTrigger id="plant">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las plantas</SelectItem>
                  {availablePlants.map(plant => (
                    <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dateFrom">Fecha Inicio</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="dateTo">Fecha Fin</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeVat}
                  onChange={(e) => setIncludeVat(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Incluir IVA</span>
              </label>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={loadData} disabled={loading} className="flex-1">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Cargando...' : 'Actualizar'}
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {includeVat ? 'Con IVA' : 'Sin IVA'} · {formatNumber(data?.summary.totalConcreteM3 || 0)} m³
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Diésel</CardTitle>
            <Fuel className="w-4 h-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {formatCurrency(data?.summary.totalDieselCost || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(data?.summary.totalDieselL || 0)} L consumidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Mantenimiento</CardTitle>
            <Wrench className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(data?.summary.totalMaintenanceCost || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Costo total periodo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ratio Costo/Ingreso</CardTitle>
            {parseFloat(costToRevenueRatio) < 15 ? (
              <TrendingDown className="w-4 h-4 text-success" />
            ) : (
              <TrendingUp className="w-4 h-4 text-danger" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${parseFloat(costToRevenueRatio) < 15 ? 'text-success' : 'text-danger'}`}>
              {costToRevenueRatio}%
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalCost)} costo total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen Ejecutivo</TabsTrigger>
          <TabsTrigger value="business-units">Unidades de Negocio</TabsTrigger>
          <TabsTrigger value="plants">Plantas</TabsTrigger>
          <TabsTrigger value="assets">Activos</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Costos Operativos</CardTitle>
                <CardDescription>Desglose por categoría</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={costBreakdownData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {costBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comparativo por Unidad de Negocio</CardTitle>
                <CardDescription>Costo total por unidad</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={data?.businessUnits.map(bu => ({
                      name: bu.name.split(' ')[0],
                      total: bu.diesel_cost + bu.maintenance_cost
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Bar dataKey="total" fill={COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* BUSINESS UNITS TAB */}
        <TabsContent value="business-units">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Análisis por Unidad de Negocio
              </CardTitle>
              <CardDescription>
                Consolidado de ventas, diésel y mantenimiento por unidad
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Unidad de Negocio</th>
                      <th className="text-right p-3 font-medium">Activos</th>
                      <th className="text-right p-3 font-medium">Ventas</th>
                      <th className="text-right p-3 font-medium">Concreto (m³)</th>
                      <th className="text-right p-3 font-medium">Diésel</th>
                      <th className="text-right p-3 font-medium">Litros</th>
                      <th className="text-right p-3 font-medium">Horas</th>
                      <th className="text-right p-3 font-medium">L/H</th>
                      <th className="text-right p-3 font-medium">Mantenimiento</th>
                      <th className="text-right p-3 font-medium">Costo Total</th>
                      <th className="text-right p-3 font-medium">Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.businessUnits.map(bu => {
                      const sales = includeVat ? bu.sales_with_vat : bu.sales_subtotal
                      const totalCost = bu.diesel_cost + bu.maintenance_cost
                      const ratio = sales > 0 ? ((totalCost / sales) * 100).toFixed(1) : '0'
                      
                      return (
                        <tr key={bu.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{bu.name}</td>
                          <td className="p-3 text-right">{bu.asset_count}</td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(sales)}</td>
                          <td className="p-3 text-right">{formatNumber(bu.concrete_m3)}</td>
                          <td className="p-3 text-right text-warning">{formatCurrency(bu.diesel_cost)}</td>
                          <td className="p-3 text-right text-muted-foreground">{formatNumber(bu.diesel_liters)}</td>
                          <td className="p-3 text-right text-muted-foreground">{formatNumber(bu.hours_worked || 0)}</td>
                          <td className="p-3 text-right">
                            {(bu.liters_per_hour || 0) > 0 ? (
                              <Badge variant={(bu.liters_per_hour as number) < 10 ? "default" : "secondary"}>
                                {(bu.liters_per_hour as number).toFixed(2)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right text-primary">{formatCurrency(bu.maintenance_cost)}</td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(totalCost)}</td>
                          <td className="p-3 text-right">
                            <Badge variant={parseFloat(ratio) < 15 ? "default" : "secondary"}>
                              {ratio}%
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLANTS TAB */}
        <TabsContent value="plants">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Análisis por Planta
              </CardTitle>
              <CardDescription>
                Detalle de operaciones y costos por ubicación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Planta</th>
                      <th className="text-left p-3 font-medium">Unidad de Negocio</th>
                      <th className="text-right p-3 font-medium">Activos</th>
                      <th className="text-right p-3 font-medium">Ventas</th>
                      <th className="text-right p-3 font-medium">m³</th>
                      <th className="text-right p-3 font-medium">Diésel</th>
                      <th className="text-right p-3 font-medium">Litros</th>
                      <th className="text-right p-3 font-medium">Horas</th>
                      <th className="text-right p-3 font-medium">L/H</th>
                      <th className="text-right p-3 font-medium">Mantenimiento</th>
                      <th className="text-right p-3 font-medium">Total Costos</th>
                      <th className="text-right p-3 font-medium">Costo/m³</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.plants.map(plant => {
                      const sales = includeVat ? plant.sales_with_vat : plant.sales_subtotal
                      const totalCost = plant.diesel_cost + plant.maintenance_cost
                      const costPerM3 = plant.concrete_m3 > 0 ? (totalCost / plant.concrete_m3) : 0
                      
                      return (
                        <tr key={plant.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{plant.name}</td>
                          <td className="p-3 text-muted-foreground">{plant.business_unit_name}</td>
                          <td className="p-3 text-right">{plant.asset_count}</td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(sales)}</td>
                          <td className="p-3 text-right">{formatNumber(plant.concrete_m3)}</td>
                          <td className="p-3 text-right text-warning">{formatCurrency(plant.diesel_cost)}</td>
                          <td className="p-3 text-right text-muted-foreground">{formatNumber(plant.diesel_liters)}</td>
                          <td className="p-3 text-right text-muted-foreground">{formatNumber(plant.hours_worked || 0)}</td>
                          <td className="p-3 text-right">
                            {(plant.liters_per_hour || 0) > 0 ? (
                              <Badge variant={(plant.liters_per_hour as number) < 10 ? "default" : "secondary"}>
                                {(plant.liters_per_hour as number).toFixed(2)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right text-primary">{formatCurrency(plant.maintenance_cost)}</td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(totalCost)}</td>
                          <td className="p-3 text-right">{formatCurrency(costPerM3)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ASSETS TAB */}
        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Análisis Detallado por Activo
              </CardTitle>
              <CardDescription>
                Rendimiento y costos a nivel de equipo individual - {data?.assets.length || 0} activos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-center p-3 font-medium w-12"></th>
                      <th className="text-left p-3 font-medium">Código</th>
                      <th className="text-left p-3 font-medium">Activo</th>
                      <th className="text-left p-3 font-medium">Planta</th>
                      <th className="text-right p-3 font-medium">Ventas</th>
                      <th className="text-right p-3 font-medium">m³</th>
                      <th className="text-right p-3 font-medium">Diésel (L)</th>
                      <th className="text-right p-3 font-medium">Costo Diésel</th>
                      <th className="text-right p-3 font-medium">Mantenimiento</th>
                      <th className="text-right p-3 font-medium">Horas</th>
                      <th className="text-right p-3 font-medium">L/H</th>
                      <th className="text-right p-3 font-medium">L/m³</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.assets.map(asset => {
                      const sales = includeVat ? asset.sales_with_vat : asset.sales_subtotal
                      const litersPerM3 = asset.concrete_m3 > 0 ? (asset.diesel_liters / asset.concrete_m3) : 0
                      const isExpanded = expandedRows.has(asset.id)
                      const hasDetails = asset.remisiones_count > 0 || asset.preventive_cost > 0 || asset.corrective_cost > 0
                      const isUnmatched = (asset as any)._is_unmatched
                      
                      return (
                        <tr key={asset.id} className={`border-b hover:bg-muted/50 ${isUnmatched ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                          <td className="p-3 text-center">
                            {hasDetails && !isUnmatched && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRow(asset.id)}
                                className="h-6 w-6 p-0"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {isUnmatched && (
                              <AlertCircle className="h-4 w-4 text-amber-600 inline-block" />
                            )}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {asset.asset_code}
                            {isUnmatched && (
                              <Badge variant="outline" className="ml-2 text-xs border-amber-600 text-amber-600">
                                Sin mapear
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 font-medium">{asset.asset_name}</td>
                          <td className="p-3 text-muted-foreground">{asset.plant_name}</td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(sales)}</td>
                          <td className="p-3 text-right">{formatNumber(asset.concrete_m3)}</td>
                          <td className="p-3 text-right">{formatNumber(asset.diesel_liters)}</td>
                          <td className="p-3 text-right text-warning">{formatCurrency(asset.diesel_cost)}</td>
                          <td className="p-3 text-right text-primary">{formatCurrency(asset.maintenance_cost)}</td>
                          <td className="p-3 text-right text-muted-foreground">{formatNumber(asset.hours_worked || 0)}</td>
                          <td className="p-3 text-right">
                            {(asset.liters_per_hour || 0) > 0 ? (
                              <Badge variant={(asset.liters_per_hour as number) < 10 ? "default" : "secondary"}>
                                {(asset.liters_per_hour as number).toFixed(2)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {litersPerM3 > 0 ? (
                              <Badge variant={litersPerM3 < 10 ? "default" : "secondary"}>
                                {litersPerM3.toFixed(2)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {(!data?.assets || data.assets.length === 0) && (
                <div className="py-12 text-center text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay datos de activos para el período seleccionado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
