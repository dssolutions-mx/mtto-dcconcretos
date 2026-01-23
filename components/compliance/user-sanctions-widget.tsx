'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, AlertTriangle, CheckCircle, XCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { SanctionWithDetails } from '@/types/compliance'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface UserSanctionsWidgetProps {
  maxItems?: number
  showOnlyActive?: boolean
}

export function UserSanctionsWidget({ 
  maxItems = 5,
  showOnlyActive = true 
}: UserSanctionsWidgetProps) {
  const [sanctions, setSanctions] = useState<SanctionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCount, setActiveCount] = useState(0)

  useEffect(() => {
    fetchUserSanctions()
    // Refresh every 60 seconds
    const interval = setInterval(fetchUserSanctions, 60000)
    return () => clearInterval(interval)
  }, [showOnlyActive])

  const fetchUserSanctions = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const params = new URLSearchParams()
      params.append('user_id', user.id)
      if (showOnlyActive) {
        params.append('status', 'active')
      }

      const response = await fetch(`/api/compliance/sanctions?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch sanctions')

      const data = await response.json()
      const allSanctions: SanctionWithDetails[] = (data.sanctions || []).map((s: any) => ({
        ...s,
        user_name: s.user ? `${s.user.nombre} ${s.user.apellido}` : null,
        applied_by_name: s.applied_by_profile ? `${s.applied_by_profile.nombre} ${s.applied_by_profile.apellido}` : null,
        incident_description: s.incident ? `${s.incident.incident_type} (${s.incident.severity})` : null,
        policy_rule_title: s.policy_rule?.title || null
      }))

      setSanctions(allSanctions.slice(0, maxItems))
      
      // Count active sanctions
      const active = allSanctions.filter(s => s.status === 'active').length
      setActiveCount(active)
    } catch (error) {
      console.error('Error fetching user sanctions:', error)
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Mis Sanciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activeCount === 0 && showOnlyActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Estado de Cumplimiento
          </CardTitle>
          <CardDescription>
            No tienes sanciones activas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Estás en cumplimiento</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Mis Sanciones
            </CardTitle>
            <CardDescription>
              {showOnlyActive 
                ? `${activeCount} sanción${activeCount !== 1 ? 'es' : ''} activa${activeCount !== 1 ? 's' : ''}`
                : 'Historial de sanciones'
              }
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/compliance/sanciones">
              Ver Todas
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Tienes {activeCount} sanción{activeCount !== 1 ? 'es' : ''} activa{activeCount !== 1 ? 's' : ''}.</strong>
              {' '}Revisa los detalles y toma las acciones necesarias para resolverlas.
            </AlertDescription>
          </Alert>
        )}

        {sanctions.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {showOnlyActive ? 'No tienes sanciones activas' : 'No tienes sanciones registradas'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sanctions.map((sanction) => (
              <div
                key={sanction.id}
                className="border rounded-lg p-4 space-y-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getSanctionTypeBadgeVariant(sanction.sanction_type)}>
                        {getSanctionTypeLabel(sanction.sanction_type)}
                      </Badge>
                      {sanction.status === 'active' && (
                        <Badge variant="destructive" className="text-xs">
                          Activa
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium mt-1">{sanction.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>
                        Aplicada: {format(new Date(sanction.applied_date), 'dd/MM/yyyy', { locale: es })}
                      </span>
                      {sanction.applied_by_name && (
                        <span>Por: {sanction.applied_by_name}</span>
                      )}
                    </div>
                    {sanction.sanction_type === 'fine' && (
                      <div className="mt-2 text-sm">
                        {sanction.sanction_amount && (
                          <span className="font-medium text-red-600">
                            ${sanction.sanction_amount.toFixed(2)} MXN
                          </span>
                        )}
                        {sanction.percentage && (
                          <span className="font-medium text-red-600 ml-2">
                            {sanction.percentage}% del día
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {sanction.incident_id && (
                  <Button variant="ghost" size="sm" asChild className="mt-2">
                    <Link href={`/compliance/incidentes/${sanction.incident_id}`}>
                      Ver Incidente
                      <ArrowRight className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {sanctions.length >= maxItems && (
          <Button variant="outline" className="w-full" asChild>
            <Link href="/compliance/sanciones">
              Ver Todas las Sanciones
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}


