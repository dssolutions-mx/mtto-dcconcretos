"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
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
  Sparkles,
  Shield,
  Award,
} from "lucide-react"
import { SignatureCanvas } from "@/components/checklists/signature-canvas"
import { EnhancedOfflineStatus } from "@/components/checklists/enhanced-offline-status"
import {
  EquipmentReadingsForm,
  type EquipmentReadingsValidation,
} from "@/components/checklists/equipment-readings-form"
import {
  TireReadingsSection,
} from "@/components/checklists/tire-readings-section"
import type { ChecklistTireReadingInput } from "@/lib/tires/checklist-readings"
import {
  normalizeTireReadingsConfig,
  validateTireReadingsSection,
} from "@/lib/tires/tire-readings-validation"
import {
  enrichEquipmentReadingsValidation,
  formatSubmissionReadingErrors,
  validateReadingsPresence,
} from "@/lib/checklist/equipment-readings-validation"
import { EvidenceCaptureSection } from "@/components/checklists/evidence-capture-section"
import { SecurityTalkSection } from "@/components/checklists/security-talk-section"
import { OperatorPunctualitySection } from "@/components/checklists/operator-punctuality-section"
import { BonusClosureSection } from "@/components/checklists/bonus-closure-section"
import { CorrectiveWorkOrderDialog } from "@/components/checklists/corrective-work-order-dialog"
import { SmartPhotoUpload } from "@/components/checklists/smart-photo-upload"
import { useOfflineSync } from "@/hooks/useOfflineSync"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  buildCorrectiveDescriptionFromIssues,
  computeVisibleMeters,
  isOperatorChecklistRole,
} from "@/lib/checklist/checklist-execution-helpers"
import { ChecklistCompletionOverlay } from "@/components/checklists/checklist-completion-overlay"
import { createBrowserClient } from '@supabase/ssr'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { initOfflineClient, offlineClient } from "@/lib/offline/offline-client"
import { shouldCreateChecklistIssue, getSectionFunnelLane } from "@/lib/checklist/section-funnel"
import { SectionFunnelLaneBadge } from "@/components/checklists/section-funnel-lane-badge"
import {
  aggregateChecklistProgress,
  computeSectionProgressCounts,
} from "@/lib/checklist/checklist-completion-progress"
import {
  normalizeSecurityConfig,
  resolveExecutionSectionType,
} from "@/lib/checklist/security-talk-validation"
import {
  sanitizeChecklistCompletePayload,
  sanitizeEvidenceMapForStorage,
  sanitizeLocalChecklistDraft,
  sanitizePlantOperationsDataForStorage,
  sanitizeSecurityTalkDataForStorage,
} from "@/lib/offline/sanitize-draft"
import {
  isChecklistScheduleDraftPayload,
  localDraftHasRestorableData,
  mergeSectionRecordMaps,
  mergeServerAndLocalDraftPayload,
  clearServerScheduleDraft,
  patchServerDraftWithMerge,
  type ChecklistScheduleDraftPayload,
} from "@/lib/checklist/schedule-draft"
import {
  detectDraftRestorePrompt,
  formatDraftSavedAt,
  fetchDraftUpdaterProfile,
  formatDraftSavedBy,
  resolveDraftSyncStatus,
  type DraftRestoreSource,
} from "@/lib/checklist/schedule-draft-display"
import { DraftRestoreBanner } from "@/components/checklists/draft-restore-banner"
import { DraftStatusChip } from "@/components/checklists/draft-status-chip"
import {
  isBonusClosureSectionComplete,
  validateBonusClosureSectionPayload,
} from "@/lib/checklist/bonus-closure-validation"
import { serializeBonusClosureSectionData } from "@/lib/checklist/bonus-closure-section-load"
import {
  evaluateCompletionEligibilitySync,
  resolveScheduleAuthContext,
} from "@/lib/checklist/executor-authorization"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface ChecklistExecutionProps {
  id: string
}

interface SectionProgress {
  id: string
  title: string
  type: 'checklist' | 'evidence' | 'cleanliness_bonus' | 'security_talk' | 'tire_readings' | 'operator_punctuality' | 'bonus_closure'
  total: number
  completed: number
  hasIssues: boolean
  isCollapsed: boolean
}

