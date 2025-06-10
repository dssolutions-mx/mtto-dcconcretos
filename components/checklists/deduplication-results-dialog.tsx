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
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  CheckCircle2, 
  Link2, 
  Plus, 
  TrendingUp, 
  Wrench,
  AlertTriangle,
  BarChart3,
  WifiOff 
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
    offline?: boolean
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

  // Handle both regular results and offline results
  const isOfflineResult = results.offline || false
  const stats = results.deduplication_stats || {
    new_work_orders: 0,
    consolidated_issues: 0,
    total_similar_found: 0,
    consolidation_window_days: 0
  }
  const hasConsolidations = stats.consolidated_issues > 0
  const hasNewWorkOrders = stats.new_work_orders > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[85vw] max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-4 sm:p-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            {isOfflineResult ? (
              <WifiOff className="h-5 w-5 text-orange-600" />
            ) : (
              <BarChart3 className="h-5 w-5 text-blue-600" />
            )}
            {isOfflineResult ? "Guardado Offline" : "Resultados del Procesamiento"}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            {isOfflineResult 
              ? "Las órdenes de trabajo se han guardado localmente y se procesarán cuando vuelva la conexión"
              : "Resumen de las acciones tomadas con el sistema de deduplicación inteligente"
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 sm:px-6">
          <div className="space-y-4 sm:space-y-6 py-2 pb-4">
            {/* Overall Statistics */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <Card className="text-center">
                <CardContent className="pt-3 sm:pt-4 pb-3">
                  <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.new_work_orders}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Nuevas Órdenes</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-3 sm:pt-4 pb-3">
                  <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.consolidated_issues}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Consolidadas</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-3 sm:pt-4 pb-3">
                  <div className="text-lg sm:text-2xl font-bold text-orange-600">{stats.total_similar_found}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Similares</div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* New Work Orders Created */}
            {hasNewWorkOrders && (
              <div>
                <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Plus className="h-4 w-4" />
                  Nuevas Órdenes de Trabajo Creadas ({stats.new_work_orders})
                </h4>
                <div className="space-y-3">
                  {results.work_orders?.map((workOrder, index) => (
                    <Card key={workOrder.id} className="bg-green-50 border-green-200">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="font-medium text-sm sm:text-base text-green-900">
                              {workOrder.order_id || `OT-${index + 1}`}
                            </div>
                            <div className="text-xs sm:text-sm text-green-700 line-clamp-2">
                              {workOrder.description?.split('\n')[0] || 'Sin descripción'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Badge variant="outline" className="text-xs">
                              {workOrder.priority}
                            </Badge>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => onNavigateToWorkOrder(workOrder.id)}
                              className="text-xs px-3 py-2 h-8 flex-1 sm:flex-none"
                            >
                              Ver Orden
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Consolidated Issues */}
            {hasConsolidations && (
              <div>
                <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Link2 className="h-4 w-4" />
                  Problemas Consolidados ({stats.consolidated_issues})
                </h4>
                <div className="space-y-3">
                  {results.consolidated_issues?.map((consolidation, index) => (
                    <Card key={index} className="bg-blue-50 border-blue-200">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="font-medium text-sm sm:text-base text-blue-900">
                              Consolidado en orden existente
                            </div>
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-700">
                              <span>Recurrencia #{consolidation.recurrence_count}</span>
                              {consolidation.escalated && (
                                <Badge variant="destructive" className="text-xs">
                                  Escalado
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => onNavigateToWorkOrder(consolidation.consolidated_into)}
                            className="text-xs px-3 py-2 h-8 w-full sm:w-auto"
                          >
                            Ver Orden
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Efficiency Summary */}
            <Card className="bg-gray-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Resumen de Eficiencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Problemas procesados:</span>
                    <span className="font-medium">{stats.new_work_orders + stats.consolidated_issues}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Órdenes evitadas por consolidación:</span>
                    <span className="font-medium text-blue-600">{stats.consolidated_issues}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Ventana de consolidación:</span>
                    <span className="font-medium">{stats.consolidation_window_days} días</span>
                  </div>
                  {hasConsolidations && (
                    <div className="flex justify-between items-center text-green-700 pt-1 border-t">
                      <span className="font-medium">Eficiencia alcanzada:</span>
                      <span className="font-bold text-lg">
                        {Math.round((stats.consolidated_issues / (stats.new_work_orders + stats.consolidated_issues)) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Success Message */}
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm sm:text-base text-green-800">
                    <div className="font-semibold mb-1">Procesamiento Completado</div>
                    <div className="text-sm">{results.message}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <Separator />
        
        <DialogFooter className="flex-shrink-0 p-4 sm:p-6 pt-4">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="order-2 sm:order-1"
            >
              Cerrar
            </Button>
            {hasNewWorkOrders && results.work_orders?.[0] && (
              <Button 
                onClick={() => {
                  onNavigateToWorkOrder(results.work_orders[0].id)
                  onOpenChange(false)
                }}
                className="order-1 sm:order-2"
              >
                Ver Primera Orden
              </Button>
            )}
            {!hasNewWorkOrders && hasConsolidations && results.consolidated_issues?.[0] && (
              <Button 
                onClick={() => {
                  onNavigateToWorkOrder(results.consolidated_issues[0].consolidated_into)
                  onOpenChange(false)
                }}
                className="order-1 sm:order-2"
              >
                Ver Orden Consolidada
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 