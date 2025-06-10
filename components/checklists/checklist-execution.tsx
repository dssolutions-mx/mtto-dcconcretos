"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  Camera, 
  Check, 
  Clock, 
  FileText, 
  Flag, 
  Loader2, 
  Save, 
  Upload, 
  X, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Menu,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Target,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  List,
  Minimize2,
  Maximize2
} from "lucide-react"
import { SignatureCanvas } from "@/components/checklists/signature-canvas"
import { EnhancedOfflineStatus } from "@/components/checklists/enhanced-offline-status"
import { EquipmentReadingsForm } from "@/components/checklists/equipment-readings-form"
import { EvidenceCaptureSection } from "@/components/checklists/evidence-capture-section"
import { CorrectiveWorkOrderDialog } from "@/components/checklists/corrective-work-order-dialog"
import { SmartPhotoUpload } from "@/components/checklists/smart-photo-upload"
import { useOfflineSync } from "@/hooks/useOfflineSync"
import { toast } from "sonner"
import { createBrowserClient } from '@supabase/ssr'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// Importación dinámica del servicio offline para evitar problemas de SSR
let offlineChecklistService: any = null

interface ChecklistExecutionProps {
  id: string
}

interface SectionProgress {
  id: string
  title: string
  type: 'checklist' | 'evidence'
  total: number
  completed: number
  hasIssues: boolean
  isCollapsed: boolean
}

