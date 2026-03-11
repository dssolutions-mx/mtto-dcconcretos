"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, Calendar, CheckCircle } from "lucide-react"
import type { CompletedChecklistData } from "./types"

interface CompletedChecklistExecutionInfoProps {
  data: CompletedChecklistData
  formatDate: (dateString: string) => string
}

export function CompletedChecklistExecutionInfo({ data, formatDate }: CompletedChecklistExecutionInfoProps) {
  return (
    <Card className="shadow-checklist-2">
      <CardHeader>
        <CardTitle className="text-lg">Información de Ejecución</CardTitle>
        <CardDescription>Detalles del técnico que ejecutó el checklist</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {data.profile?.avatar_url ? (
                <img
                  src={data.profile.avatar_url}
                  alt={`Avatar de ${data.technician}`}
                  className="w-16 h-16 rounded-full object-cover border-2 border-muted"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-muted">
                  <User className="h-8 w-8 text-muted-foreground" aria-hidden />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold">
                  {data.profile?.nombre && data.profile?.apellido
                    ? `${data.profile.nombre} ${data.profile.apellido}`
                    : data.technician}
                </h3>
                {data.profile?.role && (
                  <p className="text-sm text-muted-foreground">{data.profile.role}</p>
                )}
                {data.profile?.departamento && (
                  <p className="text-sm text-muted-foreground">
                    Departamento: {data.profile.departamento}
                  </p>
                )}
              </div>
            </div>
            {data.profile?.telefono && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Teléfono</dt>
                <dd className="text-sm">{data.profile.telefono}</dd>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Fecha y Hora de Ejecución</dt>
              <dd className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" aria-hidden />
                {formatDate(data.completion_date)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Nombre registrado</dt>
              <dd className="text-sm">{data.technician}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Estado de ejecución</dt>
              <dd className="text-sm">
                <Badge
                  variant={data.status === 'Completado' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {data.status}
                </Badge>
              </dd>
            </div>
            {data.signature_data && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground mb-2">Firma Digital</dt>
                <dd>
                  <img
                    src={data.signature_data}
                    alt="Firma del técnico"
                    className="max-w-48 h-16 object-contain border rounded bg-white"
                  />
                </dd>
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-600" aria-hidden />
            <span className="text-sm font-medium">Checklist ejecutado y validado</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Este checklist fue completado por{' '}
            {data.profile?.nombre && data.profile?.apellido
              ? `${data.profile.nombre} ${data.profile.apellido}`
              : data.technician}{' '}
            el {formatDate(data.completion_date)}
            {data.signature_data ? ' con firma digital verificada' : ' con identificación registrada'}.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
