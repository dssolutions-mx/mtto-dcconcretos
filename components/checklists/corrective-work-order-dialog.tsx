"use client"

import { useState, useEffect, useCallback } from "react"
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
import { AlertTriangle, Clock, Flag, Wrench, Loader2, Info, Search, WifiOff, Wifi, CheckCircle2, Package, Zap, Target, Users, Plus, Link2, X, Layers, StickyNote, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { SimilarIssuesSection } from "./similar-issues-section"
import { DeduplicationResultsDialog } from "./deduplication-results-dialog"
import { useOfflineSync } from "@/hooks/useOfflineSync"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

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
  onNavigateToAssetsPage?: () => void
}

export function CorrectiveWorkOrderDialog({
  open,
  onOpenChange,
  checklist,
  itemsWithIssues,
  onWorkOrderCreated,
  onNavigateToAssetsPage
}: CorrectiveWorkOrderDialogProps) {
  // Priority management - simplified but supporting both modes
  const [priorityMode, setPriorityMode] = useState<'global' | 'individual'>('global')
  const [globalPriority, setGlobalPriority] = useState("Media")
  const [individualPriorities, setIndividualPriorities] = useState<Record<string, string>>({})
  
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingSimilar, setCheckingSimilar] = useState(false)
  const [similarIssuesResults, setSimilarIssuesResults] = useState<any[]>([])
  const [consolidationChoices, setConsolidationChoices] = useState<Record<string, 'consolidate' | 'create_new' | 'escalate'>>({})
  const [showResults, setShowResults] = useState(false)
  const [processingResults, setProcessingResults] = useState<any>(null)
  
  // Offline functionality
  const { isOnline } = useOfflineSync()
  const [offlineWorkOrderData, setOfflineWorkOrderData] = useState<any>(null)

  // Stabilize the consolidation choice handler with useCallback
  const handleConsolidationChoiceChange = useCallback((choices: Record<string, 'consolidate' | 'create_new' | 'escalate'>) => {
    setConsolidationChoices(choices)
  }, [])

  // Simple initialization - more stable
  useEffect(() => {
    if (open) {
      // Set default priority based on most severe issue
      const hasFailures = itemsWithIssues.some(item => item.status === 'fail')
      const hasFlags = itemsWithIssues.some(item => item.status === 'flag')
      
      // Auto-detect if we should use individual mode
      if (hasFailures && hasFlags && itemsWithIssues.length > 1) {
        setPriorityMode('individual')
        // Initialize individual priorities
        const newIndividualPriorities: Record<string, string> = {}
        itemsWithIssues.forEach(item => {
          newIndividualPriorities[item.id] = item.status === 'fail' ? 'Alta' : 'Media'
        })
        setIndividualPriorities(newIndividualPriorities)
      } else {
        setPriorityMode('global')
        setGlobalPriority(hasFailures ? 'Alta' : 'Media')
        setIndividualPriorities({})
      }
      
      setDescription("")
      setSimilarIssuesResults([])
      setConsolidationChoices({})
      setShowResults(false)
      setProcessingResults(null)
      setOfflineWorkOrderData(null)
      
      // Only check for similar issues if online
      if (isOnline) {
        checkForSimilarIssues()
      }
    }
  }, [open, itemsWithIssues, isOnline])

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
      toast.error('Error al verificar problemas similares. Continuando sin deduplicación.')
    } finally {
      setCheckingSimilar(false)
    }
  }

  const handleSubmit = async () => {
    // Simple validation for individual mode
    if (priorityMode === 'individual') {
      const missingPriorities = itemsWithIssues.filter(item => !individualPriorities[item.id])
      if (missingPriorities.length > 0) {
        toast.error('Por favor asigne prioridad a todos los elementos')
        return
      }
    }
    
    setLoading(true)
    
    try {
      // Prepare items with their priorities
      const itemsWithPriorities = itemsWithIssues.map(item => ({
        ...item,
        priority: priorityMode === 'individual' 
          ? individualPriorities[item.id] 
          : globalPriority
      }))

      const submissionData = {
        checklist_id: checklist.id,
        asset_id: checklist.assetId,
        asset_name: checklist.assets?.name || checklist.asset || 'Sin nombre',
        items: itemsWithPriorities,
        global_priority: globalPriority,
        description: description || generateDefaultDescription(),
        similar_issues_results: similarIssuesResults,
        consolidation_choices: consolidationChoices,
        smart_deduplication_enabled: isOnline
      }

      if (!isOnline) {
        // Save offline
        const offlineId = `work-orders-${checklist.id}-${Date.now()}`
        localStorage.setItem(`offline-work-orders-${checklist.id}`, JSON.stringify(submissionData))
        setOfflineWorkOrderData(submissionData)
        
        toast.success("Órdenes de trabajo guardadas offline", {
          description: "Se procesarán automáticamente cuando vuelva la conexión"
        })
        
        onOpenChange(false)
        return
      }

      const response = await fetch('/api/checklists/generate-corrective-work-order-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      })

      if (response.ok) {
        const result = await response.json()
        setProcessingResults(result)
        setShowResults(true)
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Error al crear las órdenes de trabajo')
      }
    } catch (error) {
      console.error('Error submitting work orders:', error)
      toast.error('Error al procesar las órdenes de trabajo')
    } finally {
      setLoading(false)
    }
  }

  // Simple helper to update individual priority
  const updateIndividualPriority = (itemId: string, priority: string) => {
    setIndividualPriorities(prev => ({
      ...prev,
      [itemId]: priority
    }))
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

  const getActionButtonText = () => {
    if (checkingSimilar) {
      return {
        icon: <Search className="mr-2 h-4 w-4 animate-pulse" />,
        desktop: "Verificando similares...",
        mobile: "Verificando..."
      }
    }
    
    if (loading) {
      return {
        icon: <Loader2 className="mr-2 h-4 w-4 animate-spin" />,
        desktop: isOnline ? "Creando órdenes..." : "Guardando offline...",
        mobile: isOnline ? "Creando..." : "Guardando..."
      }
    }
    
    const itemsWithSimilarIssues = similarIssuesResults.filter(result => 
      result.similar_issues && result.similar_issues.length > 0
    )
    
    let consolidateCount = 0
    let createNewCount = 0
    let escalateCount = 0

    if (itemsWithSimilarIssues.length > 0 && isOnline) {
      itemsWithSimilarIssues.forEach(result => {
        const choice = consolidationChoices[result.item.id] || 'consolidate'
        if (choice === 'consolidate') consolidateCount++
        else if (choice === 'escalate') escalateCount++
        else createNewCount++
      })
      createNewCount += itemsWithIssues.length - itemsWithSimilarIssues.length
    } else {
      createNewCount = itemsWithIssues.length
    }

    if (consolidateCount > 0 && createNewCount === 0) {
      return {
        icon: <Wrench className="mr-2 h-4 w-4" />,
        desktop: `Consolidar ${consolidateCount} problema${consolidateCount > 1 ? 's' : ''}`,
        mobile: "Consolidar"
      }
    } else if (createNewCount > 0 && consolidateCount === 0) {
      return {
        icon: <Wrench className="mr-2 h-4 w-4" />,
        desktop: isOnline 
          ? `Crear ${createNewCount} orden${createNewCount > 1 ? 'es' : ''}`
          : `Guardar ${createNewCount} orden${createNewCount > 1 ? 'es' : ''} offline`,
        mobile: isOnline ? "Crear" : "Guardar"
      }
    } else {
      return {
        icon: <Wrench className="mr-2 h-4 w-4" />,
        desktop: isOnline ? "Procesar órdenes" : "Guardar offline",
        mobile: isOnline ? "Procesar" : "Guardar"
      }
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[80vw] max-w-3xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-4 sm:p-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {!isOnline ? (
              <WifiOff className="h-5 w-5 text-orange-600" />
            ) : (
              <Wrench className="h-5 w-5 text-blue-600" />
            )}
            Órdenes de Trabajo Correctivas
            {!isOnline && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Offline
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Configure las órdenes de trabajo correctivas para los problemas detectados
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full px-4 sm:px-6">
              <div className="space-y-4 pb-4">
                {/* Info Alert */}
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-800">
                    <span className="font-medium">✨ Proceso inteligente:</span> Se crea una orden individual por problema para mejor seguimiento
                  </AlertDescription>
                </Alert>

                {/* Asset Information */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-blue-100 p-1 rounded">
                      <Package className="h-4 w-4 text-blue-600" />
                    </div>
                    <h4 className="font-medium text-blue-900 text-sm">Activo a Reparar</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600">🏭</span>
                      <span className="font-medium">{checklist.assets?.name || checklist.asset || 'Sin nombre'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600">🏷️</span>
                      <span>{checklist.assets?.asset_id || checklist.assetCode || checklist.assetId || 'Sin código'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600">📍</span>
                      <span>{checklist.assets?.location || checklist.assetLocation || 'Sin ubicación'}</span>
                    </div>
                  </div>
                </div>

                {/* Problems Summary */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-red-100 p-1 rounded">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                    <h4 className="font-medium text-sm">
                      Problemas Encontrados ({itemsWithIssues.length})
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      → {itemsWithIssues.length} Órdenes
                    </Badge>
                  </div>
                  
                  <div className="border rounded-lg bg-gradient-to-r from-gray-50 to-slate-50">
                    <div className="max-h-48 overflow-y-auto p-2">
                      <div className="space-y-2">
                        {itemsWithIssues.map((item, index) => (
                          <div key={item.id} className="bg-white rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col items-center gap-1">
                                <div className={`p-1 rounded-full ${
                                  item.status === "fail" 
                                    ? "bg-red-100" 
                                    : "bg-yellow-100"
                                }`}>
                                  {item.status === "fail" ? (
                                    <X className="h-3 w-3 text-red-600" />
                                  ) : (
                                    <AlertTriangle className="h-3 w-3 text-yellow-600" />
                                  )}
                                </div>
                                <Badge 
                                  variant={item.status === "fail" ? "destructive" : "secondary"}
                                  className="text-xs font-medium"
                                >
                                  OT #{index + 1}
                                </Badge>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900 line-clamp-2">
                                  {item.description}
                                </div>
                                {item.sectionTitle && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    📋 {item.sectionTitle}
                                  </div>
                                )}
                                {item.notes && (
                                  <div className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded border-l-2 border-gray-300">
                                    💬 {item.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Similar Issues Section - Only show if online and has results */}
                {isOnline && similarIssuesResults.length > 0 && (
                  <SimilarIssuesSection
                    similarIssuesResults={similarIssuesResults}
                    onConsolidationChoiceChange={handleConsolidationChoiceChange}
                  />
                )}

                {/* Simplified but Complete Priority Configuration */}
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-yellow-100 p-1 rounded">
                      <Zap className="h-4 w-4 text-yellow-600" />
                    </div>
                    <h4 className="font-medium text-sm">Configuración de Prioridades</h4>
                    <Badge variant="secondary" className="text-xs">
                      {priorityMode === 'global' ? 'Misma Prioridad' : 'Prioridad Individual'}
                    </Badge>
                  </div>
                  
                  {/* Mode Selection */}
                  <RadioGroup 
                    value={priorityMode} 
                    onValueChange={(value: 'global' | 'individual') => setPriorityMode(value)}
                    className="mb-4"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <Label 
                        htmlFor="global-mode" 
                        className={`cursor-pointer flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          priorityMode === 'global' 
                            ? 'border-blue-300 bg-blue-50 text-blue-900' 
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <RadioGroupItem value="global" id="global-mode" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">Misma Prioridad</div>
                          <div className="text-xs text-gray-600">Todas las órdenes</div>
                        </div>
                      </Label>
                      
                      <Label 
                        htmlFor="individual-mode" 
                        className={`cursor-pointer flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          priorityMode === 'individual' 
                            ? 'border-blue-300 bg-blue-50 text-blue-900' 
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <RadioGroupItem value="individual" id="individual-mode" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">Prioridad Individual</div>
                          <div className="text-xs text-gray-600">Por cada orden</div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Global Priority Selection */}
                  {priorityMode === 'global' && (
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <RadioGroup value={globalPriority} onValueChange={setGlobalPriority}>
                        <div className="grid grid-cols-3 gap-3">
                          {["Alta", "Media", "Baja"].map((priorityLevel) => (
                            <div key={priorityLevel}>
                              <RadioGroupItem 
                                value={priorityLevel} 
                                id={`global-${priorityLevel}`}
                                className="sr-only"
                              />
                              <Label 
                                htmlFor={`global-${priorityLevel}`} 
                                className={`cursor-pointer flex flex-col items-center gap-2 p-4 rounded-lg border transition-all hover:shadow-md ${
                                  globalPriority === priorityLevel 
                                    ? `${getPriorityColor(priorityLevel)} font-medium border-2 border-current shadow-lg` 
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {getPriorityIcon(priorityLevel)}
                                  <span className="font-medium text-sm">{priorityLevel}</span>
                                </div>
                                <span className="text-xs text-center text-gray-600">
                                  {getPriorityLabel(priorityLevel)}
                                </span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  {/* Individual Priority Selection */}
                  {priorityMode === 'individual' && (
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="h-4 w-4 text-gray-600" />
                        <Label className="font-medium text-sm">Prioridad por Orden</Label>
                      </div>
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        {itemsWithIssues.map((item, index) => (
                          <div key={item.id} className="bg-gray-50 p-3 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`p-1 rounded-full ${
                                item.status === "fail" ? "bg-red-100" : "bg-yellow-100"
                              }`}>
                                {item.status === "fail" ? (
                                  <X className="h-3 w-3 text-red-600" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3 text-yellow-600" />
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                OT #{index + 1}
                              </Badge>
                              <span className="text-xs text-gray-600 flex-1 truncate">{item.description}</span>
                            </div>
                            <RadioGroup 
                              value={individualPriorities[item.id] || (item.status === 'fail' ? 'Alta' : 'Media')}
                              onValueChange={(value) => updateIndividualPriority(item.id, value)}
                            >
                              <div className="grid grid-cols-3 gap-2">
                                {["Alta", "Media", "Baja"].map((priorityLevel) => (
                                  <div key={priorityLevel}>
                                    <RadioGroupItem 
                                      value={priorityLevel} 
                                      id={`${item.id}-${priorityLevel}`}
                                      className="sr-only"
                                    />
                                    <Label 
                                      htmlFor={`${item.id}-${priorityLevel}`} 
                                      className={`flex items-center justify-center gap-1 cursor-pointer py-2 px-2 rounded text-xs transition-all ${
                                        (individualPriorities[item.id] || (item.status === 'fail' ? 'Alta' : 'Media')) === priorityLevel 
                                          ? `${getPriorityColor(priorityLevel)} font-medium border-2 border-current` 
                                          : 'bg-white border border-gray-200 hover:border-gray-300'
                                      }`}
                                    >
                                      {getPriorityIcon(priorityLevel)}
                                      <span className="hidden sm:inline">{priorityLevel}</span>
                                      <span className="sm:hidden">{priorityLevel.charAt(0)}</span>
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </RadioGroup>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="bg-gradient-to-r from-gray-50 to-zinc-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-gray-600" />
                    <Label htmlFor="description" className="font-medium text-sm text-gray-900">
                      Notas Adicionales (Opcional)
                    </Label>
                  </div>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="💬 Agregue contexto adicional que ayude al técnico..."
                    className="min-h-[60px] max-h-[80px] text-sm border-gray-300 focus:border-blue-500 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Se incluirá en todas las órdenes como contexto adicional
                  </p>
                </div>

                {/* Action Summary */}
                <Alert className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-800">
                    <div className="font-medium mb-1">📋 Resumen de Acciones:</div>
                    {(() => {
                      if (!isOnline) {
                        return (
                          <div className="flex items-center gap-1">
                            <WifiOff className="h-3 w-3" />
                            <span>Se guardarán <strong>{itemsWithIssues.length} orden{itemsWithIssues.length > 1 ? 'es' : ''}</strong> offline</span>
                          </div>
                        )
                      }

                      const itemsWithSimilarIssues = similarIssuesResults.filter(result => 
                        result.similar_issues && result.similar_issues.length > 0
                      )
                      
                      let consolidateCount = 0
                      let createNewCount = 0
                      let escalateCount = 0

                      // Count user choices for items with similar issues
                      itemsWithSimilarIssues.forEach(result => {
                        const choice = consolidationChoices[result.item.id] || 'consolidate'
                        if (choice === 'consolidate') consolidateCount++
                        else if (choice === 'escalate') escalateCount++
                        else createNewCount++
                      })
                      
                      // Items without similar issues will always create new orders
                      createNewCount += itemsWithIssues.length - itemsWithSimilarIssues.length

                      return (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {createNewCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Plus className="h-3 w-3 text-green-600" />
                                <span><strong>{createNewCount}</strong> nueva{createNewCount > 1 ? 's' : ''}</span>
                              </div>
                            )}
                            {consolidateCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Link2 className="h-3 w-3 text-blue-600" />
                                <span><strong>{consolidateCount}</strong> consolidada{consolidateCount > 1 ? 's' : ''}</span>
                              </div>
                            )}
                            {escalateCount > 0 && (
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-red-600" />
                                <span><strong>{escalateCount}</strong> escalada{escalateCount > 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Show details for consolidations */}
                          {consolidateCount > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              💡 Los problemas consolidados se agregarán a órdenes existentes
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </AlertDescription>
                </Alert>
              </div>
            </ScrollArea>
          </div>

          <Separator />
          
          <DialogFooter className="flex-shrink-0 p-4 pt-3 gap-2">
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
              disabled={loading || (checkingSimilar && isOnline)}
              className="flex-1 sm:flex-none"
            >
              {(() => {
                const buttonText = getActionButtonText()
                return (
                  <>
                    {buttonText.icon}
                    <span className="hidden sm:inline">{buttonText.desktop}</span>
                    <span className="sm:hidden">{buttonText.mobile}</span>
                  </>
                )
              })()}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>

    {/* Results Dialog */}
    {isOnline && (
      <DeduplicationResultsDialog
        open={showResults}
        onOpenChange={setShowResults}
        results={processingResults}
        onNavigateToWorkOrder={(workOrderId) => {
          setShowResults(false)
          onWorkOrderCreated(workOrderId)
        }}
        onNavigateToAssetsPage={onNavigateToAssetsPage}
      />
    )}
  </>
  )
} 