'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Package,
  FileText,
  Shield,
  MessageSquare
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { DisputeIncidentDialog } from './dispute-incident-dialog'
import { DisputeReviewDialog } from './dispute-review-dialog'
import { DisputeHistory } from './dispute-history'
import { ApplySanctionDialog } from './apply-sanction-dialog'
import { ComplianceTrafficLight } from './compliance-traffic-light'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import type { ComplianceIncidentWithDetails, ComplianceDisputeHistory, Sanction } from '@/types/compliance'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function ComplianceIncidentDetailPage({
  incidentId,
}: {
  incidentId: string
}) {
  const [incident, setIncident] = useState<ComplianceIncidentWithDetails | null>(null)
  const [disputeHistory, setDisputeHistory] = useState<ComplianceDisputeHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [sanctionDialogOpen, setSanctionDialogOpen] = useState(false)
  const { profile } = useAuthZustand()

  useEffect(() => {
    if (incidentId) {
      fetchIncidentDetails(incidentId)
      fetchDisputeHistory(incidentId)
    }
  }, [incidentId])

  const fetchIncidentDetails = async (id: string) => {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('compliance_incidents')
        .select(`
          *,
          user:profiles!user_id (
            id,
            nombre,
            apellido,
            role
          ),
          asset:assets (
            id,
            name,
            asset_id
          ),
          policy:policies (
            id,
            title,
            code
          ),
          policy_rule:policy_rules (
            id,
            title,
            rule_number
          ),
          resolved_by_profile:profiles!resolved_by (
            id,
            nombre,
            apellido
          ),
          dispute_reviewed_by_profile:profiles!dispute_reviewed_by (
            id,
            nombre,
            apellido
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      const incidentData: ComplianceIncidentWithDetails = {
        ...data,
        user_name: data.user 
          ? `${data.user.nombre} ${data.user.apellido}`
          : null,
        asset_name: data.asset?.name || null,
        asset_code: data.asset?.asset_id || null,
        policy_title: data.policy?.title || null,
        policy_rule_title: data.policy_rule?.title || null
      }

      setIncident(incidentData)
    } catch (error) {
      console.error('Error fetching incident:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDisputeHistory = async (id: string) => {
    try {
      const response = await fetch(`/api/compliance/incidents/${id}/dispute`)
      if (response.ok) {
        const data = await response.json()
        setDisputeHistory(data.history || [])
      }
    } catch (error) {
      console.error('Error fetching dispute history:', error)
    }
  }

  const handleDisputeSubmitted = () => {
    fetchIncidentDetails(incidentId)
    fetchDisputeHistory(incidentId)
  }

  const handleReviewCompleted = () => {
    fetchIncidentDetails(incidentId)
    fetchDisputeHistory(incidentId)
  }

  const canDispute = () => {
    if (!incident || !profile) return false
    return (
      incident.user_id === profile.id &&
      ['pending_review', 'confirmed'].includes(incident.status) &&
      !['pending', 'under_review'].includes(incident.dispute_status || 'none')
    )
  }

  const canReview = () => {
    if (!incident || !profile) return false
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'AREA_ADMINISTRATIVA', 'ENCARGADO_MANTENIMIENTO']
    return (
      allowedRoles.includes(profile.role || '') &&
      ['pending', 'under_review'].includes(incident.dispute_status || 'none')
    )
  }

  const canApplySanction = () => {
    if (!incident || !profile) return false
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'AREA_ADMINISTRATIVA', 'ENCARGADO_MANTENIMIENTO']
    return (
      allowedRoles.includes(profile.role || '') &&
      ['pending_review', 'confirmed'].includes(incident.status) &&
      incident.dispute_status !== 'pending' &&
      incident.dispute_status !== 'under_review'
    )
  }

  const handleSanctionApplied = () => {
    fetchIncidentDetails(incidentId)
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

  if (!incident) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Incidente no encontrado</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/compliance/incidentes">
                Volver a Incidentes
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/compliance/incidentes">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Detalle del Incidente</h1>
            <p className="text-muted-foreground">ID: {incident.id.substring(0, 8)}...</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canDispute() && (
            <Button onClick={() => setDisputeDialogOpen(true)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Disputar
            </Button>
          )}
          {canReview() && (
            <Button onClick={() => setReviewDialogOpen(true)} variant="default">
              <Shield className="h-4 w-4 mr-2" />
              Revisar Disputa
            </Button>
          )}
          {canApplySanction() && (
            <Button onClick={() => setSanctionDialogOpen(true)} variant="destructive">
              <Shield className="h-4 w-4 mr-2" />
              Aplicar Sanción
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Incident Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Información del Incidente</CardTitle>
                <ComplianceTrafficLight
                  status={incident.severity === 'critical' ? 'critical' : incident.severity === 'high' ? 'warning' : 'ok'}
                  size="md"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="font-medium capitalize">{incident.incident_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Severidad</p>
                  <Badge variant={incident.severity === 'critical' ? 'destructive' : 'outline'}>
                    {incident.severity}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge variant="outline">{incident.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Origen</p>
                  <p className="font-medium capitalize">{incident.source.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha del Incidente</p>
                  <p className="font-medium">
                    {format(new Date(incident.incident_date), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Creado</p>
                  <p className="font-medium">
                    {format(new Date(incident.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
              </div>

              {incident.evidence_description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Descripción de Evidencia</p>
                    <p className="text-sm">{incident.evidence_description}</p>
                  </div>
                </>
              )}

              {incident.resolution_notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Notas de Resolución</p>
                    <p className="text-sm">{incident.resolution_notes}</p>
                    {incident.resolved_by_profile && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Resuelto por: {incident.resolved_by_profile.nombre} {incident.resolved_by_profile.apellido}
                        {incident.resolved_at && (
                          <> el {format(new Date(incident.resolved_at), 'dd/MM/yyyy', { locale: es })}</>
                        )}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Dispute Information */}
          {incident.dispute_status && incident.dispute_status !== 'none' && (
            <Card>
              <CardHeader>
                <CardTitle>Información de Disputa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Estado de Disputa</p>
                  <Badge variant="outline">{incident.dispute_status}</Badge>
                </div>
                {incident.dispute_reason && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Razón de la Disputa</p>
                    <p className="text-sm bg-muted p-3 rounded-md">{incident.dispute_reason}</p>
                  </div>
                )}
                {incident.dispute_review_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Notas de Revisión</p>
                    <p className="text-sm bg-muted p-3 rounded-md">{incident.dispute_review_notes}</p>
                    {incident.dispute_reviewed_by_profile && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Revisado por: {incident.dispute_reviewed_by_profile.nombre} {incident.dispute_reviewed_by_profile.apellido}
                        {incident.dispute_reviewed_at && (
                          <> el {format(new Date(incident.dispute_reviewed_at), 'dd/MM/yyyy', { locale: es })}</>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dispute History */}
          {disputeHistory.length > 0 && (
            <DisputeHistory history={disputeHistory} />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Usuario Responsable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{incident.user_name || 'N/A'}</p>
              {incident.asset_name && (
                <>
                  <Separator className="my-3" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Activo</p>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <div>
                        <p className="font-medium">{incident.asset_name}</p>
                        <p className="text-xs text-muted-foreground">{incident.asset_code}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Policy Info */}
          {incident.policy_title && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Política Relacionada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{incident.policy_title}</p>
                {incident.policy_rule_title && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Regla: {incident.policy_rule_title}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <DisputeIncidentDialog
        open={disputeDialogOpen}
        onOpenChange={setDisputeDialogOpen}
        incidentId={incident.id}
        onDisputeSubmitted={handleDisputeSubmitted}
      />
      <DisputeReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        incidentId={incident.id}
        incident={incident}
        onReviewCompleted={handleReviewCompleted}
      />
      <ApplySanctionDialog
        open={sanctionDialogOpen}
        onOpenChange={setSanctionDialogOpen}
        incidentId={incident.id}
        userId={incident.user_id}
        userName={incident.user_name || undefined}
        onSanctionApplied={handleSanctionApplied}
      />
    </div>
  )
}
