"use client"

// ⚡ PERFORMANCE OPTIMIZATIONS APPLIED:
// - Debounced section title updates to prevent input lag
// - Local state for immediate UI updates + background state sync
// - Proper timeout cleanup on component unmount/section removal
// - Eliminated expensive array operations on every keystroke

import React, { useState, useEffect, useRef, useCallback, startTransition } from 'react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Plus, 
  Trash2, 
  Save, 
  Eye, 
  ArrowUp, 
  ArrowDown, 
  History,
  ChevronDown,
  AlertTriangle,
  Check,
  X,
  Edit3,
  CheckSquare,
  Camera,
  Sparkles,
  Shield
} from 'lucide-react'

import { createClient } from '@/lib/supabase'
import { SecurityConfig } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import { VersionHistoryDialog } from './dialogs/version-history-dialog'
import { ChangeSummaryDialog } from './dialogs/change-summary-dialog'
import { TemplatePreviewDialog } from './dialogs/template-preview-dialog'
import { BasicInfoCard } from './template-editor/basic-info-card'
import { validateTemplate as validateTemplateShared } from './template-editor/use-template-editor-state'

interface ChecklistItem {
  id?: string
  _clientId?: string
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
  _clientId?: string
  title: string
  order_index: number
  section_type?: 'checklist' | 'evidence' | 'cleanliness_bonus' | 'security_talk'
  evidence_config?: EvidenceConfig
  cleanliness_config?: CleanlinessConfig
  security_config?: SecurityConfig
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
  onDirtyChange?: (dirty: boolean) => void
}

