"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import type { ChecklistIssue } from "./types"

interface CompletedChecklistIssuesCardProps {
  issues: ChecklistIssue[]
}

export function CompletedChecklistIssuesCard({ issues }: CompletedChecklistIssuesCardProps) {
  if (!issues || issues.length === 0) return null

  return (
    <Card className="shadow-checklist-2">
      <CardHeader>
        <CardTitle className="text-lg text-red-600 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          Problemas Detectados
        </CardTitle>
        <CardDescription>Issues que requieren atención o generaron órdenes de trabajo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {issues.map((issue) => (
            <div key={issue.id} className="border-l-4 border-red-500 pl-4 py-2">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden />
                <Badge variant="destructive" className="text-xs">
                  {issue.status === 'flag' ? 'Atención' : 'Falla'}
                </Badge>
                {issue.resolved && (
                  <Badge variant="outline" className="text-xs">
                    Resuelto
                  </Badge>
                )}
              </div>
              <p className="font-medium">{issue.description}</p>
              {issue.notes && (
                <p className="text-sm text-muted-foreground mt-1">{issue.notes}</p>
              )}
              {issue.work_order_id && (
                <p className="text-sm text-blue-600 mt-1">
                  Orden de trabajo generada: {issue.work_order_id}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
