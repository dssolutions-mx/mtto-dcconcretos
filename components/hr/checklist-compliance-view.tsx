'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, CheckCircle, Clock, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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
  }
}

export default function ChecklistComplianceView() {
  const [data, setData] = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [businessUnit, setBusinessUnit] = useState('all')
  const [plant, setPlant] = useState('all')
  const [severity, setSeverity] = useState('all')
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
        ...(plant !== 'all' && { plant })
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
  }, [businessUnit, plant, severity, period])

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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Búsqueda</CardTitle>
          <CardDescription>
            Filtra los datos por unidad de negocio, planta, severidad y período
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
      <Tabs defaultValue="detailed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="detailed">Vista Detallada</TabsTrigger>
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
                      <TableHead>Unidad de Negocio</TableHead>
                      <TableHead>Planta</TableHead>
                      <TableHead>Activo</TableHead>
                      <TableHead>Checklist</TableHead>
                      <TableHead>Frecuencia</TableHead>
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
                        <TableCell className="font-medium">
                          {report.business_unit_name}
                        </TableCell>
                        <TableCell>{report.plant_name}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{report.asset_name}</p>
                            <p className="text-sm text-muted-foreground">{report.asset_code}</p>
                          </div>
                        </TableCell>
                        <TableCell>{report.checklist_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{report.frequency}</Badge>
                        </TableCell>
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