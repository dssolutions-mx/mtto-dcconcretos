"use client"

import { useState } from 'react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ClipboardCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Truck, 
  User, 
  Calendar,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { useOperatorChecklists } from '@/hooks/useOperatorChecklists'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function OperatorDashboard() {
  const { data, loading, error, isOperator, refetch } = useOperatorChecklists()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  if (!isOperator) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Acceso Denegado"
          text="Esta página es solo para operadores."
        />
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Solo los operadores pueden acceder a esta página. Si crees que esto es un error, contacta a tu supervisor.
          </AlertDescription>
        </Alert>
      </DashboardShell>
    )
  }

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Cargando..."
          text="Preparando tu dashboard de operador."
        />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    )
  }

  if (error) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Error"
          text="No se pudo cargar tu información."
        />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        <Button onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Reintentar
        </Button>
      </DashboardShell>
    )
  }

  if (!data) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Sin Datos"
          text="No se encontró información para tu perfil."
        />
      </DashboardShell>
    )
  }

  const { operator, assigned_assets, today_checklists, overdue_checklists, upcoming_checklists, stats } = data

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Bienvenido, ${operator.nombre} ${operator.apellido}`}
        text="Aquí tienes un resumen de tus activos asignados y checklists pendientes."
      >
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Actualizar
        </Button>
      </DashboardHeader>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos Asignados</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_assets}</div>
            <p className="text-xs text-muted-foreground">
              Activos bajo tu responsabilidad
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checklists Hoy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.today_checklists}</div>
            <p className="text-xs text-muted-foreground">
              Para completar hoy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue_checklists}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención inmediata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.upcoming_checklists}</div>
            <p className="text-xs text-muted-foreground">
              Programados para después
            </p>
          </CardContent>
        </Card>
      </div>

      {/* No Assets Assigned */}
      {assigned_assets.length === 0 && (
        <Alert>
          <User className="h-4 w-4" />
          <AlertDescription>
            <strong>No tienes activos asignados.</strong> Contacta a tu supervisor para que te asigne activos.
          </AlertDescription>
        </Alert>
      )}

      {/* Overdue Checklists - Priority */}
      {overdue_checklists.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              Checklists Atrasados - ¡Atención Inmediata!
            </CardTitle>
            <CardDescription className="text-red-700">
              Estos checklists están atrasados y requieren tu atención inmediata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdue_checklists.slice(0, 5).map((checklist) => (
                <div key={checklist.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Atrasado</Badge>
                      <span className="font-medium">{checklist.checklists?.name}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {checklist.assigned_asset?.name} ({checklist.assigned_asset?.asset_id})
                    </p>
                    <p className="text-xs text-red-600">
                      Programado para: {format(new Date(checklist.scheduled_date), 'PPP', { locale: es })}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/checklists/ejecutar/${checklist.id}`}>
                      Ejecutar
                    </Link>
                  </Button>
                </div>
              ))}
              {overdue_checklists.length > 5 && (
                <div className="text-center">
                  <Button variant="outline" asChild>
                    <Link href="/checklists?tab=overdue">
                      Ver todos ({overdue_checklists.length})
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Checklists */}
      {today_checklists.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Calendar className="h-5 w-5" />
              Checklists para Hoy
            </CardTitle>
            <CardDescription className="text-blue-700">
              Estos checklists están programados para completarse hoy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {today_checklists.slice(0, 5).map((checklist) => (
                <div key={checklist.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">Hoy</Badge>
                      <span className="font-medium">{checklist.checklists?.name}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {checklist.assigned_asset?.name} ({checklist.assigned_asset?.asset_id})
                    </p>
                    <p className="text-xs text-blue-600">
                      Frecuencia: {checklist.checklists?.frequency}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/checklists/ejecutar/${checklist.id}`}>
                      Ejecutar
                    </Link>
                  </Button>
                </div>
              ))}
              {today_checklists.length > 5 && (
                <div className="text-center">
                  <Button variant="outline" asChild>
                    <Link href="/checklists?tab=today">
                      Ver todos ({today_checklists.length})
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assigned Assets */}
      {assigned_assets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Mis Activos Asignados
            </CardTitle>
            <CardDescription>
              Activos bajo tu responsabilidad y su estado actual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assigned_assets.map((asset) => (
                <div key={asset.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{asset.name}</h3>
                    <Badge variant={asset.status === 'operational' ? 'default' : 'secondary'}>
                      {asset.status === 'operational' ? 'Operativo' : asset.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    ID: {asset.asset_id}
                  </p>
                  {asset.location && (
                    <p className="text-sm text-gray-600 mb-2">
                      Ubicación: {asset.location}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {asset.assignment_type === 'primary' ? 'Principal' : 'Secundario'}
                    </Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/checklists/assets?asset=${asset.id}`}>
                        Ver Checklists
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>
            Acceso directo a las funciones más importantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Button asChild className="h-auto flex flex-col p-4">
              <Link href="/checklists">
                <ClipboardCheck className="h-6 w-6 mb-2" />
                <span className="font-medium">Todos mis Checklists</span>
                <span className="text-sm text-muted-foreground">Ver todos los checklists</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-auto flex flex-col p-4">
              <Link href="/checklists/assets">
                <Truck className="h-6 w-6 mb-2" />
                <span className="font-medium">Vista por Activos</span>
                <span className="text-sm text-muted-foreground">Organizado por activo</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-auto flex flex-col p-4">
              <Link href="/checklists/problemas-pendientes">
                <AlertTriangle className="h-6 w-6 mb-2" />
                <span className="font-medium">Problemas Pendientes</span>
                <span className="text-sm text-muted-foreground">Ver problemas reportados</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  )
} 