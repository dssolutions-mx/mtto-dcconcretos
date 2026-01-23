'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Shield, 
  Search, 
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  User,
  FileText
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ComplianceTrafficLight } from '@/components/compliance/compliance-traffic-light'
import { ApplySanctionDialog } from '@/components/compliance/apply-sanction-dialog'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import type { Sanction, SanctionWithDetails } from '@/types/compliance'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function SanctionsPage() {
  const [sanctions, setSanctions] = useState<SanctionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sanctionDialogOpen, setSanctionDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null)
  const { profile } = useAuthZustand()

  useEffect(() => {
    fetchSanctions()
  }, [statusFilter, typeFilter])

  const canApplySanction = () => {
    if (!profile) return false
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'AREA_ADMINISTRATIVA', 'ENCARGADO_MANTENIMIENTO']
    return allowedRoles.includes(profile.role)
  }

  const handleSanctionApplied = () => {
    fetchSanctions()
    setSanctionDialogOpen(false)
    setSelectedUserId(null)
    setSelectedUserName(null)
  }

  const handleApplySanctionToUser = (userId: string, userName: string) => {
    setSelectedUserId(userId)
    setSelectedUserName(userName)
    setSanctionDialogOpen(true)
  }

  const fetchSanctions = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      // Build query params
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (typeFilter !== 'all') {
        params.append('sanction_type', typeFilter)
      }

      const response = await fetch(`/api/compliance/sanctions?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch sanctions')

      const data = await response.json()
      
      // Transform data to include user names
      const transformedSanctions: SanctionWithDetails[] = (data.sanctions || []).map((s: any) => ({
        ...s,
        user_name: s.user ? `${s.user.nombre} ${s.user.apellido}` : null,
        applied_by_name: s.applied_by_profile ? `${s.applied_by_profile.nombre} ${s.applied_by_profile.apellido}` : null,
        incident_description: s.incident ? `${s.incident.incident_type} (${s.incident.severity})` : null,
        policy_rule_title: s.policy_rule?.title || null
      }))

      setSanctions(transformedSanctions)
    } catch (error) {
      console.error('Error fetching sanctions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSanctionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      verbal_warning: 'Llamada Verbal',
      written_warning: 'Amonestación Escrita',
      suspension: 'Suspensión',
      fine: 'Multa',
      termination: 'Terminación',
      other: 'Otra'
    }
    return labels[type] || type
  }

  const getSanctionTypeBadgeVariant = (type: string) => {
    if (type === 'termination') return 'destructive'
    if (type === 'suspension') return 'destructive'
    if (type === 'fine') return 'default'
    if (type === 'written_warning') return 'secondary'
    return 'outline'
  }

  const getStatusBadgeVariant = (status: string) => {
    if (status === 'active') return 'destructive'
    if (status === 'resolved') return 'default'
    return 'secondary'
  }

  const filteredSanctions = sanctions.filter(sanction => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        sanction.user_name?.toLowerCase().includes(query) ||
        sanction.description.toLowerCase().includes(query) ||
        sanction.id.toLowerCase().includes(query)
      )
    }
    return true
  })

  const stats = {
    total: sanctions.length,
    active: sanctions.filter(s => s.status === 'active').length,
    resolved: sanctions.filter(s => s.status === 'resolved').length,
    verbal: sanctions.filter(s => s.sanction_type === 'verbal_warning').length,
    written: sanctions.filter(s => s.sanction_type === 'written_warning').length,
    suspension: sanctions.filter(s => s.sanction_type === 'suspension').length,
    fine: sanctions.filter(s => s.sanction_type === 'fine').length,
    termination: sanctions.filter(s => s.sanction_type === 'termination').length,
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sanciones Aplicadas</h1>
          <p className="text-muted-foreground mt-1">
            Registro de todas las sanciones disciplinarias aplicadas
          </p>
        </div>
        {canApplySanction() && (
          <Button onClick={() => {
            setSelectedUserId(null)
            setSelectedUserName(null)
            setSanctionDialogOpen(true)
          }}>
            <Shield className="h-4 w-4 mr-2" />
            Aplicar Nueva Sanción
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sanciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700">
              Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700">
              Resueltas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Llamadas Verbales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.verbal}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por usuario, descripción o ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="resolved">Resueltas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Tipos</SelectItem>
                <SelectItem value="verbal_warning">Llamada Verbal</SelectItem>
                <SelectItem value="written_warning">Amonestación Escrita</SelectItem>
                <SelectItem value="suspension">Suspensión</SelectItem>
                <SelectItem value="fine">Multa</SelectItem>
                <SelectItem value="termination">Terminación</SelectItem>
                <SelectItem value="other">Otra</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sanctions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Sanciones</CardTitle>
          <CardDescription>
            {filteredSanctions.length} sanción{filteredSanctions.length !== 1 ? 'es' : ''} encontrada{filteredSanctions.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSanctions.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No se encontraron sanciones</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Aplicada Por</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Monto/Porcentaje</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSanctions.map((sanction) => (
                    <TableRow key={sanction.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{sanction.user_name || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSanctionTypeBadgeVariant(sanction.sanction_type)}>
                          {getSanctionTypeLabel(sanction.sanction_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm max-w-xs truncate" title={sanction.description}>
                          {sanction.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(sanction.applied_date), 'dd/MM/yyyy', { locale: es })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{sanction.applied_by_name || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(sanction.status)}>
                          {sanction.status === 'active' ? 'Activa' : sanction.status === 'resolved' ? 'Resuelta' : 'Cancelada'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sanction.sanction_type === 'fine' && (
                          <div className="text-sm">
                            {sanction.sanction_amount && (
                              <div>${sanction.sanction_amount.toFixed(2)} MXN</div>
                            )}
                            {sanction.percentage && (
                              <div>{sanction.percentage}% del día</div>
                            )}
                          </div>
                        )}
                        {sanction.sanction_type !== 'fine' && (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {sanction.incident_id && (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/compliance/incidentes/${sanction.incident_id}`}>
                                <FileText className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          {canApplySanction() && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleApplySanctionToUser(sanction.user_id, sanction.user_name || '')}
                              title="Aplicar nueva sanción a este usuario"
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply Sanction Dialog */}
      {canApplySanction() && (
        <ApplySanctionDialog
          open={sanctionDialogOpen}
          onOpenChange={(open) => {
            setSanctionDialogOpen(open)
            if (!open) {
              setSelectedUserId(null)
              setSelectedUserName(null)
            }
          }}
          userId={selectedUserId || undefined}
          userName={selectedUserName || undefined}
          onSanctionApplied={handleSanctionApplied}
        />
      )}
    </div>
  )
}


