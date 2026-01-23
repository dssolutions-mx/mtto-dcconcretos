'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle, XCircle, MessageSquare, Shield } from 'lucide-react'
import type { ComplianceDisputeHistory } from '@/types/compliance'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface DisputeHistoryProps {
  history: ComplianceDisputeHistory[]
}

export function DisputeHistory({ history }: DisputeHistoryProps) {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'submitted':
        return <MessageSquare className="h-4 w-4 text-blue-500" />
      case 'review_started':
        return <Shield className="h-4 w-4 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'withdrawn':
        return <Clock className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'submitted':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">Enviado</Badge>
      case 'review_started':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">En Revisión</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Aprobado</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Rechazado</Badge>
      case 'withdrawn':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">Retirado</Badge>
      default:
        return <Badge variant="outline">{action}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Disputa</CardTitle>
        <CardDescription>
          Registro completo de todas las acciones relacionadas con esta disputa
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry, index) => (
            <div
              key={entry.id}
              className="flex gap-4 pb-4 border-b last:border-0 last:pb-0"
            >
              <div className="flex-shrink-0 mt-1">
                {getActionIcon(entry.action)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    {getActionBadge(entry.action)}
                    {entry.performed_by_profile && (
                      <span className="text-sm text-muted-foreground">
                        por {entry.performed_by_profile.nombre} {entry.performed_by_profile.apellido}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </span>
                </div>
                {entry.notes && (
                  <p className="text-sm text-muted-foreground mt-1 bg-muted p-2 rounded-md">
                    {entry.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay historial disponible
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
