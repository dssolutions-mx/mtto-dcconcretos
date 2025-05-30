import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Plus, 
  Trash2, 
  Save, 
  Eye, 
  ArrowUp, 
  ArrowDown, 
  History,
  AlertTriangle,
  Check,
  X,
  Edit3,
  Copy
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface ChecklistItem {
  id?: string
  description: string
  required: boolean
  order_index: number
  item_type: 'check' | 'measure' | 'text'
  expected_value?: string
  tolerance?: string
}

interface ChecklistSection {
  id?: string
  title: string
  order_index: number
  items: ChecklistItem[]
}

interface ChecklistTemplate {
  id?: string
  name: string
  description: string
  model_id: string
  frequency: string
  hours_interval?: number
  sections: ChecklistSection[]
}

interface TemplateVersion {
  id: string
  version_number: number
  name: string
  description: string
  change_summary: string
  created_at: string
  created_by: string
  is_active: boolean
  sections: ChecklistSection[]
}

interface TemplateEditorProps {
  templateId?: string
  onSave?: (template: ChecklistTemplate) => void
  onCancel?: () => void
}

export function TemplateEditor({ templateId, onSave, onCancel }: TemplateEditorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [template, setTemplate] = useState<ChecklistTemplate>({
    name: '',
    description: '',
    model_id: '',
    frequency: 'mensual',
    sections: []
  })
  
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [changeSummary, setChangeSummary] = useState('')
  const [models, setModels] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    loadModels()
    if (templateId) {
      loadTemplate()
      loadVersionHistory()
    }
  }, [templateId])

  const loadModels = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('equipment_models')
        .select('id, name, manufacturer')
        .order('name')

      if (error) throw error
      setModels(data || [])
    } catch (error) {
      console.error('Error loading models:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los modelos de equipos",
        variant: "destructive"
      })
    }
  }

  const loadTemplate = async () => {
    if (!templateId) return
    
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('checklists')
        .select(`
          *,
          checklist_sections (
            *,
            checklist_items (*)
          )
        `)
        .eq('id', templateId)
        .single()

      if (error) throw error

      const sections = data.checklist_sections?.map((section: any) => ({
        id: section.id,
        title: section.title,
        order_index: section.order_index,
        items: section.checklist_items?.map((item: any) => ({
          id: item.id,
          description: item.description,
          required: item.required,
          order_index: item.order_index,
          item_type: item.item_type,
          expected_value: item.expected_value,
          tolerance: item.tolerance
        })) || []
      })) || []

      setTemplate({
        id: data.id,
        name: data.name,
        description: data.description || '',
        model_id: data.model_id,
        frequency: data.frequency,
        hours_interval: data.hours_interval,
        sections: sections.sort((a: ChecklistSection, b: ChecklistSection) => a.order_index - b.order_index)
      })
    } catch (error) {
      console.error('Error loading template:', error)
      toast({
        title: "Error",
        description: "No se pudo cargar la plantilla",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const loadVersionHistory = async () => {
    if (!templateId) return
    
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('checklist_template_versions')
        .select('*')
        .eq('template_id', templateId)
        .order('version_number', { ascending: false })

      if (error) throw error
      setVersions(data || [])
    } catch (error) {
      console.error('Error loading version history:', error)
    }
  }

  const addSection = () => {
    const newSection: ChecklistSection = {
      title: 'Nueva Sección',
      order_index: template.sections.length,
      items: []
    }
    setTemplate(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }))
    setHasChanges(true)
  }

  const updateSection = (sectionIndex: number, updates: Partial<ChecklistSection>) => {
    setTemplate(prev => ({
      ...prev,
      sections: prev.sections.map((section, index) => 
        index === sectionIndex ? { ...section, ...updates } : section
      )
    }))
    setHasChanges(true)
  }

  const deleteSection = (sectionIndex: number) => {
    setTemplate(prev => ({
      ...prev,
      sections: prev.sections.filter((_, index) => index !== sectionIndex)
        .map((section, index) => ({ ...section, order_index: index }))
    }))
    setHasChanges(true)
  }

  const moveSectionUp = (sectionIndex: number) => {
    if (sectionIndex === 0) return
    setTemplate(prev => {
      const newSections = [...prev.sections]
      const temp = newSections[sectionIndex]
      newSections[sectionIndex] = newSections[sectionIndex - 1]
      newSections[sectionIndex - 1] = temp
      return {
        ...prev,
        sections: newSections.map((section, index) => ({ ...section, order_index: index }))
      }
    })
    setHasChanges(true)
  }

  const moveSectionDown = (sectionIndex: number) => {
    if (sectionIndex === template.sections.length - 1) return
    setTemplate(prev => {
      const newSections = [...prev.sections]
      const temp = newSections[sectionIndex]
      newSections[sectionIndex] = newSections[sectionIndex + 1]
      newSections[sectionIndex + 1] = temp
      return {
        ...prev,
        sections: newSections.map((section, index) => ({ ...section, order_index: index }))
      }
    })
    setHasChanges(true)
  }

  const addItem = (sectionIndex: number) => {
    const newItem: ChecklistItem = {
      description: 'Nuevo Item',
      required: true,
      order_index: template.sections[sectionIndex].items.length,
      item_type: 'check'
    }
    
    updateSection(sectionIndex, {
      items: [...template.sections[sectionIndex].items, newItem]
    })
  }

  const updateItem = (sectionIndex: number, itemIndex: number, updates: Partial<ChecklistItem>) => {
    const section = template.sections[sectionIndex]
    const newItems = section.items.map((item, index) => 
      index === itemIndex ? { ...item, ...updates } : item
    )
    updateSection(sectionIndex, { items: newItems })
  }

  const deleteItem = (sectionIndex: number, itemIndex: number) => {
    const section = template.sections[sectionIndex]
    const newItems = section.items.filter((_, index) => index !== itemIndex)
      .map((item, index) => ({ ...item, order_index: index }))
    updateSection(sectionIndex, { items: newItems })
  }

  const saveTemplate = async () => {
    if (!changeSummary.trim()) {
      toast({
        title: "Campo requerido",
        description: "Por favor ingrese un resumen de los cambios realizados",
        variant: "destructive"
      })
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()

      if (templateId) {
        // Actualizar plantilla existente y crear nueva versión
        const { error: updateError } = await supabase
          .from('checklists')
          .update({
            name: template.name,
            description: template.description,
            model_id: template.model_id,
            frequency: template.frequency,
            hours_interval: template.hours_interval,
            updated_at: new Date().toISOString()
          })
          .eq('id', templateId)

        if (updateError) throw updateError

        // Crear nueva versión a través del API
        const response = await fetch('/api/checklists/templates/create-version', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: templateId,
            change_summary: changeSummary
          })
        })

        if (!response.ok) throw new Error('Error creating version')

        toast({
          title: "Plantilla actualizada",
          description: "La plantilla ha sido actualizada y se ha creado una nueva versión",
          variant: "default"
        })
      } else {
        // Crear nueva plantilla
        const { data: newTemplate, error } = await supabase
          .from('checklists')
          .insert({
            name: template.name,
            description: template.description,
            model_id: template.model_id,
            frequency: template.frequency,
            hours_interval: template.hours_interval
          })
          .select()
          .single()

        if (error) throw error

        // Crear secciones e items
        for (const section of template.sections) {
          const { data: newSection, error: sectionError } = await supabase
            .from('checklist_sections')
            .insert({
              checklist_id: newTemplate.id,
              title: section.title,
              order_index: section.order_index
            })
            .select()
            .single()

          if (sectionError) throw sectionError

          for (const item of section.items) {
            const { error: itemError } = await supabase
              .from('checklist_items')
              .insert({
                section_id: newSection.id,
                description: item.description,
                required: item.required,
                order_index: item.order_index,
                item_type: item.item_type,
                expected_value: item.expected_value,
                tolerance: item.tolerance
              })

            if (itemError) throw itemError
          }
        }

        toast({
          title: "Plantilla creada",
          description: "La nueva plantilla ha sido creada exitosamente",
          variant: "default"
        })

        router.push('/checklists')
      }

      setHasChanges(false)
      setChangeSummary('')
      if (onSave) onSave(template)
      
    } catch (error) {
      console.error('Error saving template:', error)
      toast({
        title: "Error",
        description: "No se pudo guardar la plantilla",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const restoreVersion = async (versionId: string) => {
    try {
      const response = await fetch('/api/checklists/templates/restore-version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId })
      })

      if (!response.ok) throw new Error('Error restoring version')

      toast({
        title: "Versión restaurada",
        description: "La plantilla ha sido restaurada a la versión seleccionada",
        variant: "default"
      })

      await loadTemplate()
      await loadVersionHistory()
      setShowVersionHistory(false)
      
    } catch (error) {
      console.error('Error restoring version:', error)
      toast({
        title: "Error",
        description: "No se pudo restaurar la versión",
        variant: "destructive"
      })
    }
  }

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'check': return <Check className="h-4 w-4" />
      case 'measure': return <Edit3 className="h-4 w-4" />
      case 'text': return <Edit3 className="h-4 w-4" />
      default: return <Check className="h-4 w-4" />
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Cargando...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">
            {templateId ? 'Editar Plantilla' : 'Nueva Plantilla'}
          </h2>
          {templateId && versions.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Versión actual: {versions.find(v => v.is_active)?.version_number || 1}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {templateId && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowVersionHistory(true)}
              >
                <History className="h-4 w-4 mr-2" />
                Historial
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Vista Previa
              </Button>
            </>
          )}
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={saveTemplate} disabled={saving || !hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* Change Summary Alert */}
      {hasChanges && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Hay cambios sin guardar. Los cambios se guardarán como una nueva versión.
          </AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Plantilla</Label>
              <Input
                id="name"
                value={template.name}
                onChange={(e) => {
                  setTemplate(prev => ({ ...prev, name: e.target.value }))
                  setHasChanges(true)
                }}
                placeholder="Nombre de la plantilla"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo de Equipo</Label>
              <Select
                value={template.model_id}
                onValueChange={(value) => {
                  setTemplate(prev => ({ ...prev, model_id: value }))
                  setHasChanges(true)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar modelo" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} ({model.manufacturer})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={template.description}
              onChange={(e) => {
                setTemplate(prev => ({ ...prev, description: e.target.value }))
                setHasChanges(true)
              }}
              placeholder="Descripción de la plantilla"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frecuencia</Label>
              <Select
                value={template.frequency}
                onValueChange={(value) => {
                  setTemplate(prev => ({ ...prev, frequency: value }))
                  setHasChanges(true)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diario</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="horas">Por Horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {template.frequency === 'horas' && (
              <div className="space-y-2">
                <Label htmlFor="hours">Intervalo en Horas</Label>
                <Input
                  id="hours"
                  type="number"
                  value={template.hours_interval || ''}
                  onChange={(e) => {
                    setTemplate(prev => ({ ...prev, hours_interval: parseInt(e.target.value) || undefined }))
                    setHasChanges(true)
                  }}
                  placeholder="Horas"
                />
              </div>
            )}
          </div>

          {hasChanges && (
            <div className="space-y-2">
              <Label htmlFor="changeSummary">Resumen de Cambios</Label>
              <Textarea
                id="changeSummary"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Describe los cambios realizados en esta versión..."
                rows={2}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Secciones del Checklist</h3>
          <Button onClick={addSection}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Sección
          </Button>
        </div>

        {template.sections.map((section, sectionIndex) => (
          <Card key={sectionIndex}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(sectionIndex, { title: e.target.value })}
                    className="font-semibold"
                  />
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveSectionUp(sectionIndex)}
                    disabled={sectionIndex === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => moveSectionDown(sectionIndex)}
                    disabled={sectionIndex === template.sections.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteSection(sectionIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.items.map((item, itemIndex) => (
                <div key={itemIndex} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        {getItemTypeIcon(item.item_type)}
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(sectionIndex, itemIndex, { description: e.target.value })}
                          placeholder="Descripción del item"
                        />
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2">
                        <Select
                          value={item.item_type}
                          onValueChange={(value: any) => updateItem(sectionIndex, itemIndex, { item_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="check">Verificación</SelectItem>
                            <SelectItem value="measure">Medición</SelectItem>
                            <SelectItem value="text">Texto</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {(item.item_type === 'measure' || item.item_type === 'text') && (
                          <>
                            <Input
                              value={item.expected_value || ''}
                              onChange={(e) => updateItem(sectionIndex, itemIndex, { expected_value: e.target.value })}
                              placeholder="Valor esperado"
                            />
                            <Input
                              value={item.tolerance || ''}
                              onChange={(e) => updateItem(sectionIndex, itemIndex, { tolerance: e.target.value })}
                              placeholder="Tolerancia"
                            />
                          </>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={item.required}
                            onCheckedChange={(checked) => updateItem(sectionIndex, itemIndex, { required: checked })}
                          />
                          <Label className="text-sm">Requerido</Label>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteItem(sectionIndex, itemIndex)}
                      className="ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <Button
                variant="outline"
                onClick={() => addItem(sectionIndex)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Item
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Version History Dialog */}
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Historial de Versiones</DialogTitle>
            <DialogDescription>
              Historial completo de cambios en esta plantilla
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {versions.map((version) => (
              <Card key={version.id} className={version.is_active ? "border-green-500" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-base">
                        Versión {version.version_number}
                        {version.is_active && <Badge className="ml-2">Activa</Badge>}
                      </CardTitle>
                      <CardDescription>{version.change_summary}</CardDescription>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {new Date(version.created_at).toLocaleString()}
                    </div>
                  </div>
                </CardHeader>
                <CardFooter className="pt-0">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedVersion(version.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalles
                    </Button>
                    {!version.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreVersion(version.id)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Restaurar
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vista Previa - {template.name}</DialogTitle>
            <DialogDescription>
              Así se verá la plantilla durante la ejecución
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {template.sections.map((section, sectionIndex) => (
              <Card key={sectionIndex}>
                <CardHeader>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{item.description}</span>
                        {item.required && <Badge variant="outline">Requerido</Badge>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Check className="h-4 w-4 mr-1" />
                          Pass
                        </Button>
                        <Button variant="outline" size="sm">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Flag
                        </Button>
                        <Button variant="outline" size="sm">
                          <X className="h-4 w-4 mr-1" />
                          Fail
                        </Button>
                      </div>
                      {(item.item_type === 'measure' || item.item_type === 'text') && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          {item.expected_value && `Valor esperado: ${item.expected_value}`}
                          {item.tolerance && ` (±${item.tolerance})`}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 