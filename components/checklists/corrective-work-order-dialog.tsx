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
import { AlertTriangle, Clock, Flag, Wrench, Loader2 } from "lucide-react"
import { toast } from "sonner"

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

  // Initialize description when dialog opens
  useEffect(() => {
    if (open && itemsWithIssues.length > 0) {
      setDescription(generateDefaultDescription())
    }
  }, [open, itemsWithIssues, checklist?.name])

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Por favor, ingrese una descripción para la orden de trabajo")
      return
    }

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
          asset_id: checklist.assetId
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Error al crear orden de trabajo correctiva')
      }
      
      toast.success(
        `${result.message || 'Órdenes de trabajo correctivas creadas exitosamente'} ` +
        `Se registraron ${result.incidents_created || 0} incidencia(s).`
      )
      
      // If multiple work orders were created, navigate to the first one or show a summary
      if (result.work_orders && result.work_orders.length > 0) {
        onWorkOrderCreated(result.work_orders[0].id)
      } else if (result.work_order_id) {
        onWorkOrderCreated(result.work_order_id)
      }
      onOpenChange(false)
      
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-500" />
            Generar Orden de Trabajo Correctiva
          </DialogTitle>
          <DialogDescription>
            Configure los detalles de la orden de trabajo que se generará para corregir los problemas detectados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Asset Information */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Información del Activo</h4>
            <div className="text-sm text-blue-800">
              <div><strong>Activo:</strong> {checklist.asset}</div>
              <div><strong>Código:</strong> {checklist.assetCode}</div>
              {checklist.assetLocation && (
                <div><strong>Ubicación:</strong> {checklist.assetLocation}</div>
              )}
            </div>
          </div>

          {/* Issues Summary */}
          <div>
            <h4 className="font-medium mb-3">Problemas Detectados ({itemsWithIssues.length})</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {itemsWithIssues.map((item, index) => (
                <div key={item.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded border">
                  <Badge 
                    variant={item.status === "fail" ? "destructive" : "secondary"}
                    className="mt-0.5"
                  >
                    {item.status === "fail" ? "Falla" : "Revisar"}
                  </Badge>
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{item.description}</div>
                    {item.sectionTitle && (
                      <div className="text-muted-foreground">Sección: {item.sectionTitle}</div>
                    )}
                    {item.notes && (
                      <div className="text-muted-foreground">Notas: {item.notes}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Selection */}
          <div>
            <Label className="text-base font-medium">Prioridad de la Orden de Trabajo</Label>
            <RadioGroup value={priority} onValueChange={setPriority} className="mt-3">
              <div className="space-y-3">
                {["Alta", "Media", "Baja"].map((priorityLevel) => (
                  <div key={priorityLevel} className="flex items-center space-x-2">
                    <RadioGroupItem value={priorityLevel} id={priorityLevel} />
                    <Label 
                      htmlFor={priorityLevel} 
                      className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded border transition-colors ${
                        priority === priorityLevel ? getPriorityColor(priorityLevel) : 'hover:bg-gray-50'
                      }`}
                    >
                      {getPriorityIcon(priorityLevel)}
                      <span className="font-medium">{priorityLevel}</span>
                      <span className="text-sm text-muted-foreground">
                        {priorityLevel === "Alta" && "- Requiere atención inmediata"}
                        {priorityLevel === "Media" && "- Atender en el día"}
                        {priorityLevel === "Baja" && "- Programar cuando sea conveniente"}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-base font-medium">
              Descripción de la Orden de Trabajo
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describa los trabajos a realizar para corregir los problemas detectados..."
              className="mt-2 min-h-[120px]"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Esta descripción se usará para crear la orden de trabajo. Puede modificar el texto generado automáticamente.
            </p>
          </div>

          {/* Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Se creará una orden de trabajo correctiva y se registrarán los incidentes correspondientes en el historial del activo.
              Cada problema detectado generará un incidente individual para mejor seguimiento.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || !description.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Wrench className="mr-2 h-4 w-4" />
                Generar Orden de Trabajo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 