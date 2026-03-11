"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, Calendar } from "lucide-react"
import type { CompletedChecklistData } from "./types"

interface CompletedChecklistGeneralInfoProps {
  data: CompletedChecklistData
  formatDate: (dateString: string) => string
}

export function CompletedChecklistGeneralInfo({ data, formatDate }: CompletedChecklistGeneralInfoProps) {
  return (
    <Card className="shadow-checklist-2">
      <CardHeader>
        <CardTitle>Información General</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Activo</dt>
              <dd className="text-lg">{data.assets.name} (<span className="font-mono tabular-nums">{data.assets.asset_id}</span>)</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Ubicación</dt>
              <dd className="text-lg">{data.assets.location}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Departamento</dt>
              <dd className="text-lg">{data.assets.department}</dd>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Técnico</dt>
              <dd className="text-lg">
                <div className="flex items-center gap-3">
                  {data.profile?.avatar_url ? (
                    <img
                      src={data.profile.avatar_url}
                      alt={`Avatar de ${data.technician}`}
                      className="w-8 h-8 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4" aria-hidden />
                    </div>
                  )}
                  <div>
                    <div className="font-medium">
                      {data.profile?.nombre && data.profile?.apellido
                        ? `${data.profile.nombre} ${data.profile.apellido}`
                        : data.technician}
                    </div>
                    {data.profile?.role && (
                      <div className="text-sm text-muted-foreground">{data.profile.role}</div>
                    )}
                  </div>
                </div>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Fecha de Completado</dt>
              <dd className="text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4" aria-hidden />
                {formatDate(data.completion_date)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Estado</dt>
              <dd className="text-lg">
                <Badge
                  variant={data.status === 'Completado' ? 'default' : 'destructive'}
                  className="text-sm"
                >
                  {data.status}
                </Badge>
              </dd>
            </div>
          </div>
        </div>

        {data.notes && (
          <>
            <Separator className="my-4" />
            <div>
              <dt className="text-sm font-medium text-muted-foreground mb-2">Notas Generales</dt>
              <dd className="text-sm bg-muted p-3 rounded-md">{data.notes}</dd>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
