"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Copy, Loader2 } from "lucide-react"

interface DuplicateTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: {
    id: string
    name: string
    description?: string
    frequency: string
    model_id: string
    interval_id?: string
    equipment_models?: {
      id: string
      name: string
      manufacturer?: string
    }
  } | null
  onSuccess?: () => void
}

export function DuplicateTemplateDialog({
  open,
  onOpenChange,
  template,
  onSuccess
}: DuplicateTemplateDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState<any[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: '',
    model_id: '',
    interval_id: ''
  })

  // Load equipment models when dialog opens
  useEffect(() => {
    if (open) {
      fetchModels()
      if (template) {
        setFormData({
          name: `${template.name} (Copia)`,
          description: template.description || '',
          frequency: template.frequency,
          model_id: template.model_id,
          interval_id: template.interval_id || ''
        })
      }
    }
  }, [open, template])

  const fetchModels = async () => {
    setLoadingModels(true)
    try {
      const response = await fetch('/api/models')
      if (response.ok) {
        const data = await response.json()
        setModels(data)
      }
    } catch (error) {
      console.error('Error fetching models:', error)
    } finally {
      setLoadingModels(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleDuplicate = async () => {
    if (!template) return

    if (!formData.name.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    if (!formData.frequency) {
      toast.error('La frecuencia es requerida')
      return
    }

    if (!formData.model_id) {
      toast.error('El modelo de equipo es requerido')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/checklists/templates/${template.id}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          frequency: formData.frequency,
          model_id: formData.model_id,
          interval_id: formData.interval_id || null
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success('Plantilla duplicada exitosamente')
        onOpenChange(false)
        onSuccess?.()
      } else {
        throw new Error(result.error || 'Error al duplicar la plantilla')
      }
    } catch (error: any) {
      console.error('Error duplicating template:', error)
      toast.error(`Error al duplicar plantilla: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicar Plantilla de Checklist
          </DialogTitle>
          <DialogDescription>
            Crea una copia de "{template?.name}" con modificaciones. 
            Todas las secciones e items serán copiados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la nueva plantilla</Label>
            <Input
              id="name"
              placeholder="Nombre de la plantilla"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descripción de la plantilla"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Frecuencia</Label>
            <Select
              value={formData.frequency}
              onValueChange={(value) => handleInputChange('frequency', value)}
            >
              <SelectTrigger id="frequency">
                <SelectValue placeholder="Seleccionar frecuencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diario</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="semestral">Semestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Modelo de Equipo</Label>
            <Select
              value={formData.model_id}
              onValueChange={(value) => handleInputChange('model_id', value)}
              disabled={loadingModels}
            >
              <SelectTrigger id="model">
                <SelectValue placeholder={
                  loadingModels 
                    ? "Cargando modelos..." 
                    : "Seleccionar modelo de equipo"
                } />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.manufacturer} {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Información del template original */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h4 className="font-medium text-sm mb-2">Plantilla original:</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Nombre: {template?.name}</p>
              <p>Frecuencia: {template?.frequency}</p>
              <p>Modelo: {template?.equipment_models?.manufacturer} {template?.equipment_models?.name}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDuplicate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Duplicando...
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Duplicar Plantilla
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 