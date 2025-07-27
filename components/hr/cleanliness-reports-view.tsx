"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Users, 
  TrendingUp, 
  Calendar, 
  Eye,
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText,
  User,
  Truck
} from 'lucide-react'

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
  // Operator information
  primary_operator_name?: string
  primary_operator_code?: string
  secondary_operator_name?: string
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

interface EvaluationDetails {
  id: string
  asset_name: string
  asset_code: string
  technician_name: string
  completed_date: string
  checklist_name: string
  cleanliness_sections: Array<{
    title: string
    items: Array<{
      id: string
      description: string
      status: 'pass' | 'fail' | 'flag'
      notes?: string
    }>
  }>
  notes: string
  signature_data?: string
  evidence: Array<{
    id: string
    category: string
    description: string
    photo_url: string
    sequence_order: number
    created_at: string
  }>
  // Operator information
  primary_operator_name?: string
  primary_operator_code?: string
  secondary_operator_name?: string
}

// Helper function to get status badge
function getStatusBadge(status: 'pass' | 'fail', notes?: string) {
  const hasObservations = notes && notes.trim().length > 0
  
  if (status === 'pass') {
    return (
      <Badge variant="default" className="bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        Aprobado
      </Badge>
    )
  } else {
    // For failed status, show as observation with yellow color
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Observación
      </Badge>
    )
  }
}

