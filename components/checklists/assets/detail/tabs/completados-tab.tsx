"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CompletedChecklistCard } from "../completed-checklist-card"
import { CheckCircle, History } from "lucide-react"
import Link from "next/link"

interface CompletedItem {
  id: string
  item_id: string
  status: "pass" | "flag" | "fail"
  notes?: string
  photo_url?: string
}

interface CompletedChecklist {
  id: string
  template_id?: string
  asset_id: string
  scheduled_date: string
  status: string
  assigned_to: string | null
  updated_at: string
  completion_date?: string
  technician?: string
  completed_items?: CompletedItem[]
  checklists: {
    id: string
    name: string
    frequency: string
  } | null
  profiles: {
    nombre: string | null
    apellido: string | null
  } | null
}

interface CompletadosTabProps {
  completed: CompletedChecklist[]
  formatRelativeDate: (dateString: string) => string
  assetId: string
}

export function CompletadosTab({
  completed,
  formatRelativeDate,
  assetId,
}: CompletadosTabProps) {
  const recentCompleted = completed.slice(0, 5)
  const hasMore = completed.length > 5

  if (completed.length === 0) {
    return (
      <Card className="shadow-checklist-2">
        <CardContent className="py-8 text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No hay checklists completados
          </h3>
          <p className="text-sm text-muted-foreground">
            Aún no se ha ejecutado ningún checklist para este activo.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-green-300 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 shadow-checklist-2 transition-shadow duration-200 hover:shadow-checklist-3">
      <CardHeader>
        <CardTitle className="text-green-800 dark:text-green-200 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Completados Recientes ({recentCompleted.length})
        </CardTitle>
        <CardDescription>Últimos checklists ejecutados</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="space-y-3"
          style={{ contentVisibility: "auto" }}
        >
          {recentCompleted.map((checklist) => (
            <CompletedChecklistCard
              key={checklist.id}
              checklist={checklist}
              formatRelativeDate={formatRelativeDate}
              assetId={assetId}
            />
          ))}
          {hasMore && (
            <div className="text-center pt-2">
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/activos/${assetId}/historial-checklists`}
                  className="cursor-pointer transition-colors duration-200"
                >
                  <History className="h-3 w-3 mr-1" />
                  Ver Historial Completo ({completed.length})
                </Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
