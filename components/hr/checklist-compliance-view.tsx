'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, CheckCircle, CheckCircle2, Clock, TrendingDown, Calendar, CalendarDays, Truck } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { ChecklistDosificadorViewPayload } from '@/types/checklist-dosificador-view'

function formatUTCDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function computeUtcRangeInclusive(days: number): { from: string; to: string } {
  const now = new Date()
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - (days - 1))
  return { from: formatUTCDateKey(from), to: formatUTCDateKey(to) }
}

interface ComplianceReport {
  business_unit_id: string
  business_unit_name: string
  plant_id: string
  plant_name: string
  asset_id: string
  asset_name: string
  asset_code: string
  checklist_name: string
  frequency: string
  frequency_type: 'daily' | 'weekly' | 'monthly' | 'other'
  days_overdue: number
  weeks_overdue: number
  last_completed: string | null
  assigned_technician: string | null
  scheduled_date: string
  status: 'pending' | 'overdue' | 'critical'
  recurrence_pattern: string
}

interface ComplianceStats {
  total_assets: number
  compliant_assets: number
  overdue_assets: number
  critical_assets: number
  compliance_rate: number
  average_days_overdue: number
  frequency_breakdown: {
    daily: {
      total: number
      overdue: number
      critical: number
      compliance_rate: number
    }
    weekly: {
      total: number
      overdue: number
      critical: number
      compliance_rate: number
    }
    monthly: {
      total: number
      overdue: number
      critical: number
      compliance_rate: number
    }
    other: {
      total: number
      overdue: number
      critical: number
      compliance_rate: number
    }
  }
  business_unit_breakdown: Array<{
    business_unit: string
    total: number
    compliant: number
    overdue: number
    compliance_rate: number
  }>
  plant_breakdown: Array<{
    plant: string
    business_unit: string
    total: number
    compliant: number
    overdue: number
    compliance_rate: number
  }>
}

interface ComplianceData {
  reports: ComplianceReport[]
  stats: ComplianceStats
  total: number
  period: number
  filters: {
    business_unit?: string
    plant?: string
    severity?: string
    frequency_type?: string
  }
}

