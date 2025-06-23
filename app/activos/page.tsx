'use client';

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AssetsList } from "@/components/assets/assets-list"
import { Plus, Calendar, CheckCircle, AlertTriangle, Package, Wrench, FileText, Settings } from "lucide-react"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { toast } from "sonner"

interface AssetStats {
  total: number
  operational: number
  maintenance: number
  repair: number
  inactive: number
  criticalAlerts: number
}

interface DashboardData {
  assets: any[]
  stats: AssetStats
  locations: string[]
  departments: string[]
  metadata: {
    total_maintenance_items: number
    total_incidents: number
    total_pending_schedules: number
  }
}

export default function AssetsPage() {
  const { ui } = useAuthZustand()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Fetch optimized dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/assets/dashboard')
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        setData(result.data)
        setError(null)
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError(err instanceof Error ? err : new Error(String(err)))
        toast.error('Error al cargar los datos de activos')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Gestión de Activos"
        text="Administra y supervisa todos los equipos de la empresa"
      >
        {ui.canShowCreateButton('assets') && (
          <Button asChild size="default">
            <Link href="/activos/crear">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Activo
            </Link>
          </Button>
        )}
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
              {loading ? '...' : data?.stats.total || 0}
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
              {loading ? '...' : data?.stats.operational || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? '...' : `${Math.round(((data?.stats.operational || 0) / (data?.stats.total || 1)) * 100)}%`} del total
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
              {loading ? '...' : (data?.stats.maintenance || 0) + (data?.stats.repair || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? '...' : `${data?.stats.maintenance || 0} mant. + ${data?.stats.repair || 0} rep.`}
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
              {loading ? '...' : data?.stats.criticalAlerts || 0}
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
            {ui.shouldShowInNavigation('maintenance') && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/calendario">
                  <Calendar className="h-4 w-4 mr-2" />
                  Calendario
                </Link>
              </Button>
            )}
            {ui.canShowCreateButton('maintenance') && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/modelos">
                  <Settings className="h-4 w-4 mr-2" />
                  Modelos
                </Link>
              </Button>
            )}
            {ui.shouldShowInNavigation('reports') && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/reportes">
                  <FileText className="h-4 w-4 mr-2" />
                  Reportes
                </Link>
              </Button>
            )}
            {ui.shouldShowInNavigation('maintenance') && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/preventivo">
                  <Wrench className="h-4 w-4 mr-2" />
                  Preventivo
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>Error al cargar los activos: {error.message}</AlertDescription>
        </Alert>
      )}
      
      {/* Use original AssetsList component */}
      <AssetsList 
        assets={data?.assets || []} 
        loading={loading}
        error={error}
      />
    </DashboardShell>
  )
}
