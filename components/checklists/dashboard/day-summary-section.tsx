"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardCheck, Check } from "lucide-react"

export interface DaySummaryStats {
  daily: { total: number; pending: number; overdue: number }
  weekly: { total: number; pending: number; overdue: number }
  monthly: { total: number; pending: number; overdue: number }
}

interface DaySummarySectionProps {
  stats: DaySummaryStats
}

export function DaySummarySection({ stats }: DaySummarySectionProps) {
  const totalToday = stats.daily.total + stats.weekly.total + stats.monthly.total
  const totalOverdue = stats.daily.overdue + stats.weekly.overdue + stats.monthly.overdue

  if (totalToday > 0 || totalOverdue > 0) {
    return (
      <Card className="mb-6 shadow-checklist-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-sf-pro flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-checklist-primary" />
            Resumen del Día
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            {totalToday > 0 && (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shadow-checklist-1">
                  <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{totalToday}</span>
                </div>
                <div>
                  <p className="font-medium">Checklists para hoy</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.daily.total > 0 && `${stats.daily.total} diarios`}
                    {stats.weekly.total > 0 && `${stats.daily.total > 0 ? ", " : ""}${stats.weekly.total} semanales`}
                    {stats.monthly.total > 0 &&
                      `${stats.daily.total > 0 || stats.weekly.total > 0 ? ", " : ""}${stats.monthly.total} mensuales`}
                  </p>
                </div>
              </div>
            )}
            {totalOverdue > 0 && (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="text-lg font-bold text-red-700 dark:text-red-400">{totalOverdue}</span>
                </div>
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">Checklists atrasados</p>
                  <p className="text-sm text-muted-foreground">Requieren atención inmediata</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-6 shadow-checklist-2 border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-700 dark:text-green-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-green-700 dark:text-green-400">Todo al día</p>
            <p className="text-sm text-muted-foreground">No hay checklists pendientes para hoy</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
