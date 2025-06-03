'use client';

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AssetsList } from "@/components/assets/assets-list"
import { Plus, Calendar, CheckCircle, AlertTriangle, Package, Wrench, FileText, Settings } from "lucide-react"
import { useAssets } from "@/hooks/useSupabase"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"

interface AssetStats {
  total: number
  operational: number
  maintenance: number
  repair: number
  inactive: number
  criticalAlerts: number
}

export default function AssetsPage() {
  const { assets, loading: assetsLoading, error: assetsError, refetch } = useAssets()
  const [stats, setStats] = useState<AssetStats>({
    total: 0,
    operational: 0,
    maintenance: 0,
    repair: 0,
    inactive: 0,
    criticalAlerts: 0
  })
  const [statsLoading, setStatsLoading] = useState(true)

  // Calculate asset statistics with maintenance data
  useEffect(() => {
    const calculateStats = async () => {
      if (!assets || assets.length === 0) {
        setStats({
          total: 0,
          operational: 0,
          maintenance: 0,
          repair: 0,
          inactive: 0,
          criticalAlerts: 0
        })
        setStatsLoading(false)
        return
      }

      try {
        setStatsLoading(true)
        
        // Count basic status
        const total = assets.length
        const operational = assets.filter(a => a.status === 'operational').length
        const maintenance = assets.filter(a => a.status === 'maintenance').length
        const repair = assets.filter(a => a.status === 'repair').length
        const inactive = assets.filter(a => a.status === 'inactive').length

        // Calculate critical alerts (overdue maintenance + pending incidents)
        const supabase = createClient()
        
        // Get upcoming maintenance for all assets to check for overdue
        const response = await fetch('/api/calendar/upcoming-maintenance')
        const maintenanceData = await response.json()
        const overdueCount = maintenanceData.upcomingMaintenances?.filter((m: any) => 
          m.status === 'overdue'
        ).length || 0

        // Get pending incidents count
        const { data: incidents } = await supabase
          .from('incident_history')
          .select('id, status')
          .eq('status', 'Pendiente')
        
        const pendingIncidents = incidents?.length || 0
        const criticalAlerts = overdueCount + pendingIncidents

        setStats({
          total,
          operational,
          maintenance,
          repair,
          inactive,
          criticalAlerts
        })
      } catch (error) {
        console.error('Error calculating stats:', error)
        // Fallback to basic stats without maintenance data
        const total = assets.length
        const operational = assets.filter(a => a.status === 'operational').length
        const maintenance = assets.filter(a => a.status === 'maintenance').length
        const repair = assets.filter(a => a.status === 'repair').length
        const inactive = assets.filter(a => a.status === 'inactive').length

        setStats({
          total,
          operational,
          maintenance,
          repair,
          inactive,
          criticalAlerts: 0
        })
      } finally {
        setStatsLoading(false)
      }
    }

    calculateStats()
  }, [assets])
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Gestión de Activos"
        text="Administra y supervisa todos los equipos de la empresa"
      >
        {/* Primary action - most important */}
        <Button asChild size="default">
          <Link href="/activos/crear">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Activo
          </Link>
        </Button>
      </DashboardHeader>
      
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Total Assets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Activos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats.total}
            </div>
            <p className="text-xs text-muted-foreground">
              Equipos registrados
            </p>
          </CardContent>
        </Card>

        {/* Operational Assets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statsLoading ? '...' : stats.operational}
            </div>
            <p className="text-xs text-muted-foreground">
              {statsLoading ? '...' : `${Math.round((stats.operational / stats.total) * 100) || 0}%`} del total
            </p>
          </CardContent>
        </Card>

        {/* Maintenance & Repair */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mantenimiento/Reparación</CardTitle>
            <Wrench className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {statsLoading ? '...' : stats.maintenance + stats.repair}
            </div>
            <p className="text-xs text-muted-foreground">
              {statsLoading ? '...' : `${stats.maintenance} mant. + ${stats.repair} rep.`}
            </p>
          </CardContent>
        </Card>

        {/* Critical Alerts */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/incidentes'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Críticas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statsLoading ? '...' : stats.criticalAlerts}
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren atención inmediata
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Streamlined Quick Actions */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-medium">Acciones Rápidas</h3>
          
          <div className="flex flex-wrap gap-2">
            {/* Calendar - High priority */}
            <Button variant="outline" size="sm" asChild>
              <Link href="/calendario">
                <Calendar className="h-4 w-4 mr-2" />
                Calendario
              </Link>
            </Button>
            
            {/* Models management */}
            <Button variant="outline" size="sm" asChild>
              <Link href="/modelos">
                <Settings className="h-4 w-4 mr-2" />
                Modelos
              </Link>
            </Button>
            
            {/* Reports */}
            <Button variant="outline" size="sm" asChild>
              <Link href="/reportes">
                <FileText className="h-4 w-4 mr-2" />
                Reportes
              </Link>
            </Button>

            {/* Preventive maintenance overview */}
            <Button variant="outline" size="sm" asChild>
              <Link href="/preventivo">
                <Wrench className="h-4 w-4 mr-2" />
                Preventivo
              </Link>
            </Button>
          </div>
        </div>
      </div>
      
      {assetsError && (
        <Alert variant="destructive">
          <AlertDescription>Error al cargar los activos: {assetsError.message}</AlertDescription>
        </Alert>
      )}
      
      <AssetsList 
        assets={assets || []} 
        isLoading={assetsLoading}
        onRefresh={refetch}
      />
    </DashboardShell>
  )
}