function checklistStateFromCache(cached: import("@/lib/offline/types").CachedTemplate) {
  const schedule = cached.template as Record<string, any>
  const asset = cached.asset as Record<string, any> | undefined
  const cachedSections = schedule.checklists?.checklist_sections || []
  const orderedCachedSections = cachedSections
    .sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
    .map((section: { checklist_items?: { order_index: number }[]; order_index: number }) => ({
      ...section,
      checklist_items: (section.checklist_items || []).sort(
        (a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index
      ),
    }))

  const offlineMuRaw = schedule.checklists?.equipment_models?.maintenance_unit ?? null
  const offlineCat = schedule.checklists?.equipment_models?.category ?? null
  const offlineVisible = computeVisibleMeters(offlineMuRaw, offlineCat)
  const offlineMaintenanceUnit: "hours" | "kilometers" | null =
    offlineVisible === "kilometers"
      ? "kilometers"
      : offlineVisible === "none"
        ? null
        : offlineVisible === "both"
          ? null
          : "hours"

  return {
    id: schedule.id,
    name: schedule.checklists?.name || "",
    assetId: asset?.id || "",
    assetCode: asset?.asset_id || "",
    asset: asset?.name || "",
    assetLocation: asset?.location || "",
    plantId: asset?.plant_id || null,
    modelId: schedule.checklists?.model_id || "",
    model: schedule.checklists?.equipment_models?.name || "N/A",
    manufacturer: schedule.checklists?.equipment_models?.manufacturer || "N/A",
    frequency: schedule.checklists?.frequency || "",
    sections: orderedCachedSections,
    scheduledDate: schedule.scheduled_date || "",
    technicianId: schedule.assigned_to || "",
    technician: schedule.profiles
      ? `${schedule.profiles.nombre} ${schedule.profiles.apellido}`
      : "",
    maintenance_plan_id: schedule.maintenance_plan_id || null,
    currentHours: asset?.current_hours || 0,
    currentKilometers: asset?.current_kilometers || 0,
    maintenanceUnitRaw: offlineMuRaw,
    modelCategory: offlineCat,
    visibleMeters: offlineVisible,
    maintenanceUnit: offlineMaintenanceUnit,
  }
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
  const [completionOverlayOpen, setCompletionOverlayOpen] = useState(false)
  const [completionOverlayTitle, setCompletionOverlayTitle] = useState("")
  const [completionOverlaySubtitle, setCompletionOverlaySubtitle] = useState("")
  const [completionRedirectLabel, setCompletionRedirectLabel] = useState("Inicio")
  const [operatorAutoWoSubmitting, setOperatorAutoWoSubmitting] = useState(false)
  const [canCompleteChecklist, setCanCompleteChecklist] = useState(true)
  const [allowedExecutorRoles, setAllowedExecutorRoles] = useState<string[]>([])
  const [completionDeniedReason, setCompletionDeniedReason] = useState<string | null>(null)
  
  // Estados para lecturas de equipo
  const [equipmentReadings, setEquipmentReadings] = useState<{
    hours_reading?: number | null
    kilometers_reading?: number | null
  }>({})
  const [equipmentReadingsValidation, setEquipmentReadingsValidation] =
    useState<EquipmentReadingsValidation | null>(null)
  const [readingsFormKey, setReadingsFormKey] = useState(0)
  
  // Estados para evidencias fotográficas
  const [evidenceData, setEvidenceData] = useState<Record<string, any[]>>({})
  
  // Estados para datos de charla de seguridad
  const [securityData, setSecurityData] = useState<Record<string, any>>({})
  const [plantOperationsData, setPlantOperationsData] = useState<Record<string, any>>({})
  const [bonusClosureConfirmOpen, setBonusClosureConfirmOpen] = useState(false)
  const bonusClosureConfirmedRef = useRef(false)

  // Lecturas de llantas por sección (Phase D)
  const [tireReadingsData, setTireReadingsData] = useState<
    Record<string, ChecklistTireReadingInput[]>
  >({})
  
  // Section Navigation States
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({})
  const [autoCollapseCompleted, setAutoCollapseCompleted] = useState(false)
  
  // Usar el nuevo hook para estado offline
  const { isOnline, hasPendingSyncs } = useOfflineSync()
  const { profile, user, businessRole, role: authRole } = useAuthZustand()
  const operatorSimpleFlow = isOperatorChecklistRole(profile?.role ?? null)

  const resolvedVisibleMeters = useMemo(() => {
    if (!checklist) return "hours" as const
    return computeVisibleMeters(
      checklist.maintenanceUnitRaw ?? null,
      checklist.modelCategory ?? null
    )
  }, [checklist])

  useEffect(() => {
    if (!checklist) return
    if (resolvedVisibleMeters === "none") {
      setEquipmentReadings({})
    }
  }, [checklist, resolvedVisibleMeters])
  
  // Estados para auto-guardar
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [laneBDraftDirty, setLaneBDraftDirty] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isLoadingFromStorage, setIsLoadingFromStorage] = useState(false)
  const [hasLocalDraft, setHasLocalDraft] = useState(false)
  const [discardingDraft, setDiscardingDraft] = useState(false)
  const [draftRestorePrompt, setDraftRestorePrompt] = useState<{
    source: DraftRestoreSource
    savedAt: Date
    savedByName: string | null
    serverPayload: ChecklistScheduleDraftPayload | null
    serverUpdatedAt: string | null
    localData: Record<string, any> | null
  } | null>(null)
  const [serverDraftUpdatedAt, setServerDraftUpdatedAt] = useState<string | null>(null)
  /** Bumps on draft restore/discard to remount Lane B sections with clean parent state. */
  const [laneBMountVersion, setLaneBMountVersion] = useState(0)
  const hasUnsavedChangesRef = useRef(false)
  const serverDraftUpdatedAtRef = useRef<string | null>(null)
  const draftRestorePromptRef = useRef(draftRestorePrompt)
  const setDraftRestorePromptSynced = useCallback(
    (value: typeof draftRestorePrompt) => {
      draftRestorePromptRef.current = value
      setDraftRestorePrompt(value)
    },
    []
  )
  useEffect(() => {
    draftRestorePromptRef.current = draftRestorePrompt
  }, [draftRestorePrompt])

  // Remove this useEffect that was causing the infinite loop

  useEffect(() => {
    if (typeof window === 'undefined') return
    void initOfflineClient()
  }, [])

  const applyClientCompletionAuth = useCallback(
    (scheduleRow: Parameters<typeof resolveScheduleAuthContext>[0]) => {
      if (!profile?.role || !user?.id) {
        setCanCompleteChecklist(true)
        setAllowedExecutorRoles([])
        setCompletionDeniedReason(null)
        return
      }

      const { executorRoles, asset } = resolveScheduleAuthContext(scheduleRow)
      const eligibility = evaluateCompletionEligibilitySync(
        {
          userId: user.id,
          profile: {
            id: profile.id,
            role: profile.role,
            business_unit_id: profile.business_unit_id ?? null,
            plant_id: profile.plant_id ?? null,
            managed_plant_ids: profile.managed_plant_ids ?? null,
            can_authorize_up_to: profile.can_authorize_up_to ?? null,
          },
          effectiveBusinessRole: null,
          scope: 'plant',
          authorizationLimit: profile.can_authorize_up_to ?? 0,
        },
        executorRoles,
        asset
      )

      setCanCompleteChecklist(eligibility.allowed)
      setAllowedExecutorRoles(eligibility.allowedExecutorRoles)
      setCompletionDeniedReason(eligibility.allowed ? null : eligibility.reason ?? null)
    },
    [profile, user?.id]
  )

  const loadCompletionAuth = useCallback(
    async (scheduleRow: Parameters<typeof resolveScheduleAuthContext>[0]) => {
      if (!navigator.onLine) {
        applyClientCompletionAuth(scheduleRow)
        return
      }

      try {
        const res = await fetch(`/api/checklists/execution?id=${id}`, {
          credentials: 'include',
        })
        if (res.ok) {
          const payload = await res.json()
          setCanCompleteChecklist(payload.can_complete ?? true)
          setAllowedExecutorRoles(payload.allowed_executor_roles ?? [])
          setCompletionDeniedReason(
            payload.can_complete
              ? null
              : (payload.completion_denied_reason as string | null) ?? null
          )
          return
        }
      } catch (error) {
        console.warn('Completion auth check failed, using client fallback', error)
      }

      applyClientCompletionAuth(scheduleRow)
    },
    [applyClientCompletionAuth, id]
  )

  const securityTalkExecutor = useMemo(
    () => ({
      role: profile?.role ?? authRole,
      business_role: profile?.business_role ?? businessRole,
    }),
    [profile?.role, profile?.business_role, authRole, businessRole]
  )

  const buildSectionProgressInput = useCallback(
    (section: any) => ({
      section: {
        ...section,
        section_type: resolveExecutionSectionType(section),
      },
      itemStatus,
      sectionEvidences: evidenceData[section.id] || [],
      sectionSecurityData: securityData[section.id] || {},
      sectionPlantData: plantOperationsData[section.id],
      sectionTireReadings: tireReadingsData[section.id] ?? [],
      executorRole: securityTalkExecutor.role,
      executorBusinessRole: securityTalkExecutor.business_role,
    }),
    [itemStatus, evidenceData, securityData, plantOperationsData, tireReadingsData, securityTalkExecutor]
  )

  const getAllSectionProgressSlices = useCallback(() => {
    if (!checklist?.sections) return []
    return checklist.sections.map((section: any) => {
      const counts = computeSectionProgressCounts(buildSectionProgressInput(section))
      return {
        section_type: section.section_type,
        funnel_config: section.funnel_config,
        total: counts.total,
        completed: counts.completed,
        hasIssues: counts.hasIssues,
      }
    })
  }, [checklist, buildSectionProgressInput])

  const getUnifiedProgress = useCallback(() => {
    return aggregateChecklistProgress(getAllSectionProgressSlices())
  }, [getAllSectionProgressSlices])

  const getSectionProgress = useCallback((): SectionProgress[] => {
    if (!checklist?.sections) return []

    return checklist.sections.map((section: any) => {
      const counts = computeSectionProgressCounts(buildSectionProgressInput(section))

      return {
        id: section.id,
        title: section.title,
        type: (section.section_type || 'checklist') as SectionProgress['type'],
        total: counts.total,
        completed: counts.completed,
        hasIssues: counts.hasIssues,
        isCollapsed: sectionCollapsed[section.id] || false,
      }
    })
  }, [checklist, buildSectionProgressInput, sectionCollapsed])

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

  const applyServerDraftPayload = useCallback(
    (payload: unknown, updatedAt: string | null) => {
      if (!isChecklistScheduleDraftPayload(payload)) return

      setIsLoadingFromStorage(true)
      if (payload.security_data && typeof payload.security_data === 'object') {
        setSecurityData((prev) =>
          mergeSectionRecordMaps(
            prev,
            payload.security_data as Record<string, unknown>
          )
        )
      }
      if (
        payload.plant_operations_data &&
        typeof payload.plant_operations_data === 'object'
      ) {
        setPlantOperationsData((prev) =>
          mergeSectionRecordMaps(
            prev,
            payload.plant_operations_data as Record<string, unknown>
          )
        )
      }
      serverDraftUpdatedAtRef.current = updatedAt
      setServerDraftUpdatedAt(updatedAt)
      setLaneBDraftDirty(false)
      setIsLoadingFromStorage(false)
    },
    []
  )

  const saveDraftToServer = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!checklist || !navigator.onLine) return false

      const hasLaneBData =
        Object.keys(securityData).length > 0 ||
        Object.keys(plantOperationsData).length > 0
      if (!hasLaneBData && !laneBDraftDirty) return false

      setSavingDraft(true)
      try {
        const result = await patchServerDraftWithMerge(
          id,
          {
            securityData,
            plantOperationsData,
            serverDraftUpdatedAt: serverDraftUpdatedAtRef.current,
          },
          {
            clientUpdatedAt: serverDraftUpdatedAtRef.current ?? undefined,
          }
        )

        if (!result.ok) {
          if (result.status === 409 && result.conflict) {
            applyServerDraftPayload(
              mergeServerAndLocalDraftPayload(result.conflict, {
                securityData,
                plantOperationsData,
              }),
              result.draft_updated_at ?? null
            )
            toast.warning(
              'Borrador actualizado en otro dispositivo, se combinaron los cambios',
              { duration: 5000 }
            )
            return false
          }
          throw new Error(`HTTP ${result.status}`)
        }

        serverDraftUpdatedAtRef.current = result.draft_updated_at ?? null
        setServerDraftUpdatedAt(result.draft_updated_at ?? null)
        setLaneBDraftDirty(false)
        setLastSaved(new Date())
        if (!options?.silent) {
          toast.success('Borrador guardado')
        }
        return true
      } catch (error) {
        console.error('Error saving server draft:', error)
        if (!options?.silent) {
          toast.error('No se pudo guardar el borrador en el servidor')
        }
        return false
      } finally {
        setSavingDraft(false)
      }
    },
    [
      applyServerDraftPayload,
      checklist,
      id,
      laneBDraftDirty,
      plantOperationsData,
      securityData,
    ]
  )

  // Guardar en localStorage para recuperación
  const saveToLocalStorage = useCallback(() => {
    if (!checklist) return

    const saveData = sanitizeLocalChecklistDraft({
      checklist,
      itemStatus,
      itemNotes,
      itemPhotos,
      notes,
      technician,
      signature,
      selectedItem,
      equipmentReadings,
      evidenceData: sanitizeEvidenceMapForStorage(evidenceData),
      securityData: sanitizeSecurityTalkDataForStorage(securityData),
      plantOperationsData,
      tireReadingsData,
      sectionCollapsed,
      timestamp: Date.now(),
    })

    void offlineClient.saveDraft(id, saveData)
    setHasUnsavedChanges(false)
    hasUnsavedChangesRef.current = false
    setHasLocalDraft(true)
    setLastSaved(new Date())
    toast.success("Borrador guardado localmente", { duration: 2000 })
  }, [checklist, itemStatus, itemNotes, itemPhotos, notes, technician, signature, selectedItem, equipmentReadings, evidenceData, securityData, plantOperationsData, tireReadingsData, sectionCollapsed, id])

  // Auto-guardar Lane B en servidor cada 30s; local para el resto
  useEffect(() => {
    if (typeof window === 'undefined') return

    const autoSaveInterval = setInterval(() => {
      if (laneBDraftDirty && checklist && navigator.onLine) {
        void saveDraftToServer({ silent: true }).then((ok) => {
          if (ok) toast.success('Borrador guardado', { duration: 2000 })
        })
      } else if (hasUnsavedChanges && checklist) {
        saveToLocalStorage()
      }
    }, 30000)

    return () => clearInterval(autoSaveInterval)
  }, [laneBDraftDirty, hasUnsavedChanges, checklist, saveDraftToServer, saveToLocalStorage])

  const restoreDraftData = useCallback((
    data: Record<string, any>,
    options?: { skipLaneB?: boolean; silent?: boolean }
  ) => {
    const isRecent = Date.now() - (data.timestamp || 0) < 48 * 60 * 60 * 1000

    if (!isRecent) {
      console.log('📅 Local draft expired, cleaning up')
      void offlineClient.clearDraft(id)
      return false
    }

    if (!localDraftHasRestorableData(data)) {
      console.log('🔍 No significant data in local draft')
      return false
    }

    console.log('📂 Restoring checklist progress from draft:', {
      itemsCompleted: Object.keys(data.itemStatus || {}).length,
      hasNotes: !!data.notes,
      hasTechnician: !!data.technician,
      hasSignature: !!data.signature,
      hasEquipmentReadings: !!(data.equipmentReadings?.hours_reading || data.equipmentReadings?.kilometers_reading),
      evidenceSections: Object.keys(data.evidenceData || {}).length,
      securitySections: Object.keys(data.securityData || {}).length,
      plantOpsSections: Object.keys(data.plantOperationsData || {}).length,
      tireReadingSections: Object.keys(data.tireReadingsData || {}).length,
    })

    setIsLoadingFromStorage(true)

    Promise.resolve().then(() => {
      if (data.itemStatus) setItemStatus(data.itemStatus)
      if (data.itemNotes) setItemNotes(data.itemNotes)
      if (data.itemPhotos) setItemPhotos(data.itemPhotos)
      if (data.notes !== undefined) setNotes(data.notes || "")
      if (data.technician !== undefined) setTechnician(data.technician || "")
      if (data.signature !== undefined) setSignature(data.signature || null)
      if (data.selectedItem !== undefined) setSelectedItem(data.selectedItem || null)
      if (data.equipmentReadings) {
        setEquipmentReadings(data.equipmentReadings)
        setEquipmentReadingsValidation(null)
        setReadingsFormKey((key) => key + 1)
      }
      if (data.evidenceData) setEvidenceData(data.evidenceData)
      if (!options?.skipLaneB) {
        if (data.securityData) {
          setSecurityData((prev) =>
            mergeSectionRecordMaps(prev, data.securityData)
          )
        }
        if (data.plantOperationsData) {
          setPlantOperationsData((prev) =>
            mergeSectionRecordMaps(prev, data.plantOperationsData)
          )
        }
      }
      if (data.tireReadingsData) {
        setTireReadingsData((prev) => ({
          ...prev,
          ...data.tireReadingsData,
        }))
      }
      if (data.sectionCollapsed) setSectionCollapsed(data.sectionCollapsed)
      setHasUnsavedChanges(false)
      hasUnsavedChangesRef.current = false
      setHasLocalDraft(true)
      setIsLoadingFromStorage(false)

      if (!options?.silent) {
        const completedItems = Object.keys(data.itemStatus || {}).length
        toast.success("📋 Progreso restaurado", {
          description: `${completedItems} items completados, notas y firma preservados`,
          duration: 4000
        })
      }
    })

    return true
  }, [id])

  const loadFromLocalStorage = useCallback(async () => {
    if (typeof window === 'undefined') return false

    try {
      const draft = await offlineClient.getDraft(id)
      if (draft?.data && typeof draft.data === 'object') {
        setHasLocalDraft(localDraftHasRestorableData(draft.data))
        return restoreDraftData(draft.data as Record<string, any>)
      }
      setHasLocalDraft(false)
    } catch (error) {
      console.error('Error loading Dexie draft:', error)
    }
    return false
  }, [id, restoreDraftData])

  const applyDraftRestore = useCallback(
    (prompt: {
      savedAt: Date
      serverPayload: ChecklistScheduleDraftPayload | null
      serverUpdatedAt: string | null
      localData: Record<string, any> | null
    }) => {
      // Unblock Lane B handlers and defer child mount until payload is applied.
      setDraftRestorePromptSynced(null)

      const serverAt = prompt.serverUpdatedAt
        ? new Date(prompt.serverUpdatedAt).getTime()
        : 0
      const localAt =
        typeof prompt.localData?.timestamp === 'number'
          ? prompt.localData.timestamp
          : 0
      const preferServer =
        !!prompt.serverPayload && (!prompt.localData || serverAt >= localAt)

      if (preferServer && prompt.serverPayload) {
        applyServerDraftPayload(prompt.serverPayload, prompt.serverUpdatedAt)
        if (prompt.localData) {
          restoreDraftData(prompt.localData, { skipLaneB: true, silent: true })
        }
        toast.info('Se restauró el borrador del servidor', { duration: 4000 })
      } else if (prompt.localData) {
        restoreDraftData(prompt.localData)
      }

      setLastSaved(prompt.savedAt)
      setLaneBMountVersion((version) => version + 1)
    },
    [applyServerDraftPayload, restoreDraftData, setDraftRestorePromptSynced]
  )

  // Jun 25 draft-sync: operators should not stare at an empty section waiting on the
  // restore banner — auto-apply so the security talk form is immediately usable.
  useEffect(() => {
    if (!draftRestorePrompt || !checklist) return

    const roleKeys = [
      profile?.role ?? authRole,
      profile?.business_role ?? businessRole,
    ]
      .filter(Boolean)
      .map((role) => String(role).toUpperCase())

    const isFieldOperator = roleKeys.some((role) =>
      role === 'OPERADOR' || role === 'MECANICO'
    )

    if (isFieldOperator) {
      applyDraftRestore(draftRestorePrompt)
    }
  }, [
    draftRestorePrompt,
    checklist,
    profile?.role,
    profile?.business_role,
    authRole,
    businessRole,
    applyDraftRestore,
  ])

  const handleContinueDraft = useCallback(() => {
    if (!draftRestorePrompt) return
    applyDraftRestore(draftRestorePrompt)
  }, [draftRestorePrompt, applyDraftRestore])

  const handleDiscardDraft = useCallback(async () => {
    if (!draftRestorePrompt) return
    setDiscardingDraft(true)
    try {
      let serverCleared = true
      if (navigator.onLine) {
        const serverResult = await clearServerScheduleDraft(id)
        serverCleared = serverResult.ok
      }

      await offlineClient.clearDraft(id)
      setHasLocalDraft(false)
      serverDraftUpdatedAtRef.current = null
      setServerDraftUpdatedAt(null)
      setLaneBDraftDirty(false)
      setDraftRestorePromptSynced(null)
      setLaneBMountVersion((version) => version + 1)

      if (!serverCleared && navigator.onLine) {
        toast.warning(
          'Borrador descartado en este dispositivo; no se pudo limpiar en el servidor.',
          { duration: 5000 }
        )
      } else {
        toast.message(
          'Borrador descartado. Puede iniciar el checklist desde cero en cualquier dispositivo.'
        )
      }
    } finally {
      setDiscardingDraft(false)
    }
  }, [draftRestorePrompt, id, setDraftRestorePromptSynced])

  const probeLocalDraftPrompt = useCallback(async () => {
    const localDraft = await offlineClient.getDraft(id)
    const localData =
      localDraft?.data && typeof localDraft.data === 'object'
        ? (localDraft.data as Record<string, any>)
        : null
    setHasLocalDraft(localDraftHasRestorableData(localData))
    const promptMeta = detectDraftRestorePrompt({
      serverPayload: null,
      serverUpdatedAt: null,
      serverAuthorName: null,
      localData,
    })
    if (promptMeta) {
      setDraftRestorePromptSynced({
        ...promptMeta,
        serverPayload: null,
        serverUpdatedAt: null,
        localData,
      })
    }
  }, [id, setDraftRestorePromptSynced])

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
          const minPhotos =
            typeof config.min_photos === 'number' ? config.min_photos : 1
          const categories = config.categories || []

          if (minPhotos <= 0 || categories.length === 0) {
            return
          }
          
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
        
        // Intentar cargar desde cache si estamos offline
        if (!currentlyOnline) {
          const cached = await offlineClient.getCachedTemplate(id)

          if (cached) {
            setChecklist(checklistStateFromCache(cached))
            void loadCompletionAuth(cached.template as Parameters<typeof resolveScheduleAuthContext>[0])
            setLoading(false)
            setTimeout(() => void probeLocalDraftPrompt(), 0)
            return
          } else {
            toast.error("Este checklist no está disponible offline. Use «Preparar offline» con conexión.")
            setLoading(false)
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
              draft_payload,
              draft_updated_at,
              draft_updated_by,
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
                  maintenance_unit,
                  category
                )
              ),
              assets (
                id,
                name,
                asset_id,
                location,
                current_hours,
                current_kilometers,
                plant_id
              )
            `)
            .eq('id', id)
            .single()
          
          if (error) throw error

          const draftUpdaterProfile = await fetchDraftUpdaterProfile(
            supabase,
            data.draft_updated_by
          )
          
          // Estructurar los datos con secciones e items ordenados
          const sectionsData = data.checklists?.checklist_sections || []
          const orderedSections = sectionsData
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((section: any) => ({
              ...section,
              checklist_items: (section.checklist_items || []).sort((a: any, b: any) => a.order_index - b.order_index)
            }))
          
          const muRaw = data.checklists?.equipment_models?.maintenance_unit ?? null
          const modelCategory = data.checklists?.equipment_models?.category ?? null
          const visibleMeters = computeVisibleMeters(muRaw, modelCategory)
          const maintenanceUnitForForm: "hours" | "kilometers" | null =
            visibleMeters === "kilometers"
              ? "kilometers"
              : visibleMeters === "none"
                ? null
                : visibleMeters === "both"
                  ? null
                  : "hours"

          const checklistData = {
            id: data.id,
            name: data.checklists?.name || '',
            assetId: data.assets?.id || '',
            assetCode: data.assets?.asset_id || '',
            asset: data.assets?.name || '',
            assetLocation: data.assets?.location || '',
            plantId: data.assets?.plant_id || null,
            modelId: data.checklists?.model_id || '',
            model: data.checklists?.equipment_models?.name || 'N/A',
            manufacturer: data.checklists?.equipment_models?.manufacturer || 'N/A',
            frequency: data.checklists?.frequency || '',
            sections: orderedSections,
            scheduledDate: data.scheduled_date || '',
            scheduledDay:
              data.scheduled_day ||
              (data.scheduled_date ? String(data.scheduled_date).split('T')[0] : ''),
            technicianId: data.assigned_to || '',
            maintenance_plan_id: data.maintenance_plan_id || null,
            // Información del activo para lecturas
            currentHours: data.assets?.current_hours || 0,
            currentKilometers: data.assets?.current_kilometers || 0,
            maintenanceUnitRaw: muRaw,
            modelCategory,
            visibleMeters,
            maintenanceUnit: maintenanceUnitForForm,
          }
          
          serverDraftUpdatedAtRef.current = data.draft_updated_at ?? null
          setServerDraftUpdatedAt(data.draft_updated_at ?? null)

          const localDraft = await offlineClient.getDraft(id)
          const localData =
            localDraft?.data && typeof localDraft.data === 'object'
              ? (localDraft.data as Record<string, any>)
              : null
          setHasLocalDraft(localDraftHasRestorableData(localData))

          const authorName = formatDraftSavedBy(draftUpdaterProfile)

          const promptMeta = detectDraftRestorePrompt({
            serverPayload: data.draft_payload,
            serverUpdatedAt: data.draft_updated_at ?? null,
            serverAuthorName: authorName,
            localData,
          })

          if (promptMeta) {
            setDraftRestorePromptSynced({
              ...promptMeta,
              serverPayload: isChecklistScheduleDraftPayload(data.draft_payload)
                ? data.draft_payload
                : null,
              serverUpdatedAt: data.draft_updated_at ?? null,
              localData,
            })
          } else if (data.draft_updated_at) {
            setLastSaved(new Date(data.draft_updated_at))
          }

          // Resolve draft prompt before mounting Lane B sections (avoids prefill overwriting server draft).
          setChecklist(checklistData)

          await offlineClient.cacheTemplate(id, data, data.assets)
          void loadCompletionAuth(data)
        }
      } catch (error: unknown) {
        console.error("Error loading checklist data:", error)
        const cached = await offlineClient.getCachedTemplate(id)
        if (cached) {
          setChecklist(checklistStateFromCache(cached))
          void loadCompletionAuth(cached.template as Parameters<typeof resolveScheduleAuthContext>[0])
          setTimeout(() => void probeLocalDraftPrompt(), 0)
          return
        }
        const message = error instanceof Error ? error.message : "Error desconocido"
        toast.error("Error al cargar el checklist: " + message)
        router.back()
      } finally {
        setLoading(false)
      }
    }

    fetchChecklistData()
  }, [id, router, applyServerDraftPayload, probeLocalDraftPrompt, loadCompletionAuth])

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

        if (laneBDraftDirty && checklist) {
          void saveDraftToServer({ silent: true })
        }
        
        // Also try to reload any saved progress that might have been lost
        setTimeout(() => {
          void loadFromLocalStorage().then((hasProgress) => {
            if (hasProgress) {
              console.log('📂 Restored progress after reconnection')
            }
          })
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
  }, [hasUnsavedChanges, laneBDraftDirty, checklist, saveToLocalStorage, saveDraftToServer])

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
    const sanitized = sanitizeEvidenceMapForStorage({ [sectionId]: evidences })[sectionId] ?? []
    setEvidenceData(prev => ({
      ...prev,
      [sectionId]: sanitized
    }))
    markAsUnsaved()
  }, [markAsUnsaved])

  // Manejar cambios en datos de seguridad
  const handleSecurityDataChange = useCallback((sectionId: string, data: any) => {
    const sanitized = sanitizeSecurityTalkDataForStorage({
      [sectionId]: data,
    })[sectionId] as typeof data
    setSecurityData((prev) => ({
      ...prev,
      [sectionId]: sanitized ?? data,
    }))
    setLaneBDraftDirty(true)
    markAsUnsaved()
  }, [markAsUnsaved])

  const handlePlantOperationsDataChange = useCallback((sectionId: string, data: any) => {
    const sanitizedSection = sanitizePlantOperationsDataForStorage({
      [sectionId]: data,
    })[sectionId] as typeof data
    const nextData = sanitizedSection ?? data

    setPlantOperationsData((prev) => {
      const existing = prev[sectionId]
      if (existing && nextData) {
        if (
          validateBonusClosureSectionPayload(nextData) &&
          validateBonusClosureSectionPayload(existing)
        ) {
          if (
            serializeBonusClosureSectionData(nextData) ===
            serializeBonusClosureSectionData(existing)
          ) {
            return prev
          }
        } else if (
          typeof nextData === "object" &&
          typeof existing === "object" &&
          "had_production" in nextData &&
          "had_production" in existing
        ) {
          if (JSON.stringify(nextData) === JSON.stringify(existing)) {
            return prev
          }
        }
      }
      return {
        ...prev,
        [sectionId]: nextData,
      }
    })
    setLaneBDraftDirty(true)
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

  const handleEquipmentReadingsValidationChange = useCallback(
    (validation: EquipmentReadingsValidation | null) => {
      setEquipmentReadingsValidation(validation)
    },
    []
  )

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
      const section = sectionAndItem?.section
      return {
        item_id: itemId,
        status: itemStatus[itemId],
        notes: itemNotes[itemId] || null,
        photo_url: itemPhotos[itemId] || null,
        description: sectionAndItem?.item?.description || null,
        section_type: section?.section_type || null,
        section_title: section?.title || null,
        funnel_lane: section ? getSectionFunnelLane(section) : 'maintenance',
      }
    })
  }, [itemStatus, itemNotes, itemPhotos])

  // Essential helper functions - MOVED UP to fix hoisting issue
  const getTotalItems = () => getUnifiedProgress().totalItems

  const getCompletedItems = () => getUnifiedProgress().completedItems

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
      errors.push(`📋 ${missingCount} campo${missingCount > 1 ? 's' : ''} pendiente${missingCount > 1 ? 's' : ''}`)
      
      // Find specific uncompleted checklist items for detail warnings
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
    const vm = resolvedVisibleMeters

    if (process.env.NODE_ENV === "development") {
      console.log("🔍 validateEquipmentReadings - readings:", equipmentReadings, "visibleMeters:", vm)
    }

    if (vm === "none") {
      return { isValid: true, errors, warnings }
    }

    errors.push(...validateReadingsPresence(vm, equipmentReadings))

    if (errors.length > 0) {
      return { isValid: false, errors, warnings }
    }

    if (equipmentReadingsValidation) {
      if (!equipmentReadingsValidation.valid) {
        errors.push("⏱️ Lecturas del equipo inválidas")
        errors.push(...equipmentReadingsValidation.errors)
        warnings.push(...equipmentReadingsValidation.warnings)
        warnings.push(...equipmentReadingsValidation.hints)
      } else {
        warnings.push(...equipmentReadingsValidation.warnings)
        warnings.push(...equipmentReadingsValidation.hints)
      }
    } else if (
      equipmentReadings.hours_reading != null ||
      equipmentReadings.kilometers_reading != null
    ) {
      warnings.push("Espere a que termine la validación de lecturas antes de enviar")
      errors.push("⏱️ Validando lecturas del equipo…")
    }

    const result = { isValid: errors.length === 0, errors, warnings }

    if (process.env.NODE_ENV === "development") {
      console.log("🔍 validateEquipmentReadings result:", result)
    }

    return result
  }

  const scrollToFieldById = useCallback((elementId: string) => {
    const el = typeof document !== "undefined" ? document.getElementById(elementId) : null
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("ring-2", "ring-destructive", "ring-offset-2", "rounded-lg")
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-destructive", "ring-offset-2", "rounded-lg")
      }, 2200)
    }
  }, [])

  const firstIncompleteSectionDomId = useMemo(() => {
    if (!checklist?.sections) return null
    for (const section of checklist.sections) {
      const counts = computeSectionProgressCounts({
        section: {
          ...section,
          section_type: resolveExecutionSectionType(section),
        },
        itemStatus,
        sectionEvidences: evidenceData[section.id] || [],
        sectionSecurityData: securityData[section.id] || {},
        sectionPlantData: plantOperationsData[section.id],
        sectionTireReadings: tireReadingsData[section.id] ?? [],
        executorRole: securityTalkExecutor.role,
        executorBusinessRole: securityTalkExecutor.business_role,
      })
      if (!counts.isComplete) {
        return `section-${section.id}`
      }
    }
    return null
  }, [checklist, itemStatus, evidenceData, securityData, plantOperationsData, tireReadingsData, securityTalkExecutor])

  const liveBlockingIssues = useMemo(() => {
    if (!checklist) {
      return [] as Array<{ id: string; label: string; targetId: string }>
    }
    const issues: Array<{ id: string; label: string; targetId: string }> = []
    const totalItems = getTotalItems()
    const completedItems = getCompletedItems()
    if (completedItems < totalItems) {
      issues.push({
        id: "items",
        label: `${totalItems - completedItems} pendiente${totalItems - completedItems > 1 ? 's' : ''}`,
        targetId: firstIncompleteSectionDomId || "checklist-scroll-items-start",
      })
    }
    if (!technician?.trim()) {
      issues.push({ id: "tech", label: "Falta técnico", targetId: "checklist-field-technician" })
    }
    if (!signature) {
      issues.push({ id: "sig", label: "Falta firma", targetId: "checklist-field-signature" })
    }
    const ev = validateEvidenceRequirements()
    if (!ev.isValid) {
      const evSection = checklist.sections?.find((s: any) => s.section_type === "evidence")
      issues.push({
        id: "evidence",
        label: "Faltan fotos",
        targetId: evSection ? `section-${evSection.id}` : "checklist-scroll-items-start",
      })
    }
    const readings = validateEquipmentReadings()
    if (!readings.isValid) {
      issues.push({
        id: "readings",
        label: equipmentReadingsValidation?.valid === false ? "Lecturas inválidas" : "Faltan lecturas",
        targetId: "checklist-field-equipment-readings",
      })
    }
    if (checklist?.sections) {
      for (const section of checklist.sections) {
        const resolvedType = resolveExecutionSectionType(section)
        if (resolvedType === 'security_talk') {
          const counts = computeSectionProgressCounts({
            section: { ...section, section_type: resolvedType },
            itemStatus,
            sectionEvidences: evidenceData[section.id] || [],
            sectionSecurityData: securityData[section.id] || {},
            sectionPlantData: plantOperationsData[section.id],
            sectionTireReadings: tireReadingsData[section.id] ?? [],
            executorRole: securityTalkExecutor.role,
            executorBusinessRole: securityTalkExecutor.business_role,
          })
          if (!counts.isComplete) {
            issues.push({
              id: `security-${section.id}`,
              label: 'Charla de seguridad incompleta',
              targetId: `section-${section.id}`,
            })
          }
        }

        if (resolvedType !== 'tire_readings') continue
        const sectionReadings = tireReadingsData[section.id] ?? []
        const tireValidation = validateTireReadingsSection({
          readings: sectionReadings,
          positionCount: sectionReadings.length,
          config: section.tire_readings_config,
          sectionTitle: section.title,
        })
        if (!tireValidation.valid) {
          issues.push({
            id: `tire-${section.id}`,
            label: 'Faltan lecturas de llantas',
            targetId: `section-${section.id}`,
          })
          break
        }
      }
    }
    return issues
  }, [
    checklist,
    itemStatus,
    technician,
    signature,
    evidenceData,
    equipmentReadings,
    equipmentReadingsValidation,
    firstIncompleteSectionDomId,
    resolvedVisibleMeters,
    tireReadingsData,
    plantOperationsData,
    securityData,
    securityTalkExecutor,
  ])

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

    // 3b. Validate security talk sections (operator self-attendance vs plant roster)
    if (checklist?.sections) {
      for (const section of checklist.sections) {
        const resolvedType = resolveExecutionSectionType(section)
        if (resolvedType !== 'security_talk') continue
        const counts = computeSectionProgressCounts({
          section: { ...section, section_type: resolvedType },
          itemStatus,
          sectionEvidences: evidenceData[section.id] || [],
          sectionSecurityData: securityData[section.id] || {},
          sectionPlantData: plantOperationsData[section.id],
          sectionTireReadings: tireReadingsData[section.id] ?? [],
          executorRole: securityTalkExecutor.role,
          executorBusinessRole: securityTalkExecutor.business_role,
        })
        if (!counts.isComplete) {
          validationErrors.push(
            `🛡️ Charla de seguridad: complete ${section.title || 'la sección de seguridad'}`
          )
        }
      }
    }

    // 3c. Validate tire readings sections
    if (checklist?.sections) {
      for (const section of checklist.sections) {
        if (section.section_type !== 'tire_readings') continue
        const readings = tireReadingsData[section.id] ?? []
        const tireValidation = validateTireReadingsSection({
          readings,
          positionCount: readings.length,
          config: section.tire_readings_config,
          sectionTitle: section.title,
        })
        if (!tireValidation.valid) {
          validationErrors.push(...tireValidation.errors)
        }
      }
    }

    // 3d. Validate bonus_closure sections
    if (checklist?.sections) {
      for (const section of checklist.sections) {
        if (section.section_type !== 'bonus_closure') continue
        const sectionData = plantOperationsData[section.id]
        const operatorCount = sectionData?.decisions?.length ?? 0
        if (!isBonusClosureSectionComplete(sectionData, operatorCount)) {
          validationErrors.push('🏆 Cierre de bono: defina elegibilidad y motivos')
        }
      }
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
      return shouldCreateChecklistIssue(sectionAndItem?.section ?? {})
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
      if (process.env.NODE_ENV === "development") {
        console.log("❌ Validation failed, showing errors and returning early")
      }
      toast.error("⚠️ No se puede enviar el checklist", {
        description: `Faltan: ${validationErrors.join(", ")}`,
        duration: 8000,
      })
      validationWarnings.forEach((warning, index) => {
        setTimeout(() => {
          toast.warning(warning, { duration: 6000 })
        }, (index + 1) * 500)
      })
      const first = liveBlockingIssues[0]
      if (first?.targetId) {
        scrollToFieldById(first.targetId)
      }
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

    const hasBonusClosure = checklist?.sections?.some(
      (s: { section_type?: string }) => s.section_type === 'bonus_closure'
    )
    if (hasBonusClosure && !bonusClosureConfirmedRef.current) {
      setBonusClosureConfirmOpen(true)
      return
    }

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
      duration: 3000,
    })

    if (completedId !== "success" && completedId !== "offline-success") {
      setCompletedChecklistId(completedId)
    }

    const resolvedWoChecklistId =
      completedId !== "success" && completedId !== "offline-success"
        ? completedId
        : completedChecklistId || completedId

    if (maintenanceItemsWithIssues.length > 0) {
      if (process.env.NODE_ENV === "development") {
        console.log("⚠️ Found maintenance issues, handling corrective actions...", {
          issueCount: maintenanceItemsWithIssues.length,
          completedId,
          operatorSimpleFlow,
        })
      }

      const itemsPayload = maintenanceItemsWithIssues
        .map(([itemId]) => {
          const sectionAndItem = findSectionAndItemById(itemId)
          return {
            id: itemId,
            description: sectionAndItem?.item?.description || "",
            notes: itemNotes[itemId] || "",
            photo: itemPhotos[itemId] || null,
            status: itemStatus[itemId] as "flag" | "fail",
            sectionTitle: sectionAndItem?.section?.title,
            sectionType: sectionAndItem?.section?.section_type,
            funnelConfig: sectionAndItem?.section?.funnel_config,
          }
        })
        .filter((item) =>
          shouldCreateChecklistIssue({
            section_type: item.sectionType,
            funnel_config: item.funnelConfig,
          })
        )

      if (operatorSimpleFlow) {
        const uuidOk =
          typeof resolvedWoChecklistId === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedWoChecklistId)

        if (isOnline && uuidOk) {
          setOperatorAutoWoSubmitting(true)
          try {
            const description = buildCorrectiveDescriptionFromIssues(
              checklist.name,
              itemsPayload.map((i) => ({
                description: i.description,
                status: i.status,
                notes: i.notes,
                sectionTitle: i.sectionTitle,
              }))
            )
            const itemsWithPriorities = itemsPayload.map((item) => ({
              ...item,
              priority: item.status === "fail" ? "Alta" : "Media",
            }))
            const res = await fetch("/api/checklists/generate-corrective-work-order-enhanced", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                checklist_id: resolvedWoChecklistId,
                asset_id: checklist.assetId,
                asset_name: checklist.asset,
                items_with_issues: itemsWithPriorities,
                priority: "Media",
                description,
                enable_smart_deduplication: true,
                consolidation_window_days: 30,
                consolidation_choices: {},
              }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
              throw new Error(data.error || data.message || "Error al crear órdenes")
            }
            const subtitle =
              data.message ||
              (data.work_orders_created > 0
                ? `Se crearon ${data.work_orders_created} orden(es) de trabajo.`
                : "Problemas registrados.")
            setCompletionOverlayTitle("Checklist completado")
            setCompletionOverlaySubtitle(subtitle)
            setCompletionRedirectLabel(operatorSimpleFlow ? "Panel de operador" : "Activos")
            setCompleted(true)
            setCompletionOverlayOpen(true)
          } catch (e) {
            console.error(e)
            toast.error("No se pudieron crear las órdenes automáticamente", {
              description: e instanceof Error ? e.message : "Intente de nuevo o contacte a su coordinador",
            })
          } finally {
            setOperatorAutoWoSubmitting(false)
          }
        } else {
          setCompletionOverlayTitle("Checklist guardado")
          setCompletionOverlaySubtitle(
            "Sin conexión o datos pendientes: las órdenes se crearán al sincronizar o desde coordinación."
          )
          setCompletionRedirectLabel(operatorSimpleFlow ? "Panel de operador" : "Activos")
          setCompleted(true)
          setCompletionOverlayOpen(true)
        }
        return
      }

      setCompleted(true)
      toast.success("✅ Checklist completado exitosamente", {
        description: "Configurando órdenes de trabajo correctivas...",
        duration: 3000,
      })
      setTimeout(() => {
        handleCorrectiveDialogOpen()
      }, 1000)
      return
    }

    if (process.env.NODE_ENV === "development") {
      console.log("✅ No issues found, completing normally")
    }
    setCompleted(true)
    setCompletionOverlayTitle("Checklist completado")
    setCompletionOverlaySubtitle("Todo guardado correctamente.")
    setCompletionRedirectLabel(operatorSimpleFlow ? "Panel de operador" : "Activos")
    setCompletionOverlayOpen(true)

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

    const vmSubmit = resolvedVisibleMeters
    let hoursOut: number | null = null
    let kmOut: number | null = null
    if (vmSubmit === "hours" || vmSubmit === "both") {
      hoursOut = equipmentReadings.hours_reading ?? null
    }
    if (vmSubmit === "kilometers" || vmSubmit === "both") {
      kmOut = equipmentReadings.kilometers_reading ?? null
    }

    try {
      const completedItems = prepareCompletedItems()

      const submissionData = sanitizeChecklistCompletePayload({
        completed_items: completedItems,
        technician: technician || 'Técnico',
        notes,
        signature,
        hours_reading: hoursOut,
        kilometers_reading: kmOut,
        evidence_data: evidenceData,
        security_data: Object.keys(securityData).length > 0 ? securityData : undefined,
        plant_operations_data:
          Object.keys(plantOperationsData).length > 0
            ? plantOperationsData
            : undefined,
        tire_readings: Object.values(tireReadingsData).flat(),
      })
      
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
            const enriched = enrichEquipmentReadingsValidation(
              {
                valid: false,
                errors: errorData.validation_errors || [],
                warnings: errorData.validation_warnings || [],
                hints: errorData.validation_hints || [],
                current_hours: errorData.current_hours,
                current_kilometers: errorData.current_kilometers,
              },
              {
                hours_reading: hoursOut,
                kilometers_reading: kmOut,
              }
            )
            const { errors: readingErrors, hints } = formatSubmissionReadingErrors(enriched)

            toast.error("No se pudo completar el checklist: lecturas inválidas", {
              description: readingErrors[0],
              duration: 10000,
            })
            readingErrors.slice(1).forEach((error: string, index: number) => {
              setTimeout(() => toast.error(error, { duration: 9000 }), (index + 1) * 400)
            })
            hints.forEach((hint: string, index: number) => {
              setTimeout(() => toast.warning(hint, { duration: 10000 }), (readingErrors.length + index + 1) * 400)
            })
            scrollToFieldById("checklist-field-equipment-readings")
          } else {
            console.error('General error:', errorData.error || errorData.details)
            toast.error(errorData.error || errorData.details || 'Error al enviar el checklist')
            throw new Error(errorData.error || errorData.details || 'Error al enviar el checklist')
          }
        }
      } else {
        // Guardar offline si no hay conexión
        try {
          const completedChecklistId = `checklist-offline-${id}-${Date.now()}`
          const offlineSubmissionData = {
            ...submissionData,
            schedule_id: id,
            scheduleId: id,
            completed_checklist_id: completedChecklistId,
          }

          const offlineId = `checklist-${id}-${Date.now()}`
          await offlineClient.enqueueChecklistComplete(offlineSubmissionData, offlineId)
          await offlineClient.clearDraft(id)
          toast.success("📱 Checklist guardado sin conexión", {
            description: "Se sincronizará automáticamente cuando vuelva la conexión",
            duration: 4000
          })
          return completedChecklistId
        } catch (offlineError) {
          console.error('❌ Error saving offline checklist:', offlineError)
          toast.error("Error al guardar offline", {
            description: "No se pudo guardar el checklist",
            duration: 5000
          })
          throw new Error('No se pudo guardar offline')
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
          const completedChecklistId = `checklist-offline-fallback-${id}-${Date.now()}`
          const fallbackSubmissionData = sanitizeChecklistCompletePayload({
            schedule_id: id,
            scheduleId: id,
            completed_checklist_id: completedChecklistId,
            technician: technician || 'Técnico',
            notes,
            signature,
            completed_items: Object.keys(itemStatus).map(itemId => ({
              item_id: itemId,
              status: itemStatus[itemId],
              notes: itemNotes[itemId] || null,
              photo_url: itemPhotos[itemId] || null
            })),
            hours_reading: hoursOut,
            kilometers_reading: kmOut,
            evidence_data: evidenceData,
            security_data: Object.keys(securityData).length > 0 ? securityData : undefined,
            plant_operations_data:
              Object.keys(plantOperationsData).length > 0
                ? plantOperationsData
                : undefined,
            tire_readings: Object.values(tireReadingsData).flat(),
          })

          const offlineId = `checklist-${id}-${Date.now()}`
          await offlineClient.enqueueChecklistComplete(fallbackSubmissionData, offlineId)
          await offlineClient.clearDraft(id)
          toast.success("Checklist guardado localmente como respaldo", {
            description: "Se sincronizará cuando vuelva la conexión",
            duration: 5000
          })
          return null
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
          sectionType: sectionAndItem?.section?.section_type,
          funnelConfig: sectionAndItem?.section?.funnel_config,
        }
      })
      .filter((item) =>
        shouldCreateChecklistIssue({
          section_type: item.sectionType,
          funnel_config: item.funnelConfig,
        })
      )

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

  /** Post-checklist: operators go home; others stay in checklist asset flows */
  const handlePostCompletionNavigation = useCallback(() => {
    const path = operatorSimpleFlow ? "/dashboard/operator" : "/checklists/assets"
    try {
      const connectivityState = navigator.onLine ? "online" : "offline"
      console.log(`🚀 Navigating after checklist (${connectivityState}) → ${path}`)
      router.push(path)
    } catch (error) {
      console.error("Navigation error:", error)
      try {
        window.location.href = path
      } catch (locationError) {
        console.error("Window location fallback failed:", locationError)
        toast.error("Error al navegar, pero el checklist fue guardado exitosamente")
      }
    }
  }, [operatorSimpleFlow, router])

  const handleCompletionOverlayContinue = useCallback(() => {
    setCompletionOverlayOpen(false)
    handlePostCompletionNavigation()
  }, [handlePostCompletionNavigation])
  
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

  const isFullyComplete = () => {
    if (!checklist || !checklist.sections) return false

    const { totalItems, completedItems } = getUnifiedProgress()

    return (
      totalItems > 0 &&
      completedItems === totalItems &&
      technician.trim() !== "" &&
      signature !== null
    )
  }

  const getSectionStatus = (section: any) => {
    const counts = computeSectionProgressCounts(buildSectionProgressInput(section))

    if (section.section_type === 'cleanliness_bonus') {
      const sectionEvidences = evidenceData[section.id] || []
      const config = section.cleanliness_config || {}
      const requiredPhotos = (config.areas || []).length * (config.min_photos || 2)
      const evidenceCompleted = Math.min(sectionEvidences.length, requiredPhotos)

      return {
        completed: counts.completed,
        total: counts.total,
        hasIssues: counts.hasIssues,
        isComplete: counts.isComplete,
        evidenceCompleted,
        evidenceTotal: requiredPhotos,
        evidenceComplete: evidenceCompleted >= requiredPhotos,
      }
    }

    return {
      completed: counts.completed,
      total: counts.total,
      hasIssues: counts.hasIssues,
      isComplete: counts.isComplete,
    }
  }

  const getOverallProgress = () => {
    const sectionProgress = getSectionProgress()
    const aggregate = getUnifiedProgress()
    const completedSections = sectionProgress.filter(
      (section) => section.completed === section.total && section.total > 0
    ).length

    return {
      totalItems: aggregate.totalItems,
      completedItems: aggregate.completedItems,
      sectionsWithIssues: aggregate.sectionsWithMaintenanceIssues,
      completedSections,
      totalSections: sectionProgress.length,
      progressPercentage: aggregate.progressPercentage,
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
  const draftSyncStatus = resolveDraftSyncStatus({
    saving: savingDraft,
    isOnline,
    hasPendingSync: hasPendingSyncs,
    laneBDraftDirty,
    hasUnsavedChanges,
    serverDraftUpdatedAt,
    hasLocalDraft,
  })
  const lastSavedLabel = formatDraftSavedAt(lastSaved)

  return (
    <div className={cn("space-y-6 relative", !completed && "pb-40 md:pb-6")}>
      {!canCompleteChecklist ? (
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Su rol no puede completar este checklist</AlertTitle>
          <AlertDescription>
            {completionDeniedReason ??
              `Roles permitidos: ${allowedExecutorRoles.join(', ') || 'No definidos'}`}
            {allowedExecutorRoles.length > 0 && completionDeniedReason
              ? ` Roles permitidos: ${allowedExecutorRoles.join(', ')}.`
              : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {draftRestorePrompt ? (
        <DraftRestoreBanner
          savedAt={draftRestorePrompt.savedAt}
          savedByName={draftRestorePrompt.savedByName}
          source={draftRestorePrompt.source}
          onContinue={handleContinueDraft}
          onDiscard={handleDiscardDraft}
          discarding={discardingDraft}
        />
      ) : null}
      {/* Simplified Navigation Bar */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm" data-navigation-header>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <DraftStatusChip status={draftSyncStatus} />
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
              onClick={() => {
                if (laneBDraftDirty && navigator.onLine) {
                  void saveDraftToServer()
                } else {
                  saveToLocalStorage()
                }
              }}
              disabled={!hasUnsavedChanges && !laneBDraftDirty}
              title="Guardar borrador"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {lastSavedLabel ? (
                <span className="hidden text-xs text-muted-foreground lg:inline">
                  {lastSavedLabel}
                </span>
              ) : null}
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
          <div id="checklist-scroll-items-start" className="space-y-4 scroll-mt-28">
            {checklist.sections && checklist.sections.map((section: any, sectionIndex: number) => {
              const resolvedSectionType = resolveExecutionSectionType(section)
              const sectionForStatus = { ...section, section_type: resolvedSectionType }
              const sectionStatus = getSectionStatus(sectionForStatus)
              const isCollapsed = sectionCollapsed[section.id] || false
              
              if (resolvedSectionType === 'evidence') {
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

              if (resolvedSectionType === 'cleanliness_bonus') {
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

              if (resolvedSectionType === 'security_talk') {
                const config = normalizeSecurityConfig(section.security_config)
                const sectionSecurityData = securityData[section.id] || {}
                const plantId = checklist?.plantId

                return (
                  <div
                    key={`security-${section.id}`}
                    id={`section-${section.id}`}
                    className="scroll-mt-20"
                  >
                    <SecurityTalkSection
                      key={`security-${section.id}-v${laneBMountVersion}`}
                      sectionId={section.id}
                      sectionTitle={section.title}
                      config={config}
                      plantId={plantId}
                      checklistScheduleId={id}
                      onDataChange={handleSecurityDataChange}
                      initialData={sectionSecurityData}
                      disabled={submitting}
                    />
                  </div>
                )
              }

              if (resolvedSectionType === 'operator_punctuality') {
                const config = section.punctuality_config || {}
                const sectionPunctualityData = plantOperationsData[section.id]
                const plantId = checklist?.plantId

                return (
                  <div
                    key={`punctuality-${section.id}`}
                    id={`section-${section.id}`}
                    className="scroll-mt-20"
                  >
                    <Collapsible
                      open={!isCollapsed}
                      onOpenChange={() => toggleSectionCollapse(section.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow border-sky-200 bg-sky-50/50">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Clock className="h-5 w-5 text-sky-600" />
                                <div>
                                  <CardTitle className="text-lg">{section.title}</CardTitle>
                                  <CardDescription>
                                    Puntualidad de operadores
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={sectionStatus.isComplete ? "default" : "secondary"}
                                  className={sectionStatus.isComplete ? "bg-green-500" : ""}
                                >
                                  {sectionStatus.completed}/{sectionStatus.total}
                                </Badge>
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
                            <OperatorPunctualitySection
                              key={`punctuality-${section.id}-v${laneBMountVersion}`}
                              sectionId={section.id}
                              sectionTitle={section.title}
                              config={config}
                              plantId={plantId}
                              onDataChange={handlePlantOperationsDataChange}
                              initialData={sectionPunctualityData}
                              disabled={submitting}
                            />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )
              }

              if (resolvedSectionType === 'bonus_closure') {
                const config = section.bonus_closure_config
                const sectionBonusData = plantOperationsData[section.id]
                const plantId = checklist?.plantId
                const scheduledDay = checklist?.scheduledDay

                return (
                  <div
                    key={`bonus-closure-${section.id}`}
                    id={`section-${section.id}`}
                    className="scroll-mt-20"
                  >
                    <Collapsible
                      open={!isCollapsed}
                      onOpenChange={() => toggleSectionCollapse(section.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow border-violet-200 bg-violet-50/50">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Award className="h-5 w-5 text-violet-600" />
                                <div>
                                  <CardTitle className="text-lg">{section.title}</CardTitle>
                                  <CardDescription>
                                    Cierre mensual de bono de limpieza
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={sectionStatus.isComplete ? "default" : "secondary"}
                                  className={sectionStatus.isComplete ? "bg-green-500" : ""}
                                >
                                  {sectionStatus.completed}/{sectionStatus.total}
                                </Badge>
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
                            <BonusClosureSection
                              key={`bonus-${section.id}-v${laneBMountVersion}`}
                              sectionId={section.id}
                              sectionTitle={section.title}
                              config={config}
                              plantId={plantId}
                              scheduledDay={scheduledDay}
                              onDataChange={handlePlantOperationsDataChange}
                              initialData={sectionBonusData}
                              disabled={submitting}
                            />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )
              }

              if (resolvedSectionType === 'tire_readings') {
                return (
                  <div
                    key={`tire-readings-${section.id}`}
                    id={`section-${section.id}`}
                    className="scroll-mt-20"
                  >
                    <TireReadingsSection
                      assetId={checklist.assetId}
                      sectionTitle={section.title}
                      config={section.tire_readings_config}
                      value={tireReadingsData[section.id] ?? []}
                      onChange={(readings) =>
                        setTireReadingsData((prev) => ({ ...prev, [section.id]: readings }))
                      }
                      disabled={submitting}
                    />
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
                      <Card
                        className={cn(
                          "cursor-pointer hover:shadow-md transition-shadow",
                          !sectionStatus.isComplete &&
                            sectionStatus.total > 0 &&
                            "border-destructive/70 ring-2 ring-destructive/25"
                        )}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <List className="h-5 w-5 text-blue-600" />
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <CardTitle className="text-lg">{section.title}</CardTitle>
                                  <SectionFunnelLaneBadge section={section} />
                                </div>
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
        key={readingsFormKey}
        assetId={checklist.assetId}
        assetName={checklist.asset}
        visibleMeters={resolvedVisibleMeters}
        currentHours={checklist.currentHours}
        currentKilometers={checklist.currentKilometers}
        initialReadings={equipmentReadings}
        onReadingsChange={handleEquipmentReadingsChange}
        onValidationChange={handleEquipmentReadingsValidationChange}
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

        <div id="checklist-field-technician" className="space-y-2 scroll-mt-28">
          <Label htmlFor="technician">Técnico Responsable</Label>
          <Input 
            id="technician" 
            value={technician} 
            onChange={handleTechnicianChange}
            placeholder="Nombre del técnico responsable"
            disabled={submitting}
          />
        </div>

        <div id="checklist-field-signature" className="space-y-2 scroll-mt-28">
          <Label htmlFor="signature">Firma</Label>
          <SignatureCanvas onSave={handleSignatureChange} />
          {signature && <p className="text-sm text-green-600 mt-1">Firma guardada</p>}
        </div>

        <div
          className={cn(
            "flex flex-col gap-3 md:flex-row md:justify-between md:items-end",
            "fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none"
          )}
        >
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:w-auto sm:items-center">
            <Button variant="outline" onClick={() => router.back()} className="w-full sm:w-auto shrink-0">
              Cancelar
            </Button>
            <div className="flex w-full flex-col gap-1 sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  if (laneBDraftDirty && navigator.onLine) {
                    void saveDraftToServer()
                  } else {
                    saveToLocalStorage()
                  }
                }}
                disabled={savingDraft || (!hasUnsavedChanges && !laneBDraftDirty)}
                className="w-full sm:w-auto shrink-0"
              >
                {savingDraft ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Guardar borrador
              </Button>
              {lastSavedLabel ? (
                <p className="text-center text-xs text-muted-foreground sm:text-left">
                  Último guardado: {lastSavedLabel}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 md:max-w-md md:items-end">
            {!liveBlockingIssues.length ? (
              <p className="text-sm text-muted-foreground">
                Progreso: {overallProgress.completedItems}/{overallProgress.totalItems} ítems
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {liveBlockingIssues.map((issue) => (
                  <Button
                    key={issue.id}
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-9 rounded-full text-xs"
                    onClick={() => scrollToFieldById(issue.targetId)}
                  >
                    {issue.label}
                  </Button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground md:justify-end">
              {isOnline ? (
                <>
                  <Wifi className="h-3 w-3 text-green-500" /> En línea
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-amber-500" /> Sin conexión
                </>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting || completed || operatorAutoWoSubmitting || !canCompleteChecklist}
              className={cn("w-full min-h-12 text-base", completed && "bg-green-600 hover:bg-green-600")}
              size="lg"
            >
              {completed ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Listo
                </>
              ) : submitting || operatorAutoWoSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {operatorAutoWoSubmitting
                    ? "Creando órdenes…"
                    : isOnline
                      ? "Enviando…"
                      : "Guardando…"}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Completar ({overallProgress.completedItems}/{overallProgress.totalItems})
                </>
              )}
            </Button>
          </div>
        </div>
      </div>



      <ChecklistCompletionOverlay
        open={completionOverlayOpen}
        title={completionOverlayTitle}
        subtitle={completionOverlaySubtitle}
        redirectPathLabel={completionRedirectLabel}
        countdownSeconds={5}
        onContinue={handleCompletionOverlayContinue}
        primaryActionLabel="Continuar"
      />

      <AlertDialog open={bonusClosureConfirmOpen} onOpenChange={setBonusClosureConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar período de bono?</AlertDialogTitle>
            <AlertDialogDescription>
              Cerrar período es irreversible. Las decisiones de elegibilidad quedarán
              registradas para el mes en curso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bonusClosureConfirmedRef.current = true
                setBonusClosureConfirmOpen(false)
                void handleSubmit()
              }}
            >
              Confirmar cierre
            </AlertDialogAction>
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
            handlePostCompletionNavigation()
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
              sectionType: sectionAndItem?.section?.section_type,
              funnelConfig: sectionAndItem?.section?.funnel_config,
            }
          })
          .filter((item) =>
            shouldCreateChecklistIssue({
              section_type: item.sectionType,
              funnel_config: item.funnelConfig,
            })
          )}
        onWorkOrderCreated={handleWorkOrderCreated}
        onNavigateToAssetsPage={handlePostCompletionNavigation}
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (laneBDraftDirty && navigator.onLine) {
                  void saveDraftToServer()
                } else {
                  saveToLocalStorage()
                }
              }}
              disabled={savingDraft}
            >
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