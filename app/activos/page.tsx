'use client';

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AssetsList } from "@/components/assets/assets-list"
import { Plus, Calendar, CheckCircle, AlertTriangle, Package, Wrench, FileText, Settings, BarChart3, MoreVertical, Network } from "lucide-react"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { useIsMobile } from "@/hooks/use-mobile"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Asset } from "@/types"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface AssetStats {
  total: number
  operational: number
  maintenance: number
  repair: number
  inactive: number
  criticalAlerts: number
}

interface DashboardData {
  assets: Asset[]
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
  const isMobile = useIsMobile()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDashboardData = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const handlePullToRefresh = async () => {
    await fetchDashboardData()
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  
  return (
    <PullToRefresh onRefresh={handlePullToRefresh} disabled={loading}>
    <DashboardShell className="activos-module">
      <DashboardHeader
        heading="Gestión de Activos"
        text="Administra y supervisa todos los equipos de la empresa"
        id="activos-header"
      >
        <div className="flex gap-2">
          {isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="touch-target h-11 w-11" aria-label="Abrir menú de acciones">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/activos/flota">
                    <Network className="mr-2 h-4 w-4" />
                    Vista de Flota
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/activos/reportes">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Reportes
                  </Link>
                </DropdownMenuItem>
                {ui.canShowCreateButton('assets') && (
                  <DropdownMenuItem asChild>
                    <Link href="/activos/crear">
                      <Plus className="mr-2 h-4 w-4" />
                      Nuevo Activo
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="outline" asChild size="default">
                <Link href="/activos/flota">
                  <Network className="mr-2 h-4 w-4" />
                  Flota
                </Link>
              </Button>
              <Button variant="outline" asChild size="default">
                <Link href="/activos/reportes">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Reportes
                </Link>
              </Button>
              {ui.canShowCreateButton('assets') && (
                <Button asChild size="default">
                  <Link href="/activos/crear">
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Activo
                  </Link>
                </Button>
              )}
            </>
          )}
        </div>
      </DashboardHeader>

      <Card className="mb-4 border-primary/20 bg-muted/30">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <div>
            <CardTitle className="text-base">Vista de Flota</CardTitle>
            <p className="text-sm text-muted-foreground">
              Árbol por unidad/planta/modelo, confianza de datos y edición rápida
            </p>
          </div>
          <Button asChild>
            <Link href="/activos/flota">
              <Network className="mr-2 h-4 w-4" />
              Abrir Flota
            </Link>
          </Button>
        </CardHeader>
      </Card>
      
      {/* Summary Cards - compact on mobile to save space */}
      <div className={cn("grid mb-4", isMobile ? "grid-cols-2 gap-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4")}>
        {/* Total Assets */}
        <Card className={cn(isMobile && "px-2 py-2")}>
          <CardHeader className={cn("flex flex-row items-center justify-between space-y-0", isMobile ? "p-0" : "pb-2")}>
            <CardTitle className={cn("font-medium", isMobile ? "text-xs truncate" : "text-sm")}>Total</CardTitle>
            {!isMobile && <Package className="h-4 w-4 text-muted-foreground shrink-0" />}
          </CardHeader>
          <CardContent className={cn(isMobile ? "p-0 pt-1" : "pt-0")}>
            {loading ? (
              <Skeleton className={cn(isMobile ? "h-5" : "h-7")} />
            ) : (
              <div className={cn("font-bold", isMobile ? "text-base" : "text-2xl")}>
                {data?.stats.total || 0}
              </div>
            )}
            {!isMobile && (
              <p className="text-xs text-muted-foreground mt-1">Equipos registrados</p>
            )}
          </CardContent>
        </Card>

        {/* Operational Assets */}
        <Card className={cn(isMobile && "px-2 py-2")}>
          <CardHeader className={cn("flex flex-row items-center justify-between space-y-0", isMobile ? "p-0" : "pb-2")}>
            <CardTitle className={cn("font-medium", isMobile ? "text-xs truncate" : "text-sm")}>Operativos</CardTitle>
            {!isMobile && <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
          </CardHeader>
          <CardContent className={cn(isMobile ? "p-0 pt-1" : "pt-0")}>
            {loading ? (
              <Skeleton className={cn(isMobile ? "h-5" : "h-7")} />
            ) : (
              <div className={cn("font-bold text-green-600", isMobile ? "text-base" : "text-2xl")}>
                {data?.stats.operational || 0}
              </div>
            )}
            {!isMobile && (
              <p className="text-xs text-muted-foreground mt-1">
                {`${Math.round(((data?.stats.operational || 0) / (data?.stats.total || 1)) * 100)}%`} del total
              </p>
            )}
          </CardContent>
        </Card>

        {/* Maintenance & Repair */}
        <Card className={cn(isMobile && "px-2 py-2")}>
          <CardHeader className={cn("flex flex-row items-center justify-between space-y-0", isMobile ? "p-0" : "pb-2")}>
            <CardTitle className={cn("font-medium", isMobile ? "text-xs truncate" : "text-sm")}>Mant./Rep.</CardTitle>
            {!isMobile && <Wrench className="h-4 w-4 text-amber-600 shrink-0" />}
          </CardHeader>
          <CardContent className={cn(isMobile ? "p-0 pt-1" : "pt-0")}>
            {loading ? (
              <Skeleton className={cn(isMobile ? "h-5" : "h-7")} />
            ) : (
              <div className={cn("font-bold text-amber-600", isMobile ? "text-base" : "text-2xl")}>
                {(data?.stats.maintenance || 0) + (data?.stats.repair || 0)}
              </div>
            )}
            {!isMobile && (
              <p className="text-xs text-muted-foreground mt-1">
                {data?.stats.maintenance || 0} mant. + {data?.stats.repair || 0} rep.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Critical Alerts */}
        <Link
          href="/incidentes"
          className="block"
          aria-label={data?.stats?.criticalAlerts ? `Ver ${data.stats.criticalAlerts} alertas críticas` : "Ir a incidentes"}
        >
          <Card className={cn("cursor-pointer hover:shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none", isMobile && "px-2 py-2")}>
            <CardHeader className={cn("flex flex-row items-center justify-between space-y-0", isMobile ? "p-0" : "pb-2")}>
              <CardTitle className={cn("font-medium", isMobile ? "text-xs truncate" : "text-sm")}>Alertas</CardTitle>
              {!isMobile && <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />}
            </CardHeader>
            <CardContent className={cn(isMobile ? "p-0 pt-1" : "pt-0")}>
              {loading ? (
                <Skeleton className={cn(isMobile ? "h-5" : "h-7")} />
              ) : (
                <div className={cn("font-bold text-red-600", isMobile ? "text-base" : "text-2xl")}>
                  {data?.stats.criticalAlerts || 0}
                </div>
              )}
              {!isMobile && (
                <p className="text-xs text-muted-foreground mt-1">Requieren atención inmediata</p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions - collapsed to dropdown on mobile to save space */}
      <div className={cn("mb-4", isMobile ? "flex justify-end" : "")}>
        {isMobile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="touch-target" aria-label="Abrir menú de acciones rápidas">
                <Wrench className="h-4 w-4 mr-2" />
                Acciones
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {ui.shouldShowInNavigation('maintenance') && (
                <DropdownMenuItem asChild>
                  <Link href="/calendario">
                    <Calendar className="h-4 w-4 mr-2" />
                    Calendario
                  </Link>
                </DropdownMenuItem>
              )}
              {ui.canShowCreateButton('maintenance') && (
                <DropdownMenuItem asChild>
                  <Link href="/modelos">
                    <Settings className="h-4 w-4 mr-2" />
                    Modelos
                  </Link>
                </DropdownMenuItem>
              )}
              {ui.shouldShowInNavigation('reports') && (
                <DropdownMenuItem asChild>
                  <Link href="/reportes">
                    <FileText className="h-4 w-4 mr-2" />
                    Reportes
                  </Link>
                </DropdownMenuItem>
              )}
              {ui.shouldShowInNavigation('maintenance') && (
                <DropdownMenuItem asChild>
                  <Link href="/preventivo">
                    <Wrench className="h-4 w-4 mr-2" />
                    Preventivo
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
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
        )}
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
    </PullToRefresh>
  )
}
