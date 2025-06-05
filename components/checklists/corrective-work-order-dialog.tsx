"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Clock, Flag, Wrench, Loader2, Info, Search } from "lucide-react"
import { toast } from "sonner"
import { SimilarIssuesSection } from "./similar-issues-section"
import { DeduplicationResultsDialog } from "./deduplication-results-dialog"

interface CorrectiveWorkOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  checklist: any
  itemsWithIssues: Array<{
    id: string
    description: string
    notes: string
    photo: string | null
    status: "flag" | "fail"
    sectionTitle?: string
  }>
  onWorkOrderCreated: (workOrderId: string) => void
}

export function CorrectiveWorkOrderDialog({
  open,
  onOpenChange,
  checklist,
  itemsWithIssues,
  onWorkOrderCreated
}: CorrectiveWorkOrderDialogProps) {
  const [priority, setPriority] = useState("Media")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingSimilar, setCheckingSimilar] = useState(false)
  const [similarIssuesResults, setSimilarIssuesResults] = useState<any[]>([])
  const [consolidationChoices, setConsolidationChoices] = useState<Record<string, 'consolidate' | 'create_new' | 'escalate'>>({})
  const [showResults, setShowResults] = useState(false)
  const [processingResults, setProcessingResults] = useState<any>(null)

  // Generate default description from issues
  const generateDefaultDescription = () => {
    const failedItems = itemsWithIssues.filter(item => item.status === "fail")
    const flaggedItems = itemsWithIssues.filter(item => item.status === "flag")
    
    let desc = `Acción correctiva generada desde checklist: ${checklist.name}\n\n`
    
    if (failedItems.length > 0) {
      desc += `Elementos fallidos (${failedItems.length}):\n`
      failedItems.forEach((item, index) => {
        desc += `${index + 1}. ${item.description}`
        if (item.sectionTitle) desc += ` (${item.sectionTitle})`
        if (item.notes) desc += ` - ${item.notes}`
        desc += '\n'
      })
      desc += '\n'
    }
    
    if (flaggedItems.length > 0) {
      desc += `Elementos marcados para revisión (${flaggedItems.length}):\n`
      flaggedItems.forEach((item, index) => {
        desc += `${index + 1}. ${item.description}`
        if (item.sectionTitle) desc += ` (${item.sectionTitle})`
        if (item.notes) desc += ` - ${item.notes}`
        desc += '\n'
      })
    }
    
    return desc.trim()
  }

  // Initialize description and check for similar issues when dialog opens
  useEffect(() => {
    if (open) {
      setDescription("")
      setSimilarIssuesResults([])
      setConsolidationChoices({})
      setShowResults(false)
      setProcessingResults(null)
      checkForSimilarIssues()
    }
  }, [open, itemsWithIssues])

  const checkForSimilarIssues = async () => {
    if (!checklist.assetId || itemsWithIssues.length === 0) return
    
    setCheckingSimilar(true)
    try {
      const response = await fetch('/api/checklists/issues/check-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: checklist.assetId,
          items: itemsWithIssues,
          consolidation_window_days: 30
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setSimilarIssuesResults(data.similar_issues_results || [])
        
        // Set default choices for items with similar issues
        const defaultChoices: Record<string, 'consolidate' | 'create_new' | 'escalate'> = {}
        data.similar_issues_results?.forEach((result: any) => {
          if (result.similar_issues.length > 0) {
            defaultChoices[result.item.id] = result.recurrence_count >= 3 ? 'escalate' : 'consolidate'
          }
        })
        setConsolidationChoices(defaultChoices)
      }
    } catch (error) {
      console.error('Error checking for similar issues:', error)
    } finally {
      setCheckingSimilar(false)
    }
  }

  const handleSubmit = async () => {
    // Note: description is now optional since each work order gets its own specific description
    // The user can add additional notes that will be included in all work orders

    setLoading(true)
    
    try {
      const response = await fetch('/api/checklists/generate-corrective-work-order-enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checklist_id: checklist.id,
          items_with_issues: itemsWithIssues,
          priority,
          description: description.trim(),
          asset_id: checklist.assetId,
          consolidation_choices: consolidationChoices,
          enable_smart_deduplication: true,
          consolidation_window_days: 30
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Error al crear orden de trabajo correctiva')
      }
      
      // Store results and show detailed dialog
      setProcessingResults(result)
      
      // Close main dialog first
      onOpenChange(false)
      
      // Show detailed results dialog
      setShowResults(true)
      
      // Simple toast for immediate feedback
      toast.success('Órdenes de trabajo procesadas exitosamente. Ver detalles...')
      
    } catch (error: any) {
      console.error('Error creating corrective work order:', error)
      toast.error(`Error al crear orden de trabajo: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getPriorityIcon = (priorityLevel: string) => {
    switch (priorityLevel) {
      case "Alta":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "Media":
        return <Clock className="h-4 w-4 text-orange-500" />
      case "Baja":
        return <Flag className="h-4 w-4 text-green-500" />
      default:
        return <Wrench className="h-4 w-4 text-gray-500" />
    }
  }

  const getPriorityColor = (priorityLevel: string) => {
    switch (priorityLevel) {
      case "Alta":
        return "bg-red-100 text-red-800 border-red-300"
      case "Media":
        return "bg-orange-100 text-orange-800 border-orange-300"
      case "Baja":
        return "bg-green-100 text-green-800 border-green-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const getPriorityLabel = (priorityLevel: string) => {
    switch (priorityLevel) {
      case "Alta":
        return "Inmediata"
      case "Media":
        return "En el día"
      case "Baja":
        return "Programar"
      default:
        return ""
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] w-[95vw] sm:w-[90vw] md:w-[80vw] p-0">
        <div className="flex flex-col h-full max-h-[95vh]">
          <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              <span className="hidden sm:inline">Generar Órdenes de Trabajo Correctivas</span>
              <span className="sm:hidden">Órdenes Correctivas</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
              Configure los detalles de las órdenes de trabajo que se generarán para corregir los problemas detectados.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-4 sm:px-6">
            <div className="space-y-4 sm:space-y-6 pb-4">
              {/* Checking for Similar Issues */}
              {checkingSimilar && (
                <Alert>
                  <Search className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    <strong>Verificando problemas similares...</strong><br />
                    Analizando el historial para detectar problemas recurrentes y optimizar las órdenes de trabajo.
                  </AlertDescription>
                </Alert>
              )}

              {/* Similar Issues Section */}
              {!checkingSimilar && similarIssuesResults.length > 0 && (
                <SimilarIssuesSection 
                  similarIssuesResults={similarIssuesResults}
                  onConsolidationChoiceChange={setConsolidationChoices}
                />
              )}

              {/* Individual Work Orders Info */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Se creará una orden de trabajo individual para cada problema detectado</strong>, 
                  no una sola orden agrupada. Esto permite un mejor seguimiento y resolución específica de cada incidencia.
                </AlertDescription>
              </Alert>

              {/* Asset Information */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Información del Activo</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <div><strong>Activo:</strong> {checklist.asset}</div>
                  <div><strong>Código:</strong> {checklist.assetCode}</div>
                  {checklist.assetLocation && (
                    <div><strong>Ubicación:</strong> {checklist.assetLocation}</div>
                  )}
                </div>
              </div>

              {/* Issues Summary */}
              <div>
                <h4 className="font-medium mb-3">
                  Problemas Detectados ({itemsWithIssues.length})
                  <span className="text-sm text-muted-foreground ml-2">
                    → {itemsWithIssues.length} Órdenes de Trabajo
                  </span>
                </h4>
                <ScrollArea className="h-64 border rounded-lg">
                  <div className="space-y-3 p-4">
                    {itemsWithIssues.map((item, index) => (
                      <div key={item.id}>
                        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded border">
                          <div className="flex flex-col items-center gap-1 min-w-[60px]">
                            <Badge 
                              variant={item.status === "fail" ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              {item.status === "fail" ? "Falla" : "Revisar"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">OT #{index + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm leading-tight">{item.description}</div>
                            {item.sectionTitle && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Sección: {item.sectionTitle}
                              </div>
                            )}
                            {item.notes && (
                              <div className="text-xs text-muted-foreground mt-1 bg-white p-2 rounded border">
                                <strong>Notas:</strong> {item.notes}
                              </div>
                            )}
                          </div>
                        </div>
                        {index < itemsWithIssues.length - 1 && <Separator />}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Priority Selection */}
              <div>
                <Label className="text-base font-medium">Prioridad para Todas las Órdenes</Label>
                <RadioGroup value={priority} onValueChange={setPriority} className="mt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    {["Alta", "Media", "Baja"].map((priorityLevel) => (
                      <div key={priorityLevel} className="flex items-center space-x-2 touch-manipulation">
                        <RadioGroupItem value={priorityLevel} id={priorityLevel} className="flex-shrink-0" />
                        <Label 
                          htmlFor={priorityLevel} 
                          className={`flex items-center gap-2 cursor-pointer px-3 py-3 sm:py-2 rounded border transition-colors flex-1 min-h-[44px] ${
                            priority === priorityLevel ? getPriorityColor(priorityLevel) : 'hover:bg-gray-50'
                          }`}
                        >
                          {getPriorityIcon(priorityLevel)}
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{priorityLevel}</span>
                            <span className="text-xs text-muted-foreground">
                              {getPriorityLabel(priorityLevel)}
                            </span>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description" className="text-base font-medium">
                  Notas Adicionales (Opcional)
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Agregue observaciones adicionales, instrucciones especiales, o contexto que se incluirá en todas las órdenes..."
                  className="mt-2 min-h-[100px] max-h-[150px]"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Cada orden tendrá una descripción específica del problema detectado. Estas notas se agregarán a todas las órdenes como contexto adicional.
                </p>
              </div>

              {/* Final Warning */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Se crearán <strong>{itemsWithIssues.length} órdenes de trabajo correctivas independientes</strong> y 
                  se registrarán <strong>{itemsWithIssues.length} incidentes individuales</strong> en el historial del activo.
                </AlertDescription>
              </Alert>
            </div>
          </ScrollArea>

          <Separator />
          
          <DialogFooter className="p-4 sm:p-6 pt-4 gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 sm:flex-none"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1 sm:mr-2 h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Generando...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <Wrench className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Crear {itemsWithIssues.length} Órdenes de Trabajo</span>
                  <span className="sm:hidden">Crear {itemsWithIssues.length} OT</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>

    {/* Results Dialog */}
    <DeduplicationResultsDialog
      open={showResults}
      onOpenChange={setShowResults}
      results={processingResults}
      onNavigateToWorkOrder={(workOrderId) => {
        setShowResults(false)
        onWorkOrderCreated(workOrderId)
      }}
    />
  </>
  )
} 