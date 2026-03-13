"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export interface IssueHistoryEntry {
  date?: string
  checklist?: string
  description?: string
  notes?: string
  status?: string
}

export interface WorkOrderRecurrenceCardProps {
  relatedIssuesCount: number
  escalationCount: number
  issueHistory: IssueHistoryEntry[] | null
}

export function WorkOrderRecurrenceCard({
  relatedIssuesCount,
  escalationCount,
  issueHistory,
}: WorkOrderRecurrenceCardProps) {
  const recurrenceCount = Math.max(0, relatedIssuesCount - 1)
  const vez = (n: number) => (n === 1 ? "vez" : "veces")

  const summary =
    recurrenceCount > 0 && escalationCount > 0 ? (
      <>
        Este problema ha recurrido <strong>{recurrenceCount}</strong> {vez(recurrenceCount)} y ha
        sido escalado <strong>{escalationCount}</strong> {vez(escalationCount)}.
      </>
    ) : recurrenceCount > 0 ? (
      <>
        Este problema ha recurrido <strong>{recurrenceCount}</strong> {vez(recurrenceCount)}.
      </>
    ) : (
      <>
        Este problema ha sido escalado <strong>{escalationCount}</strong> {vez(escalationCount)}.
      </>
    )

  const sortedHistory = [...(issueHistory || [])].sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  )

  // Common values (shown once when identical across all entries)
  const allSameChecklist =
    sortedHistory.length > 1 &&
    sortedHistory.every((e) => (e.checklist || "") === (sortedHistory[0]?.checklist || ""))
  const allSameStatus =
    sortedHistory.length > 1 &&
    sortedHistory.every((e) => (e.status || "") === (sortedHistory[0]?.status || ""))
  const commonChecklist = allSameChecklist ? sortedHistory[0]?.checklist : null
  const commonStatus = allSameStatus ? sortedHistory[0]?.status : null

  return (
    <Card>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-amber-600" aria-hidden />
          Historial de recurrencias
        </CardTitle>
        <CardDescription className="text-xs">
          Este problema ha aparecido múltiples veces en el mismo activo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        <p className="text-sm">{summary}</p>
        {sortedHistory.length > 0 ? (
          <div className="space-y-1">
            {(commonChecklist || commonStatus) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                {commonChecklist && (
                  <Badge variant="outline" className="text-xs">
                    {commonChecklist}
                  </Badge>
                )}
                {commonStatus && (
                  <span>{commonStatus === "fail" ? "Falla" : "Revisión"}</span>
                )}
              </div>
            )}
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {sortedHistory.map((entry, idx) => (
                <div
                  key={idx}
                  className="border-l-2 border-amber-200 pl-2 py-1 text-sm flex flex-col gap-0.5"
                >
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {entry.date && (
                      <span className="text-muted-foreground font-medium shrink-0">
                        {format(new Date(entry.date), "d MMM HH:mm", { locale: es })}
                      </span>
                    )}
                    {(entry.notes || entry.description) && (
                      <span className="text-foreground line-clamp-1">
                        {entry.notes || entry.description}
                      </span>
                    )}
                  </div>
                  {/* Show only when different from common */}
                  {(entry.checklist && !allSameChecklist) && (
                    <Badge variant="outline" className="text-xs w-fit">
                      {entry.checklist}
                    </Badge>
                  )}
                  {(entry.status && !allSameStatus) && (
                    <span className="text-xs text-muted-foreground">
                      {entry.status === "fail" ? "Falla" : "Revisión"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Detalles no disponibles</p>
        )}
      </CardContent>
    </Card>
  )
}
