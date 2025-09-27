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
  Maximize2,
  Sparkles
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
  type: 'checklist' | 'evidence' | 'cleanliness_bonus'
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
        console.log('✅ Offline checklist service initialized')
      }).catch(error => {
        console.error('❌ Failed to load offline checklist service:', error)
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
      } else if (section.section_type === 'cleanliness_bonus') {
        const items = section.checklist_items || section.items || []
        const sectionEvidences = evidenceData[section.id] || []
        const config = section.cleanliness_config || {}
        
        // Count checklist items completion
        const itemsCompleted = items.filter((item: any) => itemStatus[item.id]).length
        
        // Count evidence requirements (optional for cleanliness)
        const requiredPhotos = (config.areas || []).length * (config.min_photos || 2)
        const evidenceCompleted = Math.min(sectionEvidences.length, requiredPhotos)
        
        // For cleanliness sections, we primarily count checklist items
        // Evidence is supplementary for HR documentation
        return {
          id: section.id,
          title: section.title,
          type: 'cleanliness_bonus' as const,
          total: items.length, // Only count checklist items in main progress
          completed: itemsCompleted,
          hasIssues: items.some((item: any) => 
            itemStatus[item.id] === 'flag' || itemStatus[item.id] === 'fail'
          ) || sectionEvidences.some(e => e.status === 'failed'),
          isCollapsed: sectionCollapsed[section.id] || false,
          // Additional info for evidence tracking (not counted in main progress)
          evidenceTotal: requiredPhotos,
          evidenceCompleted: evidenceCompleted
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
  }, [checklist, itemStatus, itemNotes, itemPhotos, notes, technician, signature, selectedItem, equipmentReadings, evidenceData, sectionCollapsed, id])

  // Enhanced localStorage recovery with better error handling and progress preservation
  const loadFromLocalStorage = useCallback(() => {
    if (typeof window === 'undefined') return false
    
    const saved = localStorage.getItem(`checklist-draft-${id}`)
    if (!saved) return false
    
    try {
      const data = JSON.parse(saved)
      
      // Enhanced validation - check if data is valid and recent (48 hours instead of 24)
      const isRecent = Date.now() - data.timestamp < 48 * 60 * 60 * 1000
      const hasValidData = data.itemStatus || data.notes || data.technician || data.signature
      
      if (!isRecent) {
        console.log('📅 Local draft expired, cleaning up')
        localStorage.removeItem(`checklist-draft-${id}`)
        return false
      }
      
      if (!hasValidData) {
        console.log('🔍 No significant data in local draft')
        return false
      }
      
      console.log('📂 Restoring checklist progress from localStorage:', {
        itemsCompleted: Object.keys(data.itemStatus || {}).length,
        hasNotes: !!data.notes,
        hasTechnician: !!data.technician,
        hasSignature: !!data.signature,
        hasEquipmentReadings: !!(data.equipmentReadings?.hours_reading || data.equipmentReadings?.kilometers_reading),
        evidenceSections: Object.keys(data.evidenceData || {}).length
      })
      
      setIsLoadingFromStorage(true)
      
      // Batch all state updates in a single microtask to prevent conflicts
      Promise.resolve().then(() => {
        // Restore all checklist progress
        setItemStatus(data.itemStatus || {})
        setItemNotes(data.itemNotes || {})
        setItemPhotos(data.itemPhotos || {})
        setNotes(data.notes || "")
        setTechnician(data.technician || "")
        setSignature(data.signature || null)
        setSelectedItem(data.selectedItem || null)
        setEquipmentReadings(data.equipmentReadings || {})
        setEvidenceData(data.evidenceData || {})
        setSectionCollapsed(data.sectionCollapsed || {})
        
        // Reset loading and unsaved flags
        setHasUnsavedChanges(false)
        hasUnsavedChangesRef.current = false
        setIsLoadingFromStorage(false)
        
        // Show restoration success
        const completedItems = Object.keys(data.itemStatus || {}).length
        toast.success("📋 Progreso restaurado", {
          description: `${completedItems} items completados, notas y firma preservados`,
          duration: 4000
        })
      })
      
      return true
    } catch (error) {
      console.error("❌ Error loading saved checklist data:", error)
      
      // Clean up corrupted data
      try {
        localStorage.removeItem(`checklist-draft-${id}`)
      } catch (cleanupError) {
        console.error("Failed to cleanup corrupted localStorage data:", cleanupError)
      }
      
      toast.error("Error al restaurar el borrador guardado", {
        description: "Los datos locales estaban corruptos",
        duration: 3000
      })
      
      return false
    }
  }, [id])

  // Moved after markAsUnsaved declaration

  // Validar si las evidencias están completas
  const validateEvidenceRequirements = () => {
    if (!checklist?.sections) return { isValid: true, errors: [] }
    
    const errors: string[] = []
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 validateEvidenceRequirements - checking sections:', checklist.sections.length)
      console.log('🔍 Available evidence data keys:', Object.keys(evidenceData))
      Object.entries(evidenceData).forEach(([sectionId, evidences]) => {
        console.log(`🔍 Section ${sectionId}: ${evidences.length} evidences`, 
          evidences.map(e => ({ category: e.category, id: e.id }))
        )
      })
    }
    
    checklist.sections
      .filter((section: any) => section.section_type === 'evidence' || section.section_type === 'cleanliness_bonus')
      .forEach((section: any) => {
        const sectionEvidences = evidenceData[section.id] || []
        
        if (section.section_type === 'evidence') {
          const config = section.evidence_config || {}
          const minPhotos = config.min_photos || 1
          const categories = config.categories || []
          
          categories.forEach((category: string) => {
            const categoryCount = sectionEvidences.filter(e => e.category === category).length
            if (categoryCount < minPhotos) {
              errors.push(`Se requieren al menos ${minPhotos} fotos para "${category}" en ${section.title}`)
            }
          })
        } else if (section.section_type === 'cleanliness_bonus') {
          const config = section.cleanliness_config || {}
          const minPhotos = config.min_photos || 2
          const areas = config.areas || []
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`🧹 Processing cleanliness section "${section.title}"`)
            console.log(`🧹 Config:`, { minPhotos, areas, hasConfig: !!section.cleanliness_config })
            console.log(`🧹 Evidence in this section:`, sectionEvidences.length)
          }
          
          // If no evidence found in this section, check if there are evidence sections with enough photos
          if (sectionEvidences.length === 0 && areas.length > 0) {
            // Count total photos across all evidence sections
            let totalEvidencePhotos = 0
            checklist.sections?.forEach((s: any) => {
              if (s.section_type === 'evidence') {
                const sectionEvidence = evidenceData[s.id] || []
                totalEvidencePhotos += sectionEvidence.length
              }
            })
            
            // Calculate total required photos (areas * minPhotos per area)
            const totalRequiredPhotos = areas.length * minPhotos
            
            if (process.env.NODE_ENV === 'development') {
              console.log(`🔍 Cleanliness validation: found ${totalEvidencePhotos} total evidence photos, need ${totalRequiredPhotos}`)
            }
            
            if (totalEvidencePhotos < totalRequiredPhotos) {
              errors.push(`Se requieren al menos ${totalRequiredPhotos} fotos de evidencia para completar la verificación de limpieza`)
            }
          } else if (sectionEvidences.length > 0) {
            // Original logic for hybrid sections with evidence in the same section
            const totalRequiredPhotos = areas.length * minPhotos
            if (sectionEvidences.length < totalRequiredPhotos) {
              errors.push(`Se requieren al menos ${totalRequiredPhotos} fotos de evidencia en ${section.title}`)
            }
          }
        }
      })
    
    const result = { isValid: errors.length === 0, errors }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 validateEvidenceRequirements result:', result)
    }

    return result
  }

  // Separate useEffect for initial data fetching (only on mount)
  useEffect(() => {
    const fetchChecklistData = async () => {
      try {
        setLoading(true)
        
        // Determine initial connectivity state
        const currentlyOnline = navigator.onLine
        
        // Cache proactivo inmediato si hay conexión
        if (currentlyOnline && offlineChecklistService) {
          const cacheAttempt = await offlineChecklistService.proactivelyCacheChecklist(id)
          if (cacheAttempt) {
            console.log('✅ Cache proactivo exitoso')
          }
        }
        
        // Intentar cargar desde cache si estamos offline
        if (!currentlyOnline && offlineChecklistService) {
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
        if (currentlyOnline) {
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
  }, [id, router]) // Removed isOnline to prevent refetching on connectivity changes

  // Separate useEffect to handle connectivity changes without refetching data
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleConnectivityChange = () => {
      // Only handle connectivity changes, don't refetch data
      console.log(`🌐 Connectivity changed to: ${navigator.onLine ? 'online' : 'offline'}`)
      
      if (navigator.onLine) {
        console.log('🌐 Connectivity restored - checking for saved progress')
        
        // When coming back online, ensure any local changes are preserved
        if (hasUnsavedChanges && checklist) {
          console.log('📤 Coming back online with unsaved changes - preserving data')
          saveToLocalStorage()
        }
        
        // Also try to reload any saved progress that might have been lost
        setTimeout(() => {
          const hasProgress = loadFromLocalStorage()
          if (hasProgress) {
            console.log('📂 Restored progress after reconnection')
          }
        }, 500) // Small delay to ensure state is stable
        
        // Show online status
        toast.success("🌐 Conexión restaurada", {
          description: "Los datos se sincronizarán automáticamente",
          duration: 3000
        })
      } else {
        // When going offline, ensure all data is saved locally immediately
        if (checklist) {
          console.log('📱 Going offline - saving all current progress')
          saveToLocalStorage()
          
          // Also trigger a second save after a short delay to catch any pending changes
          setTimeout(() => {
            saveToLocalStorage()
            console.log('📱 Second offline save completed')
          }, 1000)
        }
        
        // Show offline status  
        toast.warning("📶 Sin conexión", {
          description: "Los datos se guardarán localmente",
          duration: 4000
        })
      }
    }

    // Listen for online/offline events
    window.addEventListener('online', handleConnectivityChange)
    window.addEventListener('offline', handleConnectivityChange)

    return () => {
      window.removeEventListener('online', handleConnectivityChange)
      window.removeEventListener('offline', handleConnectivityChange)
    }
  }, [hasUnsavedChanges, checklist, saveToLocalStorage])

  // Enhanced protection against data loss - save before page unload
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Save data immediately before page unload
      if (checklist && (hasUnsavedChanges || Object.keys(itemStatus).length > 0)) {
        console.log('🚨 Page unloading - emergency save of checklist progress')
        saveToLocalStorage()
        
        // Show warning if there are unsaved changes
        if (hasUnsavedChanges) {
          const message = 'Tienes cambios sin guardar en el checklist. ¿Estás seguro de que quieres salir?'
          event.preventDefault()
          return message
        }
      }
    }

    const handlePageHide = () => {
      // Additional save when page becomes hidden (mobile background, etc.)
      if (checklist && (hasUnsavedChanges || Object.keys(itemStatus).length > 0)) {
        console.log('📱 Page hidden - saving checklist progress')
        saveToLocalStorage()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [checklist, hasUnsavedChanges, itemStatus, saveToLocalStorage])

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
    return Object.keys(itemStatus).map(itemId => {
      const sectionAndItem = findSectionAndItemById(itemId)
      return {
        item_id: itemId,
        status: itemStatus[itemId],
        notes: itemNotes[itemId] || null,
        photo_url: itemPhotos[itemId] || null,
        description: sectionAndItem?.item?.description || null
      }
    })
  }, [itemStatus, itemNotes, itemPhotos])

  // Essential helper functions - MOVED UP to fix hoisting issue
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

  // Helper validation functions - MOVED ABOVE handleSubmit to fix hoisting issue
  const validateBasicCompletion = () => {
    const errors: string[] = []
    const warnings: string[] = []

    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 validateBasicCompletion - technician:', technician?.trim())
      console.log('🔍 validateBasicCompletion - signature:', !!signature)
    }

    // Verify technician
    if (!technician?.trim()) {
      errors.push("👤 Nombre del técnico")
    }
    
    // Verify signature
    if (!signature) {
      errors.push("✍️ Firma del técnico")
    }
    
    // Verify items completion
    const totalItems = getTotalItems()
    const completedItems = getCompletedItems()
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 validateBasicCompletion - totalItems:', totalItems)
      console.log('🔍 validateBasicCompletion - completedItems:', completedItems)
    }

    if (completedItems < totalItems) {
      const missingCount = totalItems - completedItems
      errors.push(`📋 ${missingCount} item${missingCount > 1 ? 's' : ''} del checklist sin evaluar`)
      
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
        warnings.push(`Items pendientes: ${itemsToShow.join(', ')}${uncompletedItems.length > 3 ? ` y ${uncompletedItems.length - 3} más...` : ''}`)
      }
    }

    const result = { isValid: errors.length === 0, errors, warnings }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 validateBasicCompletion result:', result)
    }

    return result
  }

  const validateEquipmentReadings = () => {
    const errors: string[] = []
    const warnings: string[] = []

    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 validateEquipmentReadings - readings:', equipmentReadings)
    }

    if (equipmentReadings.hours_reading !== undefined && equipmentReadings.hours_reading !== null) {
      if (equipmentReadings.hours_reading <= 0) {
        errors.push("⏱️ Lectura de horas inválida (debe ser mayor a 0)")
      } else if (equipmentReadings.hours_reading <= checklist.currentHours) {
        warnings.push(`⚠️ Lectura de horas (${equipmentReadings.hours_reading}) no mayor a la actual (${checklist.currentHours})`)
      }
    }

    if (equipmentReadings.kilometers_reading !== undefined && equipmentReadings.kilometers_reading !== null) {
      if (equipmentReadings.kilometers_reading <= 0) {
        errors.push("📏 Lectura de kilómetros inválida (debe ser mayor a 0)")
      } else if (equipmentReadings.kilometers_reading <= checklist.currentKilometers) {
        warnings.push(`⚠️ Lectura de kilómetros (${equipmentReadings.kilometers_reading}) no mayor a la actual (${checklist.currentKilometers})`)
      }
    }

    const result = { isValid: errors.length === 0, errors, warnings }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 validateEquipmentReadings result:', result)
    }

    return result
  }
  
  const handleSubmit = async () => {
    // =====================================================
    // ENHANCED VALIDATION WITH DETAILED NOTIFICATIONS
    // =====================================================
    
    // Debug logging for mobile issues
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Submit button clicked - Debug Info:', {
        isChecklistComplete: isChecklistComplete(),
        technician: technician?.trim(),
        signature: !!signature,
        totalItems: getTotalItems(),
        completedItems: getCompletedItems(),
        submitting,
        completed
      })
      console.log('🚀 Starting handleSubmit execution...')
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('📋 Starting validation checks...')
      }
    
      // Collect all validation errors
      const validationErrors: string[] = []
      const validationWarnings: string[] = []

      // 1. Check basic checklist completion
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Running basic validation...')
      }
      const basicValidation = validateBasicCompletion()
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Basic validation completed:', basicValidation)
      }
      if (!basicValidation.isValid) {
        validationErrors.push(...basicValidation.errors)
        validationWarnings.push(...basicValidation.warnings)
      }

    // 2. Validate evidence requirements
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Running evidence validation...')
    }
    const evidenceValidation = validateEvidenceRequirements()
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Evidence validation completed:', evidenceValidation)
    }
    if (!evidenceValidation.isValid) {
      validationErrors.push("📸 Evidencias fotográficas requeridas")
      evidenceValidation.errors.forEach(error => validationWarnings.push(error))
    }

    // 3. Validate equipment readings if present
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Running equipment readings validation...')
    }
    const readingsValidation = validateEquipmentReadings()
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Equipment readings validation completed:', readingsValidation)
    }
    if (!readingsValidation.isValid) {
      validationErrors.push(...readingsValidation.errors)
      validationWarnings.push(...readingsValidation.warnings)
    }

    // 4. Separate cleanliness items from maintenance items
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Analyzing items with issues...')
    }
    const allItemsWithIssues = Object.entries(itemStatus)
      .filter(([_, status]) => status === "flag" || status === "fail")
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 All items with issues:', allItemsWithIssues.length)
    }
    
    const maintenanceItemsWithIssues = allItemsWithIssues.filter(([itemId]) => {
      const sectionAndItem = findSectionAndItemById(itemId)
      return sectionAndItem?.section?.section_type !== 'cleanliness_bonus'
    })

    const cleanlinessItemsWithIssues = allItemsWithIssues.filter(([itemId]) => {
      const sectionAndItem = findSectionAndItemById(itemId)
      return sectionAndItem?.section?.section_type === 'cleanliness_bonus'
    })

    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Maintenance items with issues:', maintenanceItemsWithIssues.length)
      console.log('🧹 Cleanliness items with issues:', cleanlinessItemsWithIssues.length)
    }

    // 5. Validate items with issues have proper notes (excluding cleanliness items)
    const maintenanceItemsWithoutNotes = maintenanceItemsWithIssues.filter(([itemId]) => !itemNotes[itemId]?.trim())
    if (maintenanceItemsWithoutNotes.length > 0) {
      validationWarnings.push(`💬 ${maintenanceItemsWithoutNotes.length} problema${maintenanceItemsWithoutNotes.length > 1 ? 's' : ''} de mantenimiento sin notas explicativas`)
    }

    // 6. Check for mandatory preventive maintenance requirements
    if (checklist.maintenance_plan_id) {
      if (validationErrors.length > 0) {
        validationErrors.push("🔧 Checklist de mantenimiento preventivo debe estar 100% completo")
      }
    }

    // Show info about cleanliness items if any failed
    if (cleanlinessItemsWithIssues.length > 0) {
      validationWarnings.push(`🧹 ${cleanlinessItemsWithIssues.length} item${cleanlinessItemsWithIssues.length > 1 ? 's' : ''} de limpieza no aprobado${cleanlinessItemsWithIssues.length > 1 ? 's' : ''} (solo afecta bonos de RH)`)
    }

    // =====================================================
    // SHOW VALIDATION RESULTS
    // =====================================================
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Final validation results:', {
        validationErrors: validationErrors.length,
        validationWarnings: validationWarnings.length,
        errors: validationErrors,
        warnings: validationWarnings
      })
    }
    
    if (validationErrors.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Validation failed, showing errors and returning early')
      }
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
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Showing validation warnings')
      }
      validationWarnings.forEach((warning, index) => {
        setTimeout(() => {
          toast.warning(warning, { duration: 5000 })
        }, index * 300)
      })
    }

    // =====================================================
    // PROCEED WITH SUBMISSION
    // =====================================================

    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Proceeding with submission...')
    }

    // Always submit the checklist first
    if (process.env.NODE_ENV === 'development') {
      console.log('📤 Calling submitChecklist()...')
    }
    const completedId = await submitChecklist()
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📨 submitChecklist result:', completedId)
    }
    
    // Check if submission failed - allow for UUID format completed IDs and offline IDs
    const isSubmissionFailed = !completedId || 
      (completedId !== "success" && 
       completedId !== "offline-success" && 
       !completedId.startsWith('sched_') && 
       !completedId.startsWith('checklist-offline-') &&
       !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(completedId))
    
    if (isSubmissionFailed) {
      // Submission failed
      if (process.env.NODE_ENV === 'development') {
        console.log('❌ Submission failed, returning early')
      }
      toast.error("❌ No se pudo procesar el checklist", {
        description: "Verifique su conexión e intente nuevamente",
        duration: 5000
      })
      return
    }

    // Checklist submitted successfully
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Submission successful, completedId:', completedId)
    }
    toast.success("✅ Checklist guardado exitosamente", {
      duration: 3000
    })

    if (maintenanceItemsWithIssues.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Found maintenance issues, handling corrective actions...', {
          issueCount: maintenanceItemsWithIssues.length,
          completedId
        })
      }
      
      // Store the completed checklist ID for corrective work orders
      if (completedId !== "success" && completedId !== "offline-success") {
        setCompletedChecklistId(completedId)
      }
      
      // Directly open the corrective work order dialog - no more "save for later" option
      setCompleted(true)
      
      // Show a brief success message
      toast.success("✅ Checklist completado exitosamente", {
        description: "Configurando órdenes de trabajo correctivas...",
        duration: 3000
      })
      
      // Small delay to show the completion state, then open the dialog
      setTimeout(() => {
        handleCorrectiveDialogOpen()
      }, 1000)
      
      return
    }

    // If no issues, complete normally
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ No issues found, completing normally')
    }
    setCompleted(true)
    
    // Always redirect after a brief delay to show completion state
    setTimeout(() => {
      handleNavigateToAssetsPage()
    }, 2500) // Slightly longer delay to read the completion message
    
    } catch (error) {
      console.error('❌ Error in handleSubmit:', error)
      toast.error("Error inesperado al procesar el checklist", {
        description: "Por favor intente nuevamente",
        duration: 5000
      })
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
        try {
          // Ensure offline service is loaded
          if (!offlineChecklistService) {
            console.log('🔄 Loading offline service dynamically...')
            const module = await import('@/lib/services/offline-checklist-service')
            offlineChecklistService = module.offlineChecklistService
            console.log('✅ Offline service loaded successfully')
          }
          
          if (offlineChecklistService) {
            const offlineId = `checklist-${id}-${Date.now()}`
            
            // Generate a proper completed checklist ID for offline use
            const completedChecklistId = `checklist-offline-${id}-${Date.now()}`
            
            // Ensure we include the schedule_id in the submission data for offline storage
            const offlineSubmissionData = {
              ...submissionData,
              schedule_id: id, // Add the schedule ID explicitly
              scheduleId: id,   // Also add as alias for compatibility
              completed_checklist_id: completedChecklistId // Store the generated ID
            }
            
            console.log('💾 Saving offline checklist with data:', {
              offlineId,
              scheduleId: id,
              completedChecklistId,
              technicianName: offlineSubmissionData.technician,
              itemsCount: offlineSubmissionData.completed_items?.length || 0
            })
            
            await offlineChecklistService.saveOfflineChecklist(offlineId, offlineSubmissionData)
            
            // Limpiar datos locales
            localStorage.removeItem(`checklist-draft-${id}`)
            
            toast.success("📱 Checklist guardado sin conexión", {
              description: "Se sincronizará automáticamente cuando vuelva la conexión",
              duration: 4000
            })
            
            // Return the generated completed checklist ID
            return completedChecklistId
          } else {
            throw new Error('No se pudo cargar el servicio offline')
          }
        } catch (offlineError) {
          console.error('❌ Error saving offline checklist:', offlineError)
          
          // Fallback: save to localStorage directly
          console.log('🔄 Fallback: saving to localStorage directly')
          const fallbackId = `checklist-offline-fallback-${id}-${Date.now()}`
          const fallbackData = {
            ...submissionData,
            schedule_id: id,
            scheduleId: id,
            completed_checklist_id: fallbackId,
            timestamp: Date.now(),
            fallback: true
          }
          
          try {
            localStorage.setItem(`offline-checklist-${fallbackId}`, JSON.stringify(fallbackData))
            localStorage.removeItem(`checklist-draft-${id}`)
            
            toast.success("📱 Checklist guardado localmente", {
              description: "Se enviará cuando vuelva la conexión",
              duration: 4000
            })
            
            return fallbackId
          } catch (storageError) {
            console.error('❌ Failed to save to localStorage:', storageError)
            toast.error("Error al guardar offline", {
              description: "No se pudo guardar el checklist",
              duration: 5000
            })
            throw new Error('No se pudo guardar offline')
          }
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
      if (isOnline) {
        try {
          // Ensure offline service is loaded for fallback
          if (!offlineChecklistService) {
            const module = await import('@/lib/services/offline-checklist-service')
            offlineChecklistService = module.offlineChecklistService
          }
          
          if (offlineChecklistService) {
            const offlineId = `checklist-${id}-${Date.now()}`
            
            // Generate a proper completed checklist ID for fallback offline save
            const completedChecklistId = `checklist-offline-fallback-${id}-${Date.now()}`
            
            const fallbackSubmissionData = {
              schedule_id: id,     // Use schedule_id for validation
              scheduleId: id,      // Keep alias for compatibility
              completed_checklist_id: completedChecklistId, // Store the generated ID
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
            
            console.log('💾 Saving backup offline checklist with data:', {
              offlineId,
              scheduleId: id,
              completedChecklistId,
              technicianName: fallbackSubmissionData.technician,
              itemsCount: fallbackSubmissionData.completed_items?.length || 0
            })
            
            await offlineChecklistService.saveOfflineChecklist(offlineId, fallbackSubmissionData)
            toast.success("Checklist guardado localmente como respaldo", {
              description: "Se sincronizará cuando vuelva la conexión",
              duration: 5000
            })
          } else {
            // Direct localStorage fallback
            const fallbackId = `checklist-offline-fallback-${id}-${Date.now()}`
            const fallbackData = {
              schedule_id: id,
              scheduleId: id,
              completed_checklist_id: fallbackId,
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
              evidence_data: evidenceData,
              timestamp: Date.now(),
              fallback: true
            }
            
            localStorage.setItem(`offline-checklist-${fallbackId}`, JSON.stringify(fallbackData))
            toast.success("Checklist guardado localmente como respaldo", {
              description: "Se sincronizará cuando vuelva la conexión",
              duration: 5000
            })
          }
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

  // Enhanced dialog handling with better mobile support
  const handleCorrectiveDialogOpen = () => {
    // Debug logging for mobile issues
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Opening corrective dialog:', {
        correctiveDialogOpen,
        itemsWithIssues: Object.entries(itemStatus).filter(([_, status]) => status === "flag" || status === "fail").length,
        completedChecklistId
      })
    }

    // Check if there are any items with issues (excluding cleanliness items)
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
          sectionTitle: sectionAndItem?.section?.title,
          sectionType: sectionAndItem?.section?.section_type
        }
      })
      // Exclude cleanliness verification items from corrective work orders
      .filter(item => item.sectionType !== 'cleanliness_bonus')

    if (itemsWithIssues.length === 0) {
      toast.error("No hay elementos con problemas para generar una orden correctiva")
      return
    }

    // Force a state update to ensure the dialog opens
    setCorrectiveDialogOpen(true)
    
    // Additional debug logging
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        console.log('🔧 Dialog state after opening attempt:', {
          correctiveDialogOpen: true
        })
      }, 100)
    }
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
    
    // Enhanced navigation with offline support
    const connectivityState = navigator.onLine ? 'online' : 'offline'
    console.log(`🚀 Navigating to work order (${connectivityState})`)
    
    try {
      // Try to navigate to work order - work order pages should handle offline scenarios
      router.push(`/ordenes/${workOrderId}`)
    } catch (error) {
      console.error('Navigation error:', error)
      
      // Fallback: Navigate to assets page where user can continue workflow
      console.log('📱 Fallback: redirecting to assets page')
      try {
        router.push('/checklists/assets')
        toast.success("✅ Checklist y orden de trabajo guardados", {
          description: "Redirigiendo a la página de activos para continuar",
          duration: 4000
        })
      } catch (fallbackError) {
        console.error('Fallback navigation failed:', fallbackError)
        toast.error("Error al navegar, pero la orden de trabajo fue creada exitosamente")
      }
    }
  }

  // Enhanced function to handle navigation with offline support
  const handleNavigateToAssetsPage = () => {
    // Always navigate to assets page - it handles offline scenarios properly
    try {
      const connectivityState = navigator.onLine ? 'online' : 'offline'
      console.log(`🚀 Navigating to assets page (${connectivityState})`)
      
      // The assets page has offline functionality built-in with cached data
      router.push('/checklists/assets')
    } catch (error) {
      console.error('Navigation error:', error)
      
      // Fallback: use window.location if router fails
      try {
        window.location.href = '/checklists/assets'
      } catch (locationError) {
        console.error('Window location fallback failed:', locationError)
        toast.error("Error al navegar, pero el checklist fue guardado exitosamente")
      }
    }
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

  // Simplified completion check - more mobile-friendly
  const isChecklistComplete = () => {
    if (!checklist || !checklist.sections) return false
    
    // Check if we have basic requirements met
    const hasBasicInfo = technician.trim() !== "" && signature !== null
    
    // Check if we have some progress on items
    const totalItems = getTotalItems()
    const completedItems = getCompletedItems()
    const hasProgress = totalItems > 0 && completedItems > 0
    
    // For mobile, be more lenient - allow submission if we have basic info and some progress
    // Full validation will happen in handleSubmit
    return hasBasicInfo && hasProgress
  }

  // Strict completion check for final validation
  const isFullyComplete = () => {
    if (!checklist || !checklist.sections) return false
    
    let totalItems = 0
    let completedItems = 0
    
    checklist.sections.forEach((section: any) => {
      const items = section.checklist_items || section.items
      if (items) {
        items.forEach((item: any) => {
          totalItems++
          if (itemStatus[item.id]) {
            completedItems++
          }
        })
      }
    })
    
    return totalItems > 0 && 
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
    } else if (section.section_type === 'cleanliness_bonus') {
      const items = section.checklist_items || section.items || []
      const sectionEvidences = evidenceData[section.id] || []
      const config = section.cleanliness_config || {}
      
      // Count checklist items completion
      const itemsCompleted = items.filter((item: any) => itemStatus[item.id]).length
      const hasItemIssues = items.some((item: any) => 
        itemStatus[item.id] === 'flag' || itemStatus[item.id] === 'fail'
      )
      
      // Evidence requirements (supplementary)
      const requiredPhotos = (config.areas || []).length * (config.min_photos || 2)
      const evidenceCompleted = Math.min(sectionEvidences.length, requiredPhotos)
      
      return {
        completed: itemsCompleted,
        total: items.length,
        hasIssues: hasItemIssues || sectionEvidences.some(e => e.status === 'failed'),
        isComplete: itemsCompleted === items.length,
        // Additional evidence info
        evidenceCompleted: evidenceCompleted,
        evidenceTotal: requiredPhotos,
        evidenceComplete: evidenceCompleted >= requiredPhotos
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
                  📍 {(checklist as any).assets?.plants?.name || checklist.assetLocation || 'Sin planta'}
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
                    key={`evidence-${section.id}`}
                    id={`section-${section.id}`}
                    className="scroll-mt-20"
                  >
                    <Collapsible
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
                            config={(section.evidence_config && Array.isArray(section.evidence_config.categories) && section.evidence_config.categories.length > 0)
                              ? section.evidence_config
                              : {
                                  min_photos: section.evidence_config?.min_photos ?? 1,
                                  max_photos: section.evidence_config?.max_photos ?? 5,
                                  categories: ['Estado General']
                                }
                            }
                            onEvidenceChange={handleEvidenceChange}
                            disabled={submitting}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )
              }

              if (section.section_type === 'cleanliness_bonus') {
                // Enhanced Cleanliness Section with Collapsible Wrapper
                return (
                  <div 
                    key={`cleanliness-${section.id}`}
                    id={`section-${section.id}`}
                    className="scroll-mt-20"
                  >
                    <Collapsible
                      open={!isCollapsed}
                      onOpenChange={() => toggleSectionCollapse(section.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow border-green-200 bg-green-50/50">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Sparkles className="h-5 w-5 text-green-600" />
                                <div>
                                  <CardTitle className="text-lg">{section.title}</CardTitle>
                                  <CardDescription>
                                    Evaluación de limpieza para bonos de RH
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
                                {/* Evidence Progress Badge (supplementary) */}
                                {(sectionStatus as any).evidenceTotal > 0 && (
                                  <Badge 
                                    variant="outline"
                                    className="text-xs"
                                    title="Evidencias fotográficas"
                                  >
                                    📸 {(sectionStatus as any).evidenceCompleted}/{(sectionStatus as any).evidenceTotal}
                                  </Badge>
                                )}
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
                        <div className="mt-2 space-y-4">
                          {/* Render cleanliness checklist items first */}
                          {(section.checklist_items || section.items || []).map((item: any) => (
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
                                  <span className={itemStatus[item.id] === "pass" ? "text-white" : "text-green-500"}>Válido</span>
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
                                  <span className={itemStatus[item.id] === "flag" ? "text-white" : "text-amber-500"}>Alerta</span>
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
                                  <span className={itemStatus[item.id] === "fail" ? "text-white" : "text-red-500"}>Falla</span>
                                </Button>
                                </div>

                                {(itemStatus[item.id] === "flag" || itemStatus[item.id] === "fail") && (
                                  <div className="mt-4 space-y-4">
                                    <div className="space-y-2">
                                      <Label htmlFor={`notes-${item.id}`}>Notas</Label>
                                      <Textarea
                                        id={`notes-${item.id}`}
                                        placeholder="Describa el problema encontrado con la limpieza"
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
                                      category="limpieza"
                                    />
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                          
                          {/* Then render evidence capture section */}
                          <div className="border-t pt-4">
                            <h4 className="font-medium text-sm text-gray-700 mb-4 flex items-center gap-2">
                              <Camera className="h-4 w-4" />
                              Evidencia Fotográfica para Verificación de Limpieza
                            </h4>
                            {(() => {
                              const items = (section.checklist_items || section.items || []) as any[]
                              const configuredAreas = section.cleanliness_config?.areas || []
                              const hasAreas = configuredAreas.length > 0
                              // If areas missing or clearly outdated, derive from items (first 3 words of description)
                              const derivedAreas = !hasAreas || configuredAreas.length < items.length
                                ? items.map((it, idx) => (it?.description?.split(' ').slice(0, 3).join(' ') || `Área ${idx + 1}`)).slice(0, 20)
                                : configuredAreas

                              return (
                                <EvidenceCaptureSection
                              sectionId={section.id}
                              sectionTitle={section.title}
                                  config={{
                                    min_photos: (section.cleanliness_config?.min_photos ?? 2),
                                    max_photos: (section.cleanliness_config?.max_photos ?? 6),
                                    categories: derivedAreas.length > 0 ? derivedAreas : ['Interior', 'Exterior'],
                                    descriptions: (section.cleanliness_config?.descriptions && Object.keys(section.cleanliness_config.descriptions).length > 0)
                                      ? section.cleanliness_config.descriptions
                                      : undefined
                                  }}
                                  onEvidenceChange={handleEvidenceChange}
                                  disabled={submitting}
                                />
                              )
                            })()}
                          </div>
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
                  key={`checklist-${section.id}`}
                  id={`section-${section.id}`}
                  className="scroll-mt-20"
                >
                  <Collapsible
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
                                  <span className={itemStatus[item.id] === "pass" ? "text-white" : "text-green-500"}>Válido</span>
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
                                  <span className={itemStatus[item.id] === "flag" ? "text-white" : "text-amber-500"}>Alerta</span>
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
                                  <span className={itemStatus[item.id] === "fail" ? "text-white" : "text-red-500"}>Falla</span>
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
            
            {/* Mobile-friendly submission button with better validation feedback */}
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              {/* Validation feedback for mobile */}
              {!isChecklistComplete() && (
                <div className="text-xs text-amber-600 text-right">
                  {!technician.trim() && "• Falta nombre del técnico"}
                  {!signature && "• Falta firma"}
                  {getCompletedItems() === 0 && "• Ningún item evaluado"}
                </div>
              )}
              
              <Button 
                onClick={handleSubmit} 
                disabled={submitting || completed}
                className={`w-full sm:w-auto ${completed ? "bg-green-500 hover:bg-green-600" : ""}`}
                size="lg"
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
                    <Save className="mr-2 h-4 w-4" />
                    Enviar Checklist
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
      </div>



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
              sectionTitle: sectionAndItem?.section?.title,
              sectionType: sectionAndItem?.section?.section_type
            }
          })
          // Exclude cleanliness verification items from corrective work orders
          .filter(item => item.sectionType !== 'cleanliness_bonus')}
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

      {/* Enhanced completion overlay with offline support */}
      {completed && (
        <Alert className="border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <Check className="h-4 w-4 text-green-600 mt-0.5" />
            <div className="flex-1">
              <AlertTitle className="text-green-800">¡Checklist Completado!</AlertTitle>
              <AlertDescription className="text-green-700 space-y-2">
                {isOnline ? (
                  <>
                    <p>El checklist se ha guardado exitosamente en el servidor.</p>
                    <p className="text-sm text-green-600 flex items-center gap-2">
                      <Clock className="h-3 w-3 animate-pulse" />
                      Redirigiendo a la página de activos para continuar con otros checklists...
                    </p>
                  </>
                ) : (
                  <>
                    <p>El checklist se ha guardado localmente y está listo para sincronización.</p>
                    <p className="text-sm text-green-600">
                      Los datos se enviarán automáticamente cuando vuelva la conexión.
                    </p>
                    <p className="text-sm text-green-600 flex items-center gap-2">
                      <Clock className="h-3 w-3 animate-pulse" />
                      Redirigiendo a la página de activos para continuar offline...
                    </p>
                  </>
                )}
              </AlertDescription>
            </div>
          </div>
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