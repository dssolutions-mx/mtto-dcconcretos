"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Check, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { createBrowserClient } from '@supabase/ssr'

export function ChecklistTemplateForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [models, setModels] = useState<any[]>([])
  const [intervals, setIntervals] = useState<any[]>([])
  const [loadingIntervals, setLoadingIntervals] = useState(false)
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    model_id: "",
    frequency: "diario",
    interval_id: "",
  })
  
  const [sections, setSections] = useState([
    {
      title: "Inspección Visual",
      items: [
        { description: "Verificar ausencia de fugas de aceite", required: true, item_type: "check" },
        { description: "Inspeccionar estado de mangueras hidráulicas", required: true, item_type: "check" },
      ],
    },
  ])

  useEffect(() => {
    const fetchModels = async () => {
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

  const addSection = () => {
    setSections([...sections, { title: "", items: [] }])
  }

  const addItem = (sectionIndex: number) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items = [...updatedSections[sectionIndex].items, { 
      description: "", 
      required: true, 
      item_type: "check" 
    }]
    setSections(updatedSections)
  }

  const updateSectionTitle = (sectionIndex: number, title: string) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].title = title
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
    updatedSections[sectionIndex].items[itemIndex].item_type = type
    setSections(updatedSections)
  }

  const removeSection = (sectionIndex: number) => {
    const updatedSections = sections.filter((_, i) => i !== sectionIndex)
    setSections(updatedSections)
  }

  const removeItem = (sectionIndex: number, itemIndex: number) => {
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items = updatedSections[sectionIndex].items.filter((_, i) => i !== itemIndex)
    setSections(updatedSections)
  }
  
  const handleFormChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value
    })
  }
  
  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('El nombre de la plantilla es requerido')
      return false
    }
    
    if (!formData.model_id) {
      toast.error('Debe seleccionar un modelo de equipo')
      return false
    }
    
    for (const section of sections) {
      if (!section.title.trim()) {
        toast.error('Todas las secciones deben tener un título')
        return false
      }
      
      if (section.items.length === 0) {
        toast.error(`La sección "${section.title}" no tiene items`)
        return false
      }
      
      for (const item of section.items) {
        if (!item.description.trim()) {
          toast.error(`Todos los items deben tener una descripción`)
          return false
        }
      }
    }
    
    return true
  }
  
  const handleSubmit = async () => {
    if (!validateForm()) return
    
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/checklists/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: {
            ...formData,
            sections: sections
          }
        }),
      })
      
      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      toast.success('Plantilla creada exitosamente')
      router.push('/checklists?tab=templates')
    } catch (error: any) {
      console.error('Error saving template:', error)
      toast.error(`Error al guardar la plantilla: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información de la Plantilla</CardTitle>
          <CardDescription>Ingresa la información básica de la plantilla de checklist</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="templateName">Nombre de la Plantilla</Label>
            <Input 
              id="templateName" 
              placeholder="Ej: Mantenimiento Preventivo 500h" 
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="templateDescription">Descripción</Label>
            <Textarea 
              id="templateDescription" 
              placeholder="Descripción general de la plantilla" 
              rows={3}
              value={formData.description}
              onChange={(e) => handleFormChange('description', e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="modelSelection">Modelo de Equipo</Label>
            <Select 
              value={formData.model_id} 
              onValueChange={(value) => handleFormChange('model_id', value)}
            >
              <SelectTrigger id="modelSelection">
                <SelectValue placeholder="Seleccionar modelo" />
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
            <Label htmlFor="intervalSelection">Intervalo de Mantenimiento (Opcional)</Label>
            <Select 
              value={formData.interval_id} 
              onValueChange={(value) => handleFormChange('interval_id', value)}
              disabled={loadingIntervals || intervals.length === 0}
            >
              <SelectTrigger id="intervalSelection">
                <SelectValue placeholder={
                  loadingIntervals 
                    ? "Cargando intervalos..." 
                    : intervals.length === 0 
                      ? "No hay intervalos disponibles" 
                      : "Seleccionar intervalo (opcional)"
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Ninguno (plantilla general)</SelectItem>
                {intervals.map((interval) => (
                  <SelectItem key={interval.id} value={interval.id}>
                    {interval.name} ({interval.interval_value} horas)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Asociar esta plantilla a un intervalo de mantenimiento específico permitirá 
              programar automáticamente este checklist cuando se cree un mantenimiento con este intervalo.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="frequencySelection">Frecuencia</Label>
            <Select 
              value={formData.frequency} 
              onValueChange={(value) => handleFormChange('frequency', value)}
            >
              <SelectTrigger id="frequencySelection">
                <SelectValue placeholder="Seleccionar frecuencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diario</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {sections.map((section, sectionIndex) => (
        <Card key={sectionIndex}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sección {sectionIndex + 1}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => removeSection(sectionIndex)}>
                Eliminar Sección
              </Button>
            </div>
            <CardDescription>Define los items de esta sección</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`sectionTitle-${sectionIndex}`}>Título de la Sección</Label>
              <Input
                id={`sectionTitle-${sectionIndex}`}
                placeholder="Ej: Inspección Visual"
                value={section.title}
                onChange={(e) => updateSectionTitle(sectionIndex, e.target.value)}
              />
            </div>

            {section.items.map((item, itemIndex) => (
              <div key={itemIndex} className="space-y-2 border-b pb-4 mb-4">
                <div className="flex items-start justify-between">
                  <Label htmlFor={`itemDescription-${sectionIndex}-${itemIndex}`}>Item {itemIndex + 1}</Label>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(sectionIndex, itemIndex)}>
                    Eliminar
                  </Button>
                </div>
                
                <Input
                  id={`itemDescription-${sectionIndex}-${itemIndex}`}
                  placeholder="Ej: Verificar nivel de aceite"
                  value={item.description}
                  onChange={(e) => updateItemDescription(sectionIndex, itemIndex, e.target.value)}
                  className="mb-2"
                />
                
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={`itemRequired-${sectionIndex}-${itemIndex}`}
                      checked={item.required}
                      onCheckedChange={(checked) => updateItemRequired(sectionIndex, itemIndex, checked)}
                    />
                    <Label htmlFor={`itemRequired-${sectionIndex}-${itemIndex}`}>Requerido</Label>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor={`itemType-${sectionIndex}-${itemIndex}`}>Tipo</Label>
                    <Select 
                      value={item.item_type} 
                      onValueChange={(value) => updateItemType(sectionIndex, itemIndex, value)}
                    >
                      <SelectTrigger id={`itemType-${sectionIndex}-${itemIndex}`} className="w-[180px]">
                        <SelectValue placeholder="Tipo de item" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="check">Verificación (Sí/No)</SelectItem>
                        <SelectItem value="numeric">Valor Numérico</SelectItem>
                        <SelectItem value="text">Texto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={() => addItem(sectionIndex)}>
              Agregar Item
            </Button>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addSection}>
        Agregar Sección
      </Button>

      <Card>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Plantilla
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
