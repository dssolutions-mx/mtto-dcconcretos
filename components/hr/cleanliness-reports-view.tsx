"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, 
  TrendingUp, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  XCircle,
  Calendar,
  Trophy
} from 'lucide-react'
import { toast } from 'sonner'

interface CleanlinessReport {
  id: string
  asset_name: string
  asset_code: string
  technician_name: string
  completed_date: string
  interior_status: 'pass' | 'fail'
  exterior_status: 'pass' | 'fail'
  interior_notes: string
  exterior_notes: string
  overall_score: number
  passed_both: boolean
}

interface CleanlinessStats {
  total_evaluations: number
  pass_rate: number
  passed_count: number
  top_performers: Array<{
    technician: string
    score: number
    evaluations: number
  }>
}

export function CleanlinessReportsView() {
  const [reports, setReports] = useState<CleanlinessReport[]>([])
  const [stats, setStats] = useState<CleanlinessStats>({
    total_evaluations: 0,
    pass_rate: 0,
    passed_count: 0,
    top_performers: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('current_month')
  const [filterTechnician, setFilterTechnician] = useState('')

  useEffect(() => {
    loadCleanlinessData()
  }, [selectedPeriod])

  const loadCleanlinessData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Calculate date range based on selected period
      const now = new Date()
      let startDate: string
      let endDate = now.toISOString()
      
      switch (selectedPeriod) {
        case 'current_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
          break
        case 'last_month':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          startDate = lastMonth.toISOString()
          endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()
          break
        case 'last_week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
          break
        default: // quarter
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()
      }
      
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      })
      
      const response = await fetch(`/api/hr/cleanliness-reports?${params}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar los datos')
      }
      
      setReports(data.reports || [])
      setStats(data.stats || {
        total_evaluations: 0,
        pass_rate: 0,
        passed_count: 0,
        top_performers: []
      })
    } catch (error) {
      console.error('Error loading cleanliness data:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido')
      setReports([])
      setStats({
        total_evaluations: 0,
        pass_rate: 0,
        passed_count: 0,
        top_performers: []
      })
      toast.error('Error al cargar los datos de limpieza')
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = reports.filter(report => 
    filterTechnician === '' || 
    report.technician_name.toLowerCase().includes(filterTechnician.toLowerCase())
  )

  const exportReports = () => {
    // Simple CSV export
    const csvData = [
      ['Fecha', 'Técnico', 'Activo', 'Interior', 'Exterior', 'Puntuación', 'Ambos Aprobados'],
      ...filteredReports.map(report => [
        new Date(report.completed_date).toLocaleDateString('es-ES'),
        report.technician_name,
        `${report.asset_name} (${report.asset_code})`,
        report.interior_status === 'pass' ? 'Aprobado' : 'No Aprobado',
        report.exterior_status === 'pass' ? 'Aprobado' : 'No Aprobado',
        `${report.overall_score}%`,
        report.passed_both ? 'Sí' : 'No'
      ])
    ]
    
    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-limpieza-${selectedPeriod}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
    
    toast.success('Reporte exportado exitosamente')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Sparkles className="h-8 w-8 animate-spin mx-auto mb-4 text-green-500" />
          <p className="text-muted-foreground">Cargando reportes de limpieza...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert>
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtros y Controles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="period">Período</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">Mes Actual</SelectItem>
                  <SelectItem value="last_month">Mes Anterior</SelectItem>
                  <SelectItem value="last_week">Última Semana</SelectItem>
                  <SelectItem value="quarter">Último Trimestre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="technician">Filtrar por Técnico</Label>
              <Input
                id="technician"
                placeholder="Buscar técnico..."
                value={filterTechnician}
                onChange={(e) => setFilterTechnician(e.target.value)}
              />
            </div>
            
            <div className="flex items-end">
              <Button onClick={exportReports} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Evaluaciones</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_evaluations}</div>
            <p className="text-xs text-muted-foreground">Evaluaciones de limpieza</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Aprobación</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pass_rate}%</div>
            <p className="text-xs text-muted-foreground">Operadores que pasaron ambas evaluaciones</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluaciones Completas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.passed_count}</div>
            <p className="text-xs text-muted-foreground">Interior y exterior aprobados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reports">Reportes Detallados</TabsTrigger>
          <TabsTrigger value="performers">Mejores Operadores</TabsTrigger>
        </TabsList>
        
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evaluaciones de Limpieza</CardTitle>
              <CardDescription>
                Resultados detallados de las verificaciones de limpieza
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredReports.length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No hay evaluaciones para este período</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReports.map((report) => (
                    <Card key={report.id} className="border-l-4 border-l-green-500">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm font-medium">Técnico</p>
                            <p className="text-sm text-muted-foreground">{report.technician_name}</p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium">Activo</p>
                            <p className="text-sm text-muted-foreground">
                              {report.asset_name} ({report.asset_code})
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium">Fecha</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(report.completed_date).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium">Puntuación</p>
                            <p className="text-sm text-muted-foreground">{report.overall_score}%</p>
                          </div>
                        </div>
                        
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Interior:</span>
                            <Badge variant={report.interior_status === 'pass' ? 'default' : 'destructive'}>
                              {report.interior_status === 'pass' ? (
                                <><CheckCircle2 className="h-3 w-3 mr-1" /> Aprobado</>
                              ) : (
                                <><XCircle className="h-3 w-3 mr-1" /> No Aprobado</>
                              )}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Exterior:</span>
                            <Badge variant={report.exterior_status === 'pass' ? 'default' : 'destructive'}>
                              {report.exterior_status === 'pass' ? (
                                <><CheckCircle2 className="h-3 w-3 mr-1" /> Aprobado</>
                              ) : (
                                <><XCircle className="h-3 w-3 mr-1" /> No Aprobado</>
                              )}
                            </Badge>
                          </div>
                        </div>
                        
                        {(report.interior_notes || report.exterior_notes) && (
                          <div className="mt-4 space-y-2">
                            {report.interior_notes && (
                              <div>
                                <p className="text-sm font-medium">Notas Interior:</p>
                                <p className="text-sm text-muted-foreground">{report.interior_notes}</p>
                              </div>
                            )}
                            {report.exterior_notes && (
                              <div>
                                <p className="text-sm font-medium">Notas Exterior:</p>
                                <p className="text-sm text-muted-foreground">{report.exterior_notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="performers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Mejores Operadores
              </CardTitle>
              <CardDescription>
                Operadores con mejor desempeño en evaluaciones de limpieza
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.top_performers.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No hay datos de rendimiento disponibles</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.top_performers.map((performer, index) => (
                    <div key={performer.technician} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{performer.technician}</p>
                          <p className="text-sm text-muted-foreground">
                            {performer.evaluations} evaluaciones
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-lg">
                        {performer.score}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 