export function TemplateEditor({ templateId, preSelectedModelId, onSave, onCancel, onDirtyChange }: TemplateEditorProps) {
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
  
  // Debounced evidence config min/max photos (Phase 1.1)
  const [evidenceMinPhotos, setEvidenceMinPhotos] = useState<Record<number, number>>({})
  const [evidenceMaxPhotos, setEvidenceMaxPhotos] = useState<Record<number, number>>({})
  const evidenceConfigTimeouts = useRef<Record<string, NodeJS.Timeout>>({})
  
  // Debounced cleanliness config (Phase 1.1)
  const [cleanlinessMinPhotos, setCleanlinessMinPhotos] = useState<Record<number, number>>({})
  const [cleanlinessMaxPhotos, setCleanlinessMaxPhotos] = useState<Record<number, number>>({})
  const [cleanlinessAreasStr, setCleanlinessAreasStr] = useState<Record<number, string>>({})
  const cleanlinessConfigTimeouts = useRef<Record<string, NodeJS.Timeout>>({})
  
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [changeSummary, setChangeSummary] = useState('')
  const [showChangeSummaryDialog, setShowChangeSummaryDialog] = useState(false)
  const [models, setModels] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [sectionTypeChangeConfirm, setSectionTypeChangeConfirm] = useState<{
    sectionIndex: number
    newType: 'checklist' | 'evidence' | 'cleanliness_bonus' | 'security_talk'
  } | null>(null)
  const [previewVersion, setPreviewVersion] = useState<TemplateVersion | null>(null)

  // Client-side validation (call after flush - uses template state)
  const validateTemplate = (): string[] => validateTemplateShared(template)

  // Sync dirty state to parent (Bug C fix)
  useEffect(() => {
    onDirtyChange?.(hasChanges)
  }, [hasChanges, onDirtyChange])

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])

  // Cleanup all debounce timeouts on unmount (Phase 1.2)
  useEffect(() => {
    return () => {
      Object.values(templateTimeouts.current).forEach(t => t && clearTimeout(t))
      Object.values(titleTimeouts.current).forEach(t => clearTimeout(t))
      Object.values(descriptionTimeouts.current).forEach(t => clearTimeout(t))
      Object.values(itemFieldTimeouts.current).forEach(t => clearTimeout(t))
      Object.values(evidenceTimeouts.current).forEach(t => clearTimeout(t))
      Object.values(evidenceConfigTimeouts.current).forEach(t => clearTimeout(t))
      Object.values(cleanlinessConfigTimeouts.current).forEach(t => clearTimeout(t))
    }
  }, [])

  // Initialize local state when template loads or sections change. Dependencies intentionally exclude local state maps to avoid overwriting user input during typing.
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

  // Sync item/evidence/cleanliness local state when sections change. Dependencies intentionally exclude local state to avoid overwriting during typing.
  useEffect(() => {
    const newDescriptions: Record<string, string> = {}
    const newExpectedValues: Record<string, string> = {}
    const newTolerances: Record<string, string> = {}
    const newEvidenceDescs: Record<string, string> = {}
    const newEvidenceMin: Record<number, number> = {}
    const newEvidenceMax: Record<number, number> = {}
    const newCleanlinessMin: Record<number, number> = {}
    const newCleanlinessMax: Record<number, number> = {}
    const newCleanlinessAreas: Record<number, string> = {}
    
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
        if (!(sectionIndex in evidenceMinPhotos)) {
          newEvidenceMin[sectionIndex] = section.evidence_config.min_photos
        }
        if (!(sectionIndex in evidenceMaxPhotos)) {
          newEvidenceMax[sectionIndex] = section.evidence_config.max_photos
        }
        Object.entries(section.evidence_config.descriptions).forEach(([category, desc]) => {
          const evidenceKey = `${sectionIndex}-${category}`
          if (!(evidenceKey in evidenceDescriptions)) {
            newEvidenceDescs[evidenceKey] = desc
          }
        })
      }
      if (section.cleanliness_config) {
        if (!(sectionIndex in cleanlinessMinPhotos)) {
          newCleanlinessMin[sectionIndex] = section.cleanliness_config.min_photos
        }
        if (!(sectionIndex in cleanlinessMaxPhotos)) {
          newCleanlinessMax[sectionIndex] = section.cleanliness_config.max_photos
        }
        if (!(sectionIndex in cleanlinessAreasStr)) {
          newCleanlinessAreas[sectionIndex] = section.cleanliness_config.areas?.join(', ') || ''
        }
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
    if (Object.keys(newEvidenceMin).length > 0) {
      setEvidenceMinPhotos(prev => ({ ...prev, ...newEvidenceMin }))
    }
    if (Object.keys(newEvidenceMax).length > 0) {
      setEvidenceMaxPhotos(prev => ({ ...prev, ...newEvidenceMax }))
    }
    if (Object.keys(newCleanlinessMin).length > 0) {
      setCleanlinessMinPhotos(prev => ({ ...prev, ...newCleanlinessMin }))
    }
    if (Object.keys(newCleanlinessMax).length > 0) {
      setCleanlinessMaxPhotos(prev => ({ ...prev, ...newCleanlinessMax }))
    }
    if (Object.keys(newCleanlinessAreas).length > 0) {
      setCleanlinessAreasStr(prev => ({ ...prev, ...newCleanlinessAreas }))
    }
  }, [template.sections])

  // Load models and template on mount / templateId change. Functions are stable; deps omitted intentionally.
  useEffect(() => {
    loadModels()
    if (templateId) {
      loadTemplate()
      loadVersionHistory()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadModels/loadTemplate/loadVersionHistory are effectively stable
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
        security_config: section.security_config || undefined,
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
      setValidationErrors([])
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
      _clientId: crypto.randomUUID(),
      title: `Nueva Sección ${template.sections.length + 1}`,
      order_index: template.sections.length,
      section_type: 'checklist',
      items: [
        {
          _clientId: crypto.randomUUID(),
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
      _clientId: crypto.randomUUID(),
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

  const addSecuritySection = () => {
    const newTitle = `Charla de Seguridad ${template.sections.filter(s => s.section_type === 'security_talk').length + 1}`
    const newSection: ChecklistSection = {
      _clientId: crypto.randomUUID(),
      title: newTitle,
      order_index: template.sections.length,
      section_type: 'security_talk',
      security_config: {
        mode: 'plant_manager',
        require_attendance: true,
        require_topic: true,
        require_reflection: true,
        allow_evidence: false
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
      _clientId: crypto.randomUUID(),
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
        { _clientId: crypto.randomUUID(), description: 'Interior está limpio', required: true, order_index: 0, item_type: 'check' },
        { _clientId: crypto.randomUUID(), description: 'Exterior está limpio', required: true, order_index: 1, item_type: 'check' }
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

  const updateSection = useCallback((sectionIndex: number, updates: Partial<ChecklistSection>) => {
    setTemplate(prev => {
      const newSections = prev.sections.map((section, index) =>
        index === sectionIndex ? { ...section, ...updates } : section
      )
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
  }, [])

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
          ;['min', 'max'].forEach(suffix => {
            const key = `${i}-${suffix}`
            if (evidenceConfigTimeouts.current[key]) {
              clearTimeout(evidenceConfigTimeouts.current[key])
              delete evidenceConfigTimeouts.current[key]
            }
          })
        }
        if (section.cleanliness_config) {
          ;['min', 'max', 'areas'].forEach(suffix => {
            const key = `${i}-${suffix}`
            if (cleanlinessConfigTimeouts.current[key]) {
              clearTimeout(cleanlinessConfigTimeouts.current[key])
              delete cleanlinessConfigTimeouts.current[key]
            }
          })
        }
      }
    }
    
    startTransition(() => {
      setTemplate(prev => ({
        ...prev,
        sections: prev.sections.filter((_, index) => index !== sectionIndex)
      }))
      setHasChanges(true)
      
      const newSectionTitles = { ...sectionTitles }
      const newDescriptions = { ...itemDescriptions }
      const newExpectedValues = { ...itemExpectedValues }
      const newTolerances = { ...itemTolerances }
      const newEvidenceDescriptions = { ...evidenceDescriptions }
      const newEvidenceMinPhotos = { ...evidenceMinPhotos }
      const newEvidenceMaxPhotos = { ...evidenceMaxPhotos }
      const newCleanlinessMinPhotos = { ...cleanlinessMinPhotos }
      const newCleanlinessMaxPhotos = { ...cleanlinessMaxPhotos }
      const newCleanlinessAreasStr = { ...cleanlinessAreasStr }
      
      for (let i = sectionIndex; i < template.sections.length; i++) {
        delete newSectionTitles[i]
        delete newEvidenceMinPhotos[i]
        delete newEvidenceMaxPhotos[i]
        delete newCleanlinessMinPhotos[i]
        delete newCleanlinessMaxPhotos[i]
        delete newCleanlinessAreasStr[i]
        const sec = template.sections[i]
        if (sec) {
          for (let j = 0; j < sec.items.length; j++) {
            const oldKey = `${i}-${j}`
            delete newDescriptions[oldKey]
            delete newExpectedValues[oldKey]
            delete newTolerances[oldKey]
          }
          if (sec.evidence_config) {
            sec.evidence_config.categories.forEach(category => {
              delete newEvidenceDescriptions[`${i}-${category}`]
            })
          }
        }
      }
      
      for (let i = sectionIndex + 1; i < template.sections.length; i++) {
        const newIndex = i - 1
        if (sectionTitles[i] !== undefined) newSectionTitles[newIndex] = sectionTitles[i]
        const sec = template.sections[i]
        if (sec) {
          for (let j = 0; j < sec.items.length; j++) {
            const oldKey = `${i}-${j}`
            const newKey = `${newIndex}-${j}`
            if (itemDescriptions[oldKey] !== undefined) newDescriptions[newKey] = itemDescriptions[oldKey]
            if (itemExpectedValues[oldKey] !== undefined) newExpectedValues[newKey] = itemExpectedValues[oldKey]
            if (itemTolerances[oldKey] !== undefined) newTolerances[newKey] = itemTolerances[oldKey]
          }
          if (sec.evidence_config) {
            sec.evidence_config.categories.forEach(category => {
              const oldKey = `${i}-${category}`
              const newKey = `${newIndex}-${category}`
              if (evidenceDescriptions[oldKey] !== undefined) newEvidenceDescriptions[newKey] = evidenceDescriptions[oldKey]
            })
            if (evidenceMinPhotos[i] !== undefined) newEvidenceMinPhotos[newIndex] = evidenceMinPhotos[i]
            if (evidenceMaxPhotos[i] !== undefined) newEvidenceMaxPhotos[newIndex] = evidenceMaxPhotos[i]
          }
          if (sec.cleanliness_config) {
            if (cleanlinessMinPhotos[i] !== undefined) newCleanlinessMinPhotos[newIndex] = cleanlinessMinPhotos[i]
            if (cleanlinessMaxPhotos[i] !== undefined) newCleanlinessMaxPhotos[newIndex] = cleanlinessMaxPhotos[i]
            if (cleanlinessAreasStr[i] !== undefined) newCleanlinessAreasStr[newIndex] = cleanlinessAreasStr[i]
          }
        }
      }
      
      setSectionTitles(newSectionTitles)
      setItemDescriptions(newDescriptions)
      setItemExpectedValues(newExpectedValues)
      setItemTolerances(newTolerances)
      setEvidenceDescriptions(newEvidenceDescriptions)
      setEvidenceMinPhotos(newEvidenceMinPhotos)
      setEvidenceMaxPhotos(newEvidenceMaxPhotos)
      setCleanlinessMinPhotos(newCleanlinessMinPhotos)
      setCleanlinessMaxPhotos(newCleanlinessMaxPhotos)
      setCleanlinessAreasStr(newCleanlinessAreasStr)
    })
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
          ;['min', 'max'].forEach(suffix => {
            const key = `${idx}-${suffix}`
            if (evidenceConfigTimeouts.current[key]) {
              clearTimeout(evidenceConfigTimeouts.current[key])
              delete evidenceConfigTimeouts.current[key]
            }
          })
        }
        if (section.cleanliness_config) {
          ;['min', 'max', 'areas'].forEach(suffix => {
            const key = `${idx}-${suffix}`
            if (cleanlinessConfigTimeouts.current[key]) {
              clearTimeout(cleanlinessConfigTimeouts.current[key])
              delete cleanlinessConfigTimeouts.current[key]
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
    const newEvidenceMinPhotos = { ...evidenceMinPhotos }
    const newEvidenceMaxPhotos = { ...evidenceMaxPhotos }
    const newCleanlinessMinPhotos = { ...cleanlinessMinPhotos }
    const newCleanlinessMaxPhotos = { ...cleanlinessMaxPhotos }
    const newCleanlinessAreasStr = { ...cleanlinessAreasStr }
    
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
          delete newEvidenceMinPhotos[index]
          delete newEvidenceMaxPhotos[index]
        }
        if (section.cleanliness_config) {
          delete newCleanlinessMinPhotos[index]
          delete newCleanlinessMaxPhotos[index]
          delete newCleanlinessAreasStr[index]
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
        if (evidenceMinPhotos[sectionIndex] !== undefined) newEvidenceMinPhotos[targetIndex] = evidenceMinPhotos[sectionIndex]
        if (evidenceMaxPhotos[sectionIndex] !== undefined) newEvidenceMaxPhotos[targetIndex] = evidenceMaxPhotos[sectionIndex]
      }
      if (currentSection.cleanliness_config) {
        if (cleanlinessMinPhotos[sectionIndex] !== undefined) newCleanlinessMinPhotos[targetIndex] = cleanlinessMinPhotos[sectionIndex]
        if (cleanlinessMaxPhotos[sectionIndex] !== undefined) newCleanlinessMaxPhotos[targetIndex] = cleanlinessMaxPhotos[sectionIndex]
        if (cleanlinessAreasStr[sectionIndex] !== undefined) newCleanlinessAreasStr[targetIndex] = cleanlinessAreasStr[sectionIndex]
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
        if (evidenceMinPhotos[targetIndex] !== undefined) newEvidenceMinPhotos[sectionIndex] = evidenceMinPhotos[targetIndex]
        if (evidenceMaxPhotos[targetIndex] !== undefined) newEvidenceMaxPhotos[sectionIndex] = evidenceMaxPhotos[targetIndex]
      }
      if (targetSection.cleanliness_config) {
        if (cleanlinessMinPhotos[targetIndex] !== undefined) newCleanlinessMinPhotos[sectionIndex] = cleanlinessMinPhotos[targetIndex]
        if (cleanlinessMaxPhotos[targetIndex] !== undefined) newCleanlinessMaxPhotos[sectionIndex] = cleanlinessMaxPhotos[targetIndex]
        if (cleanlinessAreasStr[targetIndex] !== undefined) newCleanlinessAreasStr[sectionIndex] = cleanlinessAreasStr[targetIndex]
      }
    }
    
    setSectionTitles(newSectionTitles)
    setItemDescriptions(newDescriptions)
    setItemExpectedValues(newExpectedValues)
    setItemTolerances(newTolerances)
    setEvidenceDescriptions(newEvidenceDescriptions)
    setEvidenceMinPhotos(newEvidenceMinPhotos)
    setEvidenceMaxPhotos(newEvidenceMaxPhotos)
    setCleanlinessMinPhotos(newCleanlinessMinPhotos)
    setCleanlinessMaxPhotos(newCleanlinessMaxPhotos)
    setCleanlinessAreasStr(newCleanlinessAreasStr)
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
          ;['min', 'max'].forEach(suffix => {
            const key = `${idx}-${suffix}`
            if (evidenceConfigTimeouts.current[key]) {
              clearTimeout(evidenceConfigTimeouts.current[key])
              delete evidenceConfigTimeouts.current[key]
            }
          })
        }
        if (section.cleanliness_config) {
          ;['min', 'max', 'areas'].forEach(suffix => {
            const key = `${idx}-${suffix}`
            if (cleanlinessConfigTimeouts.current[key]) {
              clearTimeout(cleanlinessConfigTimeouts.current[key])
              delete cleanlinessConfigTimeouts.current[key]
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
    const newEvidenceMinPhotos = { ...evidenceMinPhotos }
    const newEvidenceMaxPhotos = { ...evidenceMaxPhotos }
    const newCleanlinessMinPhotos = { ...cleanlinessMinPhotos }
    const newCleanlinessMaxPhotos = { ...cleanlinessMaxPhotos }
    const newCleanlinessAreasStr = { ...cleanlinessAreasStr }
    
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
          delete newEvidenceMinPhotos[index]
          delete newEvidenceMaxPhotos[index]
        }
        if (section.cleanliness_config) {
          delete newCleanlinessMinPhotos[index]
          delete newCleanlinessMaxPhotos[index]
          delete newCleanlinessAreasStr[index]
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
        if (evidenceMinPhotos[sectionIndex] !== undefined) newEvidenceMinPhotos[targetIndex] = evidenceMinPhotos[sectionIndex]
        if (evidenceMaxPhotos[sectionIndex] !== undefined) newEvidenceMaxPhotos[targetIndex] = evidenceMaxPhotos[sectionIndex]
      }
      if (currentSection.cleanliness_config) {
        if (cleanlinessMinPhotos[sectionIndex] !== undefined) newCleanlinessMinPhotos[targetIndex] = cleanlinessMinPhotos[sectionIndex]
        if (cleanlinessMaxPhotos[sectionIndex] !== undefined) newCleanlinessMaxPhotos[targetIndex] = cleanlinessMaxPhotos[sectionIndex]
        if (cleanlinessAreasStr[sectionIndex] !== undefined) newCleanlinessAreasStr[targetIndex] = cleanlinessAreasStr[sectionIndex]
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
        if (evidenceMinPhotos[targetIndex] !== undefined) newEvidenceMinPhotos[sectionIndex] = evidenceMinPhotos[targetIndex]
        if (evidenceMaxPhotos[targetIndex] !== undefined) newEvidenceMaxPhotos[sectionIndex] = evidenceMaxPhotos[targetIndex]
      }
      if (targetSection.cleanliness_config) {
        if (cleanlinessMinPhotos[targetIndex] !== undefined) newCleanlinessMinPhotos[sectionIndex] = cleanlinessMinPhotos[targetIndex]
        if (cleanlinessMaxPhotos[targetIndex] !== undefined) newCleanlinessMaxPhotos[sectionIndex] = cleanlinessMaxPhotos[targetIndex]
        if (cleanlinessAreasStr[targetIndex] !== undefined) newCleanlinessAreasStr[sectionIndex] = cleanlinessAreasStr[targetIndex]
      }
    }
    
    setSectionTitles(newSectionTitles)
    setItemDescriptions(newDescriptions)
    setItemExpectedValues(newExpectedValues)
    setItemTolerances(newTolerances)
    setEvidenceDescriptions(newEvidenceDescriptions)
    setEvidenceMinPhotos(newEvidenceMinPhotos)
    setEvidenceMaxPhotos(newEvidenceMaxPhotos)
    setCleanlinessMinPhotos(newCleanlinessMinPhotos)
    setCleanlinessMaxPhotos(newCleanlinessMaxPhotos)
    setCleanlinessAreasStr(newCleanlinessAreasStr)
  }

  const handleSectionTypeChange = (sectionIndex: number, newType: 'checklist' | 'evidence' | 'cleanliness_bonus' | 'security_talk') => {
    const section = template.sections[sectionIndex]
    const wouldLoseItems = (newType === 'evidence' || newType === 'security_talk') && (section?.items?.length ?? 0) > 0
    if (wouldLoseItems) {
      setSectionTypeChangeConfirm({ sectionIndex, newType })
    } else {
      updateSectionType(sectionIndex, newType)
    }
  }

  const updateSectionType = useCallback((sectionIndex: number, newType: 'checklist' | 'evidence' | 'cleanliness_bonus' | 'security_talk') => {
    setTemplate(prev => {
      const section = prev.sections[sectionIndex]
      const updates: Partial<ChecklistSection> = {
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
        } : section?.cleanliness_config,
        security_config: newType === 'security_talk' ? {
          mode: 'plant_manager',
          require_attendance: true,
          require_topic: true,
          require_reflection: true,
          allow_evidence: false
        } : section?.security_config,
        items: newType === 'evidence' || newType === 'security_talk' ? [] : (section?.items ?? [])
      }
      const newSections = prev.sections.map((s, i) => i === sectionIndex ? { ...s, ...updates } : s)
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
  }, [])

  // Item functions (functional setState to avoid stale closure)
  const addItem = useCallback((sectionIndex: number) => {
    setTemplate(prev => {
      const section = prev.sections[sectionIndex]
      if (!section) return prev
      const newItem: ChecklistItem = {
        _clientId: crypto.randomUUID(),
        description: 'Nuevo Item',
        required: true,
        order_index: section.items.length,
        item_type: 'check'
      }
      const newSections = [...prev.sections]
      newSections[sectionIndex] = { ...section, items: [...section.items, newItem] }
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
  }, [])

  const updateItem = useCallback((sectionIndex: number, itemIndex: number, updates: Partial<ChecklistItem>) => {
    setTemplate(prev => {
      const section = prev.sections[sectionIndex]
      if (!section) return prev
      const updatedItems = section.items.map((item, index) =>
        index === itemIndex ? { ...item, ...updates } : item
      )
      const newSections = [...prev.sections]
      newSections[sectionIndex] = { ...section, items: updatedItems }
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
  }, [])

  const deleteItem = (sectionIndex: number, itemIndex: number) => {
    const key = `${sectionIndex}-${itemIndex}`
    if (descriptionTimeouts.current[key]) {
      clearTimeout(descriptionTimeouts.current[key])
      delete descriptionTimeouts.current[key]
    }
    
    const section = template.sections[sectionIndex]
    for (let i = itemIndex; i < section.items.length; i++) {
      const currentKey = `${sectionIndex}-${i}`
      const expectedKey = `${currentKey}-expected`
      const toleranceKey = `${currentKey}-tolerance`
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
    
    startTransition(() => {
      const updatedItems = section.items.filter((_, index) => index !== itemIndex)
      updateSection(sectionIndex, { items: updatedItems })
      setHasChanges(true)
      
      const newDescriptions = { ...itemDescriptions }
      const newExpectedValues = { ...itemExpectedValues }
      const newTolerances = { ...itemTolerances }
      for (let i = itemIndex; i < section.items.length; i++) {
        const oldKey = `${sectionIndex}-${i}`
        delete newDescriptions[oldKey]
        delete newExpectedValues[oldKey]
        delete newTolerances[oldKey]
      }
      for (let i = itemIndex + 1; i < section.items.length; i++) {
        const oldKey = `${sectionIndex}-${i}`
        const newKey = `${sectionIndex}-${i - 1}`
        if (itemDescriptions[oldKey] !== undefined) newDescriptions[newKey] = itemDescriptions[oldKey]
        if (itemExpectedValues[oldKey] !== undefined) newExpectedValues[newKey] = itemExpectedValues[oldKey]
        if (itemTolerances[oldKey] !== undefined) newTolerances[newKey] = itemTolerances[oldKey]
      }
      setItemDescriptions(newDescriptions)
      setItemExpectedValues(newExpectedValues)
      setItemTolerances(newTolerances)
    })
  }

  // Evidence functions
  const updateEvidenceConfig = useCallback((sectionIndex: number, config: Partial<EvidenceConfig>) => {
    setTemplate(prev => {
      const section = prev.sections[sectionIndex]
      if (!section?.evidence_config) return prev
      const newSections = [...prev.sections]
      newSections[sectionIndex] = {
        ...section,
        evidence_config: { ...section.evidence_config, ...config }
      }
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
  }, [])

  const addEvidenceCategory = useCallback((sectionIndex: number, category: string) => {
    setTemplate(prev => {
      const section = prev.sections[sectionIndex]
      if (!section?.evidence_config || section.evidence_config.categories.includes(category)) return prev
      const newSections = [...prev.sections]
      newSections[sectionIndex] = {
        ...section,
        evidence_config: {
          ...section.evidence_config,
          categories: [...section.evidence_config.categories, category],
          descriptions: {
            ...section.evidence_config.descriptions,
            [category]: `Instrucciones para ${category.toLowerCase()}`
          }
        }
      }
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
  }, [])

  const removeEvidenceCategory = useCallback((sectionIndex: number, category: string) => {
    setTemplate(prev => {
      const section = prev.sections[sectionIndex]
      if (!section?.evidence_config) return prev
      const newDescriptions = { ...section.evidence_config.descriptions }
      delete newDescriptions[category]
      const newSections = [...prev.sections]
      newSections[sectionIndex] = {
        ...section,
        evidence_config: {
          categories: section.evidence_config.categories.filter(c => c !== category),
          descriptions: newDescriptions
        }
      }
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
  }, [])

  const updateCategoryDescription = useCallback((sectionIndex: number, category: string, description: string) => {
    setTemplate(prev => {
      const section = prev.sections[sectionIndex]
      if (!section?.evidence_config) return prev
      const newSections = [...prev.sections]
      newSections[sectionIndex] = {
        ...section,
        evidence_config: {
          ...section.evidence_config,
          descriptions: { ...section.evidence_config.descriptions, [category]: description }
        }
      }
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
  }, [])

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

  const updateEvidenceMinPhotosLocal = (sectionIndex: number, value: number) => {
    setEvidenceMinPhotos(prev => ({ ...prev, [sectionIndex]: value }))
    const key = `${sectionIndex}-min`
    if (evidenceConfigTimeouts.current[key]) clearTimeout(evidenceConfigTimeouts.current[key])
    evidenceConfigTimeouts.current[key] = setTimeout(() => {
      updateEvidenceConfig(sectionIndex, { min_photos: value })
      delete evidenceConfigTimeouts.current[key]
    }, 400)
  }

  const updateEvidenceMaxPhotosLocal = (sectionIndex: number, value: number) => {
    setEvidenceMaxPhotos(prev => ({ ...prev, [sectionIndex]: value }))
    const key = `${sectionIndex}-max`
    if (evidenceConfigTimeouts.current[key]) clearTimeout(evidenceConfigTimeouts.current[key])
    evidenceConfigTimeouts.current[key] = setTimeout(() => {
      updateEvidenceConfig(sectionIndex, { max_photos: value })
      delete evidenceConfigTimeouts.current[key]
    }, 400)
  }

  const updateCleanlinessMinPhotosLocal = (sectionIndex: number, value: number) => {
    setCleanlinessMinPhotos(prev => ({ ...prev, [sectionIndex]: value }))
    const key = `${sectionIndex}-min`
    if (cleanlinessConfigTimeouts.current[key]) clearTimeout(cleanlinessConfigTimeouts.current[key])
    cleanlinessConfigTimeouts.current[key] = setTimeout(() => {
      setTemplate(prev => {
        const section = prev.sections[sectionIndex]
        if (!section?.cleanliness_config) return prev
        const newSections = [...prev.sections]
        newSections[sectionIndex] = {
          ...section,
          cleanliness_config: {
            ...section.cleanliness_config,
            min_photos: value,
            max_photos: section.cleanliness_config.max_photos ?? 4
          }
        }
        return { ...prev, sections: newSections }
      })
      setHasChanges(true)
      delete cleanlinessConfigTimeouts.current[key]
    }, 400)
  }

  const updateCleanlinessMaxPhotosLocal = (sectionIndex: number, value: number) => {
    setCleanlinessMaxPhotos(prev => ({ ...prev, [sectionIndex]: value }))
    const key = `${sectionIndex}-max`
    if (cleanlinessConfigTimeouts.current[key]) clearTimeout(cleanlinessConfigTimeouts.current[key])
    cleanlinessConfigTimeouts.current[key] = setTimeout(() => {
      setTemplate(prev => {
        const section = prev.sections[sectionIndex]
        if (!section?.cleanliness_config) return prev
        const newSections = [...prev.sections]
        newSections[sectionIndex] = {
          ...section,
          cleanliness_config: {
            ...section.cleanliness_config,
            min_photos: section.cleanliness_config.min_photos ?? 2,
            max_photos: value
          }
        }
        return { ...prev, sections: newSections }
      })
      setHasChanges(true)
      delete cleanlinessConfigTimeouts.current[key]
    }, 400)
  }

  const updateCleanlinessAreasLocal = (sectionIndex: number, value: string) => {
    setCleanlinessAreasStr(prev => ({ ...prev, [sectionIndex]: value }))
    const key = `${sectionIndex}-areas`
    if (cleanlinessConfigTimeouts.current[key]) clearTimeout(cleanlinessConfigTimeouts.current[key])
    cleanlinessConfigTimeouts.current[key] = setTimeout(() => {
      const areas = value.split(',').map(a => a.trim()).filter(a => a.length > 0)
      setTemplate(prev => {
        const section = prev.sections[sectionIndex]
        if (!section?.cleanliness_config) return prev
        const newSections = [...prev.sections]
        newSections[sectionIndex] = {
          ...section,
          cleanliness_config: {
            ...section.cleanliness_config,
            areas: areas.length > 0 ? areas : ['Interior', 'Exterior']
          }
        }
        return { ...prev, sections: newSections }
      })
      setHasChanges(true)
      delete cleanlinessConfigTimeouts.current[key]
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

      // Clear any pending evidence description timeouts (Bug B fix: split on first hyphen only - categories can contain hyphens/spaces)
      Object.entries(evidenceTimeouts.current).forEach(([key, timeout]) => {
        clearTimeout(timeout)
        const firstDash = key.indexOf('-')
        const sectionIndexStr = key.slice(0, firstDash)
        const category = key.slice(firstDash + 1)
        const sectionIndex = parseInt(sectionIndexStr)
        const description = evidenceDescriptions[key]
        if (description && template.sections[sectionIndex]?.evidence_config) {
          template.sections[sectionIndex].evidence_config!.descriptions[category] = description
        }
      })

      // Clear any pending item field timeouts (Bug A fix: keys are "0-1-expected"/"0-1-tolerance" but state uses "0-1")
      Object.entries(itemFieldTimeouts.current).forEach(([key, timeout]) => {
        clearTimeout(timeout)
        const baseKey = key.replace(/-expected$|-tolerance$/, '')
        const [sectionIndexStr, itemIndexStr] = baseKey.split('-')
        const sectionIndex = parseInt(sectionIndexStr)
        const itemIndex = parseInt(itemIndexStr)
        const expectedValue = key.endsWith('-expected') ? itemExpectedValues[baseKey] : undefined
        const tolerance = key.endsWith('-tolerance') ? itemTolerances[baseKey] : undefined

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

      // Clear any pending evidence config timeouts (min/max photos)
      Object.entries(evidenceConfigTimeouts.current).forEach(([key, timeout]) => {
        clearTimeout(timeout)
        const sectionIndex = parseInt(key.replace(/-min$|-max$/, ''))
        const section = template.sections[sectionIndex]?.evidence_config
        if (section) {
          if (key.endsWith('-min') && sectionIndex in evidenceMinPhotos) {
            template.sections[sectionIndex].evidence_config!.min_photos = evidenceMinPhotos[sectionIndex]
          }
          if (key.endsWith('-max') && sectionIndex in evidenceMaxPhotos) {
            template.sections[sectionIndex].evidence_config!.max_photos = evidenceMaxPhotos[sectionIndex]
          }
        }
        delete evidenceConfigTimeouts.current[key]
      })

      // Clear any pending cleanliness config timeouts
      Object.entries(cleanlinessConfigTimeouts.current).forEach(([key, timeout]) => {
        clearTimeout(timeout)
        const sectionIndex = parseInt(key.replace(/-min$|-max$|-areas$/, ''))
        const section = template.sections[sectionIndex]?.cleanliness_config
        if (section) {
          if (key.endsWith('-min') && sectionIndex in cleanlinessMinPhotos) {
            template.sections[sectionIndex].cleanliness_config!.min_photos = cleanlinessMinPhotos[sectionIndex]
          }
          if (key.endsWith('-max') && sectionIndex in cleanlinessMaxPhotos) {
            template.sections[sectionIndex].cleanliness_config!.max_photos = cleanlinessMaxPhotos[sectionIndex]
          }
          if (key.endsWith('-areas') && sectionIndex in cleanlinessAreasStr) {
            const areas = cleanlinessAreasStr[sectionIndex].split(',').map(a => a.trim()).filter(a => a.length > 0)
            template.sections[sectionIndex].cleanliness_config!.areas = areas.length > 0 ? areas : ['Interior', 'Exterior']
          }
        }
        delete cleanlinessConfigTimeouts.current[key]
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

      const errors = validateTemplate()
      if (errors.length > 0) {
        setValidationErrors(errors)
        toast({
          title: 'Corrige los siguientes errores',
          description: errors.join('. '),
          variant: 'destructive'
        })
        setSaving(false)
        return
      }
      setValidationErrors([])

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
              cleanliness_config: section.cleanliness_config || null,
              security_config: section.security_config || null
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
              cleanliness_config: section.cleanliness_config || null,
              security_config: section.security_config || null
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

  const onModelChange = useCallback((value: string) => {
    setTemplate(prev => ({ ...prev, model_id: value }))
    setHasChanges(true)
  }, [])

  const onFrequencyChange = useCallback((value: string) => {
    setTemplate(prev => ({ ...prev, frequency: value }))
    setHasChanges(true)
  }, [])

  const onHoursIntervalChange = useCallback((value: number | undefined) => {
    setTemplate(prev => ({ ...prev, hours_interval: value }))
    setHasChanges(true)
  }, [])

  const updateSecurityConfig = useCallback((sectionIndex: number, updates: Partial<SecurityConfig>) => {
    setTemplate(prev => {
      const section = prev.sections[sectionIndex]
      if (!section) return prev
      const currentConfig = section.security_config || {
        mode: 'plant_manager',
        require_attendance: true,
        require_topic: true,
        require_reflection: true,
        allow_evidence: false
      }
      const newSections = [...prev.sections]
      newSections[sectionIndex] = {
        ...section,
        security_config: { ...currentConfig, ...updates }
      }
      return { ...prev, sections: newSections }
    })
    setHasChanges(true)
  }, [])

  const renderSecuritySection = (section: ChecklistSection, sectionIndex: number) => {
    const config = section.security_config || {
      mode: 'plant_manager',
      require_attendance: true,
      require_topic: true,
      require_reflection: true,
      allow_evidence: false
    }
    
    return (
      <div className="space-y-4 border-l-4 border-orange-500 pl-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-orange-600" />
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            Sección de Charla de Seguridad
          </Badge>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Modo de Uso</Label>
            <Select
              value={config.mode}
              onValueChange={(value: 'plant_manager' | 'operator') => 
                updateSecurityConfig(sectionIndex, { mode: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plant_manager">Jefe de Planta / Dosificador</SelectItem>
                <SelectItem value="operator">Operador</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {config.mode === 'plant_manager' 
                ? 'Permite registrar lista de asistentes (operadores de la planta)'
                : 'Permite registrar asistencia individual del operador'}
            </p>
          </div>

          <div className="space-y-3 border-t pt-3">
            <Label className="text-sm font-semibold">Campos Requeridos</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`attendance-${sectionIndex}`} className="text-sm font-normal">
                  {config.mode === 'plant_manager' ? 'Lista de Asistentes' : 'Asistencia'}
                </Label>
                <Switch
                  id={`attendance-${sectionIndex}`}
                  checked={config.require_attendance}
                  onCheckedChange={(checked) => 
                    updateSecurityConfig(sectionIndex, { require_attendance: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor={`topic-${sectionIndex}`} className="text-sm font-normal">
                  Tema Cubierto
                </Label>
                <Switch
                  id={`topic-${sectionIndex}`}
                  checked={config.require_topic}
                  onCheckedChange={(checked) => 
                    updateSecurityConfig(sectionIndex, { require_topic: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor={`reflection-${sectionIndex}`} className="text-sm font-normal">
                  Reflexión
                </Label>
                <Switch
                  id={`reflection-${sectionIndex}`}
                  checked={config.require_reflection}
                  onCheckedChange={(checked) => 
                    updateSecurityConfig(sectionIndex, { require_reflection: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor={`evidence-${sectionIndex}`} className="text-sm font-normal">
                  Permitir Evidencia Fotográfica
                </Label>
                <Switch
                  id={`evidence-${sectionIndex}`}
                  checked={config.allow_evidence}
                  onCheckedChange={(checked) => 
                    updateSecurityConfig(sectionIndex, { allow_evidence: checked })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
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
              value={evidenceMinPhotos[sectionIndex] ?? config.min_photos}
              onChange={(e) => updateEvidenceMinPhotosLocal(sectionIndex, parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-2">
            <Label>Máximo de Fotos</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={evidenceMaxPhotos[sectionIndex] ?? config.max_photos}
              onChange={(e) => updateEvidenceMaxPhotosLocal(sectionIndex, parseInt(e.target.value) || 5)}
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
            {config.categories.map((category) => (
              <div key={category} className="border rounded-lg p-3 bg-gray-50">
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
                    value={(`${sectionIndex}-${category}` in evidenceDescriptions) ? evidenceDescriptions[`${sectionIndex}-${category}`] : (config.descriptions[category] ?? '')}
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
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
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
          <Button
            variant="outline"
            onClick={() => (hasChanges ? setShowCancelConfirm(true) : onCancel?.())}
          >
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

      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <BasicInfoCard
        templateName={templateName}
        templateDescription={templateDescription}
        name={template.name}
        description={template.description}
        modelId={template.model_id}
        frequency={template.frequency}
        hoursInterval={template.hours_interval}
        models={models}
        onNameChange={updateTemplateNameLocal}
        onDescriptionChange={updateTemplateDescriptionLocal}
        onModelChange={onModelChange}
        onFrequencyChange={onFrequencyChange}
        onHoursIntervalChange={onHoursIntervalChange}
      />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h3 className="text-lg font-semibold">Secciones del Checklist</h3>
          <div className="flex gap-2 flex-wrap">
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar sección
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={addSection}>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Checklist Normal
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={addEvidenceSection}>
                    <Camera className="h-4 w-4 mr-2" />
                    Evidencia Fotográfica
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={addCleanlinessSection}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Verificación de Limpieza
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={addSecuritySection}>
                    <Shield className="h-4 w-4 mr-2" />
                    Charla de Seguridad
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="hidden md:flex gap-2">
              <Button variant="outline" size="sm" onClick={addSection}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Checklist
              </Button>
              <Button variant="outline" size="sm" onClick={addEvidenceSection} className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                <Camera className="h-4 w-4 mr-2" />
                Evidencia
              </Button>
              <Button variant="outline" size="sm" onClick={addCleanlinessSection} className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                <Sparkles className="h-4 w-4 mr-2" />
                Limpieza
              </Button>
              <Button variant="outline" size="sm" onClick={addSecuritySection} className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100">
                <Shield className="h-4 w-4 mr-2" />
                Seguridad
              </Button>
            </div>
          </div>
        </div>

        {template.sections.map((section, sectionIndex) => (
          <Card key={section.id ?? section._clientId ?? sectionIndex} className={`[content-visibility:auto] [contain-intrinsic-size:auto_120px] ${
            section.section_type === 'evidence' ? 'border-blue-200 bg-blue-50/50' : 
            section.section_type === 'cleanliness_bonus' ? 'border-green-200 bg-green-50/50' :
            section.section_type === 'security_talk' ? 'border-orange-200 bg-orange-50/50' : ''
          }`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <Select
                      value={section.section_type || 'checklist'}
                      onValueChange={(value: 'checklist' | 'evidence' | 'cleanliness_bonus' | 'security_talk') => handleSectionTypeChange(sectionIndex, value)}
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
                        <SelectItem value="security_talk">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Charla de Seguridad
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    value={sectionIndex in sectionTitles ? sectionTitles[sectionIndex] : section.title}
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
              ) : section.section_type === 'security_talk' ? (
                renderSecuritySection(section, sectionIndex)
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
                      <div key={item.id ?? item._clientId ?? itemIndex} className="border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              {getItemTypeIcon(item.item_type)}
                              <Input
                                value={(`${sectionIndex}-${itemIndex}` in itemDescriptions) ? itemDescriptions[`${sectionIndex}-${itemIndex}`] : item.description}
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
                                    value={(`${sectionIndex}-${itemIndex}` in itemExpectedValues) ? itemExpectedValues[`${sectionIndex}-${itemIndex}`] : (item.expected_value ?? '')}
                                    onChange={(e) => updateItemExpectedValueLocal(sectionIndex, itemIndex, e.target.value)}
                                    placeholder="Valor esperado"
                                  />
                                  <Input
                                    value={(`${sectionIndex}-${itemIndex}` in itemTolerances) ? itemTolerances[`${sectionIndex}-${itemIndex}`] : (item.tolerance ?? '')}
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
                          value={cleanlinessMinPhotos[sectionIndex] ?? section.cleanliness_config?.min_photos ?? 2}
                          onChange={(e) => updateCleanlinessMinPhotosLocal(sectionIndex, parseInt(e.target.value) || 2)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fotos Máximas</Label>
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          value={cleanlinessMaxPhotos[sectionIndex] ?? section.cleanliness_config?.max_photos ?? 4}
                          onChange={(e) => updateCleanlinessMaxPhotosLocal(sectionIndex, parseInt(e.target.value) || 4)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Áreas de Evidencia</Label>
                      <Textarea
                        value={cleanlinessAreasStr[sectionIndex] ?? section.cleanliness_config?.areas.join(', ') ?? ''}
                        onChange={(e) => updateCleanlinessAreasLocal(sectionIndex, e.target.value)}
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
                    <div key={item.id ?? item._clientId ?? itemIndex} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            {getItemTypeIcon(item.item_type)}
                            <Input
                              value={(`${sectionIndex}-${itemIndex}` in itemDescriptions) ? itemDescriptions[`${sectionIndex}-${itemIndex}`] : item.description}
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
                                  value={(`${sectionIndex}-${itemIndex}` in itemExpectedValues) ? itemExpectedValues[`${sectionIndex}-${itemIndex}`] : (item.expected_value ?? '')}
                                  onChange={(e) => updateItemExpectedValueLocal(sectionIndex, itemIndex, e.target.value)}
                                  placeholder="Valor esperado"
                                />
                                <Input
                                  value={(`${sectionIndex}-${itemIndex}` in itemTolerances) ? itemTolerances[`${sectionIndex}-${itemIndex}`] : (item.tolerance ?? '')}
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

      <Dialog
        open={!!sectionTypeChangeConfirm}
        onOpenChange={(open) => !open && setSectionTypeChangeConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cambiar tipo de sección?</DialogTitle>
            <DialogDescription>
              Al cambiar a este tipo de sección se eliminarán los ítems actuales. ¿Continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionTypeChangeConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (sectionTypeChangeConfirm) {
                  updateSectionType(sectionTypeChangeConfirm.sectionIndex, sectionTypeChangeConfirm.newType)
                  setSectionTypeChangeConfirm(null)
                }
              }}
            >
              Cambiar tipo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Salir sin guardar?</DialogTitle>
            <DialogDescription>
              Tienes cambios sin guardar. ¿Estás seguro de que deseas salir sin guardar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>
              Permanecer
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowCancelConfirm(false)
                onCancel?.()
              }}
            >
              Salir sin guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VersionHistoryDialog
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        templateName={template.name}
        versions={versions}
        onViewVersion={(version) => {
          setPreviewVersion(version)
          setShowVersionHistory(false)
          setShowPreview(true)
        }}
        onRestoreVersion={async (version) => {
          try {
            const res = await fetch('/api/checklists/templates/restore-version', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ version_id: version.id })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al restaurar')
            toast({ title: 'Versión restaurada', description: 'La plantilla se ha restaurado correctamente', variant: 'default' })
            await loadTemplate()
            await loadVersionHistory()
            setShowVersionHistory(false)
          } catch (err) {
            toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' })
          }
        }}
      />

      <ChangeSummaryDialog
        open={showChangeSummaryDialog}
        onOpenChange={(open) => {
          setShowChangeSummaryDialog(open)
          if (!open) setChangeSummary('')
        }}
        changeSummary={changeSummary}
        onChangeSummary={setChangeSummary}
        onSave={() => {
          setShowChangeSummaryDialog(false)
          saveTemplate()
        }}
        saving={saving}
      />

      <TemplatePreviewDialog
        open={showPreview}
        onOpenChange={(open) => {
          setShowPreview(open)
          if (!open) setPreviewVersion(null)
        }}
        template={previewVersion
          ? { name: previewVersion.name, sections: (previewVersion.sections as ChecklistSection[]) || [] }
          : template
        }
      />
    </div>
  )
} 