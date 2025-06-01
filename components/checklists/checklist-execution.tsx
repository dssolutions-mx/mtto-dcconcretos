"use client"

import { useState, useEffect } from "react"
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
import { Camera, Check, Clock, FileText, Flag, Loader2, Save, Upload, X, Wifi, WifiOff, RefreshCw } from "lucide-react"
import { SignatureCanvas } from "@/components/checklists/signature-canvas"
import { OfflineStatus } from "@/components/checklists/offline-status"
import { EquipmentReadingsForm } from "@/components/checklists/equipment-readings-form"
import { EvidenceCaptureSection } from "@/components/checklists/evidence-capture-section"
import { CorrectiveWorkOrderDialog } from "@/components/checklists/corrective-work-order-dialog"
import { useOfflineSync } from "@/hooks/useOfflineSync"
import { toast } from "sonner"
import { createBrowserClient } from '@supabase/ssr'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Importación dinámica del servicio offline para evitar problemas de SSR
let offlineChecklistService: any = null

interface ChecklistExecutionProps {
  id: string
}

export function ChecklistExecution({ id }: ChecklistExecutionProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
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
  
  // Estados para lecturas de equipo
  const [equipmentReadings, setEquipmentReadings] = useState<{
    hours_reading?: number | null
    kilometers_reading?: number | null
  }>({})
  
  // Estados para evidencias fotográficas
  const [evidenceData, setEvidenceData] = useState<Record<string, any[]>>({})
  
  // Usar el nuevo hook para estado offline
  const { isOnline, hasPendingSyncs } = useOfflineSync()
  
  // Estados para auto-guardar
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

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
  }, [hasUnsavedChanges, checklist])

  // Guardar en localStorage para recuperación
  const saveToLocalStorage = () => {
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
      timestamp: Date.now()
    }
    
    localStorage.setItem(`checklist-draft-${id}`, JSON.stringify(saveData))
    setHasUnsavedChanges(false)
    setLastSaved(new Date())
    toast.success("Borrador guardado localmente", { duration: 2000 })
  }

  // Recuperar datos guardados localmente
  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem(`checklist-draft-${id}`)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        // Solo cargar si los datos tienen menos de 24 horas
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
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
          toast.info("Borrador restaurado desde almacenamiento local")
          return true
        }
      } catch (error) {
        console.error("Error loading saved data:", error)
      }
    }
    return false
  }

  // Manejar cambios en evidencias
  const handleEvidenceChange = (sectionId: string, evidences: any[]) => {
    setEvidenceData(prev => ({
      ...prev,
      [sectionId]: evidences
    }))
  }

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
              sections: cached.template.checklists?.checklist_sections || [],
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
            loadFromLocalStorage()
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
          
          // Estructurar los datos
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
            sections: data.checklists?.checklist_sections || [],
            scheduledDate: data.scheduled_date || '',
            technicianId: data.assigned_to || '',
            maintenance_plan_id: data.maintenance_plan_id || null,
            // Información del activo para lecturas
            currentHours: data.assets?.current_hours || 0,
            currentKilometers: data.assets?.current_kilometers || 0,
            maintenanceUnit: data.checklists?.equipment_models?.maintenance_unit || 'hours'
          }
          
          setChecklist(checklistData)
          
          // Intentar cargar datos guardados
          loadFromLocalStorage()
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

  // Marcar cambios sin guardar
  useEffect(() => {
    setHasUnsavedChanges(true)
  }, [itemStatus, itemNotes, itemPhotos, notes, technician, signature, equipmentReadings, evidenceData])

  const handleStatusChange = (itemId: string, status: "pass" | "flag" | "fail") => {
    setItemStatus(prev => ({ ...prev, [itemId]: status }))
  }

  const handlePhotoUpload = async (itemId: string, file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'checklist-photos')
      
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const errorData = await response.text().catch(() => 'Error desconocido')
        throw new Error(`Error al subir archivo: ${errorData}`)
      }
      
      const { url } = await response.json()
      setItemPhotos(prev => ({ ...prev, [itemId]: url }))
      toast.success('Foto subida exitosamente')
    } catch (error: any) {
      console.error('Error uploading photo:', error)
      const errorMessage = error?.message || 'Error desconocido al subir la foto'
      toast.error(`Error al subir la foto: ${errorMessage}`)
    }
  }

  const handleItemNotesChange = (itemId: string, note: string) => {
    setItemNotes(prev => ({ ...prev, [itemId]: note }))
  }

  const prepareCompletedItems = () => {
    return Object.keys(itemStatus).map(itemId => ({
      item_id: itemId,
      status: itemStatus[itemId],
      notes: itemNotes[itemId] || null,
      photo_url: itemPhotos[itemId] || null
    }))
  }
  
  const handleSubmit = async () => {
    if (!isChecklistComplete()) {
      toast.error('Por favor complete todos los campos requeridos')
      return
    }
    
    // Validar evidencias
    const evidenceValidation = validateEvidenceRequirements()
    if (!evidenceValidation.isValid) {
      toast.error('Evidencias fotográficas incompletas')
      evidenceValidation.errors.forEach(error => toast.error(error))
      return
    }
    
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
        // Usar el nuevo endpoint que maneja lecturas y evidencias
        const response = await fetch(`/api/checklists/schedules/${id}/complete-with-readings`, {
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
          
          if (result.data?.has_issues) {
            toast.info("Se detectaron problemas. Se creará una orden de trabajo correctiva.")
          }
          
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
          
          router.push('/checklists')
        } else {
          const errorData = await response.json()
          if (errorData.validation_errors || errorData.validation_warnings) {
            toast.error('Error en las validaciones')
            if (errorData.validation_errors?.length > 0) {
              errorData.validation_errors.forEach((error: string) => toast.error(error))
            }
            if (errorData.validation_warnings?.length > 0) {
              errorData.validation_warnings.forEach((warning: string) => toast.warning(warning))
            }
          } else {
            throw new Error(errorData.error || 'Error al enviar el checklist')
          }
        }
      } else {
        // Guardar offline si no hay conexión
        if (offlineChecklistService) {
          const offlineId = `checklist-${id}-${Date.now()}`
          await offlineChecklistService.saveOfflineChecklist(offlineId, submissionData)
          
          // Limpiar datos locales
          localStorage.removeItem(`checklist-draft-${id}`)
          
          toast.success("Checklist guardado sin conexión", {
            description: "Se sincronizará automáticamente cuando vuelva la conexión"
          })
          
          router.push('/checklists')
        } else {
          throw new Error('Servicio offline no disponible')
        }
      }
    } catch (error) {
      console.error('Error al enviar el checklist:', error)
      toast.error("Error al completar el checklist")
      
      // Si falla, guardar offline como respaldo
      if (isOnline && offlineChecklistService) {
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
        toast.info("Checklist guardado localmente como respaldo")
      }
    } finally {
      setSubmitting(false)
    }
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

  const handleWorkOrderCreated = (workOrderId: string) => {
    router.push(`/ordenes/${workOrderId}`)
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="bg-blue-500 text-white">
          <CardTitle className="text-2xl">{checklist.name}</CardTitle>
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
          
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Fecha: {checklist.scheduledDate}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Completado: {getCompletedItems()}/{getTotalItems()}
              </div>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${getTotalItems() > 0 ? (getCompletedItems() / getTotalItems()) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>

          {checklist.sections && checklist.sections.map((section: any, sectionIndex: number) => {
            if (section.section_type === 'evidence') {
              // Renderizar sección de evidencias
              return (
                <EvidenceCaptureSection
                  key={section.id}
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
              )
            }
            
            // Renderizar sección normal de checklist
            return (
            <div key={sectionIndex} className="mb-8">
              <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
              <div className="space-y-6">
                {(section.checklist_items || section.items) && (section.checklist_items || section.items).map((item: any) => {
                  return (
                  <Card key={item.id} className="overflow-hidden">
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">{item.description}</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={itemStatus[item.id] === "pass" ? "default" : "outline"}
                          className={`h-12 ${itemStatus[item.id] === "pass" ? "bg-green-500 hover:bg-green-600" : ""}`}
                          onClick={() => handleStatusChange(item.id, "pass")}
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
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Fotografía</Label>
                            {itemPhotos[item.id] ? (
                              <div className="relative">
                                <img
                                  src={itemPhotos[item.id] || ""}
                                  alt="Foto del problema"
                                  className="w-full h-48 object-cover rounded-md"
                                />
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 right-2"
                                  onClick={() => setItemPhotos(prev => ({ ...prev, [item.id]: null }))}
                                >
                                  Eliminar
                                </Button>
                              </div>
                            ) : (
                              <div className="border-2 border-dashed border-muted-foreground/50 rounded-md p-8 text-center">
                                <Label
                                  htmlFor={`photo-upload-${item.id}`}
                                  className="cursor-pointer"
                                >
                                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Subir foto</span>
                                </Label>
                                <input
                                  id={`photo-upload-${item.id}`}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handlePhotoUpload(item.id, e.target.files[0])
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )})}
              </div>
            </div>
          )})}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              "Enviar"
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Componente de lecturas de equipo */}
      <EquipmentReadingsForm
        assetId={checklist.assetId}
        assetName={checklist.asset}
        maintenanceUnit={checklist.maintenanceUnit}
        currentHours={checklist.currentHours}
        currentKilometers={checklist.currentKilometers}
        onReadingsChange={setEquipmentReadings}
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
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="technician">Técnico Responsable</Label>
          <Input 
            id="technician" 
            value={technician} 
            onChange={(e) => setTechnician(e.target.value)}
            placeholder="Nombre del técnico responsable"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signature">Firma</Label>
          <SignatureCanvas onSave={setSignature} />
          {signature && <p className="text-sm text-green-600 mt-1">Firma guardada</p>}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <div className="flex flex-col items-end gap-2">
            <div className="text-sm text-muted-foreground">
              Progreso: {getCompletedItems()}/{getTotalItems()} items completados
            </div>
            <Button 
              onClick={handleSubmit} 
              disabled={!isChecklistComplete() || submitting}
              className={!isChecklistComplete() ? "opacity-50 cursor-not-allowed" : ""}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
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
            <AlertDialogCancel>No, solo guardar</AlertDialogCancel>
                            <AlertDialogAction onClick={prepareCorrectiveAction}>Sí, crear orden correctiva</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Corrective Work Order Dialog */}
      <CorrectiveWorkOrderDialog
        open={correctiveDialogOpen}
        onOpenChange={setCorrectiveDialogOpen}
        checklist={checklist}
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
      />

      {/* Estado offline integrado */}
      <OfflineStatus showDetails={true} />

      {hasUnsavedChanges && (
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
    </div>
  )
}