export default function ChecklistComplianceView() {
  const [data, setData] = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mainTab, setMainTab] = useState('detailed')

  const [dosificadorData, setDosificadorData] = useState<ChecklistDosificadorViewPayload | null>(null)
  const [dosificadorLoading, setDosificadorLoading] = useState(false)
  const [dosificadorError, setDosificadorError] = useState<string | null>(null)
  const [dosificadorRangeDays, setDosificadorRangeDays] = useState('14')
  
  // Filters
  const [businessUnit, setBusinessUnit] = useState('all')
  const [plant, setPlant] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [frequencyType, setFrequencyType] = useState('all')
  const [period, setPeriod] = useState('30')
  const [search, setSearch] = useState('')
  
  // Available options for filters
  const [businessUnits, setBusinessUnits] = useState<Array<{id: string, name: string}>>([])
  const [plants, setPlants] = useState<Array<{id: string, name: string, business_unit_id: string}>>([])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        period,
        severity,
        ...(businessUnit !== 'all' && { business_unit: businessUnit }),
        ...(plant !== 'all' && { plant }),
        ...(frequencyType !== 'all' && { frequency_type: frequencyType })
      })
      
      const response = await fetch(`/api/hr/checklist-compliance?${params}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar los datos de cumplimiento')
      }
      
      const result = await response.json()
      setData(result)
      
    } catch (err) {
      console.error('Error fetching compliance data:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const fetchOrganizationalData = async () => {
    try {
      // Fetch business units
      const buResponse = await fetch('/api/business-units')
      if (buResponse.ok) {
        const buData = await buResponse.json()
        setBusinessUnits(buData.business_units || [])
      }
      
      // Fetch plants
      const plantsResponse = await fetch('/api/plants')
      if (plantsResponse.ok) {
        const plantsData = await plantsResponse.json()
        setPlants(plantsData.plants || [])
      }
    } catch (error) {
      console.error('Error fetching organizational data:', error)
    }
  }

  useEffect(() => {
    fetchOrganizationalData()
  }, [])

  useEffect(() => {
    fetchData()
  }, [businessUnit, plant, severity, frequencyType, period])

  const fetchDosificador = useCallback(async () => {
    try {
      setDosificadorLoading(true)
      setDosificadorError(null)
      const days = Math.min(90, Math.max(1, parseInt(dosificadorRangeDays, 10) || 14))
      const { from, to } = computeUtcRangeInclusive(days)
      const params = new URLSearchParams({ from, to })
      if (businessUnit !== 'all') params.set('business_unit', businessUnit)
      if (plant !== 'all') params.set('plant', plant)
      const response = await fetch(`/api/hr/checklist-dosificador-view?${params}`)
      if (!response.ok) {
        const j = await response.json().catch(() => ({}))
        throw new Error(j.error || 'Error al cargar la vista dosificador')
      }
      const result = (await response.json()) as ChecklistDosificadorViewPayload
      setDosificadorData(result)
    } catch (err) {
      console.error('Error fetching dosificador view:', err)
      setDosificadorError(err instanceof Error ? err.message : 'Error desconocido')
      setDosificadorData(null)
    } finally {
      setDosificadorLoading(false)
    }
  }, [businessUnit, plant, dosificadorRangeDays])

  useEffect(() => {
    if (mainTab !== 'dosificador') return
    void fetchDosificador()
  }, [mainTab, fetchDosificador])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'overdue':
        return <Clock className="h-4 w-4 text-orange-500" />
      case 'pending':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>
      case 'overdue':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Atrasado</Badge>
      case 'pending':
        return <Badge variant="default" className="bg-green-100 text-green-800">Pendiente</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const getFrequencyTypeBadge = (frequencyType: string) => {
    switch (frequencyType) {
      case 'daily':
        return <Badge className="bg-blue-100 text-blue-800">Diario</Badge>
      case 'weekly':
        return <Badge className="bg-purple-100 text-purple-800">Semanal</Badge>
      case 'monthly':
        return <Badge className="bg-indigo-100 text-indigo-800">Mensual</Badge>
      case 'other':
        return <Badge variant="outline">Otro</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const filteredReports = data?.reports.filter(report => {
    if (!search) return true
    
    const searchLower = search.toLowerCase()
    return (
      report.asset_name.toLowerCase().includes(searchLower) ||
      report.asset_code.toLowerCase().includes(searchLower) ||
      report.plant_name.toLowerCase().includes(searchLower) ||
      report.business_unit_name.toLowerCase().includes(searchLower) ||
      report.checklist_name.toLowerCase().includes(searchLower) ||
      (report.assigned_technician && report.assigned_technician.toLowerCase().includes(searchLower))
    )
  }) || []

  const availablePlants = plants.filter(p => 
    businessUnit === 'all' || p.business_unit_id === businessUnit
  )

  // Group reports by frequency type for better organization
  const reportsByFrequency = {
    daily: filteredReports.filter(r => r.frequency_type === 'daily'),
    weekly: filteredReports.filter(r => r.frequency_type === 'weekly'),
    monthly: filteredReports.filter(r => r.frequency_type === 'monthly'),
    other: filteredReports.filter(r => r.frequency_type === 'other')
  }

  // Get assets with multiple frequency types overdue
  const assetsWithMultipleTypes = new Map()
  filteredReports.forEach(report => {
    const assetId = report.asset_id
    if (!assetsWithMultipleTypes.has(assetId)) {
      assetsWithMultipleTypes.set(assetId, new Set())
    }
    assetsWithMultipleTypes.get(assetId).add(report.frequency_type)
  })

  const getAssetFrequencyTypes = (assetId: string) => {
    const types = assetsWithMultipleTypes.get(assetId)
    if (!types || types.size <= 1) return null
    
    const typeLabels = {
      daily: 'Diario',
      weekly: 'Semanal', 
      monthly: 'Mensual',
      other: 'Otro'
    }
    
    return Array.from(types).map(type => typeLabels[type as keyof typeof typeLabels]).join(', ')
  }

  const getAssetMultiTypeBadge = (assetId: string) => {
    const types = assetsWithMultipleTypes.get(assetId)
    if (!types || types.size <= 1) return null
    
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
        {types.size} tipos atrasados
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
            <Button 
              onClick={fetchData} 
              className="mt-4"
              variant="outline"
            >
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tasa de Cumplimiento</p>
                <p className="text-2xl font-bold">
                  {data.stats.compliance_rate.toFixed(1)}%
                </p>
              </div>
            </div>
            <Progress 
              value={data.stats.compliance_rate} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Activos Críticos</p>
                <p className="text-2xl font-bold text-red-600">
                  {data.stats.critical_assets}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Activos Atrasados</p>
                <p className="text-2xl font-bold text-orange-600">
                  {data.stats.overdue_assets}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Promedio Días Atraso</p>
                <p className="text-2xl font-bold">
                  {data.stats.average_days_overdue.toFixed(0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets with Multiple Frequency Types */}
      <Card>
        <CardHeader>
          <CardTitle>Activos con Múltiples Tipos de Checklists Atrasados</CardTitle>
          <CardDescription>
            Activos que tienen checklists de diferentes frecuencias atrasados simultáneamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from(assetsWithMultipleTypes.entries())
              .filter(([_, types]) => types.size > 1)
              .map(([assetId, types]) => {
                const assetReports = filteredReports.filter(r => r.asset_id === assetId)
                const firstReport = assetReports[0]
                const typeLabels = {
                  daily: 'Diario',
                  weekly: 'Semanal', 
                  monthly: 'Mensual',
                  other: 'Otro'
                }
                const typesList = Array.from(types).map(type => typeLabels[type as keyof typeof typeLabels]).join(', ')
                
                return (
                  <div key={assetId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">{firstReport.asset_name}</p>
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          {types.size} tipos
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{firstReport.asset_code}</p>
                      <p className="text-sm text-orange-600">{firstReport.plant_name} - {firstReport.business_unit_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Tipos atrasados:</p>
                      <p className="text-sm text-muted-foreground">{typesList}</p>
                    </div>
                  </div>
                )
              })}
            {Array.from(assetsWithMultipleTypes.entries()).filter(([_, types]) => types.size > 1).length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No hay activos con múltiples tipos de checklists atrasados
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Frequency Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CalendarDays className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Checklists Diarios</p>
                <p className="text-2xl font-bold text-blue-600">
                  {data.stats.frequency_breakdown.daily.total}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.stats.frequency_breakdown.daily.critical} críticos
                </p>
              </div>
            </div>
            <Progress 
              value={data.stats.frequency_breakdown.daily.compliance_rate} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Checklists Semanales</p>
                <p className="text-2xl font-bold text-purple-600">
                  {data.stats.frequency_breakdown.weekly.total}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.stats.frequency_breakdown.weekly.critical} críticos
                </p>
              </div>
            </div>
            <Progress 
              value={data.stats.frequency_breakdown.weekly.compliance_rate} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-indigo-500" />
              <div>
                <p className="text-sm text-muted-foreground">Checklists Mensuales</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {data.stats.frequency_breakdown.monthly.total}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.stats.frequency_breakdown.monthly.critical} críticos
                </p>
              </div>
            </div>
            <Progress 
              value={data.stats.frequency_breakdown.monthly.compliance_rate} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-muted-foreground">Otros Checklists</p>
                <p className="text-2xl font-bold text-gray-600">
                  {data.stats.frequency_breakdown.other.total}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.stats.frequency_breakdown.other.critical} críticos
                </p>
              </div>
            </div>
            <Progress 
              value={data.stats.frequency_breakdown.other.compliance_rate} 
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Búsqueda</CardTitle>
          <CardDescription>
            Filtra los datos por unidad de negocio, planta, severidad, frecuencia y período
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            <Select value={businessUnit} onValueChange={setBusinessUnit}>
              <SelectTrigger>
                <SelectValue placeholder="Unidad de Negocio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Unidades</SelectItem>
                {businessUnits.map(bu => (
                  <SelectItem key={bu.id} value={bu.id}>
                    {bu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={plant} onValueChange={setPlant}>
              <SelectTrigger>
                <SelectValue placeholder="Planta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Plantas</SelectItem>
                {availablePlants.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="critical">Solo Críticos</SelectItem>
                <SelectItem value="overdue">Solo Atrasados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={frequencyType} onValueChange={setFrequencyType}>
              <SelectTrigger>
                <SelectValue placeholder="Frecuencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Frecuencias</SelectItem>
                <SelectItem value="daily">Solo Diarios</SelectItem>
                <SelectItem value="weekly">Solo Semanales</SelectItem>
                <SelectItem value="monthly">Solo Mensuales</SelectItem>
                <SelectItem value="other">Otros</SelectItem>
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Última semana</SelectItem>
                <SelectItem value="30">Último mes</SelectItem>
                <SelectItem value="90">Últimos 3 meses</SelectItem>
                <SelectItem value="180">Últimos 6 meses</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="col-span-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs
        value={mainTab}
        onValueChange={(v) => {
          setMainTab(v)
          if (v === 'dosificador') {
            setDosificadorLoading(true)
            setDosificadorError(null)
          }
        }}
        className="space-y-4"
      >
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="detailed">Vista Detallada</TabsTrigger>
          <TabsTrigger value="dosificador">Vista Dosificador</TabsTrigger>
          <TabsTrigger value="daily">Checklists Diarios</TabsTrigger>
          <TabsTrigger value="weekly">Checklists Semanales</TabsTrigger>
          <TabsTrigger value="monthly">Checklists Mensuales</TabsTrigger>
          <TabsTrigger value="summary">Resumen por Unidad</TabsTrigger>
          <TabsTrigger value="plants">Resumen por Planta</TabsTrigger>
        </TabsList>

        <TabsContent value="detailed">
          <Card>
            <CardHeader>
              <CardTitle>Checklists con Incumplimientos</CardTitle>
              <CardDescription>
                Mostrando {filteredReports.length} de {data.reports.length} activos con checklists pendientes o atrasados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                                          <TableRow>
                        <TableHead>Estado</TableHead>
                        <TableHead>Frecuencia</TableHead>
                        <TableHead>Unidad de Negocio</TableHead>
                        <TableHead>Planta</TableHead>
                        <TableHead>Activo</TableHead>
                        <TableHead>Checklist</TableHead>
                        <TableHead>Días Atraso</TableHead>
                        <TableHead>Patrón de Recurrencia</TableHead>
                        <TableHead>Técnico Asignado</TableHead>
                        <TableHead>Última Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((report, index) => (
                        <TableRow key={`${report.asset_id}-${report.checklist_name}-${report.scheduled_date}-${index}`}>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(report.status)}
                              {getStatusBadge(report.status)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getFrequencyTypeBadge(report.frequency_type)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {report.business_unit_name}
                          </TableCell>
                          <TableCell>{report.plant_name}</TableCell>
                          <TableCell>
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="font-medium">{report.asset_name}</p>
                                {getAssetMultiTypeBadge(report.asset_id)}
                              </div>
                              <p className="text-sm text-muted-foreground">{report.asset_code}</p>
                              {getAssetFrequencyTypes(report.asset_id) && (
                                <p className="text-xs text-orange-600 mt-1">
                                  También atrasado: {getAssetFrequencyTypes(report.asset_id)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        <TableCell>{report.checklist_name}</TableCell>
                        <TableCell>
                          <div className="text-center">
                            <p className="font-bold text-lg">{report.days_overdue}</p>
                            <p className="text-sm text-muted-foreground">
                              ({report.weeks_overdue} semanas)
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {report.recurrence_pattern}
                          </div>
                        </TableCell>
                        <TableCell>
                          {report.assigned_technician || (
                            <span className="text-muted-foreground italic">Sin asignar</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {report.last_completed ? (
                            format(new Date(report.last_completed), 'dd/MM/yyyy', { locale: es })
                          ) : (
                            <span className="text-muted-foreground italic">Nunca</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dosificador">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-muted-foreground" />
                    Vista Dosificador
                  </CardTitle>
                  <CardDescription>
                    Inspección diaria (checklists con frecuencia &quot;diario&quot;) por planta y por día.
                    Las fechas del rango y los días mostrados usan calendario UTC, alineado con el tablero del
                    dosificador.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-1.5 sm:items-end">
                  <span className="text-xs font-medium text-muted-foreground">Rango (UTC)</span>
                  <Select value={dosificadorRangeDays} onValueChange={setDosificadorRangeDays}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Últimos 7 días</SelectItem>
                      <SelectItem value="14">Últimos 14 días</SelectItem>
                      <SelectItem value="30">Últimos 30 días</SelectItem>
                    </SelectContent>
                  </Select>
                  {dosificadorData && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {dosificadorData.fromKey} → {dosificadorData.toKey}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Usa los filtros de <strong>Unidad de Negocio</strong> y <strong>Planta</strong> arriba para
                acotar el alcance. Esta vista incluye activos operativos con programación diaria en el rango,
                tanto completados como pendientes.
              </p>
              {dosificadorLoading && (
                <div className="space-y-4">
                  <div className="h-10 animate-pulse rounded-md bg-muted/60" />
                  <div className="h-40 animate-pulse rounded-md bg-muted/50" />
                </div>
              )}
              {dosificadorError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {dosificadorError}
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchDosificador()}>
                    Reintentar
                  </Button>
                </div>
              )}
              {!dosificadorLoading && !dosificadorError && dosificadorData && dosificadorData.plants.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay programaciones de checklist diario en el rango y filtros seleccionados.
                </p>
              )}
              {!dosificadorLoading &&
                !dosificadorError &&
                dosificadorData?.plants.map((p) => (
                  <Card key={p.plantId} className="border-border/80 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{p.plantName}</CardTitle>
                      <CardDescription>{p.businessUnitName}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="multiple" className="w-full">
                        {p.days.map((day) => (
                          <AccordionItem key={`${p.plantId}-${day.dayKey}`} value={`${p.plantId}-${day.dayKey}`}>
                            <AccordionTrigger className="text-left hover:no-underline">
                              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="font-mono text-sm tabular-nums">{day.dayKey}</span>
                                <span className="text-sm text-muted-foreground">
                                  <span className="text-emerald-700 dark:text-emerald-400">{day.summary.completed} listos</span>
                                  <span className="mx-1">·</span>
                                  <span className="text-amber-800 dark:text-amber-200">{day.summary.pending} pendientes</span>
                                  <span className="mx-1">·</span>
                                  {day.summary.total} activos
                                </span>
                              </span>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="overflow-x-auto rounded-md border">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Código</TableHead>
                                      <TableHead>Activo</TableHead>
                                      <TableHead>Estado</TableHead>
                                      <TableHead>Operador asignado</TableHead>
                                      <TableHead>Checklist</TableHead>
                                      <TableHead>Registro de completado</TableHead>
                                      <TableHead>Hora (UTC)</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {day.rows.map((row) => {
                                      const ok = row.readiness === 'listo'
                                      return (
                                        <TableRow
                                          key={row.scheduleId}
                                          className={cn(!ok && 'bg-amber-50/60 dark:bg-amber-950/20')}
                                        >
                                          <TableCell className="font-medium tabular-nums">{row.assetCode ?? '—'}</TableCell>
                                          <TableCell>
                                            <div className="max-w-[200px] truncate" title={row.assetName ?? ''}>
                                              {row.assetName ?? '—'}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            {ok ? (
                                              <Badge className="gap-1 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Listo
                                              </Badge>
                                            ) : (
                                              <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                                                <AlertTriangle className="h-3 w-3" />
                                                Pendiente
                                              </Badge>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-sm">
                                            {row.operatorName ?? (
                                              <span className="text-muted-foreground italic">Sin asignar</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">
                                            {row.checklistName ?? '—'}
                                          </TableCell>
                                          <TableCell className="text-sm">
                                            {row.completedByLabel ?? (
                                              <span className="text-muted-foreground">—</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-sm tabular-nums text-muted-foreground">
                                            {row.completionTime
                                              ? format(new Date(row.completionTime), 'dd/MM/yyyy HH:mm', { locale: es })
                                              : '—'}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle>Checklists Diarios con Incumplimientos</CardTitle>
              <CardDescription>
                Mostrando {reportsByFrequency.daily.length} checklists diarios con incumplimientos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Unidad de Negocio</TableHead>
                      <TableHead>Planta</TableHead>
                      <TableHead>Activo</TableHead>
                      <TableHead>Checklist</TableHead>
                      <TableHead>Días Atraso</TableHead>
                      <TableHead>Técnico Asignado</TableHead>
                      <TableHead>Última Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportsByFrequency.daily.map((report, index) => (
                      <TableRow key={`daily-${report.asset_id}-${report.checklist_name}-${index}`}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(report.status)}
                            {getStatusBadge(report.status)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {report.business_unit_name}
                        </TableCell>
                        <TableCell>{report.plant_name}</TableCell>
                        <TableCell>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">{report.asset_name}</p>
                              {getAssetMultiTypeBadge(report.asset_id)}
                            </div>
                            <p className="text-sm text-muted-foreground">{report.asset_code}</p>
                            {getAssetFrequencyTypes(report.asset_id) && (
                              <p className="text-xs text-orange-600 mt-1">
                                También atrasado: {getAssetFrequencyTypes(report.asset_id)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{report.checklist_name}</TableCell>
                        <TableCell>
                          <div className="text-center">
                            <p className="font-bold text-lg">{report.days_overdue}</p>
                            <p className="text-sm text-muted-foreground">
                              ({report.weeks_overdue} semanas)
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {report.assigned_technician || (
                            <span className="text-muted-foreground italic">Sin asignar</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {report.last_completed ? (
                            format(new Date(report.last_completed), 'dd/MM/yyyy', { locale: es })
                          ) : (
                            <span className="text-muted-foreground italic">Nunca</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly">
          <Card>
            <CardHeader>
              <CardTitle>Checklists Semanales con Incumplimientos</CardTitle>
              <CardDescription>
                Mostrando {reportsByFrequency.weekly.length} checklists semanales con incumplimientos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Unidad de Negocio</TableHead>
                      <TableHead>Planta</TableHead>
                      <TableHead>Activo</TableHead>
                      <TableHead>Checklist</TableHead>
                      <TableHead>Días Atraso</TableHead>
                      <TableHead>Técnico Asignado</TableHead>
                      <TableHead>Última Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportsByFrequency.weekly.map((report, index) => (
                      <TableRow key={`weekly-${report.asset_id}-${report.checklist_name}-${index}`}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(report.status)}
                            {getStatusBadge(report.status)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {report.business_unit_name}
                        </TableCell>
                        <TableCell>{report.plant_name}</TableCell>
                        <TableCell>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">{report.asset_name}</p>
                              {getAssetMultiTypeBadge(report.asset_id)}
                            </div>
                            <p className="text-sm text-muted-foreground">{report.asset_code}</p>
                            {getAssetFrequencyTypes(report.asset_id) && (
                              <p className="text-xs text-orange-600 mt-1">
                                También atrasado: {getAssetFrequencyTypes(report.asset_id)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{report.checklist_name}</TableCell>
                        <TableCell>
                          <div className="text-center">
                            <p className="font-bold text-lg">{report.days_overdue}</p>
                            <p className="text-sm text-muted-foreground">
                              ({report.weeks_overdue} semanas)
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {report.assigned_technician || (
                            <span className="text-muted-foreground italic">Sin asignar</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {report.last_completed ? (
                            format(new Date(report.last_completed), 'dd/MM/yyyy', { locale: es })
                          ) : (
                            <span className="text-muted-foreground italic">Nunca</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>Checklists Mensuales con Incumplimientos</CardTitle>
              <CardDescription>
                Mostrando {reportsByFrequency.monthly.length} checklists mensuales con incumplimientos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Unidad de Negocio</TableHead>
                      <TableHead>Planta</TableHead>
                      <TableHead>Activo</TableHead>
                      <TableHead>Checklist</TableHead>
                      <TableHead>Días Atraso</TableHead>
                      <TableHead>Técnico Asignado</TableHead>
                      <TableHead>Última Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportsByFrequency.monthly.map((report, index) => (
                      <TableRow key={`monthly-${report.asset_id}-${report.checklist_name}-${index}`}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(report.status)}
                            {getStatusBadge(report.status)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {report.business_unit_name}
                        </TableCell>
                        <TableCell>{report.plant_name}</TableCell>
                        <TableCell>
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">{report.asset_name}</p>
                              {getAssetMultiTypeBadge(report.asset_id)}
                            </div>
                            <p className="text-sm text-muted-foreground">{report.asset_code}</p>
                            {getAssetFrequencyTypes(report.asset_id) && (
                              <p className="text-xs text-orange-600 mt-1">
                                También atrasado: {getAssetFrequencyTypes(report.asset_id)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{report.checklist_name}</TableCell>
                        <TableCell>
                          <div className="text-center">
                            <p className="font-bold text-lg">{report.days_overdue}</p>
                            <p className="text-sm text-muted-foreground">
                              ({report.weeks_overdue} semanas)
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {report.assigned_technician || (
                            <span className="text-muted-foreground italic">Sin asignar</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {report.last_completed ? (
                            format(new Date(report.last_completed), 'dd/MM/yyyy', { locale: es })
                          ) : (
                            <span className="text-muted-foreground italic">Nunca</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Resumen por Unidad de Negocio</CardTitle>
              <CardDescription>
                Análisis de cumplimiento agrupado por unidades de negocio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidad de Negocio</TableHead>
                    <TableHead>Total Activos</TableHead>
                    <TableHead>Cumpliendo</TableHead>
                    <TableHead>Con Atrasos</TableHead>
                    <TableHead>Tasa de Cumplimiento</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stats.business_unit_breakdown.map((unit) => (
                    <TableRow key={unit.business_unit}>
                      <TableCell className="font-medium">{unit.business_unit}</TableCell>
                      <TableCell>{unit.total}</TableCell>
                      <TableCell className="text-green-600">{unit.compliant}</TableCell>
                      <TableCell className="text-red-600">{unit.overdue}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress value={unit.compliance_rate} className="w-16" />
                          <span className="text-sm font-medium">
                            {unit.compliance_rate.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {unit.compliance_rate >= 90 ? (
                          <Badge className="bg-green-100 text-green-800">Excelente</Badge>
                        ) : unit.compliance_rate >= 75 ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Bueno</Badge>
                        ) : unit.compliance_rate >= 50 ? (
                          <Badge className="bg-orange-100 text-orange-800">Regular</Badge>
                        ) : (
                          <Badge variant="destructive">Crítico</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plants">
          <Card>
            <CardHeader>
              <CardTitle>Resumen por Planta</CardTitle>
              <CardDescription>
                Análisis de cumplimiento agrupado por plantas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Planta</TableHead>
                    <TableHead>Unidad de Negocio</TableHead>
                    <TableHead>Total Activos</TableHead>
                    <TableHead>Cumpliendo</TableHead>
                    <TableHead>Con Atrasos</TableHead>
                    <TableHead>Tasa de Cumplimiento</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stats.plant_breakdown.map((plant) => (
                    <TableRow key={plant.plant}>
                      <TableCell className="font-medium">{plant.plant}</TableCell>
                      <TableCell>{plant.business_unit}</TableCell>
                      <TableCell>{plant.total}</TableCell>
                      <TableCell className="text-green-600">{plant.compliant}</TableCell>
                      <TableCell className="text-red-600">{plant.overdue}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress value={plant.compliance_rate} className="w-16" />
                          <span className="text-sm font-medium">
                            {plant.compliance_rate.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {plant.compliance_rate >= 90 ? (
                          <Badge className="bg-green-100 text-green-800">Excelente</Badge>
                        ) : plant.compliance_rate >= 75 ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Bueno</Badge>
                        ) : plant.compliance_rate >= 50 ? (
                          <Badge className="bg-orange-100 text-orange-800">Regular</Badge>
                        ) : (
                          <Badge variant="destructive">Crítico</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 