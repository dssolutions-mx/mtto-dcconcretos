"use client"

// ⚡ PERFORMANCE OPTIMIZATIONS APPLIED:
// - Debounced section title updates to prevent input lag
// - Local state for immediate UI updates + background state sync
// - Proper timeout cleanup on component unmount/section removal
// - Eliminated expensive array operations on every keystroke

import React, { useState, useEffect, useRef } from 'react'
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  Copy,
  CheckSquare,
  Camera,
  Sparkles
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

interface EvidenceConfig {
  min_photos: number
  max_photos: number
  categories: string[]
  descriptions: Record<string, string>
}

interface CleanlinessConfig {
  min_photos: number
  max_photos: number
  areas: string[]
  descriptions: Record<string, string>
}

interface ChecklistSection {
  id?: string
  title: string
  order_index: number
  section_type?: 'checklist' | 'evidence' | 'cleanliness_bonus'
  evidence_config?: EvidenceConfig
  cleanliness_config?: CleanlinessConfig
  items: ChecklistItem[]
}

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

const CLEANLINESS_AREAS = [
  'Interior',
  'Exterior',
  'Cabina',
  'Carrocería',
  'Motor',
  'Llantas',
  'Ventanas',
  'Área de Trabajo'
]

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
  preSelectedModelId?: string
  onSave?: (template: ChecklistTemplate) => void
  onCancel?: () => void
}

