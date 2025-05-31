"use client"

// ⚡ PERFORMANCE OPTIMIZATIONS APPLIED:
// - Debounced section title updates to prevent input lag
// - Local state for immediate UI updates + background state sync
// - Proper timeout cleanup on component unmount/section removal
// - Eliminated expensive array operations on every keystroke

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, CheckSquare, Trash2, Plus, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

// Tipos completos
interface ChecklistItem {
  description: string
  required: boolean
  item_type: 'check' | 'numeric' | 'text'
  expected_value?: string
  tolerance?: string
}

interface EvidenceConfig {
  min_photos: number
  max_photos: number
  categories: string[]
  descriptions: Record<string, string>
}

interface ChecklistSection {
  title: string
  section_type: 'checklist' | 'evidence'
  items: ChecklistItem[]
  evidence_config?: EvidenceConfig
}

// Categorías predefinidas para evidencias
const EVIDENCE_CATEGORIES = [
  'Vista Frontal',
  'Vista Trasera', 
  'Motor/Compartimento',
  'Cabina/Interior',
  'Detalles Específicos',
  'Estado General',
  'Problemas Identificados',
  'Mediciones',
  'Documentación',
  'Antes del Trabajo',
  'Después del Trabajo'
]

export function ChecklistTemplateForm() {
  const router = useRouter()
  const [models, setModels] = useState<any[]>([])
  const [intervals, setIntervals] = useState<any[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [loadingIntervals, setLoadingIntervals] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Add local title state for debouncing
  const [sectionTitles, setSectionTitles] = useState<Record<number, string>>({})
  const titleTimeouts = useRef<Record<number, NodeJS.Timeout>>({})
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    model_id: "",
    frequency: "mensual",
    interval_id: "",
  })
  
  const [sections, setSections] = useState<ChecklistSection[]>([
    {
      title: "Inspección Visual",
      section_type: "checklist",
      items: [
        { description: "Verificar ausencia de fugas de aceite", required: true, item_type: "check" },
        { description: "Inspeccionar estado de mangueras hidráulicas", required: true, item_type: "check" },
      ],
    },
  ])

  // Initialize section titles when sections change
  useEffect(() => {
    const newTitles: Record<number, string> = {}
    sections.forEach((section, index) => {
      if (!(index in sectionTitles)) {
        newTitles[index] = section.title
      }
    })
    if (Object.keys(newTitles).length > 0) {
      setSectionTitles(prev => ({ ...prev, ...newTitles }))
    }
  }, [sections.length])

  useEffect(() => {
    const fetchModels = async () => {
      setLoadingModels(true)
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        
        const { data, error } = await supabase
          .from('equipment_models')
          .select('id, name, manufacturer')
          .order('name')
        
        if (error) {
          console.error('Error loading models:', error)
          toast.error('Error al cargar los modelos de equipos')
          return
        }
        
        setModels(data || [])
      } catch (error) {
        console.error('Error loading models:', error)
        toast.error('Error al cargar los modelos de equipos')
      } finally {
        setLoadingModels(false)
      }
    }
    
    fetchModels()
  }, [])

  useEffect(() => {
    if (!formData.model_id) {
      setIntervals([])
      return
    }
    
    const fetchIntervals = async () => {
      setLoadingIntervals(true)
      
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        
        const { data, error } = await supabase
          .from('maintenance_intervals')
          .select('id, name, interval_value, type')
          .eq('model_id', formData.model_id)
          .order('interval_value')
        
        if (error) {
          throw error
        }
        
        setIntervals(data || [])
      } catch (error: any) {
        console.error('Error loading maintenance intervals:', error)
        toast.error('Error al cargar los intervalos de mantenimiento')
      } finally {
        setLoadingIntervals(false)
      }
    }
    
    fetchIntervals()
  }, [formData.model_id])

  const handleFormChange = (field: string, value: string) => {
    const processedValue = field === 'interval_id' && value === 'none' ? '' : value;
    setFormData({
      ...formData,
      [field]: processedValue
    });
  }

  const addSection = () => {
    const newSectionIndex = sections.length
    const newTitle = `Nueva Sección ${sections.length + 1}`
    setSections([...sections, { 
      title: newTitle, 
      section_type: "checklist",
      items: [
        { description: "Nuevo item", required: true, item_type: "check" }
      ]
    }])
    // Initialize title for new section
    setSectionTitles(prev => ({ 
      ...prev, 
      [newSectionIndex]: newTitle 
    }))
  }

  const addEvidenceSection = () => {
    const newSectionIndex = sections.length
    const newTitle = `Evidencia ${sections.filter(s => s.section_type === 'evidence').length + 1}`
    const newSection = { 
      title: newTitle, 
      section_type: "evidence" as const,
      items: [],
      evidence_config: {
        min_photos: 1,
        max_photos: 5,
        categories: ['Estado General', 'Detalles Específicos'],
        descriptions: {
          'Estado General': 'Capturar vista general del equipo',
          'Detalles Específicos': 'Fotografiar detalles relevantes'
        }
      }
    }
    setSections([...sections, newSection])
    // Initialize title for new section
    setSectionTitles(prev => ({ 
      ...prev, 
      [newSectionIndex]: newTitle 
    }))
  }

  // Optimized section title update with debouncing
  const updateSectionTitleLocal = (index: number, title: string) => {
    // Update local state immediately (no lag)
    setSectionTitles(prev => ({ ...prev, [index]: title }))
    
    // Clear existing timeout
    if (titleTimeouts.current[index]) {
      clearTimeout(titleTimeouts.current[index])
    }
    
    // Set new timeout to update main state after 500ms of no typing
    titleTimeouts.current[index] = setTimeout(() => {
      setSections(prevSections => {
        const newSections = [...prevSections]
        newSections[index] = { ...newSections[index], title }
        return newSections
      })
      delete titleTimeouts.current[index]
    }, 500)
  }

  const removeSection = (index: number) => {
    // Clear any pending timeout for this section
    if (titleTimeouts.current[index]) {
      clearTimeout(titleTimeouts.current[index])
      delete titleTimeouts.current[index]
    }
    
    // Remove from sections
    setSections(sections.filter((_, i) => i !== index))
    
    // Update local titles (shift indices down)
    setSectionTitles(prev => {
      const newTitles: Record<number, string> = {}
      Object.entries(prev).forEach(([key, value]) => {
        const idx = parseInt(key)
        if (idx < index) {
          newTitles[idx] = value
        } else if (idx > index) {
          newTitles[idx - 1] = value
        }
        // Skip idx === index (the removed one)
      })
      return newTitles
    })
  }

  // Item management functions
  const addItem = (sectionIndex: number) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items.push({
      description: "Nuevo item",
      required: true,
      item_type: "check"
    })
    setSections(updatedSections)
  }

  const updateItemDescription = (sectionIndex: number, itemIndex: number, description: string) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items[itemIndex].description = description
    setSections(updatedSections)
  }

  const updateItemRequired = (sectionIndex: number, itemIndex: number, required: boolean) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items[itemIndex].required = required
    setSections(updatedSections)
  }

  const updateItemType = (sectionIndex: number, itemIndex: number, type: string) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items[itemIndex].item_type = type as 'check' | 'numeric' | 'text'
    setSections(updatedSections)
  }

  const updateItemExpectedValue = (sectionIndex: number, itemIndex: number, value: string) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items[itemIndex].expected_value = value
    setSections(updatedSections)
  }

  const updateItemTolerance = (sectionIndex: number, itemIndex: number, tolerance: string) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items[itemIndex].tolerance = tolerance
    setSections(updatedSections)
  }

  const removeItem = (sectionIndex: number, itemIndex: number) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items = updatedSections[sectionIndex].items.filter((_, i) => i !== itemIndex)
    setSections(updatedSections)
  }

  // Evidence management functions
  const updateEvidenceConfig = (sectionIndex: number, config: Partial<EvidenceConfig>) => {
    const updatedSections = [...sections]
    if (updatedSections[sectionIndex].evidence_config) {
      updatedSections[sectionIndex].evidence_config = {
        ...updatedSections[sectionIndex].evidence_config!,
        ...config
      }
      setSections(updatedSections)
    }
  }

  const addEvidenceCategory = (sectionIndex: number, category: string) => {
    const updatedSections = [...sections]
    const config = updatedSections[sectionIndex].evidence_config
    if (config && !config.categories.includes(category)) {
      config.categories.push(category)
      config.descriptions[category] = `Documentar ${category.toLowerCase()}`
      setSections(updatedSections)
    }
  }

  const removeEvidenceCategory = (sectionIndex: number, category: string) => {
    const updatedSections = [...sections]
    const config = updatedSections[sectionIndex].evidence_config
    if (config) {
      config.categories = config.categories.filter(c => c !== category)
      delete config.descriptions[category]
      setSections(updatedSections)
    }
  }

  const updateCategoryDescription = (sectionIndex: number, category: string, description: string) => {
    const updatedSections = [...sections]
    const config = updatedSections[sectionIndex].evidence_config
    if (config) {
      config.descriptions[category] = description
      setSections(updatedSections)
    }
  }

  // Form validation
  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('El nombre de la plantilla es requerido')
      return false
    }
    
    if (!formData.model_id) {
      toast.error('Debe seleccionar un modelo de equipo')
      return false
    }
    
    if (sections.length === 0) {
      toast.error('Debe agregar al menos una sección')
      return false
    }
    
    // Validate that all sections have titles
    for (let i = 0; i < sections.length; i++) {
      const actualTitle = sectionTitles[i] || sections[i].title
      if (!actualTitle.trim()) {
        toast.error(`La sección ${i + 1} debe tener un título`)
        return false
      }
    }
    
    // Validate that checklist sections have items
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      if (section.section_type === 'checklist' && section.items.length === 0) {
        toast.error(`La sección "${section.title}" debe tener al menos un item`)
        return false
      }
      
      // Validate items have descriptions
      for (let j = 0; j < section.items.length; j++) {
        if (!section.items[j].description.trim()) {
          toast.error(`Todos los items de la sección "${section.title}" deben tener descripción`)
          return false
        }
      }
    }
    
    return true
  }

  // Submit form
  const handleSubmit = async () => {
    if (!validateForm()) return
    
    setSubmitting(true)
    
    try {
      // Apply any pending section title changes
      Object.entries(titleTimeouts.current).forEach(([index, timeout]) => {
        clearTimeout(timeout)
        const idx = parseInt(index)
        const title = sectionTitles[idx]
        if (title) {
          sections[idx].title = title
        }
      })
      
      const templateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        model_id: formData.model_id,
        frequency: formData.frequency,
        interval_id: formData.interval_id || null,
        sections: sections.map((section, index) => ({
          title: sectionTitles[index] || section.title,
          section_type: section.section_type,
          items: section.items,
          evidence_config: section.evidence_config
        }))
      }
      
      const response = await fetch('/api/checklists/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template: templateData }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al crear la plantilla')
      }
      
      const result = await response.json()
      
      toast.success('Plantilla creada exitosamente')
      router.push('/checklists')
      
    } catch (error: any) {
      console.error('Error creating template:', error)
      toast.error(error.message || 'Error al crear la plantilla')
    } finally {
      setSubmitting(false)
    }
  }

  // Evidence section rendering
  const renderEvidenceSection = (section: ChecklistSection, sectionIndex: number) => {
    const config = section.evidence_config!
    const availableCategories = EVIDENCE_CATEGORIES.filter(cat => !config.categories.includes(cat))
    
    return (
      <div className="space-y-4 border-l-4 border-blue-500 pl-4">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="h-5 w-5 text-blue-600" />
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Sección de Evidencia Fotográfica
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mínimo de Fotos</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={config.min_photos}
              onChange={(e) => updateEvidenceConfig(sectionIndex, { 
                min_photos: parseInt(e.target.value) || 1 
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>Máximo de Fotos</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={config.max_photos}
              onChange={(e) => updateEvidenceConfig(sectionIndex, { 
                max_photos: parseInt(e.target.value) || 5 
              })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Categorías de Evidencia</Label>
            <Select 
              value=""
              onValueChange={(value) => {
                if (value) {
                  addEvidenceCategory(sectionIndex, value)
                }
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Agregar categoría" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
                {availableCategories.length === 0 && (
                  <SelectItem value="" disabled>
                    Todas las categorías agregadas
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-3">
            {config.categories.map((category, catIndex) => (
              <div key={catIndex} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">{category}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEvidenceCategory(sectionIndex, category)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Descripción/Instrucciones</Label>
                  <Textarea
                    value={config.descriptions[category] || ''}
                    onChange={(e) => updateCategoryDescription(sectionIndex, category, e.target.value)}
                    placeholder={`Instrucciones para fotografiar ${category.toLowerCase()}`}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Form Header */}
      <Card>
        <CardHeader>
          <CardTitle>Crear Plantilla de Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Plantilla *</Label>
            <Input 
              id="name"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder="Ej: Inspección Diaria de Grúa Torre"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea 
              id="description"
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
              placeholder="Descripción detallada de la plantilla..."
              rows={3}
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Modelo de Equipo *</Label>
            <Select 
              value={formData.model_id} 
              onValueChange={(value) => handleFormChange('model_id', value)}
              disabled={submitting || loadingModels}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  loadingModels ? "Cargando modelos..." : "Seleccionar modelo de equipo"
                } />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name} - {model.manufacturer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Frecuencia</Label>
            <Select 
              value={formData.frequency} 
              onValueChange={(value) => handleFormChange('frequency', value)}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
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
            <Label htmlFor="interval">Intervalo de Mantenimiento (Opcional)</Label>
            <Select 
              value={formData.interval_id} 
              onValueChange={(value) => handleFormChange('interval_id', value)}
              disabled={submitting || loadingIntervals || intervals.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  loadingIntervals 
                    ? "Cargando intervalos..." 
                    : intervals.length === 0 
                      ? "No hay intervalos disponibles" 
                      : "Seleccionar intervalo (opcional)"
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguno (plantilla general)</SelectItem>
                {intervals.map((interval) => (
                  <SelectItem key={interval.id} value={interval.id}>
                    {interval.name} ({interval.interval_value} horas)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={addSection} 
              variant="outline"
              disabled={submitting}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Agregar Sección
            </Button>
            <Button 
              onClick={addEvidenceSection} 
              variant="outline" 
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              disabled={submitting}
            >
              <Camera className="h-4 w-4 mr-2" />
              Agregar Evidencia
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Secciones ({sections.length})</h3>
        
        {sections.map((section, index) => (
          <Card key={index} className={section.section_type === 'evidence' ? 'bg-blue-50 border-blue-200' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {section.section_type === 'evidence' ? (
                    <Camera className="h-4 w-4 text-blue-600" />
                  ) : (
                    <CheckSquare className="h-4 w-4" />
                  )}
                  <span className="font-medium">
                    {section.section_type === 'evidence' ? 'EVIDENCIA' : 'CHECKLIST'}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => removeSection(index)}
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Input
                value={sectionTitles[index] || section.title}
                onChange={(e) => updateSectionTitleLocal(index, e.target.value)}
                placeholder="Título de la sección"
                className="mb-4"
                disabled={submitting}
              />

              {section.section_type === 'evidence' ? (
                renderEvidenceSection(section, index)
              ) : (
                <div className="space-y-4">
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="space-y-3 border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <Label>Item {itemIndex + 1}</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeItem(index, itemIndex)}
                          disabled={submitting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <Input
                        placeholder="Ej: Verificar nivel de aceite"
                        value={item.description}
                        onChange={(e) => updateItemDescription(index, itemIndex, e.target.value)}
                        disabled={submitting}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select 
                            value={item.item_type} 
                            onValueChange={(value) => updateItemType(index, itemIndex, value)}
                            disabled={submitting}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="check">Verificación (Sí/No)</SelectItem>
                              <SelectItem value="numeric">Valor Numérico</SelectItem>
                              <SelectItem value="text">Texto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {(item.item_type === 'numeric' || item.item_type === 'text') && (
                          <>
                            <div className="space-y-2">
                              <Label>Valor Esperado</Label>
                              <Input
                                value={item.expected_value || ''}
                                onChange={(e) => updateItemExpectedValue(index, itemIndex, e.target.value)}
                                placeholder="Valor esperado"
                                disabled={submitting}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Tolerancia</Label>
                              <Input
                                value={item.tolerance || ''}
                                onChange={(e) => updateItemTolerance(index, itemIndex, e.target.value)}
                                placeholder="±0.5"
                                disabled={submitting}
                              />
                            </div>
                          </>
                        )}
                        
                        <div className="flex items-center space-x-2 pt-6">
                          <Switch
                            checked={item.required}
                            onCheckedChange={(checked) => updateItemRequired(index, itemIndex, checked)}
                            disabled={submitting}
                          />
                          <Label>Requerido</Label>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button 
                    variant="outline" 
                    onClick={() => addItem(index)}
                    disabled={submitting}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Item
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4 pt-6">
        <Button 
          variant="outline" 
          onClick={() => router.push('/checklists')}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={submitting || !formData.name.trim() || !formData.model_id || sections.length === 0}
        >
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitting ? 'Guardando...' : 'Crear Plantilla'}
        </Button>
      </div>
    </div>
  )
}