function EvaluationViewDialog({ reportId }: { reportId: string }) {
  const [evaluation, setEvaluation] = useState<EvaluationDetails | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchEvaluationDetails = async () => {
    if (!reportId) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/hr/cleanliness-reports?evaluation_id=${reportId}`)
      if (response.ok) {
        const data = await response.json()
        setEvaluation(data.evaluation)
      }
    } catch (error) {
      console.error('Error fetching evaluation details:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          onClick={fetchEvaluationDetails}
        >
          <Eye className="h-4 w-4 mr-1" />
          Ver Evaluación
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalles de Evaluación de Limpieza</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : evaluation ? (
          <div className="space-y-6">
            {/* Información General */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Truck className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="text-sm font-medium">{evaluation.asset_name}</p>
                  <p className="text-xs text-gray-600">{evaluation.asset_code}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="text-sm font-medium">{evaluation.technician_name}</p>
                  <p className="text-xs text-gray-600">Técnico</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="text-sm font-medium">
                    {evaluation.primary_operator_name || 'Sin asignar'}
                  </p>
                  <p className="text-xs text-gray-600">
                    Operador {evaluation.primary_operator_code && `(${evaluation.primary_operator_code})`}
                  </p>
                  {evaluation.secondary_operator_name && (
                    <p className="text-xs text-gray-500">
                      Sec: {evaluation.secondary_operator_name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="text-sm font-medium">
                    {new Date(evaluation.completed_date).toLocaleDateString('es-MX')}
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(evaluation.completed_date).toLocaleTimeString('es-MX')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="text-sm font-medium">{evaluation.checklist_name}</p>
                  <p className="text-xs text-gray-600">Checklist</p>
                </div>
              </div>
            </div>

            {/* Secciones de Limpieza */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Evaluación de Limpieza</h3>
                <div className="flex space-x-3 text-xs">
                  <div className="flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                    <span>Aprobado (100%)</span>
                  </div>
                  <div className="flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1 text-yellow-600" />
                    <span>Observación (50%)</span>
                  </div>
                  <div className="flex items-center">
                    <XCircle className="h-3 w-3 mr-1 text-red-600" />
                    <span>Falló (0%)</span>
                  </div>
                </div>
              </div>
              
              <Alert className="bg-blue-50 border-blue-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Sistema de Puntuación:</strong> Aprobado = 100%, Observación = 50%, Falló = 0%. 
                  Una sección se aprueba si el promedio es ≥75%. La puntuación general refleja el promedio ponderado de todos los elementos.
                </AlertDescription>
              </Alert>
              {evaluation.cleanliness_sections.map((section, sectionIndex) => (
                <Card key={sectionIndex}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {section.items.map((item, itemIndex) => (
                        <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{item.description}</p>
                            {item.notes && (
                              <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                            )}
                          </div>
                          <div className="ml-4">
                            {item.status === 'pass' && (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Aprobado
                              </Badge>
                            )}
                            {item.status === 'fail' && (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Falló
                              </Badge>
                            )}
                            {item.status === 'flag' && (
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Observación
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Evidencias Fotográficas */}
            {evaluation.evidence && evaluation.evidence.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Evidencias Fotográficas</h3>
                {/* Group evidence by category */}
                {Object.entries(
                  evaluation.evidence.reduce((acc, ev) => {
                    const category = ev.category || 'General'
                    if (!acc[category]) acc[category] = []
                    acc[category].push(ev)
                    return acc
                  }, {} as Record<string, typeof evaluation.evidence>)
                ).map(([category, evidenceItems]) => (
                  <div key={category} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3 text-blue-600">{category}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {evidenceItems.map((evidence) => (
                        <div key={evidence.id} className="space-y-2">
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
                            <img
                              src={evidence.photo_url}
                              alt={evidence.description}
                              className="w-full h-full object-cover"
                              onClick={() => window.open(evidence.photo_url, '_blank')}
                            />
                          </div>
                          <p className="text-xs text-gray-600 text-center">
                            {evidence.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notas Generales */}
            {evaluation.notes && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Notas Generales</h3>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm">{evaluation.notes}</p>
                </div>
              </div>
            )}

            {/* Firma */}
            {evaluation.signature_data && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Firma del Técnico</h3>
                <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                  <img 
                    src={evaluation.signature_data} 
                    alt="Firma" 
                    className="max-h-24 mx-auto"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-8">
            <p className="text-gray-500">No se pudieron cargar los detalles de la evaluación</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function CleanlinessReportsView() {
  const [reports, setReports] = useState<CleanlinessReport[]>([])
  const [stats, setStats] = useState<CleanlinessStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('week')
  const [technicianFilter, setTechnicianFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchReports = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        period: dateFilter,
        ...(technicianFilter !== 'all' && { technician: technicianFilter }),
        ...(searchTerm && { search: searchTerm })
      })
      
      const response = await fetch(`/api/hr/cleanliness-reports?${params}`)
      if (response.ok) {
        const data = await response.json()
        setReports(data.reports)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [dateFilter, technicianFilter])

  const handleSearch = () => {
    fetchReports()
  }

  const uniqueTechnicians = Array.from(new Set(reports.map(r => r.technician_name)))

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="period">Período</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mes</SelectItem>
                  <SelectItem value="quarter">Último trimestre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="technician">Técnico</Label>
              <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los técnicos</SelectItem>
                  {uniqueTechnicians.map(tech => (
                    <SelectItem key={tech} value={tech}>{tech}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="search">Buscar unidad</Label>
              <Input
                id="search"
                placeholder="Código o nombre de unidad"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Evaluaciones</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_evaluations}</div>
              <p className="text-xs text-muted-foreground">
                Evaluaciones realizadas
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Aprobación</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pass_rate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.passed_count} de {stats.total_evaluations} aprobadas
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mejor Técnico</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.top_performers[0]?.technician || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.top_performers[0]?.score.toFixed(1)}% de aprobación
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de Reportes */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluaciones de Limpieza</CardTitle>
          <CardDescription>
            Lista de evaluaciones realizadas en el período seleccionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No se encontraron evaluaciones para los filtros seleccionados.
                  </AlertDescription>
                </Alert>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center space-x-4">
                          <div>
                            <p className="font-semibold">Técnico</p>
                            <p className="text-sm text-gray-600">{report.technician_name}</p>
                          </div>
                          <div>
                            <p className="font-semibold">Operador Asignado</p>
                            <p className="text-sm text-gray-600">
                              {report.primary_operator_name ? (
                                <>
                                  {report.primary_operator_name}
                                  {report.primary_operator_code && (
                                    <span className="text-xs text-gray-500 ml-1">({report.primary_operator_code})</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-gray-400 italic">Sin operador asignado</span>
                              )}
                            </p>
                            {report.secondary_operator_name && (
                              <p className="text-xs text-gray-500">
                                Secundario: {report.secondary_operator_name}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">Activo</p>
                            <p className="text-sm text-gray-600">
                              {report.asset_name} - {report.asset_code}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold">Fecha</p>
                            <p className="text-sm text-gray-600">
                              {new Date(report.completed_date).toLocaleDateString('es-MX')}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold">Puntuación General</p>
                            <p className="text-sm text-gray-600">{report.overall_score}%</p>
                            <p className="text-xs text-gray-500">
                              {report.overall_score >= 75 ? 'Calificación aprobatoria' : 'Calificación reprobatoria'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div>
                            <span className="text-sm font-medium">Interior:</span>
                            <span className="ml-2">
                              {getStatusBadge(report.interior_status, report.interior_notes)}
                            </span>
                          </div>
                          
                          <div>
                            <span className="text-sm font-medium">Exterior:</span>
                            <span className="ml-2">
                              {getStatusBadge(report.exterior_status, report.exterior_notes)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <EvaluationViewDialog reportId={report.id} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 