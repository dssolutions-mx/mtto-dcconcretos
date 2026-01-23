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
  FileText, 
  Search, 
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ComplianceTrafficLight } from './compliance-traffic-light'
import type { ComplianceIncidentWithDetails } from '@/types/compliance'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function ComplianceIncidentsPage() {
  const [incidents, setIncidents] = useState<ComplianceIncidentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [disputeFilter, setDisputeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchIncidents()
  }, [statusFilter, severityFilter, disputeFilter])

  const fetchIncidents = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      // Build query
      let query = supabase
        .from('compliance_incidents')
        .select(`
          *,
          user:profiles!user_id (
            id,
            nombre,
            apellido
          ),
          asset:assets (
            id,
            name,
            asset_id
          ),
          policy:policies (
            id,
            title
          ),
          policy_rule:policy_rules (
            id,
            title
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter)
      }

      if (disputeFilter === 'pending') {
        query = query.in('dispute_status', ['pending', 'under_review'])
      } else if (disputeFilter === 'none') {
        query = query.eq('dispute_status', 'none')
      } else if (disputeFilter === 'resolved') {
        query = query.in('dispute_status', ['approved', 'rejected'])
      }

      const { data, error } = await query

      if (error) throw error

      // Transform data
      const incidentsWithDetails: ComplianceIncidentWithDetails[] = (data || []).map((item: any) => ({
        ...item,
        user_name: item.user 
          ? `${item.user.nombre} ${item.user.apellido}`
          : null,
        asset_name: item.asset?.name || null,
        asset_code: item.asset?.asset_id || null,
        policy_title: item.policy?.title || null,
        policy_rule_title: item.policy_rule?.title || null
      }))

      setIncidents(incidentsWithDetails)
    } catch (error) {
      console.error('Error fetching incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>
      case 'confirmed':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300"><AlertTriangle className="h-3 w-3 mr-1" />Confirmado</Badge>
      case 'dismissed':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300"><XCircle className="h-3 w-3 mr-1" />Descartado</Badge>
      case 'resolved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Resuelto</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">Alto</Badge>
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Medio</Badge>
      case 'low':
        return <Badge variant="outline">Bajo</Badge>
      default:
        return <Badge variant="outline">{severity}</Badge>
    }
  }

  const getDisputeBadge = (disputeStatus: string) => {
    switch (disputeStatus) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Disputa Pendiente</Badge>
      case 'under_review':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">En Revisión</Badge>
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Disputa Aprobada</Badge>
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Disputa Rechazada</Badge>
      default:
        return null
    }
  }

  const filteredIncidents = incidents.filter(incident => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        incident.user_name?.toLowerCase().includes(query) ||
        incident.asset_name?.toLowerCase().includes(query) ||
        incident.asset_code?.toLowerCase().includes(query) ||
        incident.incident_type?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const stats = {
    total: incidents.length,
    pending: incidents.filter(i => i.status === 'pending_review').length,
    confirmed: incidents.filter(i => i.status === 'confirmed').length,
    disputes: incidents.filter(i => ['pending', 'under_review'].includes(i.dispute_status || 'none')).length
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
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Incidentes de Cumplimiento
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestión y seguimiento de incidentes de cumplimiento
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Incidentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.confirmed}</div>
            <p className="text-xs text-muted-foreground">Confirmados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.disputes}</div>
            <p className="text-xs text-muted-foreground">Disputas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="pending_review">Pendiente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="dismissed">Descartado</SelectItem>
                <SelectItem value="resolved">Resuelto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Severidades</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="medium">Medio</SelectItem>
                <SelectItem value="low">Bajo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={disputeFilter} onValueChange={setDisputeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Disputa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="none">Sin Disputa</SelectItem>
                <SelectItem value="pending">Disputas Pendientes</SelectItem>
                <SelectItem value="resolved">Disputas Resueltas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Incidents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Incidentes</CardTitle>
          <CardDescription>
            {filteredIncidents.length} incidente(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredIncidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No se encontraron incidentes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead>Severidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Disputa</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell>
                        {format(new Date(incident.incident_date), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">
                          {incident.incident_type.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell>{incident.user_name || 'N/A'}</TableCell>
                      <TableCell>
                        {incident.asset_name ? (
                          <div>
                            <div className="font-medium">{incident.asset_name}</div>
                            <div className="text-xs text-muted-foreground">{incident.asset_code}</div>
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                      <TableCell>{getStatusBadge(incident.status)}</TableCell>
                      <TableCell>
                        {getDisputeBadge(incident.dispute_status || 'none')}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/compliance/incidentes/${incident.id}`}>
                            Ver <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
