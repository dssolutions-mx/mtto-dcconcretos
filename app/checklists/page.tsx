"use client"

import type { Metadata } from "next"
import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, FileDown, ClipboardCheck, Loader2, Trash2 } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { DailyChecklistList } from "@/components/checklists/daily-checklist-list"
import { WeeklyChecklistList } from "@/components/checklists/weekly-checklist-list"
import { MonthlyChecklistList } from "@/components/checklists/monthly-checklist-list"
import { ChecklistTemplateList } from "@/components/checklists/checklist-template-list"
import { useChecklistSchedules, useChecklistTemplates } from "@/hooks/useChecklists"
import { toast } from "sonner"

// Create a client component that uses useSearchParams
function ChecklistsContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const { schedules, loading, error, fetchSchedules } = useChecklistSchedules()
  const { templates, fetchTemplates } = useChecklistTemplates()
  const [activeTab, setActiveTab] = useState('overview')
  const [cleaningUp, setCleaningUp] = useState(false)
  const [stats, setStats] = useState({
    daily: { total: 0, pending: 0 },
    weekly: { total: 0, pending: 0, overdue: 0 },
    monthly: { total: 0, pending: 0, overdue: 0 },
    templates: 0
  })
  
  // Set active tab from URL parameter if present
  useEffect(() => {
    if (tabParam && ['overview', 'daily', 'weekly', 'monthly', 'templates'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  // Fetch schedules on mount
  useEffect(() => {
    fetchSchedules('pendiente')
    fetchTemplates()
  }, [fetchSchedules, fetchTemplates])
  
  // Update stats when schedules and templates change
  useEffect(() => {
    if (schedules.length > 0 || templates.length > 0) {
      // Process the schedule data to get counts
      const dailyItems = schedules.filter(s => s.checklists?.frequency === 'diario')
      const weeklyItems = schedules.filter(s => s.checklists?.frequency === 'semanal')
      const monthlyItems = schedules.filter(s => s.checklists?.frequency === 'mensual')
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Calculate overdue items (scheduled_date is in the past)
      const overdueWeekly = weeklyItems.filter(s => new Date(s.scheduled_date) < today).length
      const overdueMonthly = monthlyItems.filter(s => new Date(s.scheduled_date) < today).length
      
      // Calculate pending today items
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const pendingToday = dailyItems.filter(s => {
        const date = new Date(s.scheduled_date)
        return date >= today && date < tomorrow
      }).length
      
      setStats({
        daily: { 
          total: dailyItems.length, 
          pending: pendingToday
        },
        weekly: { 
          total: weeklyItems.length, 
          pending: weeklyItems.length, 
          overdue: overdueWeekly 
        },
        monthly: { 
          total: monthlyItems.length, 
          pending: monthlyItems.length, 
          overdue: overdueMonthly 
        },
        templates: templates.length
      })
    }
  }, [schedules, templates])

  // Function to clean up duplicates
  const handleCleanupDuplicates = async () => {
    setCleaningUp(true)
    try {
      const response = await fetch('/api/checklists/schedules?cleanup=true')
      const result = await response.json()
      
      if (response.ok) {
        toast.success(result.message)
        // Recargar los schedules después de la limpieza
        fetchSchedules('pendiente')
      } else {
        throw new Error(result.error || 'Error durante la limpieza')
      }
    } catch (error: any) {
      console.error('Error cleaning duplicates:', error)
      toast.error(`Error al limpiar duplicados: ${error.message}`)
    } finally {
      setCleaningUp(false)
    }
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Checklists de Mantenimiento"
        text="Gestiona los checklists para diferentes frecuencias de mantenimiento."
      >
        <div className="flex gap-2">
          <Button variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" asChild>
            <Link href="/checklists/programar">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Programar Checklist
            </Link>
          </Button>
          <Button asChild>
            <Link href="/checklists/crear">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Plantilla
            </Link>
          </Button>
          <Button 
            variant="outline" 
            onClick={handleCleanupDuplicates}
            disabled={cleaningUp}
          >
            {cleaningUp ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {cleaningUp ? 'Limpiando...' : 'Limpiar Duplicados'}
          </Button>
        </div>
      </DashboardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="daily">Diarios</TabsTrigger>
          <TabsTrigger value="weekly">Semanales</TabsTrigger>
          <TabsTrigger value="monthly">Mensuales</TabsTrigger>
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Cargando datos...</span>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/checklists/diarios" className="block">
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Checklists Diarios</CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.daily.total}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.daily.pending} pendientes hoy
                      </p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/checklists/semanales" className="block">
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Checklists Semanales</CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.weekly.total}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.weekly.overdue > 0 ? `${stats.weekly.overdue} atrasados` : 'Al día'}
                      </p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/checklists/mensuales" className="block">
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Checklists Mensuales</CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.monthly.total}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.monthly.overdue > 0 ? `${stats.monthly.overdue} atrasados` : 'Al día'}
                      </p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/checklists" className="block">
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Plantillas</CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.templates}</div>
                      <p className="text-xs text-muted-foreground">Para diferentes equipos</p>
                    </CardContent>
                  </Card>
                </Link>
              </div>

              <div className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Checklists Pendientes</CardTitle>
                    <CardDescription>Checklists que requieren atención inmediata</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {error ? (
                      <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
                        <p className="font-medium">Error al cargar los checklists</p>
                        <p className="text-sm">{error}</p>
                      </div>
                    ) : schedules.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No hay checklists pendientes en este momento.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {schedules
                          .filter(checklist => {
                            // Find checklists that are overdue or due today
                            const scheduledDate = new Date(checklist.scheduled_date)
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            const isOverdue = scheduledDate < today
                            
                            const tomorrow = new Date(today)
                            tomorrow.setDate(tomorrow.getDate() + 1)
                            const isDueToday = scheduledDate >= today && scheduledDate < tomorrow
                            
                            return isOverdue || isDueToday
                          })
                          .slice(0, 3) // Limit to 3 items for display
                          .map(checklist => (
                            <Link 
                              key={checklist.id} 
                              href={`/checklists/ejecutar/${checklist.id}`} 
                              className="block"
                            >
                              <Card className={`hover:bg-muted/50 transition-colors ${
                                new Date(checklist.scheduled_date) < new Date() ? 'border-amber-200' : ''
                              }`}>
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <h4 className="font-semibold">
                                        {checklist.checklists?.name || 'Checklist sin nombre'}
                                      </h4>
                                      <p className="text-sm text-muted-foreground">
                                        {checklist.assets?.name || 'Sin activo asignado'}
                                        {new Date(checklist.scheduled_date) < new Date() && 
                                          ` - Atrasado - Debió ejecutarse el ${
                                            new Date(checklist.scheduled_date).toLocaleDateString()
                                          }`
                                        }
                                      </p>
                                    </div>
                                    <Button 
                                      size="sm" 
                                      variant={new Date(checklist.scheduled_date) < new Date() ? "destructive" : "default"}
                                    >
                                      {new Date(checklist.scheduled_date) < new Date() ? 'Urgente' : 'Ejecutar'}
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            </Link>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="daily">
          <DailyChecklistList />
        </TabsContent>

        <TabsContent value="weekly">
          <WeeklyChecklistList />
        </TabsContent>

        <TabsContent value="monthly">
          <MonthlyChecklistList />
        </TabsContent>

        <TabsContent value="templates">
          <ChecklistTemplateList />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}

// Main page component with Suspense boundary
export default function ChecklistsPage() {
  return (
    <Suspense fallback={
      <DashboardShell>
        <DashboardHeader
          heading="Checklists de Mantenimiento"
          text="Cargando..."
        />
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Cargando datos...</span>
        </div>
      </DashboardShell>
    }>
      <ChecklistsContent />
    </Suspense>
  )
}
