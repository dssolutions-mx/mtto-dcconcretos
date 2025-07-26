"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  FileText, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Calendar,
  Factory,
  Plus,
  Eye,
  TrendingUp,
  Loader2
} from "lucide-react"
import Link from "next/link"
import { EquipmentModel } from "@/types"

interface ModelOverviewTabProps {
  model: EquipmentModel
}

interface ModelStats {
  templatesCount: number
  assetsCount: number
  completedChecklistsCount: number
  pendingIssuesCount: number
  averageCompletionRate: number
  recentActivity: {
    checklistsCompletedThisWeek: number
    templatesCreatedThisMonth: number
    newAssetsThisMonth: number
  }
}

export function ModelOverviewTab({ model }: ModelOverviewTabProps) {
  const [stats, setStats] = useState<ModelStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchModelStats = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch model statistics from API
        const response = await fetch(`/api/models/${model.id}/stats`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Error al cargar estadísticas del modelo')
        }

        const data = await response.json()
        setStats(data)
      } catch (err) {
        console.error('Error fetching model stats:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
        // Set default stats for now
        setStats({
          templatesCount: 0,
          assetsCount: 0,
          completedChecklistsCount: 0,
          pendingIssuesCount: 0,
          averageCompletionRate: 0,
          recentActivity: {
            checklistsCompletedThisWeek: 0,
            templatesCreatedThisMonth: 0,
            newAssetsThisMonth: 0
          }
        })
      } finally {
        setLoading(false)
      }
    }

    fetchModelStats()
  }, [model.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p>Cargando estadísticas del modelo...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md">
            <p className="font-medium">Advertencia</p>
            <p className="text-sm">{error}</p>
            <p className="text-sm mt-2">Mostrando información básica del modelo.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Model Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Información del Modelo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nombre</label>
              <p className="text-lg font-semibold">{model.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Fabricante</label>
              <p className="text-lg">{model.manufacturer}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Categoría</label>
              <Badge variant="secondary" className="mt-1">
                {model.category}
              </Badge>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Fecha de creación</label>
              <p className="text-sm">
                {model.created_at ? new Date(model.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
          
          {model.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Descripción</label>
              <p className="text-sm mt-1">{model.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Plantillas</p>
                <p className="text-2xl font-bold">{stats?.templatesCount || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Activos</p>
                <p className="text-2xl font-bold">{stats?.assetsCount || 0}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Checklists Completados</p>
                <p className="text-2xl font-bold">{stats?.completedChecklistsCount || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Problemas Pendientes</p>
                <p className="text-2xl font-bold">{stats?.pendingIssuesCount || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Rendimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Tasa de Finalización Promedio</span>
              <span>{Math.round(stats?.averageCompletionRate || 0)}%</span>
            </div>
            <Progress value={stats?.averageCompletionRate || 0} className="h-2" />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {stats?.recentActivity?.checklistsCompletedThisWeek || 0}
              </p>
              <p className="text-sm text-muted-foreground">Checklists esta semana</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {stats?.recentActivity?.templatesCreatedThisMonth || 0}
              </p>
              <p className="text-sm text-muted-foreground">Plantillas este mes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {stats?.recentActivity?.newAssetsThisMonth || 0}
              </p>
              <p className="text-sm text-muted-foreground">Activos este mes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Gestiona plantillas, activos y mantenimiento para este modelo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button asChild className="h-auto p-4 flex-col gap-2">
              <Link href={`/checklists/crear?model=${model.id}`}>
                <Plus className="h-5 w-5" />
                <span className="text-sm">Nueva Plantilla</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-auto p-4 flex-col gap-2">
              <Link href={`/activos/crear?model=${model.id}`}>
                <Users className="h-5 w-5" />
                <span className="text-sm">Registrar Activo</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-auto p-4 flex-col gap-2">
              <Link href={`/modelos/${model.id}`}>
                <Eye className="h-5 w-5" />
                <span className="text-sm">Ver Modelo</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-auto p-4 flex-col gap-2">
              <Link href={`/checklists/programar?model=${model.id}`}>
                <Calendar className="h-5 w-5" />
                <span className="text-sm">Programar Checklist</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 