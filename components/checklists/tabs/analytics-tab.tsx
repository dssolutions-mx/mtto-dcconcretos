"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Activity
} from "lucide-react"
import { EquipmentModel } from "@/types"

interface AnalyticsTabProps {
  model: EquipmentModel
}

interface ModelAnalytics {
  checklistCompletion: {
    thisMonth: number
    lastMonth: number
    trend: 'up' | 'down' | 'stable'
  }
  averageCompletionTime: {
    current: number // in minutes
    previous: number
    trend: 'up' | 'down' | 'stable'
  }
  issueDetectionRate: {
    current: number // percentage
    previous: number
    trend: 'up' | 'down' | 'stable'
  }
  maintenanceEfficiency: {
    preventiveRatio: number // percentage of preventive vs corrective
    averageDowntime: number // in hours
    mtbf: number // mean time between failures in days
  }
  templateUsage: {
    mostUsed: Array<{
      templateName: string
      usageCount: number
      successRate: number
    }>
    leastUsed: Array<{
      templateName: string
      usageCount: number
      reason?: string
    }>
  }
  upcomingTrends: {
    predictedMaintenanceNeeds: number
    seasonalPatterns: string
    recommendations: string[]
  }
}

export function AnalyticsTab({ model }: AnalyticsTabProps) {
  const [analytics, setAnalytics] = useState<ModelAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch analytics data from API
        const response = await fetch(`/api/models/${model.id}/analytics`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Error al cargar análisis del modelo')
        }

        const data = await response.json()
        setAnalytics(data)
      } catch (err) {
        console.error('Error fetching analytics:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
        // Set mock data for demo
        setAnalytics({
          checklistCompletion: {
            thisMonth: 85,
            lastMonth: 78,
            trend: 'up'
          },
          averageCompletionTime: {
            current: 25,
            previous: 30,
            trend: 'down'
          },
          issueDetectionRate: {
            current: 12,
            previous: 15,
            trend: 'down'
          },
          maintenanceEfficiency: {
            preventiveRatio: 75,
            averageDowntime: 2.5,
            mtbf: 45
          },
          templateUsage: {
            mostUsed: [
              { templateName: 'Inspección Diaria', usageCount: 45, successRate: 95 },
              { templateName: 'Mantenimiento Preventivo', usageCount: 32, successRate: 88 },
              { templateName: 'Check Semanal', usageCount: 28, successRate: 92 }
            ],
            leastUsed: [
              { templateName: 'Inspección Especial', usageCount: 3, reason: 'Requiere capacitación' },
              { templateName: 'Check Trimestral', usageCount: 1, reason: 'Frecuencia muy baja' }
            ]
          },
          upcomingTrends: {
            predictedMaintenanceNeeds: 8,
            seasonalPatterns: 'Mayor uso en temporada alta (Jun-Sep)',
            recommendations: [
              'Incrementar frecuencia de inspecciones diarias',
              'Capacitar personal en plantillas subutilizadas',
              'Optimizar tiempo de completado de checklists'
            ]
          }
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [model.id])

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrendColor = (trend: 'up' | 'down' | 'stable', isGood: boolean = true) => {
    if (trend === 'stable') return 'text-gray-500'
    if (trend === 'up') return isGood ? 'text-green-500' : 'text-red-500'
    return isGood ? 'text-red-500' : 'text-green-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p>Cargando análisis para {model.name}...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
            <p className="font-medium">Datos no disponibles</p>
            <p className="text-sm">{error}</p>
            <p className="text-sm mt-2">Mostrando datos simulados para demostración.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completado de Checklists</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{analytics?.checklistCompletion.thisMonth}%</p>
                  {getTrendIcon(analytics?.checklistCompletion.trend || 'stable')}
                </div>
                <p className={`text-sm ${getTrendColor(analytics?.checklistCompletion.trend || 'stable')}`}>
                  {analytics?.checklistCompletion.trend === 'up' ? '+' : ''}
                  {(analytics?.checklistCompletion.thisMonth || 0) - (analytics?.checklistCompletion.lastMonth || 0)}% vs mes anterior
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tiempo Promedio</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{analytics?.averageCompletionTime.current}min</p>
                  {getTrendIcon(analytics?.averageCompletionTime.trend || 'stable')}
                </div>
                <p className={`text-sm ${getTrendColor(analytics?.averageCompletionTime.trend || 'stable', false)}`}>
                  {analytics?.averageCompletionTime.trend === 'down' ? '-' : '+'}
                  {Math.abs((analytics?.averageCompletionTime.current || 0) - (analytics?.averageCompletionTime.previous || 0))}min vs anterior
                </p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Detección de Problemas</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{analytics?.issueDetectionRate.current}%</p>
                  {getTrendIcon(analytics?.issueDetectionRate.trend || 'stable')}
                </div>
                <p className={`text-sm ${getTrendColor(analytics?.issueDetectionRate.trend || 'stable', false)}`}>
                  {analytics?.issueDetectionRate.trend === 'down' ? '' : '+'}
                  {(analytics?.issueDetectionRate.current || 0) - (analytics?.issueDetectionRate.previous || 0)}% vs anterior
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Maintenance Efficiency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Eficiencia de Mantenimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Mantenimiento Preventivo</span>
                <span>{analytics?.maintenanceEfficiency.preventiveRatio}%</span>
              </div>
              <Progress value={analytics?.maintenanceEfficiency.preventiveRatio} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Meta: 80% preventivo vs correctivo
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {analytics?.maintenanceEfficiency.averageDowntime}h
              </p>
              <p className="text-sm text-muted-foreground">Tiempo promedio de parada</p>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {analytics?.maintenanceEfficiency.mtbf}
              </p>
              <p className="text-sm text-muted-foreground">Días entre fallas (MTBF)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Usage Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Plantillas Más Utilizadas</CardTitle>
            <CardDescription>Top 3 plantillas por uso y efectividad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics?.templateUsage.mostUsed.map((template, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{template.templateName}</p>
                    <p className="text-sm text-muted-foreground">
                      {template.usageCount} usos • {template.successRate}% éxito
                    </p>
                  </div>
                  <Badge variant="secondary">#{index + 1}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plantillas Subutilizadas</CardTitle>
            <CardDescription>Oportunidades de mejora</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics?.templateUsage.leastUsed.map((template, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="font-medium">{template.templateName}</p>
                    <p className="text-sm text-muted-foreground">
                      Solo {template.usageCount} usos
                    </p>
                    {template.reason && (
                      <p className="text-xs text-orange-600 mt-1">{template.reason}</p>
                    )}
                  </div>
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Predictions and Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Tendencias y Recomendaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Predicciones</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Mantenimientos próximos:</span>
                  <Badge variant="outline">{analytics?.upcomingTrends.predictedMaintenanceNeeds} activos</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Patrón estacional:</strong> {analytics?.upcomingTrends.seasonalPatterns}
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Recomendaciones</h4>
              <ul className="space-y-1 text-sm">
                {analytics?.upcomingTrends.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 