"use client"

import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  CheckCircle2, 
  Link2, 
  Plus, 
  TrendingUp, 
  Wrench,
  AlertTriangle,
  BarChart3 
} from "lucide-react"

interface DeduplicationResult {
  new_work_orders: number
  consolidated_issues: number
  total_similar_found: number
  consolidation_window_days: number
}

interface DeduplicationResultsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  results: {
    smart_deduplication_enabled: boolean
    work_orders_created: number
    work_orders: any[]
    consolidated_issues: any[]
    similar_issues_found: any[]
    deduplication_stats: DeduplicationResult
    message: string
  } | null
  onNavigateToWorkOrder: (workOrderId: string) => void
}

export function DeduplicationResultsDialog({
  open,
  onOpenChange,
  results,
  onNavigateToWorkOrder
}: DeduplicationResultsDialogProps) {
  if (!results) return null

  const stats = results.deduplication_stats
  const hasConsolidations = stats.consolidated_issues > 0
  const hasNewWorkOrders = stats.new_work_orders > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-[90vw] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Resultados del Procesamiento
          </DialogTitle>
          <DialogDescription>
            Resumen de las acciones tomadas con el sistema de deduplicación inteligente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Overall Statistics */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <Card className="text-center">
              <CardContent className="pt-2 sm:pt-4">
                <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.new_work_orders}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Nuevas Órdenes</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-2 sm:pt-4">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.consolidated_issues}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Consolidadas</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-2 sm:pt-4">
                <div className="text-xl sm:text-2xl font-bold text-orange-600">{stats.total_similar_found}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Similares</div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* New Work Orders Created */}
          {hasNewWorkOrders && (
            <div>
              <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevas Órdenes de Trabajo Creadas ({stats.new_work_orders})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {results.work_orders?.map((workOrder, index) => (
                  <div key={workOrder.id} className="bg-green-50 p-2 sm:p-3 rounded border border-green-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-green-900">
                          {workOrder.order_id || `OT-${index + 1}`}
                        </div>
                        <div className="text-xs text-green-700 overflow-hidden text-ellipsis whitespace-nowrap">
                          {workOrder.description?.split('\n')[0] || 'Sin descripción'}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {workOrder.priority}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => onNavigateToWorkOrder(workOrder.id)}
                          className="text-xs px-2 py-1"
                        >
                          Ver
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consolidated Issues */}
          {hasConsolidations && (
            <div>
              <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Problemas Consolidados ({stats.consolidated_issues})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {results.consolidated_issues?.map((consolidation, index) => (
                  <div key={index} className="bg-blue-50 p-3 rounded border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-blue-900">
                          Consolidado en orden existente
                        </div>
                        <div className="text-xs text-blue-700">
                          Recurrencia #{consolidation.recurrence_count}
                          {consolidation.escalated && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Escalado
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => onNavigateToWorkOrder(consolidation.consolidated_into)}
                        className="text-xs"
                      >
                        Ver OT
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Efficiency Summary */}
          <Card className="bg-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Resumen de Eficiencia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <div className="flex justify-between">
                  <span>Problemas procesados:</span>
                  <span className="font-medium">{stats.new_work_orders + stats.consolidated_issues}</span>
                </div>
                <div className="flex justify-between">
                  <span>Órdenes evitadas por consolidación:</span>
                  <span className="font-medium text-blue-600">{stats.consolidated_issues}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ventana de consolidación:</span>
                  <span className="font-medium">{stats.consolidation_window_days} días</span>
                </div>
                {hasConsolidations && (
                  <div className="flex justify-between text-green-700">
                    <span>Eficiencia alcanzada:</span>
                    <span className="font-medium">
                      {Math.round((stats.consolidated_issues / (stats.new_work_orders + stats.consolidated_issues)) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Success Message */}
          <div className="bg-green-50 p-3 rounded border border-green-200">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              <div className="text-sm text-green-800">
                <strong>Procesamiento Completado</strong><br />
                {results.message}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {hasNewWorkOrders && results.work_orders?.[0] && (
            <Button onClick={() => {
              onNavigateToWorkOrder(results.work_orders[0].id)
              onOpenChange(false)
            }}>
              Ver Primera Orden
            </Button>
          )}
          {!hasNewWorkOrders && hasConsolidations && results.consolidated_issues?.[0] && (
            <Button onClick={() => {
              onNavigateToWorkOrder(results.consolidated_issues[0].consolidated_into)
              onOpenChange(false)
            }}>
              Ver Orden Consolidada
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 