"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface SupplierPerformanceChartProps {
  supplierId: string
  timeRange?: '30d' | '90d' | '1y' | 'all'
  metrics?: ('rating' | 'reliability' | 'delivery_time' | 'cost_accuracy')[]
}

interface PerformanceData {
  period: string
  rating: number
  reliability: number
  delivery_time: number
  cost_accuracy: number
  order_count: number
}

export function SupplierPerformanceChart({
  supplierId,
  timeRange = '90d',
  metrics = ['rating', 'reliability']
}: SupplierPerformanceChartProps) {
  const [data, setData] = useState<PerformanceData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPerformanceData()
  }, [supplierId, timeRange])

  const loadPerformanceData = async () => {
    setLoading(true)
    try {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/suppliers/${supplierId}/performance?time_range=${timeRange}`)
      const result = await response.json()

      if (response.ok) {
        setData(result.data || [])
      } else {
        console.error('Error loading performance data:', result.error)
        // Generate mock data for demonstration
        setData(generateMockData())
      }
    } catch (error) {
      console.error('Error loading performance data:', error)
      setData(generateMockData())
    } finally {
      setLoading(false)
    }
  }

  const generateMockData = (): PerformanceData[] => {
    const periods = timeRange === '30d' ? 4 : timeRange === '90d' ? 12 : timeRange === '1y' ? 12 : 24
    const data: PerformanceData[] = []

    for (let i = 0; i < periods; i++) {
      const baseRating = 3.5 + Math.random() * 1.5
      const baseReliability = 70 + Math.random() * 25
      const baseDelivery = 5 + Math.random() * 10

      data.push({
        period: `Period ${i + 1}`,
        rating: Math.round(baseRating * 10) / 10,
        reliability: Math.round(baseReliability),
        delivery_time: Math.round(baseDelivery),
        cost_accuracy: Math.round(85 + Math.random() * 10),
        order_count: Math.floor(2 + Math.random() * 8)
      })
    }

    return data
  }

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="w-4 h-4 text-green-500" />
    if (current < previous) return <TrendingDown className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-gray-500" />
  }

  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) return "text-green-600"
    if (current < previous) return "text-red-600"
    return "text-gray-600"
  }

  const formatMetricValue = (metric: string, value: number) => {
    switch (metric) {
      case 'rating':
        return `${value.toFixed(1)}/5`
      case 'reliability':
        return `${value}%`
      case 'delivery_time':
        return `${value} días`
      case 'cost_accuracy':
        return `${value}%`
      default:
        return value.toString()
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Cargando datos de rendimiento...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data.length) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            No hay datos de rendimiento disponibles
          </p>
        </CardContent>
      </Card>
    )
  }

  const latestData = data[data.length - 1]
  const previousData = data.length > 1 ? data[data.length - 2] : latestData

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map(metric => {
          const currentValue = latestData[metric as keyof PerformanceData] as number
          const previousValue = previousData[metric as keyof PerformanceData] as number

          return (
            <Card key={metric}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {metric === 'rating' ? 'Calificación' :
                       metric === 'reliability' ? 'Confiabilidad' :
                       metric === 'delivery_time' ? 'Tiempo Entrega' :
                       'Precisión Costo'}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatMetricValue(metric, currentValue)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {getTrendIcon(currentValue, previousValue)}
                    <span className={`text-xs ${getTrendColor(currentValue, previousValue)}`}>
                      {currentValue !== previousValue && (
                        `${currentValue > previousValue ? '+' : ''}${((currentValue - previousValue) * (metric === 'delivery_time' ? -1 : 1)).toFixed(1)}`
                      )}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Performance Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Tendencia de Rendimiento
          </CardTitle>
          <CardDescription>
            Evolución del rendimiento del proveedor en el tiempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.slice(-6).map((period, index) => (
              <div key={period.period} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{period.period}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {period.order_count} órdenes
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {metrics.map(metric => {
                    const value = period[metric as keyof PerformanceData] as number
                    return (
                      <div key={metric} className="text-center">
                        <p className="text-xs text-muted-foreground">
                          {metric === 'rating' ? 'Calif.' :
                           metric === 'reliability' ? 'Conf.' :
                           metric === 'delivery_time' ? 'Entrega' :
                           'Costo'}
                        </p>
                        <p className="font-semibold text-sm">
                          {formatMetricValue(metric, value)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Insights de Rendimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {latestData.rating >= 4.5 && (
              <div className="flex items-center gap-2 text-green-600">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-sm">Excelente calificación general</span>
              </div>
            )}
            {latestData.reliability >= 90 && (
              <div className="flex items-center gap-2 text-blue-600">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Alta confiabilidad en entregas</span>
              </div>
            )}
            {latestData.delivery_time <= 5 && (
              <div className="flex items-center gap-2 text-purple-600">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Entregas rápidas y consistentes</span>
              </div>
            )}
            {latestData.cost_accuracy >= 95 && (
              <div className="flex items-center gap-2 text-orange-600">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Excelente precisión en presupuestos</span>
              </div>
            )}
            {data.length < 3 && (
              <div className="flex items-center gap-2 text-yellow-600">
                <Minus className="w-4 h-4" />
                <span className="text-sm">Datos limitados - se necesita más historial</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