export function ChecklistExecution({ id }: ChecklistExecutionProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [checklist, setChecklist] = useState<any>(null)
  
  const [itemStatus, setItemStatus] = useState<Record<string, "pass" | "flag" | "fail" | null>>({})
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({})
  const [itemPhotos, setItemPhotos] = useState<Record<string, string | null>>({})
  const [notes, setNotes] = useState('')
  const [technician, setTechnician] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [showCorrective, setShowCorrective] = useState(false)
  const [correctiveDialogOpen, setCorrectiveDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [completedChecklistId, setCompletedChecklistId] = useState<string | null>(null)
  
  // Estados para lecturas de equipo
  const [equipmentReadings, setEquipmentReadings] = useState<{
    hours_reading?: number | null
    kilometers_reading?: number | null
  }>({})
  
  // Estados para evidencias fotográficas
  const [evidenceData, setEvidenceData] = useState<Record<string, any[]>>({})
  
  // Section Navigation States
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({})
  const [autoCollapseCompleted, setAutoCollapseCompleted] = useState(false)
  
  // Usar el nuevo hook para estado offline
  const { isOnline, hasPendingSyncs } = useOfflineSync()
  
  // Estados para auto-guardar
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isLoadingFromStorage, setIsLoadingFromStorage] = useState(false)
  const hasUnsavedChangesRef = useRef(false)

  // Remove this useEffect that was causing the infinite loop

  // Inicializar servicio offline solo cuando sea necesario
  useEffect(() => {
    if (typeof window !== 'undefined' && !offlineChecklistService) {
      import('@/lib/services/offline-checklist-service').then(module => {
        offlineChecklistService = module.offlineChecklistService
      })
    }
  }, [])

  // Auto-guardar cambios cada 30 segundos si hay cambios no guardados
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const autoSaveInterval = setInterval(() => {
      if (hasUnsavedChanges && checklist) {
        saveToLocalStorage()
      }
    }, 30000)
    
    return () => clearInterval(autoSaveInterval)
  }, [hasUnsavedChanges, !!checklist])

  // Enhanced Section Progress Calculation
  const getSectionProgress = useCallback((): SectionProgress[] => {
    if (!checklist?.sections) return []
    
    return checklist.sections.map((section: any) => {
      if (section.section_type === 'evidence') {
        const sectionEvidences = evidenceData[section.id] || []
        const config = section.evidence_config || {}
        const requiredPhotos = (config.categories || []).length * (config.min_photos || 1)
        
        return {
          id: section.id,
          title: section.title,
          type: 'evidence' as const,
          total: requiredPhotos,
          completed: sectionEvidences.length,
          hasIssues: sectionEvidences.some(e => e.status === 'failed'),
          isCollapsed: sectionCollapsed[section.id] || false
        }
      } else {
        const items = section.checklist_items || section.items || []
        const completed = items.filter((item: any) => itemStatus[item.id]).length
        const hasIssues = items.some((item: any) => 
          itemStatus[item.id] === 'flag' || itemStatus[item.id] === 'fail'
        )
        
        return {
          id: section.id,
          title: section.title,
          type: 'checklist' as const,
          total: items.length,
          completed,
          hasIssues,
          isCollapsed: sectionCollapsed[section.id] || false
        }
      }
    })
  }, [checklist, itemStatus, evidenceData, sectionCollapsed])

  // Auto-collapse completed sections when enabled
  useEffect(() => {
    if (!autoCollapseCompleted) return
    
    const sectionProgress = getSectionProgress()
    const newCollapsed = { ...sectionCollapsed }
    
    sectionProgress.forEach(section => {
      if (section.completed === section.total && section.total > 0) {
        newCollapsed[section.id] = true
      }
    })
    
    setSectionCollapsed(newCollapsed)
  }, [itemStatus, evidenceData, autoCollapseCompleted, getSectionProgress])

  // Scroll to section functionality
  const scrollToSection = useCallback((sectionId: string) => {
    // First expand the section if it's collapsed
    if (sectionCollapsed[sectionId]) {
      setSectionCollapsed(prev => ({ ...prev, [sectionId]: false }))
    }
    
    // Use setTimeout to ensure the section is expanded before scrolling
    setTimeout(() => {
      const element = document.getElementById(`section-${sectionId}`)
      if (element) {
        // Get the navigation header height to account for sticky positioning
        const navHeader = document.querySelector('[data-navigation-header]')
        const headerOffset = navHeader ? navHeader.getBoundingClientRect().height + 20 : 100
        
        // Calculate the target position
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
        const targetPosition = elementPosition - headerOffset
        
        // Smooth scroll to the calculated position
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        })
        
        // Section highlighted and navigation completed
        
        // Highlight the section briefly
        element.style.transition = 'box-shadow 0.3s ease'
        element.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)'
        setTimeout(() => {
          element.style.boxShadow = ''
        }, 2000)
      } else {
        console.warn(`Section element not found: section-${sectionId}`)
      }
    }, sectionCollapsed[sectionId] ? 300 : 50) // Wait longer if section was collapsed
  }, [sectionCollapsed])

  // Toggle section collapse
  const toggleSectionCollapse = useCallback((sectionId: string) => {
    setSectionCollapsed(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
    markAsUnsaved()
  }, [])

  // Bulk section operations
  const collapseAllSections = useCallback(() => {
    const newCollapsed: Record<string, boolean> = {}
    checklist?.sections?.forEach((section: any) => {
      newCollapsed[section.id] = true
    })
    setSectionCollapsed(newCollapsed)
    toast.success("Todas las secciones han sido colapsadas")
  }, [checklist])

  const expandAllSections = useCallback(() => {
    setSectionCollapsed({})
    toast.success("Todas las secciones han sido expandidas")
  }, [])

  const collapseCompletedSections = useCallback(() => {
    const sectionProgress = getSectionProgress()
    const newCollapsed: Record<string, boolean> = {}
    
    sectionProgress.forEach(section => {
      if (section.completed === section.total && section.total > 0) {
        newCollapsed[section.id] = true
      }
    })
    
    setSectionCollapsed(newCollapsed)
    toast.success("Secciones completadas han sido colapsadas")
  }, [getSectionProgress])

  // Jump to next incomplete section
  const jumpToNextIncomplete = useCallback(() => {
    const sectionProgress = getSectionProgress()
    const nextIncomplete = sectionProgress.find(section => 
      section.completed < section.total
    )
    
    if (nextIncomplete) {
      scrollToSection(nextIncomplete.id)
      toast.info(`📍 Navegando a: ${nextIncomplete.title}`, {
        description: `${nextIncomplete.completed}/${nextIncomplete.total} completado`,
        duration: 3000
      })
    } else {
      toast.success("🎉 ¡Todas las secciones están completas!", {
        description: "El checklist está listo para ser enviado",
        duration: 4000
      })
    }
  }, [getSectionProgress, scrollToSection])

  // Guardar en localStorage para recuperación
  const saveToLocalStorage = useCallback(() => {
    if (!checklist) return
    
    const saveData = {
      checklist,
      itemStatus,
      itemNotes,
      itemPhotos,
      notes,
      technician,
      signature,
      showCorrective,
      selectedItem,
      equipmentReadings,
      evidenceData,
      sectionCollapsed, // Save section collapse state
      timestamp: Date.now()
    }
    
    localStorage.setItem(`checklist-draft-${id}`, JSON.stringify(saveData))
    setHasUnsavedChanges(false)
    hasUnsavedChangesRef.current = false
    setLastSaved(new Date())
    toast.success("Borrador guardado localmente", { duration: 2000 })
  }, [checklist, itemStatus, itemNotes, itemPhotos, notes, technician, signature, showCorrective, selectedItem, equipmentReadings, evidenceData, sectionCollapsed, id])

  // Recuperar datos guardados localmente
  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem(`checklist-draft-${id}`)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        // Solo cargar si los datos tienen menos de 24 horas
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          setIsLoadingFromStorage(true)
          // Batch all state updates to prevent multiple re-renders
          setTimeout(() => {
            setItemStatus(data.itemStatus || {})
            setItemNotes(data.itemNotes || {})
            setItemPhotos(data.itemPhotos || {})
            setNotes(data.notes || "")
            setTechnician(data.technician || "")
            setSignature(data.signature || null)
            setShowCorrective(data.showCorrective || false)
            setSelectedItem(data.selectedItem || null)
            setEquipmentReadings(data.equipmentReadings || {})
            setEvidenceData(data.evidenceData || {})
            setSectionCollapsed(data.sectionCollapsed || {}) // Restore section collapse state
            // Reset unsaved changes flag after loading
            setHasUnsavedChanges(false)
            hasUnsavedChangesRef.current = false
            setIsLoadingFromStorage(false)
          }, 0)
          toast.info("Borrador restaurado desde almacenamiento local")
          return true
        }
      } catch (error) {
        console.error("Error loading saved data:", error)
      }
    }
    return false
  }

  // Moved after markAsUnsaved declaration

  // Validar si las evidencias están completas
  const validateEvidenceRequirements = () => {
    if (!checklist?.sections) return { isValid: true, errors: [] }
    
    const errors: string[] = []
    
    checklist.sections
      .filter((section: any) => section.section_type === 'evidence')
      .forEach((section: any) => {
        const sectionEvidences = evidenceData[section.id] || []
        const config = section.evidence_config || {}
        const minPhotos = config.min_photos || 1
        const categories = config.categories || []
        
        categories.forEach((category: string) => {
          const categoryCount = sectionEvidences.filter(e => e.category === category).length
          if (categoryCount < minPhotos) {
            errors.push(`Se requieren al menos ${minPhotos} fotos para "${category}" en ${section.title}`)
          }
        })
      })
    
    return { isValid: errors.length === 0, errors }
  }

  useEffect(() => {
    const fetchChecklistData = async () => {
      try {
        setLoading(true)
        
        // Cache proactivo inmediato si hay conexión
        if (isOnline && offlineChecklistService) {
          const cacheAttempt = await offlineChecklistService.proactivelyCacheChecklist(id)
          if (cacheAttempt) {
            console.log('✅ Cache proactivo exitoso')
          }
        }
        
        // Intentar cargar desde cache si estamos offline
        if (isOnline === false && offlineChecklistService) {
          const cached = await offlineChecklistService.getCachedChecklistTemplate(id)
          if (cached) {
            // Ordenar secciones e items del cache también
            const cachedSections = cached.template.checklists?.checklist_sections || []
            const orderedCachedSections = cachedSections
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((section: any) => ({
                ...section,
                checklist_items: (section.checklist_items || []).sort((a: any, b: any) => a.order_index - b.order_index)
              }))
            
            setChecklist({
              id: cached.template.id,
              name: cached.template.checklists?.name || '',
              assetId: cached.asset?.id || '',
              assetCode: cached.asset?.asset_id || '',
              asset: cached.asset?.name || '',
              assetLocation: cached.asset?.location || '',
              modelId: cached.template.checklists?.model_id || '',
              model: cached.template.checklists?.equipment_models?.name || 'N/A',
              manufacturer: cached.template.checklists?.equipment_models?.manufacturer || 'N/A',
              frequency: cached.template.checklists?.frequency || '',
              sections: orderedCachedSections,
              scheduledDate: cached.template.scheduled_date || '',
              technicianId: cached.template.assigned_to || '',
              technician: cached.template.profiles ? `${cached.template.profiles.nombre} ${cached.template.profiles.apellido}` : '',
              maintenance_plan_id: cached.template.maintenance_plan_id || null,
              // Información del activo para lecturas
              currentHours: cached.asset?.current_hours || 0,
              currentKilometers: cached.asset?.current_kilometers || 0,
              maintenanceUnit: cached.template.checklists?.equipment_models?.maintenance_unit || 'hours'
            })
            setLoading(false)
            // Call loadFromLocalStorage in the next tick to avoid interference
            setTimeout(() => loadFromLocalStorage(), 0)
            console.log('📱 Checklist cargado desde cache offline')
            return
          } else {
            toast.error("Este checklist no está disponible offline")
            router.back()
            return
          }
        }
        
        // Si hay conexión, cargar desde servidor
        if (isOnline) {
          const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          )
          
          const { data, error } = await supabase
            .from('checklist_schedules')
            .select(`
              *,
              checklists (
                *,
                checklist_sections (
                  *,
                  checklist_items (*)
                ),
                equipment_models (
                  id, 
                  name, 
                  manufacturer,
                  maintenance_unit
                )
              ),
              assets (
                id,
                name,
                asset_id,
                location,
                current_hours,
                current_kilometers
              )
            `)
            .eq('id', id)
            .single()
          
          if (error) throw error
          
          // Estructurar los datos con secciones e items ordenados
          const sectionsData = data.checklists?.checklist_sections || []
          const orderedSections = sectionsData
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((section: any) => ({
              ...section,
              checklist_items: (section.checklist_items || []).sort((a: any, b: any) => a.order_index - b.order_index)
            }))
          
          const checklistData = {
            id: data.id,
            name: data.checklists?.name || '',
            assetId: data.assets?.id || '',
            assetCode: data.assets?.asset_id || '',
            asset: data.assets?.name || '',
            assetLocation: data.assets?.location || '',
            modelId: data.checklists?.model_id || '',
            model: data.checklists?.equipment_models?.name || 'N/A',
            manufacturer: data.checklists?.equipment_models?.manufacturer || 'N/A',
            frequency: data.checklists?.frequency || '',
            sections: orderedSections,
            scheduledDate: data.scheduled_date || '',
            technicianId: data.assigned_to || '',
            maintenance_plan_id: data.maintenance_plan_id || null,
            // Información del activo para lecturas
            currentHours: data.assets?.current_hours || 0,
            currentKilometers: data.assets?.current_kilometers || 0,
            maintenanceUnit: data.checklists?.equipment_models?.maintenance_unit || 'hours'
          }
          
          setChecklist(checklistData)
          
          // Intentar cargar datos guardados in the next tick
          setTimeout(() => loadFromLocalStorage(), 0)
        }
      } catch (error: any) {
        console.error('Error loading checklist data:', error)
        toast.error('Error al cargar el checklist: ' + error.message)
        router.back()
      } finally {
        setLoading(false)
      }
    }

    fetchChecklistData()
  }, [id, isOnline, router])

  // Simple approach: mark as unsaved on any user interaction
  const markAsUnsaved = useCallback(() => {
    if (!isLoadingFromStorage && !hasUnsavedChangesRef.current) {
      setHasUnsavedChanges(true)
      hasUnsavedChangesRef.current = true
    }
  }, [isLoadingFromStorage])

  // Manejar cambios en evidencias - wrapped in useCallback to prevent infinite loops
  const handleEvidenceChange = useCallback((sectionId: string, evidences: any[]) => {
    setEvidenceData(prev => ({
      ...prev,
      [sectionId]: evidences
    }))
    markAsUnsaved()
  }, [markAsUnsaved])

  const handleStatusChange = useCallback((itemId: string, status: "pass" | "flag" | "fail") => {
    setItemStatus(prev => ({ ...prev, [itemId]: status }))
    markAsUnsaved()
  }, [markAsUnsaved])

  const handleItemNotesChange = useCallback((itemId: string, note: string) => {
    setItemNotes(prev => ({ ...prev, [itemId]: note }))
    markAsUnsaved()
  }, [markAsUnsaved])

  const handleEquipmentReadingsChange = useCallback((readings: any) => {
    setEquipmentReadings(readings)
    markAsUnsaved()
  }, [markAsUnsaved])

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value)
    markAsUnsaved()
  }, [markAsUnsaved])

  const handleTechnicianChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTechnician(e.target.value)
    markAsUnsaved()
  }, [markAsUnsaved])

  const handleSignatureChange = useCallback((signature: string | null) => {
    setSignature(signature)
    markAsUnsaved()
  }, [markAsUnsaved])

  const handlePhotoChange = useCallback((itemId: string) => (url: string | null) => {
    setItemPhotos(prev => ({ ...prev, [itemId]: url }))
    markAsUnsaved()
  }, [markAsUnsaved])

  const prepareCompletedItems = useCallback(() => {
    return Object.keys(itemStatus).map(itemId => ({
      item_id: itemId,
      status: itemStatus[itemId],
      notes: itemNotes[itemId] || null,
      photo_url: itemPhotos[itemId] || null
    }))
  }, [itemStatus, itemNotes, itemPhotos])
  
  const handleSubmit = async () => {
    // =====================================================
    // ENHANCED VALIDATION WITH DETAILED NOTIFICATIONS
    // =====================================================
    
    // Collect all validation errors
    const validationErrors: string[] = []
    const validationWarnings: string[] = []

    // 1. Check basic checklist completion
    if (!isChecklistComplete()) {
      // Verificar técnico
      if (!technician?.trim()) {
        validationErrors.push("👤 Nombre del técnico")
      }
      
      // Verificar firma
      if (!signature) {
        validationErrors.push("✍️ Firma del técnico")
      }
      
      // Verificar items sin completar
      const totalItems = getTotalItems()
      const completedItems = getCompletedItems()
      if (completedItems < totalItems) {
        const missingCount = totalItems - completedItems
        validationErrors.push(`📋 ${missingCount} item${missingCount > 1 ? 's' : ''} del checklist sin evaluar`)
        
        // Find specific uncompleted items
        const uncompletedItems: string[] = []
        checklist.sections.forEach((section: any) => {
          const items = section.checklist_items || section.items
          if (items) {
            items.forEach((item: any) => {
              if (!itemStatus[item.id]) {
                uncompletedItems.push(`"${item.description.substring(0, 50)}${item.description.length > 50 ? '...' : ''}"`)
              }
            })
          }
        })
        
        // Show first few incomplete items
        if (uncompletedItems.length > 0) {
          const itemsToShow = uncompletedItems.slice(0, 3)
          validationWarnings.push(`Items pendientes: ${itemsToShow.join(', ')}${uncompletedItems.length > 3 ? ` y ${uncompletedItems.length - 3} más...` : ''}`)
        }
      }
    }

    // 2. Validate evidence requirements
    const evidenceValidation = validateEvidenceRequirements()
    if (!evidenceValidation.isValid) {
      validationErrors.push("📸 Evidencias fotográficas requeridas")
      evidenceValidation.errors.forEach(error => validationWarnings.push(error))
    }

    // 3. Validate equipment readings if present
    if (equipmentReadings.hours_reading !== undefined && equipmentReadings.hours_reading !== null) {
      if (equipmentReadings.hours_reading <= 0) {
        validationErrors.push("⏱️ Lectura de horas inválida (debe ser mayor a 0)")
      } else if (equipmentReadings.hours_reading <= checklist.currentHours) {
        validationWarnings.push(`⚠️ Lectura de horas (${equipmentReadings.hours_reading}) no mayor a la actual (${checklist.currentHours})`)
      }
    }

    if (equipmentReadings.kilometers_reading !== undefined && equipmentReadings.kilometers_reading !== null) {
      if (equipmentReadings.kilometers_reading <= 0) {
        validationErrors.push("📏 Lectura de kilómetros inválida (debe ser mayor a 0)")
      } else if (equipmentReadings.kilometers_reading <= checklist.currentKilometers) {
        validationWarnings.push(`⚠️ Lectura de kilómetros (${equipmentReadings.kilometers_reading}) no mayor a la actual (${checklist.currentKilometers})`)
      }
    }

    // 4. Validate items with issues have proper notes
    const itemsWithIssues = Object.entries(itemStatus)
      .filter(([_, status]) => status === "flag" || status === "fail")
    
    const itemsWithoutNotes = itemsWithIssues.filter(([itemId]) => !itemNotes[itemId]?.trim())
    if (itemsWithoutNotes.length > 0) {
      validationWarnings.push(`💬 ${itemsWithoutNotes.length} problema${itemsWithoutNotes.length > 1 ? 's' : ''} sin notas explicativas`)
    }

    // 5. Check for mandatory preventive maintenance requirements
    if (checklist.maintenance_plan_id) {
      if (validationErrors.length > 0) {
        validationErrors.push("🔧 Checklist de mantenimiento preventivo debe estar 100% completo")
      }
    }

    // =====================================================
    // SHOW VALIDATION RESULTS
    // =====================================================
    
    if (validationErrors.length > 0) {
      // Show primary error with all missing items
      toast.error("⚠️ No se puede enviar el checklist", {
        description: `Faltan: ${validationErrors.join(", ")}`,
        duration: 8000
      })
      
      // Show warnings as separate toasts
      validationWarnings.forEach((warning, index) => {
        setTimeout(() => {
          toast.warning(warning, { duration: 6000 })
        }, (index + 1) * 500) // Stagger warnings
      })
      
      return
    }

    // Show warnings only if no errors
    if (validationWarnings.length > 0) {
      validationWarnings.forEach((warning, index) => {
        setTimeout(() => {
          toast.warning(warning, { duration: 5000 })
        }, index * 300)
      })
    }

    // =====================================================
    // PROCEED WITH SUBMISSION
    // =====================================================

    if (itemsWithIssues.length > 0) {
      // Complete the checklist first, then show dialog
      toast.info("🔄 Procesando checklist...", {
        description: "Guardando datos y preparando órdenes de trabajo",
        duration: 3000
      })
      
      const completedId = await submitChecklist()
      if (completedId && completedId !== "success" && completedId !== "offline-success") {
        toast.success("✅ Checklist procesado correctamente", {
          description: "Preparando órdenes de trabajo...",
          duration: 3000
        })
        setCompletedChecklistId(completedId)
        setShowCorrective(true)
      } else if (completedId === "success" || completedId === "offline-success") {
        // Handle success case for issues
        toast.success("✅ Checklist guardado exitosamente", {
          description: "Mostrando opciones de acción correctiva...",
          duration: 3000
        })
        setShowCorrective(true)
      } else {
        // Submission failed
        toast.error("❌ No se pudo procesar el checklist", {
          description: "Verifique su conexión e intente nuevamente",
          duration: 5000
        })
      }
      return
    }

    // If no issues, proceed with normal submission
    toast.info("✅ Completando checklist...", {
      description: "No se encontraron problemas",
      duration: 2000
    })
    
    const result = await submitChecklist()
    
    // Navigate after successful submission when no issues
    if (result && result !== null) {
      setCompleted(true)
      
      if (result === "offline-success") {
        // For offline success, show additional confirmation and navigate
        toast.success("✅ Checklist guardado correctamente", {
          description: "Navegando a la lista de activos...",
          duration: 4000
        })
        setTimeout(() => {
          handleNavigateToAssetsPage()
        }, 3000)
      } else {
        // For online success, show confirmation and navigate
        toast.success("🎉 Checklist completado exitosamente", {
          description: "Navegando a la lista de activos...",
          duration: 4000
        })
        
        // Longer delay to ensure message is visible on mobile
        setTimeout(() => {
          handleNavigateToAssetsPage()
        }, 3000)
      }
    } else {
      // Submission failed - error already shown in submitChecklist
      console.log("Checklist submission failed or was cancelled")
    }
  }

  const submitChecklist = async (): Promise<string | null> => {
    setSubmitting(true)
    
    try {
      const completedItems = prepareCompletedItems()
      
      const submissionData = {
        completed_items: completedItems,
        technician: technician || 'Técnico',
        notes,
        signature,
        hours_reading: equipmentReadings.hours_reading || null,
        kilometers_reading: equipmentReadings.kilometers_reading || null,
        evidence_data: evidenceData
      }
      
      if (isOnline) {
        // Create a new endpoint that doesn't auto-create work orders
        const response = await fetch(`/api/checklists/schedules/${id}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submissionData),
        })
        
        if (response.ok) {
          const result = await response.json()
          
          // Limpiar datos locales
          localStorage.removeItem(`checklist-draft-${id}`)
          
          toast.success(result.message || "Checklist completado exitosamente")
          
          // Mostrar información de actualización de lecturas si hubo cambios
          if (result.data?.reading_update && (equipmentReadings.hours_reading || equipmentReadings.kilometers_reading)) {
            const update = result.data.reading_update
            if (update.hours_difference > 0 || update.kilometers_difference > 0) {
              toast.success(
                `Lecturas actualizadas: ${update.hours_difference > 0 ? `+${update.hours_difference}h` : ''} ${update.kilometers_difference > 0 ? `+${update.kilometers_difference}km` : ''}`,
                { duration: 5000 }
              )
            }
          }
          
          // Mostrar información de evidencias si se guardaron
          if (result.data?.evidence_summary?.saved_count > 0) {
            toast.success(
              `Se guardaron ${result.data.evidence_summary.saved_count} evidencias fotográficas`,
              { duration: 5000 }
            )
          }
          
          // Return completed ID - navigation will be handled by the caller
          if (result.data?.completed_id) {
            return result.data.completed_id
          } else {
            // Return a success indicator even if no completed_id
            return "success"
          }
        } else {
          // Enhanced error logging
          const errorText = await response.text()
          console.error('=== CHECKLIST SUBMISSION ERROR ===')
          console.error('Status:', response.status)
          console.error('Status Text:', response.statusText)
          console.error('Response:', errorText)
          console.error('Submission Data:', JSON.stringify(submissionData, null, 2))
          
          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch (e) {
            console.error('Failed to parse error response as JSON:', e)
            toast.error(`Error del servidor: ${response.status} ${response.statusText}`)
            throw new Error(`Server error: ${response.status} ${response.statusText}`)
          }
          
          if (errorData.validation_errors || errorData.validation_warnings) {
            toast.error('Error en las validaciones')
            if (errorData.validation_errors?.length > 0) {
              console.error('Validation errors:', errorData.validation_errors)
              errorData.validation_errors.forEach((error: string) => toast.error(error))
            }
            if (errorData.validation_warnings?.length > 0) {
              console.error('Validation warnings:', errorData.validation_warnings)
              errorData.validation_warnings.forEach((warning: string) => toast.warning(warning))
            }
          } else {
            console.error('General error:', errorData.error || errorData.details)
            toast.error(errorData.error || errorData.details || 'Error al enviar el checklist')
            throw new Error(errorData.error || errorData.details || 'Error al enviar el checklist')
          }
        }
      } else {
        // Guardar offline si no hay conexión
        if (offlineChecklistService) {
          const offlineId = `checklist-${id}-${Date.now()}`
          await offlineChecklistService.saveOfflineChecklist(offlineId, submissionData)
          
          // Limpiar datos locales
          localStorage.removeItem(`checklist-draft-${id}`)
          
          toast.success("📱 Checklist guardado sin conexión", {
            description: "Se sincronizará automáticamente cuando vuelva la conexión",
            duration: 4000
          })
          
          // Return success indicator for offline mode
          return "offline-success"
        } else {
          throw new Error('Servicio offline no disponible')
        }
      }
    } catch (error) {
      console.error('Error al enviar el checklist:', error)
      
      // Provide more specific error feedback
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"
      toast.error("Error al completar el checklist", {
        description: isOnline ? 
          `No se pudo enviar: ${errorMessage}` : 
          "Sin conexión - guardado localmente",
        duration: 5000
      })
      
      // Si falla, guardar offline como respaldo
      if (isOnline && offlineChecklistService) {
        try {
          const offlineId = `checklist-${id}-${Date.now()}`
          const submissionData = {
            scheduleId: id,
            technician: technician || 'Técnico',
            notes,
            signature,
            completed_items: Object.keys(itemStatus).map(itemId => ({
              item_id: itemId,
              status: itemStatus[itemId],
              notes: itemNotes[itemId] || null,
              photo_url: itemPhotos[itemId] || null
            })),
            hours_reading: equipmentReadings.hours_reading || null,
            kilometers_reading: equipmentReadings.kilometers_reading || null,
            evidence_data: evidenceData
          }
          
          await offlineChecklistService.saveOfflineChecklist(offlineId, submissionData)
          toast.success("Checklist guardado localmente como respaldo", {
            description: "Se sincronizará cuando vuelva la conexión",
            duration: 5000
          })
        } catch (offlineError) {
          console.error('Error saving offline backup:', offlineError)
          toast.error("No se pudo guardar respaldo local")
        }
      }
      return null
    } finally {
      setSubmitting(false)
    }
    
    return null
  }

  const prepareCorrectiveAction = () => {
    // Check if there are any items with issues
    const itemsWithIssues = Object.entries(itemStatus)
      .filter(([_, status]) => status === "flag" || status === "fail")
      .map(([itemId]) => {
        const sectionAndItem = findSectionAndItemById(itemId)
        return {
          id: itemId,
          description: sectionAndItem?.item?.description || '',
          notes: itemNotes[itemId] || '',
          photo: itemPhotos[itemId] || null,
          status: itemStatus[itemId],
          sectionTitle: sectionAndItem?.section?.title
        }
      })

    if (itemsWithIssues.length === 0) {
      toast.error("No hay elementos con problemas para generar una orden correctiva")
      return
    }

    setCorrectiveDialogOpen(true)
  }

  const handleWorkOrderCreated = async (workOrderId: string) => {
    // Check if we have offline work order data that needs to be processed
    const offlineData = localStorage.getItem(`offline-work-orders-${id}`)
    if (offlineData && isOnline) {
      try {
        // Process offline work orders when connection is restored
        const data = JSON.parse(offlineData)
        const response = await fetch('/api/checklists/generate-corrective-work-order-enhanced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        
        if (response.ok) {
          localStorage.removeItem(`offline-work-orders-${id}`)
          toast.success("Órdenes de trabajo offline procesadas exitosamente")
        }
      } catch (error) {
        console.error('Error processing offline work orders:', error)
      }
    }
    
    // Navigate to the specific work order that was created
    router.push(`/ordenes/${workOrderId}`)
  }

  // New function to handle when user cancels or closes dialogs without creating work orders
  const handleNavigateToAssetsPage = () => {
    // Navigate to assets page which works offline and shows asset status
    router.push('/checklists/assets')
  }
  
  const findSectionAndItemById = (itemId: string) => {
    if (!checklist) return null
    
    for (const section of checklist.sections) {
      const items = section.checklist_items || section.items
      if (items) {
        for (const item of items) {
          if (item.id === itemId) {
            return { section, item }
          }
        }
      }
    }
    
    return null
  }

  const getTotalItems = () => {
    if (!checklist || !checklist.sections) return 0
    
    let total = 0
    checklist.sections.forEach((section: any) => {
      const items = section.checklist_items || section.items
      if (items) {
        total += items.length
      }
    })
    return total
  }

  const getCompletedItems = () => {
    return Object.values(itemStatus).filter(Boolean).length
  }

  const isChecklistComplete = () => {
    if (!checklist || !checklist.sections) return false
    
    // Verificar si TODOS los items tienen un estado
    let complete = true
    let totalItems = 0
    let completedItems = 0
    
    checklist.sections.forEach((section: any) => {
      const items = section.checklist_items || section.items
      if (items) {
        items.forEach((item: any) => {
          totalItems++
          if (itemStatus[item.id]) {
            completedItems++
          } else {
            complete = false
          }
        })
      }
    })
    
    // Verificar que todos los items estén completados y que se hayan llenado los campos obligatorios
    return complete && 
           totalItems > 0 && 
           completedItems === totalItems && 
           technician.trim() !== "" && 
           signature !== null
  }

  // Enhanced Section Status Calculation
  const getSectionStatus = (section: any) => {
    if (section.section_type === 'evidence') {
      const sectionEvidences = evidenceData[section.id] || []
      const config = section.evidence_config || {}
      const requiredPhotos = (config.categories || []).length * (config.min_photos || 1)
      
      return {
        completed: sectionEvidences.length,
        total: requiredPhotos,
        hasIssues: sectionEvidences.some(e => e.status === 'failed'),
        isComplete: sectionEvidences.length >= requiredPhotos
      }
    } else {
      const items = section.checklist_items || section.items || []
      const completed = items.filter((item: any) => itemStatus[item.id]).length
      const hasIssues = items.some((item: any) => 
        itemStatus[item.id] === 'flag' || itemStatus[item.id] === 'fail'
      )
      
      return {
        completed,
        total: items.length,
        hasIssues,
        isComplete: completed === items.length
      }
    }
  }

  // Get overall progress statistics
  const getOverallProgress = () => {
    const sectionProgress = getSectionProgress()
    const totalItems = sectionProgress.reduce((sum, section) => sum + section.total, 0)
    const completedItems = sectionProgress.reduce((sum, section) => sum + section.completed, 0)
    const sectionsWithIssues = sectionProgress.filter(section => section.hasIssues).length
    const completedSections = sectionProgress.filter(section => 
      section.completed === section.total && section.total > 0
    ).length
    
    return {
      totalItems,
      completedItems,
      sectionsWithIssues,
      completedSections,
      totalSections: sectionProgress.length,
      progressPercentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-muted-foreground">Cargando checklist...</p>
        </div>
      </div>
    )
  }
  
  if (!checklist) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Checklist no encontrado</p>
          <p className="text-muted-foreground mb-4">No se pudo encontrar el checklist solicitado</p>
          <Button onClick={() => router.back()}>Volver</Button>
        </div>
      </div>
    )
  }

  const sectionProgress = getSectionProgress()
  const overallProgress = getOverallProgress()

  return (
    <div className="space-y-6 relative">
      {/* Simplified Navigation Bar */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm" data-navigation-header>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            {/* Progress Indicator */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <BarChart3 className="h-4 w-4" />
              <span>{overallProgress.progressPercentage}% completado</span>
              <span>({overallProgress.completedItems}/{overallProgress.totalItems})</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Collapse/Expand Actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={collapseAllSections}
              title="Colapsar todas las secciones"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={expandAllSections}
              title="Expandir todas las secciones"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            
            {/* Jump to Next Incomplete */}
            <Button
              variant="ghost"
              size="sm"
              onClick={jumpToNextIncomplete}
              disabled={overallProgress.progressPercentage === 100}
              title="Ir a siguiente sección incompleta"
            >
              <Target className="h-4 w-4" />
            </Button>
            
            {/* Save Draft */}
            <Button
              variant="ghost"
              size="sm"
              onClick={saveToLocalStorage}
              disabled={!hasUnsavedChanges}
              title="Guardar borrador"
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className={`${completed ? 'bg-green-500' : 'bg-blue-500'} text-white transition-colors duration-300`}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{checklist.name}</CardTitle>
            {completed && (
              <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Completado</span>
              </div>
            )}
          </div>
          <div className="text-white/90 mt-2">
            <div className="space-y-1">
              <div className="font-medium text-lg">{checklist.asset || 'Sin activo'}</div>
              <div className="text-sm">
                {checklist.manufacturer} {checklist.model}
              </div>
              {checklist.assetCode && (
                <div className="text-xs opacity-75">
                  ID del Activo: {checklist.assetCode}
                </div>
              )}
              {checklist.assetLocation && (
                <div className="text-xs opacity-75">
                  📍 {checklist.assetLocation}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {checklist.maintenance_plan_id && (
            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <AlertTitle className="text-blue-800">
                Checklist de Mantenimiento Preventivo
              </AlertTitle>
              <AlertDescription className="text-blue-700">
                Este checklist está asociado a una orden de trabajo de mantenimiento preventivo. 
                Es obligatorio completar todos los items para continuar con el plan de mantenimiento.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Enhanced Progress Summary */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Fecha: {checklist.scheduledDate}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {overallProgress.completedItems}/{overallProgress.totalItems} items
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${overallProgress.progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Section Status Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{overallProgress.completedSections} secciones completas</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>{overallProgress.sectionsWithIssues} con problemas</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <span>{overallProgress.progressPercentage}% completado</span>
              </div>
            </div>
          </div>

          {/* Enhanced Collapsible Sections */}
          <div className="space-y-4">
            {checklist.sections && checklist.sections.map((section: any, sectionIndex: number) => {
              const sectionStatus = getSectionStatus(section)
              const isCollapsed = sectionCollapsed[section.id] || false
              
              if (section.section_type === 'evidence') {
                // Enhanced Evidence Section with Collapsible Wrapper
                return (
                  <div 
                    id={`section-${section.id}`}
                    className="scroll-mt-20"
                  >
                    <Collapsible
                      key={section.id}
                      open={!isCollapsed}
                      onOpenChange={() => toggleSectionCollapse(section.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Camera className="h-5 w-5 text-blue-600" />
                                <div>
                                  <CardTitle className="text-lg">{section.title}</CardTitle>
                                  <CardDescription>
                                    Sección de evidencias fotográficas
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Section Progress Badge */}
                                <Badge 
                                  variant={sectionStatus.isComplete ? "default" : "secondary"}
                                  className={sectionStatus.isComplete ? "bg-green-500" : ""}
                                >
                                  {sectionStatus.completed}/{sectionStatus.total}
                                </Badge>
                                {sectionStatus.hasIssues && (
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                )}
                                {sectionStatus.isComplete && (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                )}
                                {isCollapsed ? (
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2">
                          <EvidenceCaptureSection
                            sectionId={section.id}
                            sectionTitle={section.title}
                            config={section.evidence_config || {
                              min_photos: 1,
                              max_photos: 5,
                              categories: ['Estado General']
                            }}
                            onEvidenceChange={handleEvidenceChange}
                            disabled={submitting}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )
              }
              
              // Enhanced Regular Checklist Section with Collapsible Items
              const items = section.checklist_items || section.items || []
              
              return (
                <div 
                  id={`section-${section.id}`}
                  className="scroll-mt-20"
                >
                  <Collapsible
                    key={section.id}
                    open={!isCollapsed}
                    onOpenChange={() => toggleSectionCollapse(section.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <Card className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <List className="h-5 w-5 text-blue-600" />
                              <div>
                                <CardTitle className="text-lg">{section.title}</CardTitle>
                                <CardDescription>
                                  {items.length} item{items.length !== 1 ? 's' : ''} de verificación
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Section Progress Badge */}
                              <Badge 
                                variant={sectionStatus.isComplete ? "default" : "secondary"}
                                className={sectionStatus.isComplete ? "bg-green-500" : ""}
                              >
                                {sectionStatus.completed}/{sectionStatus.total}
                              </Badge>
                              {sectionStatus.hasIssues && (
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              )}
                              {sectionStatus.isComplete && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                          </div>
                          
                          {/* Quick Progress Bar */}
                          <div className="mt-3">
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div 
                                className={`h-1 rounded-full transition-all duration-300 ${
                                  sectionStatus.isComplete ? 'bg-green-500' : 
                                  sectionStatus.hasIssues ? 'bg-amber-500' : 'bg-blue-500'
                                }`}
                                style={{ 
                                  width: `${sectionStatus.total > 0 ? (sectionStatus.completed / sectionStatus.total) * 100 : 0}%` 
                                }}
                              />
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="mt-2 space-y-4">
                        {items.map((item: any) => (
                          <Card key={item.id} className="overflow-hidden">
                            <CardHeader className="py-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex-1">{item.description}</CardTitle>
                                {itemStatus[item.id] && (
                                  <div className="ml-2">
                                    {itemStatus[item.id] === "pass" && (
                                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    )}
                                    {itemStatus[item.id] === "flag" && (
                                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                                    )}
                                    {itemStatus[item.id] === "fail" && (
                                      <XCircle className="h-5 w-5 text-red-500" />
                                    )}
                                  </div>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="grid grid-cols-3 gap-2">
                                <Button
                                  variant={itemStatus[item.id] === "pass" ? "default" : "outline"}
                                  className={`h-12 ${itemStatus[item.id] === "pass" ? "bg-green-500 hover:bg-green-600" : ""}`}
                                  onClick={() => handleStatusChange(item.id, "pass")}
                                  disabled={submitting}
                                >
                                  <Check
                                    className={`mr-2 h-5 w-5 ${itemStatus[item.id] === "pass" ? "text-white" : "text-green-500"}`}
                                  />
                                  <span className={itemStatus[item.id] === "pass" ? "text-white" : "text-green-500"}>Pass</span>
                                </Button>
                                <Button
                                  variant={itemStatus[item.id] === "flag" ? "default" : "outline"}
                                  className={`h-12 ${itemStatus[item.id] === "flag" ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                                  onClick={() => handleStatusChange(item.id, "flag")}
                                  disabled={submitting}
                                >
                                  <Flag
                                    className={`mr-2 h-5 w-5 ${itemStatus[item.id] === "flag" ? "text-white" : "text-amber-500"}`}
                                  />
                                  <span className={itemStatus[item.id] === "flag" ? "text-white" : "text-amber-500"}>Flag</span>
                                </Button>
                                <Button
                                  variant={itemStatus[item.id] === "fail" ? "default" : "outline"}
                                  className={`h-12 ${itemStatus[item.id] === "fail" ? "bg-red-500 hover:bg-red-600" : ""}`}
                                  onClick={() => handleStatusChange(item.id, "fail")}
                                  disabled={submitting}
                                >
                                  <X
                                    className={`mr-2 h-5 w-5 ${itemStatus[item.id] === "fail" ? "text-white" : "text-red-500"}`}
                                  />
                                  <span className={itemStatus[item.id] === "fail" ? "text-white" : "text-red-500"}>Fail</span>
                                </Button>
                              </div>

                              {(itemStatus[item.id] === "flag" || itemStatus[item.id] === "fail") && (
                                <div className="mt-4 space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor={`notes-${item.id}`}>Notas</Label>
                                    <Textarea
                                      id={`notes-${item.id}`}
                                      placeholder="Describa el problema encontrado"
                                      value={itemNotes[item.id] || ""}
                                      onChange={(e) => handleItemNotesChange(item.id, e.target.value)}
                                      disabled={submitting}
                                    />
                                  </div>

                                  <SmartPhotoUpload
                                    checklistId={checklist.id}
                                    itemId={item.id}
                                    currentPhotoUrl={itemPhotos[item.id]}
                                    onPhotoChange={handlePhotoChange(item.id)}
                                    disabled={submitting}
                                    category="problema"
                                  />
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )
            })}
          </div>
        </CardContent>

      </Card>

      {/* Componente de lecturas de equipo */}
      <EquipmentReadingsForm
        assetId={checklist.assetId}
        assetName={checklist.asset}
        maintenanceUnit={checklist.maintenanceUnit}
        currentHours={checklist.currentHours}
        currentKilometers={checklist.currentKilometers}
        onReadingsChange={handleEquipmentReadingsChange}
        disabled={submitting}
      />

      <div className="space-y-6 pt-4">
        <div className="space-y-2">
          <Label htmlFor="notes">Notas Generales</Label>
          <Textarea
            id="notes"
            placeholder="Agregue notas generales sobre el mantenimiento realizado"
            rows={3}
            value={notes}
            onChange={handleNotesChange}
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="technician">Técnico Responsable</Label>
          <Input 
            id="technician" 
            value={technician} 
            onChange={handleTechnicianChange}
            placeholder="Nombre del técnico responsable"
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signature">Firma</Label>
          <SignatureCanvas onSave={handleSignatureChange} />
          {signature && <p className="text-sm text-green-600 mt-1">Firma guardada</p>}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <div className="flex flex-col items-end gap-2">
            <div className="text-sm text-muted-foreground">
              Progreso: {overallProgress.completedItems}/{overallProgress.totalItems} items completados
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isOnline ? (
                <><Wifi className="h-3 w-3 text-green-500" /> Se enviará al servidor</>
              ) : (
                <><WifiOff className="h-3 w-3 text-amber-500" /> Se guardará localmente</>
              )}
            </div>
            <Button 
              onClick={handleSubmit} 
              disabled={!isChecklistComplete() || submitting || completed}
              className={!isChecklistComplete() ? "opacity-50 cursor-not-allowed" : completed ? "bg-green-500 hover:bg-green-600" : ""}
            >
              {completed ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  ¡Completado! Redirigiendo...
                </>
              ) : submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isOnline ? "Enviando..." : "Guardando offline..."}
                </>
              ) : !isChecklistComplete() ? (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Completar todos los items
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Completar Checklist
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showCorrective} onOpenChange={setShowCorrective}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Crear Acción Correctiva</AlertDialogTitle>
            <AlertDialogDescription>
              Se han detectado problemas en este checklist. ¿Desea crear una Orden de Trabajo correctiva para solucionar
              estos problemas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowCorrective(false)
              submitChecklist()
              // Navigate to assets page instead of staying on completed checklist
              handleNavigateToAssetsPage()
            }}>No, solo guardar</AlertDialogCancel>
            <AlertDialogAction onClick={prepareCorrectiveAction}>Sí, crear orden correctiva</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Corrective Work Order Dialog */}
      <CorrectiveWorkOrderDialog
        open={correctiveDialogOpen}
        onOpenChange={(open) => {
          setCorrectiveDialogOpen(open)
          // When dialog is closed without creating work orders, navigate to assets page
          if (!open) {
            handleNavigateToAssetsPage()
          }
        }}
        checklist={{
          ...checklist,
          id: completedChecklistId || checklist.id // Use completed checklist ID if available
        }}
        itemsWithIssues={Object.entries(itemStatus)
          .filter(([_, status]) => status === "flag" || status === "fail")
          .map(([itemId]) => {
            const sectionAndItem = findSectionAndItemById(itemId)
            const currentStatus = itemStatus[itemId]
            return {
              id: itemId,
              description: sectionAndItem?.item?.description || '',
              notes: itemNotes[itemId] || '',
              photo: itemPhotos[itemId] || null,
              status: currentStatus as "flag" | "fail",
              sectionTitle: sectionAndItem?.section?.title
            }
          })}
        onWorkOrderCreated={handleWorkOrderCreated}
        onNavigateToAssetsPage={handleNavigateToAssetsPage}
      />

      {/* Estado offline integrado */}
      <EnhancedOfflineStatus showDetails={true} />

      {hasUnsavedChanges && !completed && (
        <Alert>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">Tienes cambios sin guardar</span>
              {lastSaved && (
                <span className="text-xs text-muted-foreground">
                  Último guardado: {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={saveToLocalStorage}>
              Guardar borrador
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Mobile-friendly completion overlay */}
      {completed && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">¡Checklist Completado!</AlertTitle>
          <AlertDescription className="text-green-700">
            El checklist se ha guardado exitosamente. Redirigiendo a la lista de activos...
          </AlertDescription>
        </Alert>
      )}

      {/* Floating Quick Navigation for Mobile */}
      <div className="fixed bottom-4 right-4 z-40 md:hidden">
        {overallProgress.progressPercentage < 100 && (
          <Button
            size="sm"
            onClick={jumpToNextIncomplete}
            className="rounded-full shadow-lg"
            title="Ir a siguiente sección incompleta"
          >
            <Target className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}