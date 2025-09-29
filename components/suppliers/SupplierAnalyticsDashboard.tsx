"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Star,
  Target,
  Award,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Calendar
} from "lucide-react"
import { SupplierAnalytics } from "@/types/suppliers"

interface SupplierAnalyticsDashboardProps {
  timeRange?: '30d' | '90d' | '1y' | 'all'
  supplierType?: string
  className?: string
}

export function SupplierAnalyticsDashboard({
  timeRange = '1y',
  supplierType = 'all',
  className
}: SupplierAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<SupplierAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange)
  const [selectedSupplierType, setSelectedSupplierType] = useState(supplierType)

  useEffect(() => {
    loadAnalytics()
  }, [selectedTimeRange, selectedSupplierType])

  const loadAnalytics = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        time_range: selectedTimeRange,
        supplier_type: selectedSupplierType
      })

      const response = await fetch(`/api/suppliers/analytics?${params}`)
      const data = await response.json()

      if (response.ok) {
        setAnalytics(data.analytics)
      } else {
        setError(data.error || 'Error loading analytics')
      }
    } catch (err) {
      setError('Error loading supplier analytics')
      console.error('Error loading analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const getPerformanceBadge = (rating: number) => {
    if (rating >= 4.5) return { variant: "default" as const, color: "text-green-600", label: "Excelente" }
    if (rating >= 3.5) return { variant: "secondary" as const, color: "text-blue-600", label: "Bueno" }
    if (rating >= 2.5) return { variant: "outline" as const, color: "text-yellow-600", label: "Regular" }
    return { variant: "destructive" as const, color: "text-red-600", label: "Deficiente" }
  }

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          <span>Cargando análisis de proveedores...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
              </div>
              <Button variant="outline" size="sm" onClick={loadAnalytics}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No hay datos disponibles</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Análisis de Proveedores</h2>
          <p className="text-muted-foreground">
            Métricas de rendimiento y análisis de proveedores
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">30 días</SelectItem>
              <SelectItem value="90d">90 días</SelectItem>
              <SelectItem value="1y">1 año</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedSupplierType} onValueChange={setSelectedSupplierType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
              <SelectItem value="distributor">Distribuidor</SelectItem>
              <SelectItem value="manufacturer">Fabricante</SelectItem>
              <SelectItem value="service_provider">Servicios</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Proveedores</p>
                <p className="text-3xl font-bold">{analytics.summary.total_suppliers}</p>
                <p className="text-xs text-muted-foreground">
                  {analytics.summary.active_suppliers} activos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm font-medium">Monto Total</p>
                <p className="text-3xl font-bold">
                  ${analytics.summary.total_amount_this_year.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {analytics.summary.total_orders_this_year} órdenes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Star className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Calificación Promedio</p>
                <p className="text-3xl font-bold">{analytics.summary.average_rating}</p>
                <p className="text-xs text-muted-foreground">
                  de 5.0 estrellas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Confiabilidad Promedio</p>
                <p className="text-3xl font-bold">{analytics.summary.average_reliability}%</p>
                <p className="text-xs text-muted-foreground">
                  nivel de confianza
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
          <TabsTrigger value="costs">Costos</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Distribución por Rendimiento
                </CardTitle>
                <CardDescription>
                  Clasificación de proveedores por calificación
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Excelente (4.5+)</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-green-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(analytics.by_performance.excellent / analytics.summary.total_suppliers) * 100}%` }}
                        />
                      </div>
                      <Badge variant="default">{analytics.by_performance.excellent}</Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Bueno (3.5-4.4)</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(analytics.by_performance.good / analytics.summary.total_suppliers) * 100}%` }}
                        />
                      </div>
                      <Badge variant="secondary">{analytics.by_performance.good}</Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Regular (2.5-3.4)</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-yellow-200 rounded-full h-2">
                        <div
                          className="bg-yellow-600 h-2 rounded-full"
                          style={{ width: `${(analytics.by_performance.average / analytics.summary.total_suppliers) * 100}%` }}
                        />
                      </div>
                      <Badge variant="outline">{analytics.by_performance.average}</Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Deficiente (&lt;2.5)</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-red-200 rounded-full h-2">
                        <div
                          className="bg-red-600 h-2 rounded-full"
                          style={{ width: `${(analytics.by_performance.poor / analytics.summary.total_suppliers) * 100}%` }}
                        />
                      </div>
                      <Badge variant="destructive">{analytics.by_performance.poor}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Mejores Proveedores
                </CardTitle>
                <CardDescription>
                  Proveedores con mejor rendimiento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.top_performers.map((supplier, index) => (
                    <div key={supplier.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{supplier.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {supplier.supplier_type?.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">
                            {supplier.rating?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {supplier.reliability_score || 0}% confiable
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento por Tipo de Proveedor</CardTitle>
              <CardDescription>
                Comparación de métricas por categoría
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analytics.by_type).map(([type, data]: [string, any]) => (
                  <div key={type} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold capitalize">
                          {type.replace('_', ' ')}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {data.count} proveedores
                        </p>
                      </div>
                      <Badge variant="outline">
                        {data.average_rating?.toFixed(1) || 'N/A'} ⭐
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Órdenes</p>
                        <p className="font-semibold">{data.total_orders || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monto Total</p>
                        <p className="font-semibold">${(data.total_amount || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Promedio</p>
                        <p className="font-semibold">${((data.total_amount || 0) / Math.max(data.total_orders, 1)).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Calificación</p>
                        <p className="font-semibold">{data.average_rating?.toFixed(1) || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Análisis de Costos
                </CardTitle>
                <CardDescription>
                  Comparación de costos por tipo de proveedor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">Costo promedio por proveedor</span>
                    <span className="text-lg font-bold">
                      ${analytics.cost_analysis.average_cost_per_supplier.toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Proveedores más económicos</h4>
                    {analytics.cost_analysis.most_economical_suppliers.map((supplier, index) => (
                      <div key={supplier.id} className="flex items-center justify-between text-sm">
                        <span>{supplier.name}</span>
                        <span className="font-medium">
                          ${supplier.avg_order_amount?.toLocaleString() || 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Varianza de Costos
                </CardTitle>
                <CardDescription>
                  Consistencia de precios por tipo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics.cost_analysis.cost_variance_by_type).map(([type, variance]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="capitalize text-sm">{type.replace('_', ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${Math.min((variance / 1000) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          ${variance.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Tendencias de Confiabilidad
              </CardTitle>
              <CardDescription>
                Evolución mensual de la confiabilidad de proveedores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.reliability_trends.monthly_reliability_scores.map((month, index) => (
                  <div key={month.month} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 text-center">
                        <span className="text-sm font-medium">{month.month}</span>
                      </div>
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${month.average_score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{month.average_score}%</p>
                      <p className="text-xs text-muted-foreground">
                        {month.order_count} órdenes
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