export function TemplateEditor({ templateId, preSelectedModelId, onSave, onCancel }: TemplateEditorProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [template, setTemplate] = useState<ChecklistTemplate>({
    name: '',
    description: '',
    model_id: preSelectedModelId || '',
    frequency: 'mensual',
    sections: []
  })
  
  // ⚡ Performance optimizations: Debounced inputs
  const [sectionTitles, setSectionTitles] = useState<Record<number, string>>({})
  const titleTimeouts = useRef<Record<number, NodeJS.Timeout>>({})
  
  const [itemDescriptions, setItemDescriptions] = useState<Record<string, string>>({})
  const descriptionTimeouts = useRef<Record<string, NodeJS.Timeout>>({})
  
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const templateTimeouts = useRef<{ name?: NodeJS.Timeout; description?: NodeJS.Timeout }>({})
  
  const [itemExpectedValues, setItemExpectedValues] = useState<Record<string, string>>({})
  const [itemTolerances, setItemTolerances] = useState<Record<string, string>>({})
  const itemFieldTimeouts = useRef<Record<string, NodeJS.Timeout>>({})
  
  const [evidenceDescriptions, setEvidenceDescriptions] = useState<Record<string, string>>({})
  const evidenceTimeouts = useRef<Record<string, NodeJS.Timeout>>({})
  
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [changeSummary, setChangeSummary] = useState('')
  const [showChangeSummaryDialog, setShowChangeSummaryDialog] = useState(false)
  const [models, setModels] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize local states when template changes
  useEffect(() => {
    const newTitles: Record<number, string> = {}
    template.sections.forEach((section, index) => {
      if (!(index in sectionTitles)) {
        newTitles[index] = section.title
      }
    })
    if (Object.keys(newTitles).length > 0) {
      setSectionTitles(prev => ({ ...prev, ...newTitles }))
    }
    
    if (templateName !== template.name) {
      setTemplateName(template.name)
    }
    if (templateDescription !== template.description) {
      setTemplateDescription(template.description)
    }
  }, [template.sections.length, template.name, template.description])

  useEffect(() => {
    const newDescriptions: Record<string, string> = {}
    const newExpectedValues: Record<string, string> = {}
    const newTolerances: Record<string, string> = {}
    const newEvidenceDescs: Record<string, string> = {}
    
    template.sections.forEach((section, sectionIndex) => {
      section.items.forEach((item, itemIndex) => {
        const key = `${sectionIndex}-${itemIndex}`
        if (!(key in itemDescriptions)) {
          newDescriptions[key] = item.description
        }
        if (!(key in itemExpectedValues) && item.expected_value) {
          newExpectedValues[key] = item.expected_value
        }
        if (!(key in itemTolerances) && item.tolerance) {
          newTolerances[key] = item.tolerance
        }
      })
      
      if (section.evidence_config) {
        Object.entries(section.evidence_config.descriptions).forEach(([category, desc]) => {
          const evidenceKey = `${sectionIndex}-${category}`
          if (!(evidenceKey in evidenceDescriptions)) {
            newEvidenceDescs[evidenceKey] = desc
          }
        })
      }
    })
    
    if (Object.keys(newDescriptions).length > 0) {
      setItemDescriptions(prev => ({ ...prev, ...newDescriptions }))
    }
    if (Object.keys(newExpectedValues).length > 0) {
      setItemExpectedValues(prev => ({ ...prev, ...newExpectedValues }))
    }
    if (Object.keys(newTolerances).length > 0) {
      setItemTolerances(prev => ({ ...prev, ...newTolerances }))
    }
    if (Object.keys(newEvidenceDescs).length > 0) {
      setEvidenceDescriptions(prev => ({ ...prev, ...newEvidenceDescs }))
    }
  }, [template.sections])

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

      // Explicitly type the data object to include all expected fields
      const templateData = data as any

      const sections = templateData.checklist_sections?.map((section: any) => ({
        id: section.id,
        title: section.title,
        order_index: section.order_index,
        section_type: section.section_type || 'checklist',
        evidence_config: section.evidence_config || undefined,
        cleanliness_config: section.cleanliness_config || undefined,
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
        id: templateData.id,
        name: templateData.name,
        description: templateData.description || '',
        model_id: templateData.model_id || '',
        frequency: templateData.frequency || 'mensual',
        hours_interval: templateData.hours_interval,
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
        .from('checklist_template_versions' as any)
        .select('*')
        .eq('template_id', templateId)
        .order('version_number', { ascending: false })

      if (error) {
        console.error('Error loading version history:', error)
        setVersions([])
        return
      }

      setVersions((data as unknown as TemplateVersion[]) || [])
    } catch (error) {
      console.error('Error loading version history:', error)
      setVersions([])
    }
  }

  // Core template functions
  const addSection = () => {
    const newSection: ChecklistSection = {
      title: `Nueva Sección ${template.sections.length + 1}`,
      order_index: template.sections.length,
      section_type: 'checklist',
      items: [
        {
          description: 'Nuevo Item',
          required: true,
          order_index: 0,
          item_type: 'check'
        }
      ]
    }
    
    const newSectionIndex = template.sections.length
    setSectionTitles(prev => ({ 
      ...prev, 
      [newSectionIndex]: newSection.title 
    }))
    
    setTemplate(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }))
    setHasChanges(true)
  }

  const addEvidenceSection = () => {
    const newTitle = `Evidencia Fotográfica ${template.sections.filter(s => s.section_type === 'evidence').length + 1}`
    const newSection: ChecklistSection = {
      title: newTitle,
      order_index: template.sections.length,
      section_type: 'evidence',
      evidence_config: {
        min_photos: 1,
        max_photos: 5,
        categories: ['Estado General', 'Detalles Específicos'],
        descriptions: {
          'Estado General': 'Capturar vista general del equipo',
          'Detalles Específicos': 'Fotografiar detalles relevantes'
        }
      },
      items: []
    }
    
    const newSectionIndex = template.sections.length
    setSectionTitles(prev => ({ 
      ...prev, 
      [newSectionIndex]: newTitle 
    }))
    
    setTemplate(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }))
    setHasChanges(true)
  }

  const addCleanlinessSection = () => {
    const newTitle = `Verificación de Limpieza ${template.sections.filter(s => s.section_type === 'cleanliness_bonus').length + 1}`
    const newSection: ChecklistSection = {
      title: newTitle,
      order_index: template.sections.length,
      section_type: 'cleanliness_bonus',
      cleanliness_config: {
        min_photos: 2,
        max_photos: 4,
        areas: ['Interior', 'Exterior'],
        descriptions: {
          'Interior': 'Fotografiar evidencia del estado de limpieza interior',
          'Exterior': 'Fotografiar evidencia del estado de limpieza exterior'
        }
      },
      items: [
        {
          description: 'Interior está limpio',
          required: true,
          order_index: 0,
          item_type: 'check'
        },
        {
          description: 'Exterior está limpio',
          required: true,
          order_index: 1,
          item_type: 'check'
        }
      ]
    }
    
    const newSectionIndex = template.sections.length
    setSectionTitles(prev => ({ 
      ...prev, 
      [newSectionIndex]: newTitle 
    }))
    
    setTemplate(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }))
    setHasChanges(true)
  }

  const updateSection = (sectionIndex: number, updates: Partial<ChecklistSection>) => {
    setTemplate(prev => {
      const newSections = prev.sections.map((section, index) =>
        index === sectionIndex ? { ...section, ...updates } : section
      )
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
  }

  const deleteSection = (sectionIndex: number) => {
    if (titleTimeouts.current[sectionIndex]) {
      clearTimeout(titleTimeouts.current[sectionIndex])
      delete titleTimeouts.current[sectionIndex]
    }
    
    // Clear all timeouts and local state for sections that will be shifted
    for (let i = sectionIndex; i < template.sections.length; i++) {
      // Clear section title timeouts
      if (titleTimeouts.current[i]) {
        clearTimeout(titleTimeouts.current[i])
        delete titleTimeouts.current[i]
      }
      
      // Clear item-related timeouts and state for this section
      const section = template.sections[i]
      if (section) {
        for (let j = 0; j < section.items.length; j++) {
          const itemKey = `${i}-${j}`
          const expectedKey = `${itemKey}-expected`
          const toleranceKey = `${itemKey}-tolerance`
          
          // Clear timeouts
          if (descriptionTimeouts.current[itemKey]) {
            clearTimeout(descriptionTimeouts.current[itemKey])
            delete descriptionTimeouts.current[itemKey]
          }
          if (itemFieldTimeouts.current[expectedKey]) {
            clearTimeout(itemFieldTimeouts.current[expectedKey])
            delete itemFieldTimeouts.current[expectedKey]
          }
          if (itemFieldTimeouts.current[toleranceKey]) {
            clearTimeout(itemFieldTimeouts.current[toleranceKey])
            delete itemFieldTimeouts.current[toleranceKey]
          }
        }
        
        // Clear evidence-related timeouts if any
        if (section.evidence_config) {
          section.evidence_config.categories.forEach(category => {
            const evidenceKey = `${i}-${category}`
            if (evidenceTimeouts.current[evidenceKey]) {
              clearTimeout(evidenceTimeouts.current[evidenceKey])
              delete evidenceTimeouts.current[evidenceKey]
            }
          })
        }
      }
    }
    
    setTemplate(prev => ({
      ...prev,
      sections: prev.sections.filter((_, index) => index !== sectionIndex)
    }))
    setHasChanges(true)
    
    // Re-index local state for remaining sections
    const newSectionTitles = { ...sectionTitles }
    const newDescriptions = { ...itemDescriptions }
    const newExpectedValues = { ...itemExpectedValues }
    const newTolerances = { ...itemTolerances }
    const newEvidenceDescriptions = { ...evidenceDescriptions }
    
    // Remove state for deleted section and sections that will be shifted
    for (let i = sectionIndex; i < template.sections.length; i++) {
      delete newSectionTitles[i]
      
      // Remove item state for this section
      const section = template.sections[i]
      if (section) {
        for (let j = 0; j < section.items.length; j++) {
          const oldKey = `${i}-${j}`
          delete newDescriptions[oldKey]
          delete newExpectedValues[oldKey]
          delete newTolerances[oldKey]
        }
        
        // Remove evidence state for this section
        if (section.evidence_config) {
          section.evidence_config.categories.forEach(category => {
            const oldKey = `${i}-${category}`
            delete newEvidenceDescriptions[oldKey]
          })
        }
      }
    }
    
    // Re-index remaining sections (shift indices down)
    for (let i = sectionIndex + 1; i < template.sections.length; i++) {
      const newIndex = i - 1
      
      // Re-index section titles
      if (sectionTitles[i]) {
        newSectionTitles[newIndex] = sectionTitles[i]
      }
      
      // Re-index item state
      const section = template.sections[i]
      if (section) {
        for (let j = 0; j < section.items.length; j++) {
          const oldKey = `${i}-${j}`
          const newKey = `${newIndex}-${j}`
          
          if (itemDescriptions[oldKey]) {
            newDescriptions[newKey] = itemDescriptions[oldKey]
          }
          if (itemExpectedValues[oldKey]) {
            newExpectedValues[newKey] = itemExpectedValues[oldKey]
          }
          if (itemTolerances[oldKey]) {
            newTolerances[newKey] = itemTolerances[oldKey]
          }
        }
        
        // Re-index evidence state
        if (section.evidence_config) {
          section.evidence_config.categories.forEach(category => {
            const oldKey = `${i}-${category}`
            const newKey = `${newIndex}-${category}`
            if (evidenceDescriptions[oldKey]) {
              newEvidenceDescriptions[newKey] = evidenceDescriptions[oldKey]
            }
          })
        }
      }
    }
    
    setSectionTitles(newSectionTitles)
    setItemDescriptions(newDescriptions)
    setItemExpectedValues(newExpectedValues)
    setItemTolerances(newTolerances)
    setEvidenceDescriptions(newEvidenceDescriptions)
  }

  const moveSectionUp = (sectionIndex: number) => {
    if (sectionIndex === 0) return
    
    const targetIndex = sectionIndex - 1
    
    // Clear any pending timeouts for both affected sections
    const indicesToClear = [sectionIndex, targetIndex]
    indicesToClear.forEach((idx: number) => {
      if (titleTimeouts.current[idx]) {
        clearTimeout(titleTimeouts.current[idx])
        delete titleTimeouts.current[idx]
      }
      
      const section = template.sections[idx]
      if (section) {
        section.items.forEach((_, itemIdx) => {
          const itemKey = `${idx}-${itemIdx}`
          const expectedKey = `${itemKey}-expected`
          const toleranceKey = `${itemKey}-tolerance`
          
          if (descriptionTimeouts.current[itemKey]) {
            clearTimeout(descriptionTimeouts.current[itemKey])
            delete descriptionTimeouts.current[itemKey]
          }
          if (itemFieldTimeouts.current[expectedKey]) {
            clearTimeout(itemFieldTimeouts.current[expectedKey])
            delete itemFieldTimeouts.current[expectedKey]
          }
          if (itemFieldTimeouts.current[toleranceKey]) {
            clearTimeout(itemFieldTimeouts.current[toleranceKey])
            delete itemFieldTimeouts.current[toleranceKey]
          }
        })
        
        if (section.evidence_config) {
          section.evidence_config.categories.forEach(category => {
            const evidenceKey = `${idx}-${category}`
            if (evidenceTimeouts.current[evidenceKey]) {
              clearTimeout(evidenceTimeouts.current[evidenceKey])
              delete evidenceTimeouts.current[evidenceKey]
            }
          })
        }
      }
    })
    
    setTemplate(prev => {
      const newSections = [...prev.sections]
      const temp = newSections[sectionIndex]
      newSections[sectionIndex] = newSections[sectionIndex - 1]
      newSections[sectionIndex - 1] = temp
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
    
    // Swap local state for the two affected sections
    const newSectionTitles = { ...sectionTitles }
    const newDescriptions = { ...itemDescriptions }
    const newExpectedValues = { ...itemExpectedValues }
    const newTolerances = { ...itemTolerances }
    const newEvidenceDescriptions = { ...evidenceDescriptions }
    
    // Swap section titles
    const tempTitle = newSectionTitles[sectionIndex]
    newSectionTitles[sectionIndex] = newSectionTitles[targetIndex]
    newSectionTitles[targetIndex] = tempTitle
    
    // Swap item state for both sections
    const currentSection = template.sections[sectionIndex]
    const targetSection = template.sections[targetIndex]
    
    // Clear old state for both sections
    const sectionsToProcess = [
      { section: currentSection, index: sectionIndex },
      { section: targetSection, index: targetIndex }
    ]
    
    sectionsToProcess.forEach(({ section, index }) => {
      if (section) {
        section.items.forEach((_, itemIdx) => {
          const key = `${index}-${itemIdx}`
          delete newDescriptions[key]
          delete newExpectedValues[key]
          delete newTolerances[key]
        })
        
        if (section.evidence_config) {
          section.evidence_config.categories.forEach(category => {
            const key = `${index}-${category}`
            delete newEvidenceDescriptions[key]
          })
        }
      }
    })
    
    // Set new state with swapped indices
    if (currentSection) {
      currentSection.items.forEach((_, itemIdx) => {
        const oldKey = `${sectionIndex}-${itemIdx}`
        const newKey = `${targetIndex}-${itemIdx}`
        
        if (itemDescriptions[oldKey]) newDescriptions[newKey] = itemDescriptions[oldKey]
        if (itemExpectedValues[oldKey]) newExpectedValues[newKey] = itemExpectedValues[oldKey]
        if (itemTolerances[oldKey]) newTolerances[newKey] = itemTolerances[oldKey]
      })
      
      if (currentSection.evidence_config) {
        currentSection.evidence_config.categories.forEach(category => {
          const oldKey = `${sectionIndex}-${category}`
          const newKey = `${targetIndex}-${category}`
          if (evidenceDescriptions[oldKey]) newEvidenceDescriptions[newKey] = evidenceDescriptions[oldKey]
        })
      }
    }
    
    if (targetSection) {
      targetSection.items.forEach((_, itemIdx) => {
        const oldKey = `${targetIndex}-${itemIdx}`
        const newKey = `${sectionIndex}-${itemIdx}`
        
        if (itemDescriptions[oldKey]) newDescriptions[newKey] = itemDescriptions[oldKey]
        if (itemExpectedValues[oldKey]) newExpectedValues[newKey] = itemExpectedValues[oldKey]
        if (itemTolerances[oldKey]) newTolerances[newKey] = itemTolerances[oldKey]
      })
      
      if (targetSection.evidence_config) {
        targetSection.evidence_config.categories.forEach(category => {
          const oldKey = `${targetIndex}-${category}`
          const newKey = `${sectionIndex}-${category}`
          if (evidenceDescriptions[oldKey]) newEvidenceDescriptions[newKey] = evidenceDescriptions[oldKey]
        })
      }
    }
    
    setSectionTitles(newSectionTitles)
    setItemDescriptions(newDescriptions)
    setItemExpectedValues(newExpectedValues)
    setItemTolerances(newTolerances)
    setEvidenceDescriptions(newEvidenceDescriptions)
  }

  const moveSectionDown = (sectionIndex: number) => {
    if (sectionIndex >= template.sections.length - 1) return
    
    const targetIndex = sectionIndex + 1
    
    // Clear any pending timeouts for both affected sections
    const indicesToClear = [sectionIndex, targetIndex]
    indicesToClear.forEach((idx: number) => {
      if (titleTimeouts.current[idx]) {
        clearTimeout(titleTimeouts.current[idx])
        delete titleTimeouts.current[idx]
      }
      
      const section = template.sections[idx]
      if (section) {
        section.items.forEach((_, itemIdx) => {
          const itemKey = `${idx}-${itemIdx}`
          const expectedKey = `${itemKey}-expected`
          const toleranceKey = `${itemKey}-tolerance`
          
          if (descriptionTimeouts.current[itemKey]) {
            clearTimeout(descriptionTimeouts.current[itemKey])
            delete descriptionTimeouts.current[itemKey]
          }
          if (itemFieldTimeouts.current[expectedKey]) {
            clearTimeout(itemFieldTimeouts.current[expectedKey])
            delete itemFieldTimeouts.current[expectedKey]
          }
          if (itemFieldTimeouts.current[toleranceKey]) {
            clearTimeout(itemFieldTimeouts.current[toleranceKey])
            delete itemFieldTimeouts.current[toleranceKey]
          }
        })
        
        if (section.evidence_config) {
          section.evidence_config.categories.forEach(category => {
            const evidenceKey = `${idx}-${category}`
            if (evidenceTimeouts.current[evidenceKey]) {
              clearTimeout(evidenceTimeouts.current[evidenceKey])
              delete evidenceTimeouts.current[evidenceKey]
            }
          })
        }
      }
    })
    
    setTemplate(prev => {
      const newSections = [...prev.sections]
      const temp = newSections[sectionIndex]
      newSections[sectionIndex] = newSections[sectionIndex + 1]
      newSections[sectionIndex + 1] = temp
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
    
    // Swap local state for the two affected sections
    const newSectionTitles = { ...sectionTitles }
    const newDescriptions = { ...itemDescriptions }
    const newExpectedValues = { ...itemExpectedValues }
    const newTolerances = { ...itemTolerances }
    const newEvidenceDescriptions = { ...evidenceDescriptions }
    
    // Swap section titles
    const tempTitle = newSectionTitles[sectionIndex]
    newSectionTitles[sectionIndex] = newSectionTitles[targetIndex]
    newSectionTitles[targetIndex] = tempTitle
    
    // Swap item state for both sections
    const currentSection = template.sections[sectionIndex]
    const targetSection = template.sections[targetIndex]
    
    // Clear old state for both sections
    const sectionsToProcess = [
      { section: currentSection, index: sectionIndex },
      { section: targetSection, index: targetIndex }
    ]
    
    sectionsToProcess.forEach(({ section, index }) => {
      if (section) {
        section.items.forEach((_, itemIdx) => {
          const key = `${index}-${itemIdx}`
          delete newDescriptions[key]
          delete newExpectedValues[key]
          delete newTolerances[key]
        })
        
        if (section.evidence_config) {
          section.evidence_config.categories.forEach(category => {
            const key = `${index}-${category}`
            delete newEvidenceDescriptions[key]
          })
        }
      }
    })
    
    // Set new state with swapped indices
    if (currentSection) {
      currentSection.items.forEach((_, itemIdx) => {
        const oldKey = `${sectionIndex}-${itemIdx}`
        const newKey = `${targetIndex}-${itemIdx}`
        
        if (itemDescriptions[oldKey]) newDescriptions[newKey] = itemDescriptions[oldKey]
        if (itemExpectedValues[oldKey]) newExpectedValues[newKey] = itemExpectedValues[oldKey]
        if (itemTolerances[oldKey]) newTolerances[newKey] = itemTolerances[oldKey]
      })
      
      if (currentSection.evidence_config) {
        currentSection.evidence_config.categories.forEach(category => {
          const oldKey = `${sectionIndex}-${category}`
          const newKey = `${targetIndex}-${category}`
          if (evidenceDescriptions[oldKey]) newEvidenceDescriptions[newKey] = evidenceDescriptions[oldKey]
        })
      }
    }
    
    if (targetSection) {
      targetSection.items.forEach((_, itemIdx) => {
        const oldKey = `${targetIndex}-${itemIdx}`
        const newKey = `${sectionIndex}-${itemIdx}`
        
        if (itemDescriptions[oldKey]) newDescriptions[newKey] = itemDescriptions[oldKey]
        if (itemExpectedValues[oldKey]) newExpectedValues[newKey] = itemExpectedValues[oldKey]
        if (itemTolerances[oldKey]) newTolerances[newKey] = itemTolerances[oldKey]
      })
      
      if (targetSection.evidence_config) {
        targetSection.evidence_config.categories.forEach(category => {
          const oldKey = `${targetIndex}-${category}`
          const newKey = `${sectionIndex}-${category}`
          if (evidenceDescriptions[oldKey]) newEvidenceDescriptions[newKey] = evidenceDescriptions[oldKey]
        })
      }
    }
    
    setSectionTitles(newSectionTitles)
    setItemDescriptions(newDescriptions)
    setItemExpectedValues(newExpectedValues)
    setItemTolerances(newTolerances)
    setEvidenceDescriptions(newEvidenceDescriptions)
  }

  const updateSectionType = (sectionIndex: number, newType: 'checklist' | 'evidence' | 'cleanliness_bonus') => {
    updateSection(sectionIndex, { 
      section_type: newType,
      evidence_config: newType === 'evidence' ? {
        min_photos: 1,
        max_photos: 5,
        categories: ['Estado General'],
        descriptions: { 'Estado General': 'Vista general del equipo' }
      } : undefined,
      cleanliness_config: newType === 'cleanliness_bonus' ? {
        min_photos: 2,
        max_photos: 4,
        areas: ['Interior', 'Exterior'],
        descriptions: {
          'Interior': 'Fotografiar evidencia del estado de limpieza interior',
          'Exterior': 'Fotografiar evidencia del estado de limpieza exterior'
        }
      } : template.sections[sectionIndex].cleanliness_config,
      items: newType === 'evidence' ? [] : template.sections[sectionIndex].items
    })
  }

  // Item functions
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
    const updatedItems = template.sections[sectionIndex].items.map((item, index) =>
      index === itemIndex ? { ...item, ...updates } : item
    )
    updateSection(sectionIndex, { items: updatedItems })
  }

  const deleteItem = (sectionIndex: number, itemIndex: number) => {
    const key = `${sectionIndex}-${itemIndex}`
    if (descriptionTimeouts.current[key]) {
      clearTimeout(descriptionTimeouts.current[key])
      delete descriptionTimeouts.current[key]
    }
    
    // Clear all timeouts for items in this section that will be shifted
    const section = template.sections[sectionIndex]
    for (let i = itemIndex; i < section.items.length; i++) {
      const currentKey = `${sectionIndex}-${i}`
      const expectedKey = `${currentKey}-expected`
      const toleranceKey = `${currentKey}-tolerance`
      
      // Clear timeouts
      if (descriptionTimeouts.current[currentKey]) {
        clearTimeout(descriptionTimeouts.current[currentKey])
        delete descriptionTimeouts.current[currentKey]
      }
      if (itemFieldTimeouts.current[expectedKey]) {
        clearTimeout(itemFieldTimeouts.current[expectedKey])
        delete itemFieldTimeouts.current[expectedKey]
      }
      if (itemFieldTimeouts.current[toleranceKey]) {
        clearTimeout(itemFieldTimeouts.current[toleranceKey])
        delete itemFieldTimeouts.current[toleranceKey]
      }
    }
    
    // Update the template
    const updatedItems = template.sections[sectionIndex].items.filter((_, index) => index !== itemIndex)
    updateSection(sectionIndex, { items: updatedItems })
    setHasChanges(true)
    
    // Re-index local state for remaining items
    const newDescriptions = { ...itemDescriptions }
    const newExpectedValues = { ...itemExpectedValues }
    const newTolerances = { ...itemTolerances }
    
    // Remove state for deleted item and items that will be shifted
    for (let i = itemIndex; i < section.items.length; i++) {
      const oldKey = `${sectionIndex}-${i}`
      delete newDescriptions[oldKey]
      delete newExpectedValues[oldKey]
      delete newTolerances[oldKey]
    }
    
    // Re-index remaining items (shift indices down)
    for (let i = itemIndex + 1; i < section.items.length; i++) {
      const oldKey = `${sectionIndex}-${i}`
      const newKey = `${sectionIndex}-${i - 1}`
      
      if (itemDescriptions[oldKey]) {
        newDescriptions[newKey] = itemDescriptions[oldKey]
      }
      if (itemExpectedValues[oldKey]) {
        newExpectedValues[newKey] = itemExpectedValues[oldKey]
      }
      if (itemTolerances[oldKey]) {
        newTolerances[newKey] = itemTolerances[oldKey]
      }
    }
    
    setItemDescriptions(newDescriptions)
    setItemExpectedValues(newExpectedValues)
    setItemTolerances(newTolerances)
  }

  // Evidence functions
  const updateEvidenceConfig = (sectionIndex: number, config: Partial<EvidenceConfig>) => {
    const section = template.sections[sectionIndex]
    if (section.evidence_config) {
      updateSection(sectionIndex, {
        evidence_config: { ...section.evidence_config, ...config }
      })
    }
  }

  const addEvidenceCategory = (sectionIndex: number, category: string) => {
    const section = template.sections[sectionIndex]
    if (section.evidence_config && !section.evidence_config.categories.includes(category)) {
      updateEvidenceConfig(sectionIndex, {
        categories: [...section.evidence_config.categories, category],
        descriptions: {
          ...section.evidence_config.descriptions,
          [category]: `Instrucciones para ${category.toLowerCase()}`
        }
      })
    }
  }

  const removeEvidenceCategory = (sectionIndex: number, category: string) => {
    const section = template.sections[sectionIndex]
    if (section.evidence_config) {
      const newDescriptions = { ...section.evidence_config.descriptions }
      delete newDescriptions[category]
      
      updateEvidenceConfig(sectionIndex, {
        categories: section.evidence_config.categories.filter(c => c !== category),
        descriptions: newDescriptions
      })
    }
  }

  const updateCategoryDescription = (sectionIndex: number, category: string, description: string) => {
    const section = template.sections[sectionIndex]
    if (section.evidence_config) {
      updateEvidenceConfig(sectionIndex, {
        descriptions: {
          ...section.evidence_config.descriptions,
          [category]: description
        }
      })
    }
  }

  // Optimized local update functions
  const updateTemplateNameLocal = (name: string) => {
    setTemplateName(name)
    
    if (templateTimeouts.current.name) {
      clearTimeout(templateTimeouts.current.name)
    }
    
    templateTimeouts.current.name = setTimeout(() => {
      setTemplate(prev => ({ ...prev, name }))
      setHasChanges(true)
      delete templateTimeouts.current.name
    }, 500)
  }

  const updateTemplateDescriptionLocal = (description: string) => {
    setTemplateDescription(description)
    
    if (templateTimeouts.current.description) {
      clearTimeout(templateTimeouts.current.description)
    }
    
    templateTimeouts.current.description = setTimeout(() => {
      setTemplate(prev => ({ ...prev, description }))
      setHasChanges(true)
      delete templateTimeouts.current.description
    }, 500)
  }

  const updateSectionTitleLocal = (index: number, title: string) => {
    setSectionTitles(prev => ({ ...prev, [index]: title }))
    
    if (titleTimeouts.current[index]) {
      clearTimeout(titleTimeouts.current[index])
    }
    
    titleTimeouts.current[index] = setTimeout(() => {
      updateSection(index, { title })
      delete titleTimeouts.current[index]
    }, 500)
  }

  const updateItemDescriptionLocal = (sectionIndex: number, itemIndex: number, description: string) => {
    const key = `${sectionIndex}-${itemIndex}`
    
    setItemDescriptions(prev => ({ ...prev, [key]: description }))
    
    if (descriptionTimeouts.current[key]) {
      clearTimeout(descriptionTimeouts.current[key])
    }
    
    descriptionTimeouts.current[key] = setTimeout(() => {
      updateItem(sectionIndex, itemIndex, { description })
      delete descriptionTimeouts.current[key]
    }, 500)
  }

  const updateItemExpectedValueLocal = (sectionIndex: number, itemIndex: number, value: string) => {
    const key = `${sectionIndex}-${itemIndex}`
    setItemExpectedValues(prev => ({ ...prev, [key]: value }))
    
    if (itemFieldTimeouts.current[`${key}-expected`]) {
      clearTimeout(itemFieldTimeouts.current[`${key}-expected`])
    }
    
    itemFieldTimeouts.current[`${key}-expected`] = setTimeout(() => {
      updateItem(sectionIndex, itemIndex, { expected_value: value })
      delete itemFieldTimeouts.current[`${key}-expected`]
    }, 500)
  }

  const updateItemToleranceLocal = (sectionIndex: number, itemIndex: number, tolerance: string) => {
    const key = `${sectionIndex}-${itemIndex}`
    setItemTolerances(prev => ({ ...prev, [key]: tolerance }))
    
    if (itemFieldTimeouts.current[`${key}-tolerance`]) {
      clearTimeout(itemFieldTimeouts.current[`${key}-tolerance`])
    }
    
    itemFieldTimeouts.current[`${key}-tolerance`] = setTimeout(() => {
      updateItem(sectionIndex, itemIndex, { tolerance })
      delete itemFieldTimeouts.current[`${key}-tolerance`]
    }, 500)
  }

  const updateEvidenceDescriptionLocal = (sectionIndex: number, category: string, description: string) => {
    const key = `${sectionIndex}-${category}`
    setEvidenceDescriptions(prev => ({ ...prev, [key]: description }))
    
    if (evidenceTimeouts.current[key]) {
      clearTimeout(evidenceTimeouts.current[key])
    }
    
    evidenceTimeouts.current[key] = setTimeout(() => {
      updateCategoryDescription(sectionIndex, category, description)
      delete evidenceTimeouts.current[key]
    }, 500)
  }

  const saveTemplate = async () => {
    setSaving(true)
    try {
      // Flush all pending updates
      if (templateTimeouts.current.name) {
        clearTimeout(templateTimeouts.current.name)
        template.name = templateName
      }
      if (templateTimeouts.current.description) {
        clearTimeout(templateTimeouts.current.description)
        template.description = templateDescription
      }
      
      Object.entries(titleTimeouts.current).forEach(([index, timeout]) => {
        clearTimeout(timeout)
        const idx = parseInt(index)
        const title = sectionTitles[idx]
        if (title && template.sections[idx]) {
          template.sections[idx].title = title
        }
      })

      // Clear any pending evidence description timeouts
      Object.entries(evidenceTimeouts.current).forEach(([key, timeout]) => {
        clearTimeout(timeout)
        const [sectionIndexStr, category] = key.split('-')
        const sectionIndex = parseInt(sectionIndexStr)
        const description = evidenceDescriptions[key]
        if (description && template.sections[sectionIndex]?.evidence_config) {
          template.sections[sectionIndex].evidence_config!.descriptions[category] = description
        }
      })

      // Clear any pending item field timeouts
      Object.entries(itemFieldTimeouts.current).forEach(([key, timeout]) => {
        clearTimeout(timeout)
        const [sectionIndexStr, itemIndexStr] = key.split('-')
        const sectionIndex = parseInt(sectionIndexStr)
        const itemIndex = parseInt(itemIndexStr)
        
        const expectedValue = itemExpectedValues[key]
        const tolerance = itemTolerances[key]
        
        if (template.sections[sectionIndex]?.items[itemIndex]) {
          if (expectedValue !== undefined) {
            template.sections[sectionIndex].items[itemIndex].expected_value = expectedValue
          }
          if (tolerance !== undefined) {
            template.sections[sectionIndex].items[itemIndex].tolerance = tolerance
          }
        }
      })

      // Clear any pending item description timeouts
      Object.entries(descriptionTimeouts.current).forEach(([key, timeout]) => {
        clearTimeout(timeout)
        const [sectionIndexStr, itemIndexStr] = key.split('-')
        const sectionIndex = parseInt(sectionIndexStr)
        const itemIndex = parseInt(itemIndexStr)
        
        const description = itemDescriptions[key]
        if (description && template.sections[sectionIndex]?.items[itemIndex]) {
          template.sections[sectionIndex].items[itemIndex].description = description
        }
      })

      // Sanitize cleanliness config to avoid empty/invalid states
      template.sections = template.sections.map((section) => {
        if (section.section_type === 'cleanliness_bonus') {
          const minPhotos = section.cleanliness_config?.min_photos ?? 2
          const maxPhotos = section.cleanliness_config?.max_photos ?? 6
          const areasRaw = section.cleanliness_config?.areas || []
          const areas = areasRaw
            .map(a => (a || '').trim())
            .filter(a => a.length > 0)
          const descriptions = section.cleanliness_config?.descriptions || {}
          const safeAreas = areas.length > 0 ? areas : ['Interior', 'Exterior']
          const safeDescriptions = { ...descriptions }
          safeAreas.forEach(a => {
            if (!safeDescriptions[a]) {
              safeDescriptions[a] = a.toLowerCase().includes('interior')
                ? 'Fotografiar evidencia del estado de limpieza interior'
                : a.toLowerCase().includes('exterior')
                  ? 'Fotografiar evidencia del estado de limpieza exterior'
                  : `Evidencia fotográfica para ${a}`
            }
          })
          return {
            ...section,
            cleanliness_config: {
              min_photos: Math.max(1, minPhotos),
              max_photos: Math.max(Math.max(1, minPhotos), maxPhotos),
              areas: safeAreas,
              descriptions: safeDescriptions
            }
          }
        }
        return section
      })

      const supabase = createClient()

      if (templateId) {
        // Update existing template
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

        console.log('🔄 Using versioning system to save template safely')

        // First, update the template sections in the database to match the current state
        // We'll use a transaction-like approach: create new sections, then clean up old ones
        
        // Step 1: Create all new sections (they'll have new IDs)
        const newSectionIds: string[] = []
        
        for (let i = 0; i < template.sections.length; i++) {
          const section = template.sections[i]
          
          console.log(`🆕 Creating section ${i + 1}: ${section.title}`)
          
          const { data: newSection, error: sectionError } = await supabase
            .from('checklist_sections')
            .insert({
              checklist_id: templateId,
              title: section.title,
              order_index: i,
              section_type: section.section_type || 'checklist',
              evidence_config: section.evidence_config || null,
              cleanliness_config: section.cleanliness_config || null
            })
            .select('id')
            .single()

          if (sectionError) {
            console.error('❌ Error creating section:', sectionError)
            throw sectionError
          }

          console.log('✅ Section created with ID:', newSection.id)
          newSectionIds.push(newSection.id)

          // Update the template state with the new section ID
          setTemplate(prev => {
            const updatedSections = [...prev.sections]
            updatedSections[i] = { ...updatedSections[i], id: newSection.id }
            return { ...prev, sections: updatedSections }
          })

          // Create items for checklist and cleanliness sections
          if (section.section_type === 'checklist' || section.section_type === 'cleanliness_bonus' || !section.section_type) {
            console.log(`📋 Adding ${section.items.length} items to section`)
            for (let j = 0; j < section.items.length; j++) {
              const item = section.items[j]
              await supabase
                .from('checklist_items')
                .insert({
                  section_id: newSection.id,
                  description: item.description,
                  required: item.required,
                  order_index: j,
                  item_type: item.item_type,
                  expected_value: item.expected_value || null,
                  tolerance: item.tolerance || null
                })
            }
          } else {
            console.log('📸 Evidence section - no items to add')
          }
        }

        // Step 2: Create version snapshot of the new state
        try {
          console.log('📝 Creating version snapshot of new template state')
          
          const { data: versionData, error: versionError } = await (supabase as any).rpc(
            'create_template_version',
            {
              p_template_id: templateId,
              p_change_summary: changeSummary || 'Cambios en plantilla desde el editor',
              p_migration_notes: 'Versión creada desde editor de plantillas'
            }
          )

          if (versionError) {
            console.error('❌ Error creating template version:', versionError)
            // Continue with cleanup anyway
          } else {
            console.log('✅ New template version created:', versionData)
            
            // Reload version history to show the new version
            await loadVersionHistory()
          }
        } catch (versioningError) {
          console.error('⚠️ Versioning system not available:', versioningError)
          // Continue anyway
        }

        // Step 3: Clean up old sections (keep only the new ones we just created)
        try {
          console.log('🧹 Cleaning up old sections...')
          
          // Get all existing sections for this template
          const { data: allSections, error: fetchError } = await supabase
            .from('checklist_sections')
            .select('id')
            .eq('checklist_id', templateId)

          if (fetchError) {
            console.error('⚠️ Could not fetch sections for cleanup:', fetchError)
          } else if (allSections) {
            // Find old sections to delete (those not in newSectionIds)
            const oldSectionIds = allSections
              .map(s => s.id)
              .filter(id => !newSectionIds.includes(id))

            if (oldSectionIds.length > 0) {
              console.log(`🗑️ Cleaning up ${oldSectionIds.length} old sections`)

              // Delete items from old sections first
              await supabase
                .from('checklist_items')
                .delete()
                .in('section_id', oldSectionIds)

              // Clean up any evidence records pointing to old sections  
              try {
                await supabase
                  .from('checklist_evidence' as any)
                  .delete()
                  .in('section_id', oldSectionIds)
              } catch (evidenceError) {
                console.log('⚠️ Could not clean evidence records (may not exist)')
              }

              // Delete old sections
              const { error: oldSectionsError } = await supabase
                .from('checklist_sections')
                .delete()
                .in('id', oldSectionIds)

              if (oldSectionsError) {
                console.error('⚠️ Could not clean up old sections:', oldSectionsError)
                // Don't throw - the new sections are created successfully
              } else {
                console.log('✅ Old sections cleaned up successfully')
              }
            } else {
              console.log('ℹ️ No old sections to clean up')
            }
          }
        } catch (cleanupError) {
          console.error('⚠️ Cleanup error (non-critical):', cleanupError)
          // Don't throw - the save was successful
        }

        toast({
          title: "Plantilla actualizada",
          description: "La plantilla ha sido actualizada exitosamente",
          variant: "default"
        })
      } else {
        // Create new template
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

        // Create sections for new template
        for (let i = 0; i < template.sections.length; i++) {
          const section = template.sections[i]
          
          const { data: newSection, error: sectionError } = await supabase
            .from('checklist_sections')
            .insert({
              checklist_id: newTemplate.id,
              title: section.title,
              order_index: i,
              section_type: section.section_type || 'checklist',
              evidence_config: section.evidence_config || null,
              cleanliness_config: section.cleanliness_config || null
            })
            .select('id')
            .single()

          if (sectionError) throw sectionError

          // Create items for checklist and cleanliness sections
          if (section.section_type === 'checklist' || section.section_type === 'cleanliness_bonus' || !section.section_type) {
            for (let j = 0; j < section.items.length; j++) {
              const item = section.items[j]
              await supabase
                .from('checklist_items')
                .insert({
                  section_id: newSection.id,
                  description: item.description,
                  required: item.required,
                  order_index: j,
                  item_type: item.item_type,
                  expected_value: item.expected_value || null,
                  tolerance: item.tolerance || null
                })
            }
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

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'check': return <Check className="h-4 w-4" />
      case 'measure': return <Edit3 className="h-4 w-4" />
      case 'text': return <Edit3 className="h-4 w-4" />
      default: return <Check className="h-4 w-4" />
    }
  }

  const renderEvidenceSection = (section: ChecklistSection, sectionIndex: number) => {
    const config = section.evidence_config!
    
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
            <Select onValueChange={(value) => addEvidenceCategory(sectionIndex, value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Agregar categoría" />
              </SelectTrigger>
              <SelectContent>
                {EVIDENCE_CATEGORIES.filter(cat => !config.categories.includes(cat)).map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
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
                    value={evidenceDescriptions[`${sectionIndex}-${category}`] || config.descriptions[category] || ''}
                    onChange={(e) => updateEvidenceDescriptionLocal(sectionIndex, category, e.target.value)}
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

  if (loading) {
    return <div className="flex justify-center p-8">Cargando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">
            {templateId ? 'Editar Plantilla' : 'Nueva Plantilla'}
          </h2>
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
          <Button onClick={() => templateId && hasChanges ? setShowChangeSummaryDialog(true) : saveTemplate()} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Hay cambios sin guardar.
          </AlertDescription>
        </Alert>
      )}

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
                value={templateName || template.name}
                onChange={(e) => updateTemplateNameLocal(e.target.value)}
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
              value={templateDescription || template.description}
              onChange={(e) => updateTemplateDescriptionLocal(e.target.value)}
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
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Secciones del Checklist</h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={addSection}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Agregar Sección Normal
            </Button>
            <Button variant="outline" onClick={addEvidenceSection} className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
              <Camera className="h-4 w-4 mr-2" />
              Agregar Sección de Evidencia
            </Button>
            <Button variant="outline" onClick={addCleanlinessSection} className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
              <Sparkles className="h-4 w-4 mr-2" />
              Verificación de Limpieza
            </Button>
          </div>
        </div>

        {template.sections.map((section, sectionIndex) => (
          <Card key={sectionIndex} className={
            section.section_type === 'evidence' ? 'border-blue-200 bg-blue-50/50' : 
            section.section_type === 'cleanliness_bonus' ? 'border-green-200 bg-green-50/50' : ''
          }>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <Select
                      value={section.section_type || 'checklist'}
                      onValueChange={(value: 'checklist' | 'evidence' | 'cleanliness_bonus') => updateSectionType(sectionIndex, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checklist">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="h-4 w-4" />
                            Checklist Normal
                          </div>
                        </SelectItem>
                        <SelectItem value="evidence">
                          <div className="flex items-center gap-2">
                            <Camera className="h-4 w-4" />
                            Evidencia Fotográfica
                          </div>
                        </SelectItem>
                        <SelectItem value="cleanliness_bonus">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Limpieza
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    value={sectionTitles[sectionIndex] || section.title}
                    onChange={(e) => updateSectionTitleLocal(sectionIndex, e.target.value)}
                    className="font-semibold"
                    placeholder="Título de la sección"
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
              {section.section_type === 'evidence' ? (
                renderEvidenceSection(section, sectionIndex)
                            ) : section.section_type === 'cleanliness_bonus' ? (
                // Render cleanliness section - hybrid of checklist items + evidence photos
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-l-4 border-green-500 pl-4">
                    <Sparkles className="h-5 w-5 text-green-600" />
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Verificación de Limpieza (Checklist + Fotos)
                    </Badge>
                  </div>
                  
                  {/* Checklist Items */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-gray-700">Items a Verificar:</h4>
                    {section.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              {getItemTypeIcon(item.item_type)}
                              <Input
                                value={itemDescriptions[`${sectionIndex}-${itemIndex}`] || item.description}
                                onChange={(e) => updateItemDescriptionLocal(sectionIndex, itemIndex, e.target.value)}
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
                                    value={itemExpectedValues[`${sectionIndex}-${itemIndex}`] || item.expected_value || ''}
                                    onChange={(e) => updateItemExpectedValueLocal(sectionIndex, itemIndex, e.target.value)}
                                    placeholder="Valor esperado"
                                  />
                                  <Input
                                    value={itemTolerances[`${sectionIndex}-${itemIndex}`] || item.tolerance || ''}
                                    onChange={(e) => updateItemToleranceLocal(sectionIndex, itemIndex, e.target.value)}
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
                      Agregar Item de Limpieza
                    </Button>
                  </div>

                  {/* Photo Evidence Configuration */}
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Configuración de Evidencia Fotográfica:
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Fotos Mínimas</Label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={section.cleanliness_config?.min_photos ?? 2}
                          onChange={(e) => {
                            const minPhotos = parseInt(e.target.value) || 2
                            updateSection(sectionIndex, {
                              cleanliness_config: {
                                min_photos: minPhotos,
                                max_photos: section.cleanliness_config?.max_photos ?? 4,
                                areas: section.cleanliness_config?.areas ?? [],
                                descriptions: section.cleanliness_config?.descriptions ?? {}
                              }
                            })
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fotos Máximas</Label>
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          value={section.cleanliness_config?.max_photos ?? 4}
                          onChange={(e) => {
                            const maxPhotos = parseInt(e.target.value) || 4
                            updateSection(sectionIndex, {
                              cleanliness_config: {
                                min_photos: section.cleanliness_config?.min_photos ?? 2,
                                max_photos: maxPhotos,
                                areas: section.cleanliness_config?.areas ?? [],
                                descriptions: section.cleanliness_config?.descriptions ?? {}
                              }
                            })
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Áreas de Evidencia</Label>
                      <Textarea
                        value={section.cleanliness_config?.areas.join(', ') || ''}
                        onChange={(e) => {
                          const areas = e.target.value.split(',').map(a => a.trim()).filter(a => a.length > 0)
                          updateSection(sectionIndex, {
                            cleanliness_config: {
                              min_photos: section.cleanliness_config?.min_photos ?? 2,
                              max_photos: section.cleanliness_config?.max_photos ?? 4,
                              descriptions: section.cleanliness_config?.descriptions ?? {},
                              areas: areas
                            }
                          })
                        }}
                        placeholder="Ejemplo: Interior, Exterior"
                        rows={2}
                      />
                      <p className="text-sm text-muted-foreground">
                        Áreas que requieren evidencia fotográfica para respaldar la evaluación de limpieza.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            {getItemTypeIcon(item.item_type)}
                            <Input
                              value={itemDescriptions[`${sectionIndex}-${itemIndex}`] || item.description}
                              onChange={(e) => updateItemDescriptionLocal(sectionIndex, itemIndex, e.target.value)}
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
                                  value={itemExpectedValues[`${sectionIndex}-${itemIndex}`] || item.expected_value || ''}
                                  onChange={(e) => updateItemExpectedValueLocal(sectionIndex, itemIndex, e.target.value)}
                                  placeholder="Valor esperado"
                                />
                                <Input
                                  value={itemTolerances[`${sectionIndex}-${itemIndex}`] || item.tolerance || ''}
                                  onChange={(e) => updateItemToleranceLocal(sectionIndex, itemIndex, e.target.value)}
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
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Historial de Versiones - {template.name}</DialogTitle>
            <DialogDescription>
              Versiones de esta plantilla de checklist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay versiones guardadas aún</p>
                <p className="text-sm">Se creará una versión automáticamente cuando guardes cambios</p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version) => (
                  <Card key={version.id} className={version.is_active ? 'border-blue-500 bg-blue-50' : ''}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            Versión {version.version_number}
                            {version.is_active && (
                              <Badge variant="default" className="bg-blue-600">Activa</Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                                                         {new Date(version.created_at).toLocaleDateString('es-ES', { 
                               year: 'numeric', 
                               month: '2-digit', 
                               day: '2-digit',
                               hour: '2-digit',
                               minute: '2-digit'
                             })}
                            {version.created_by && ` • ${version.created_by}`}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                          {!version.is_active && (
                            <Button variant="outline" size="sm">
                              <Copy className="h-4 w-4 mr-1" />
                              Restaurar
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div>
                          <Label className="text-sm font-medium">Resumen de cambios:</Label>
                          <p className="text-sm text-muted-foreground">{version.change_summary || 'Sin descripción'}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {version.sections?.length || 0} secciones
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVersionHistory(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showChangeSummaryDialog} onOpenChange={setShowChangeSummaryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar Cambios</DialogTitle>
            <DialogDescription>
              Describe los cambios realizados en esta versión de la plantilla
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="changeSummary">Resumen de Cambios</Label>
              <Textarea
                id="changeSummary"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Ej: Agregué nueva sección de verificación de limpieza, eliminé item duplicado de accesorios..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowChangeSummaryDialog(false)
                setChangeSummary('')
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                setShowChangeSummaryDialog(false)
                saveTemplate()
              }}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vista Previa - {template.name}</DialogTitle>
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