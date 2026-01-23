'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  FileText,
  Users,
  Package
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ComplianceTrafficLightWidget } from './compliance-traffic-light'
import { ComplianceNotificationCenter } from './compliance-notification-center'
import { ForgottenAssetsView } from './forgotten-assets-view'
import type { ComplianceDashboardStats, AssetAccountabilityTracking } from '@/types/compliance'

export function ComplianceDashboard() {
  const [stats, setStats] = useState<ComplianceDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const supabase = createClient()
      
      // Fetch asset accountability tracking
      const { data: tracking, error: trackingError } = await supabase
        .from('asset_accountability_tracking')
        .select('alert_level, has_operator')
        .order('alert_level', { ascending: false })

      if (trackingError) throw trackingError

      // Calculate stats
      const totalAssets = tracking?.length || 0
      const compliantAssets = tracking?.filter(t => t.alert_level === 'ok').length || 0
      const warningAssets = tracking?.filter(t => t.alert_level === 'warning').length || 0
      const criticalAssets = tracking?.filter(t => t.alert_level === 'critical').length || 0
      const emergencyAssets = tracking?.filter(t => t.alert_level === 'emergency').length || 0
      const assetsWithoutOperator = tracking?.filter(t => !t.has_operator).length || 0

      // Calculate average days overdue
      const { data: overdueData, error: overdueError } = await supabase
        .from('asset_accountability_tracking')
        .select('days_without_checklist')
        .in('alert_level', ['warning', 'critical', 'emergency'])

      if (overdueError) throw overdueError

      const totalDaysOverdue = overdueData?.reduce((sum, item) => sum + (item.days_without_checklist || 0), 0) || 0
      const avgDaysOverdue = overdueData && overdueData.length > 0 
        ? totalDaysOverdue / overdueData.length 
        : 0

      const complianceRate = totalAssets > 0 
        ? (compliantAssets / totalAssets) * 100 
        : 100

      setStats({
        total_assets: totalAssets,
        compliant_assets: compliantAssets,
        warning_assets: warningAssets,
        critical_assets: criticalAssets,
        emergency_assets: emergencyAssets,
        assets_without_operator: assetsWithoutOperator,
        compliance_rate: complianceRate,
        average_days_overdue: avgDaysOverdue
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshData = async () => {
    setRefreshing(true)
    try {
      const supabase = createClient()
      // Trigger refresh function
      const { error } = await supabase.rpc('refresh_asset_accountability')
      if (error) throw error
      
      // Wait a bit for the function to complete
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      await fetchDashboardData()
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" data-tour="compliance-dashboard" id="compliance-dashboard-page">
      {/* Header */}
      <div id="compliance-dashboard-header" className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Cumplimiento y Gobernanza
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitoreo y gestión de cumplimiento de políticas y activos
          </p>
        </div>
        <Button onClick={refreshData} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total_assets}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Activos monitoreados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tasa de Cumplimiento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold flex items-center gap-2">
                {stats.compliance_rate.toFixed(1)}%
                {stats.compliance_rate >= 95 ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.compliant_assets} de {stats.total_assets} activos
              </p>
            </CardContent>
          </Card>

          <Card className={stats.assets_without_operator > 0 ? 'border-orange-200 bg-orange-50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sin Operador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {stats.assets_without_operator}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Requieren asignación
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Promedio Días Atrasados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats.average_days_overdue.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Días promedio sin checklist
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="forgotten">Activos Olvidados</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          <TabsTrigger value="policies">Políticas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {stats && (
              <div data-tour="compliance-widget">
                <ComplianceTrafficLightWidget
                  okCount={stats.compliant_assets}
                  warningCount={stats.warning_assets}
                  criticalCount={stats.critical_assets}
                  emergencyCount={stats.emergency_assets}
                  totalCount={stats.total_assets}
                />
              </div>
            )}
            
            <Card>
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
                <CardDescription>
                  Accesos directos a funciones de cumplimiento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/compliance/activos-olvidados">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Ver Activos Olvidados
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/compliance/incidentes">
                    <FileText className="mr-2 h-4 w-4" />
                    Incidentes de Cumplimiento
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/compliance/sanciones">
                    <Shield className="mr-2 h-4 w-4" />
                    Sanciones Aplicadas
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/compliance/configuracion">
                    <Package className="mr-2 h-4 w-4" />
                    Configuración del Sistema
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="forgotten">
          <ForgottenAssetsView />
        </TabsContent>

        <TabsContent value="notifications">
          <ComplianceNotificationCenter maxItems={20} />
        </TabsContent>

        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle>Políticas de la Empresa</CardTitle>
              <CardDescription>
                Gestión y visualización de políticas activas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                La gestión de políticas estará disponible próximamente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
