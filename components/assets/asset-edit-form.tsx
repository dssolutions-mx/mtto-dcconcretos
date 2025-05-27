"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { 
  CalendarIcon,
  Plus,
  Check,
  AlertCircle,
  Clock,
  Camera,
  FileText,
  Trash2,
  DollarSign,
  FileUp,
  Loader2,
  LinkIcon,
  CheckCircle2,
  ClipboardList,
  Info,
  Pencil,
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Resolver } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

import { GeneralInfoTab } from "./tabs/general-info-tab"
import { TechnicalInfoTab } from "./tabs/technical-info-tab"
import { FinancialInfoTab } from "./tabs/financial-info-tab"
import { MaintenancePlanTab } from "./tabs/maintenance-plan-tab"
import { IncidentsTab } from "./tabs/incidents-tab"
import { DocumentsTab } from "./tabs/documents-tab"
import { PhotoUploadDialog } from "./dialogs/photo-upload-dialog"
import { IncidentRegistrationDialog } from "./dialogs/incident-registration-dialog"
import { MaintenanceRegistrationDialog } from "./dialogs/maintenance-registration-dialog"
import { MaintenanceTasksDialog } from "./dialogs/maintenance-tasks-dialog"
import { PartDialog } from "./dialogs/part-dialog"
import { createClient } from "@/lib/supabase"
import { useIncidents } from "@/hooks/useSupabase"
import { EquipmentModelWithIntervals } from "@/types"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

interface MaintenanceHistoryPart {
  name: string
  partNumber?: string
  quantity: number
  cost?: string
}

interface MaintenanceHistoryRecord {
  date: Date
  type: string
  hours?: string
  description: string
  findings?: string
  actions?: string
  technician: string
  laborHours?: string
  laborCost?: string
  cost?: string
  workOrder?: string
  parts?: MaintenanceHistoryPart[]
  maintenancePlanId?: string
  completedTasks?: Record<string, boolean>
}

interface MaintenanceScheduleItem {
  id: string
  hours: number
  name: string
  description: string
  tasks: {
    id: string
    description: string
    type: string
    estimatedTime: number
    requiresSpecialist: boolean
    parts: {
      id: string
      name: string
      partNumber: string
      quantity: number
      cost?: number
    }[]
  }[]
}

const formSchema = z.object({
  assetId: z.string().min(1, "El ID del activo es requerido"),
  name: z.string().min(1, "El nombre es requerido"),
  serialNumber: z.string().min(1, "El número de serie es requerido"),
  location: z.string().min(1, "La ubicación es requerida"),
  department: z.string().min(1, "El departamento es requerido"),
  purchaseDate: z.date({
    required_error: "La fecha de adquisición es requerida",
    invalid_type_error: "La fecha de adquisición debe ser una fecha válida",
  }),
  installationDate: z.date({
    invalid_type_error: "La fecha de instalación debe ser una fecha válida",
  }).optional(),
  initialHours: z.string()
    .min(1, "Las horas iniciales son requeridas")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, { 
      message: "Las horas iniciales deben ser un número válido mayor o igual a 0" 
    }),
  currentHours: z.string()
    .min(1, "Las horas actuales son requeridas")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, { 
      message: "Las horas actuales deben ser un número válido mayor o igual a 0" 
    }),
  status: z.string().min(1, "El estado es requerido"),
  notes: z.string().optional(),
  warrantyExpiration: z.date({
    invalid_type_error: "La fecha de vencimiento de garantía debe ser una fecha válida",
  }).optional(),
  isNew: z.boolean(),
  purchaseCost: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), { 
      message: "El costo de adquisición debe ser un número válido mayor o igual a 0" 
    }),
  registrationInfo: z.string().optional(),
  insurancePolicy: z.string().optional(),
  insuranceCoverage: z
    .object({
      startDate: z.date({
        invalid_type_error: "La fecha de inicio de cobertura debe ser una fecha válida",
      }).optional(),
      endDate: z.date({
        invalid_type_error: "La fecha de fin de cobertura debe ser una fecha válida",
      }).optional(),
    })
    .optional()
    .refine((data) => {
      if (data?.startDate && data?.endDate) {
        return data.startDate <= data.endDate
      }
      return true
    }, {
      message: "La fecha de inicio de cobertura debe ser anterior a la fecha de fin",
      path: ["endDate"]
    }),
})

type FormValues = z.infer<typeof formSchema>

// Interfaz para fotos con descripción
interface PhotoWithDescription {
  file: File
  preview: string
  description: string
  category?: string
}

interface AssetEditFormProps {
  assetId: string
}

export function AssetEditForm({ assetId }: AssetEditFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Estados para el manejo de fotos
  const [uploadedPhotos, setUploadedPhotos] = useState<PhotoWithDescription[]>([])
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false)
  
  // Estados para el manejo de incidentes
  const { incidents, loading: incidentsLoading, error: incidentsError, refetch: refetchIncidents } = useIncidents(assetId)
  const [showIncidentDialog, setShowIncidentDialog] = useState(false)

  // Add state for selected model
  const [selectedModel, setSelectedModel] = useState<EquipmentModelWithIntervals | null>(null)

  // Add states for modular maintenance dialogs
  const [isPartDialogOpen, setIsPartDialogOpen] = useState(false)
  const [showMaintenanceTasksDialog, setShowMaintenanceTasksDialog] = useState(false)
  const [showMaintenanceRecordDialog, setShowMaintenanceRecordDialog] = useState(false)
  const [showLinkMaintenancePlanDialog, setShowLinkMaintenancePlanDialog] = useState(false)
  const [historyDate, setHistoryDate] = useState<Date | undefined>(new Date())
  const [historyType, setHistoryType] = useState("")
  const [historyDescription, setHistoryDescription] = useState("")
  const [historyTechnician, setHistoryTechnician] = useState("")
  const [historyCost, setHistoryCost] = useState("")
  const [historyHours, setHistoryHours] = useState("")
  const [historyFindings, setHistoryFindings] = useState("")
  const [historyActions, setHistoryActions] = useState("")
  const [historyLaborHours, setHistoryLaborHours] = useState("")
  const [historyLaborCost, setHistoryLaborCost] = useState("")
  const [historyWorkOrder, setHistoryWorkOrder] = useState("")
  const [historyParts, setHistoryParts] = useState<MaintenanceHistoryPart[]>([])
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null)
  const [selectedMaintenancePlan, setSelectedMaintenancePlan] = useState<any>(null)
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({})
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistoryRecord[]>([])
  const [maintenanceSchedule, setMaintenanceSchedule] = useState<any[]>([])
  const [completedMaintenances, setCompletedMaintenances] = useState<string[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      assetId: "",
      name: "",
      serialNumber: "",
      location: "",
      department: "",
      purchaseDate: new Date(),
      installationDate: undefined,
      initialHours: "0",
      currentHours: "0",
      status: "operational",
      notes: "",
      warrantyExpiration: undefined,
      isNew: true,
      purchaseCost: undefined,
      registrationInfo: "",
      insurancePolicy: "",
      insuranceCoverage: { startDate: undefined, endDate: undefined },
    },
  })

  // Función para obtener etiquetas de campos en español
  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      assetId: "ID del Activo",
      name: "Nombre",
      serialNumber: "Número de Serie",
      location: "Ubicación",
      department: "Departamento",
      purchaseDate: "Fecha de Adquisición",
      installationDate: "Fecha de Instalación",
      initialHours: "Horas Iniciales",
      currentHours: "Horas Actuales",
      status: "Estado",
      notes: "Notas",
      warrantyExpiration: "Vencimiento de Garantía",
      isNew: "Es Nuevo",
      registrationInfo: "Información de Registro",
      purchaseCost: "Costo de Adquisición",
      insurancePolicy: "Póliza de Seguro",
      "insuranceCoverage.startDate": "Inicio de Cobertura",
      "insuranceCoverage.endDate": "Fin de Cobertura"
    }
    return labels[field] || field
  }

  // Función para obtener errores de validación del formulario
  const getFormErrors = () => {
    const errors = form.formState.errors
    const errorMessages: string[] = []
    
    const processErrors = (obj: any, prefix = '') => {
      Object.entries(obj).forEach(([key, value]: [string, any]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key
        
        if (value?.message) {
          errorMessages.push(`${getFieldLabel(fullKey)}: ${value.message}`)
        } else if (typeof value === 'object' && value !== null) {
          processErrors(value, fullKey)
        }
      })
    }
    
    processErrors(errors)
    return errorMessages
  }

  // Función para determinar qué pestañas tienen errores
  const getTabsWithErrors = () => {
    const errors = form.formState.errors
    const tabErrors = {
      general: false,
      technical: false,
      financial: false,
      'maintenance-plan': false,
      'maintenance-history': false,
      incidents: false,
      documents: false
    }

    // Verificar errores en campos específicos
    if (errors.assetId || errors.name || errors.serialNumber || errors.location || 
        errors.department || errors.purchaseDate || errors.installationDate || 
        errors.status || errors.notes || errors.warrantyExpiration || errors.isNew) {
      tabErrors.general = true
    }

    if (errors.initialHours || errors.currentHours || errors.registrationInfo) {
      tabErrors.technical = true
    }

    if (errors.purchaseCost || errors.insurancePolicy || errors.insuranceCoverage) {
      tabErrors.financial = true
    }

    return tabErrors
  }

  // Load asset data
  useEffect(() => {
    const loadAssetData = async () => {
      try {
        setIsLoading(true)
        const supabase = createClient()
        
        const { data: asset, error } = await supabase
          .from("assets")
          .select(`
            *,
            equipment_models (*)
          `)
          .eq("id", assetId)
          .single()

        if (error) {
          throw error
        }

        if (asset) {
          form.reset({
            assetId: asset.asset_id || "",
            name: asset.name || "",
            serialNumber: asset.serial_number || "",
            location: asset.location || "",
            department: asset.department || "",
            purchaseDate: new Date(asset.purchase_date || new Date()),
            installationDate: asset.installation_date ? new Date(asset.installation_date) : undefined,
            initialHours: (asset.initial_hours || 0).toString(),
            currentHours: (asset.current_hours || 0).toString(),
            status: asset.status || "operational",
            notes: asset.notes || "",
            warrantyExpiration: asset.warranty_expiration ? new Date(asset.warranty_expiration) : undefined,
            isNew: asset.is_new || false,
            registrationInfo: asset.registration_info || "",
            purchaseCost: asset.purchase_cost ? asset.purchase_cost.toString() : undefined,
            insurancePolicy: asset.insurance_policy || "",
            insuranceCoverage: {
              startDate: asset.insurance_start_date ? new Date(asset.insurance_start_date) : undefined,
              endDate: asset.insurance_end_date ? new Date(asset.insurance_end_date) : undefined
            }
          })
        }


      } catch (error: any) {
        console.error("Error loading asset:", error)
        toast({
          title: "Error al cargar el activo",
          description: error.message || "Ha ocurrido un error inesperado.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (assetId) {
      loadAssetData()
    }
  }, [assetId, form, toast])

  // Load maintenance intervals for the asset's model
  useEffect(() => {
    const loadMaintenanceIntervals = async () => {
      try {
        const supabase = createClient()
        
        // First get the asset with its model
        const { data: asset, error: assetError } = await supabase
          .from("assets")
          .select(`
            *,
            equipment_models (*)
          `)
          .eq("id", assetId)
          .single()

        if (assetError) {
          throw assetError
        }

        if (!asset || !asset.model_id || !asset.equipment_models) {
          console.log("No model associated with this asset")
          return
        }

        const modelId = asset.model_id
        
        // Set the selected model
        const modelData = asset.equipment_models;
        setSelectedModel({
          ...modelData,
          maintenanceIntervals: []
        } as unknown as EquipmentModelWithIntervals);

        // Now fetch the maintenance intervals for this model
        try {
          const response = await fetch(`/api/models/${modelId}/maintenance-intervals`)
          
          if (!response.ok) {
            throw new Error('Error al cargar las actividades de mantenimiento')
          }
          
          const maintenanceActivities = await response.json()
          console.log("Actividades de mantenimiento cargadas:", maintenanceActivities)
          
          // Update the selected model with maintenance intervals
          if (selectedModel) {
            const maintenanceIntervals = maintenanceActivities.map((activity: any) => ({
              hours: activity.interval_value,
              type: activity.type,
              id: activity.id,
              name: activity.name,
              description: activity.description || ''
            }));
            
            setSelectedModel(prevModel => ({
              ...prevModel!,
              maintenanceIntervals
            }));
          }
          
          const schedules = maintenanceActivities.map((activity: any) => {
            const tasks = Array.isArray(activity.maintenance_tasks) 
              ? activity.maintenance_tasks.map((task: any) => {
                  const parts = Array.isArray(task.task_parts) 
                    ? task.task_parts.map((part: any) => ({
                        id: part.id,
                        name: part.name,
                        partNumber: part.part_number || '',
                        quantity: part.quantity || 1,
                        cost: part.cost
                      }))
                    : []
                  
                  return {
                    id: task.id,
                    description: task.description,
                    type: task.type || 'Mantenimiento',
                    estimatedTime: task.estimated_time || 1,
                    requiresSpecialist: task.requires_specialist || false,
                    parts: parts
                  }
                })
              : []
            
            return {
              id: activity.id,
              hours: activity.interval_value,
              name: activity.name || `Mantenimiento a las ${activity.interval_value} horas`,
              description: activity.description || '',
              tasks: tasks
            }
          })
          
          console.log("Actividades de mantenimiento procesadas:", schedules)
          setMaintenanceSchedule(schedules)
        } catch (error) {
          console.error('Error al cargar las actividades de mantenimiento:', error)
          setMaintenanceSchedule([])
        }
      } catch (error) {
        console.error("Error loading maintenance intervals:", error)
      }
    }

    if (assetId) {
      loadMaintenanceIntervals()
    }
  }, [assetId])

  // Load existing maintenance history
  useEffect(() => {
    const loadMaintenanceHistory = async () => {
      try {
        const supabase = createClient()
        
        const { data: historyData, error } = await supabase
          .from("maintenance_history")
          .select("*")
          .eq("asset_id", assetId)
          .order("date", { ascending: false })

        if (error) {
          throw error
        }

        if (historyData) {
          const formattedHistory: MaintenanceHistoryRecord[] = historyData.map((record: any) => ({
            date: new Date(record.date),
            type: record.type,
            hours: record.hours?.toString(),
            description: record.description,
            findings: record.findings,
            actions: record.actions,
            technician: record.technician,
            laborHours: record.labor_hours?.toString(),
            laborCost: record.labor_cost,
            cost: record.total_cost,
            workOrder: record.work_order,
            parts: record.parts ? JSON.parse(record.parts) : undefined,
            maintenancePlanId: record.maintenance_plan_id,
            completedTasks: record.completed_tasks ? JSON.parse(record.completed_tasks) : undefined,
          }))
          
          setMaintenanceHistory(formattedHistory)
          
          // Mark completed maintenances
          const completedIds = formattedHistory
            .filter(record => record.maintenancePlanId)
            .map(record => record.maintenancePlanId!)
          setCompletedMaintenances(completedIds)
        }
      } catch (error) {
        console.error("Error loading maintenance history:", error)
      }
    }

    if (assetId) {
      loadMaintenanceHistory()
    }
  }, [assetId])

  // Funciones para manejar incidentes
  const handleAddIncident = () => {
    setShowIncidentDialog(true)
  }

  const handleEditIncident = (index: number) => {
    // Por ahora, solo mostrar el diálogo para agregar uno nuevo
    // En una implementación completa, se cargarían los datos del incidente específico
    setShowIncidentDialog(true)
  }

  const handleRemoveIncident = async (index: number) => {
    const incident = incidents[index]
    if (incident && incident.id) {
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from("incident_history")
          .delete()
          .eq("id", incident.id)

        if (error) {
          throw error
        }

        // Recargar la lista de incidentes
        refetchIncidents()

        toast({
          title: "Incidente eliminado",
          description: "El incidente ha sido eliminado exitosamente.",
          variant: "default",
        })
      } catch (error: any) {
        console.error("Error deleting incident:", error)
        toast({
          title: "Error al eliminar incidente",
          description: error.message || "Ha ocurrido un error inesperado.",
          variant: "destructive",
        })
      }
    }
  }

  const handleIncidentSuccess = async () => {
    // Recargar incidentes después de agregar uno nuevo
    refetchIncidents()
    setShowIncidentDialog(false)
  }

  // Function to add maintenance history
  const addMaintenanceHistory = () => {
    if (historyDate && historyType && historyDescription && historyTechnician) {
      const newHistory: MaintenanceHistoryRecord = {
        date: historyDate,
        type: historyType,
        description: historyDescription,
        technician: historyTechnician,
        cost: historyCost || undefined,
      }

      if (editingHistoryIndex !== null) {
        const updatedHistory = [...maintenanceHistory]
        updatedHistory[editingHistoryIndex] = newHistory
        setMaintenanceHistory(updatedHistory)
        setEditingHistoryIndex(null)
      } else {
        setMaintenanceHistory([...maintenanceHistory, newHistory])
      }

      resetHistoryForm()
    }
  }

  const addDetailedMaintenanceHistory = async () => {
    if (historyDate && historyType && historyDescription && historyTechnician) {
      const totalPartsCost = historyParts.reduce((total, part) => {
        return total + (Number(part.cost) || 0) * part.quantity
      }, 0)

      const laborCost = Number(historyLaborCost) || 0
      const totalCost = totalPartsCost + laborCost

      const newHistory: MaintenanceHistoryRecord = {
        date: historyDate,
        type: historyType,
        hours: historyHours || undefined,
        description: historyDescription,
        findings: historyFindings || undefined,
        actions: historyActions || undefined,
        technician: historyTechnician,
        laborHours: historyLaborHours || undefined,
        laborCost: historyLaborCost || undefined,
        cost: totalCost > 0 ? totalCost.toString() : undefined,
        workOrder: historyWorkOrder || undefined,
        parts: historyParts.length > 0 ? [...historyParts] : undefined,
        maintenancePlanId: selectedMaintenancePlan?.id,
        completedTasks: Object.keys(completedTasks).length > 0 ? { ...completedTasks } : undefined,
      }

      try {
        // Save to database
        const supabase = createClient()
        const { data: userData } = await supabase.auth.getUser()
        const user = userData.user
        
        if (!user) {
          throw new Error("Usuario no autenticado")
        }

        const maintenanceData = {
          asset_id: assetId,
          date: historyDate.toISOString(),
          type: historyType,
          description: historyDescription,
          technician: historyTechnician,
          findings: historyFindings || null,
          actions: historyActions || null,
          hours: historyHours ? parseInt(historyHours) : null,
          labor_hours: historyLaborHours ? parseFloat(historyLaborHours) : null,
          labor_cost: historyLaborCost || null,
          total_cost: totalCost > 0 ? totalCost.toString() : null,
          work_order: historyWorkOrder || null,
          parts: historyParts.length > 0 ? JSON.stringify(historyParts) : null,
          maintenance_plan_id: selectedMaintenancePlan?.id || null,
          completed_tasks: Object.keys(completedTasks).length > 0 ? JSON.stringify(completedTasks) : null,
          created_by: user.id,
          created_at: new Date().toISOString()
        }
        
        const { error: recordError } = await supabase
          .from("maintenance_history")
          .insert(maintenanceData)
          
        if (recordError) {
          throw recordError
        }

        toast({
          title: "Mantenimiento registrado",
          description: "El registro de mantenimiento ha sido guardado exitosamente.",
          variant: "default",
        })

        if (editingHistoryIndex !== null) {
          const updatedHistory = [...maintenanceHistory]
          updatedHistory[editingHistoryIndex] = newHistory
          setMaintenanceHistory(updatedHistory)
          setEditingHistoryIndex(null)
        } else {
          setMaintenanceHistory([...maintenanceHistory, newHistory])
        }

        // Mark maintenance as completed if it was linked to a plan
        if (selectedMaintenancePlan) {
          markMaintenanceAsCompleted(selectedMaintenancePlan.id, true)
        }

        resetHistoryForm()
        setShowMaintenanceRecordDialog(false)
      } catch (error: any) {
        console.error("Error al guardar historial de mantenimiento:", error)
        toast({
          title: "Error al registrar mantenimiento",
          description: error.message || "Ha ocurrido un error inesperado.",
          variant: "destructive",
        })
      }
    }
  }

  const resetHistoryForm = () => {
    setHistoryDate(new Date())
    setHistoryType("")
    setHistoryHours("")
    setHistoryDescription("")
    setHistoryFindings("")
    setHistoryActions("")
    setHistoryTechnician("")
    setHistoryCost("")
    setHistoryLaborHours("")
    setHistoryLaborCost("")
    setHistoryWorkOrder("")
    setHistoryParts([])
    setSelectedMaintenancePlan(null)
    setCompletedTasks({})
  }

  const removeMaintenanceHistory = (index: number) => {
    const newHistory = [...maintenanceHistory]
    newHistory.splice(index, 1)
    setMaintenanceHistory(newHistory)
  }

  const editMaintenanceHistory = (index: number) => {
    const record = maintenanceHistory[index]
    setHistoryDate(record.date)
    setHistoryType(record.type)
    setHistoryHours(record.hours || "")
    setHistoryDescription(record.description)
    setHistoryFindings(record.findings || "")
    setHistoryActions(record.actions || "")
    setHistoryTechnician(record.technician)
    setHistoryCost(record.cost || "")
    setHistoryLaborHours(record.laborHours || "")
    setHistoryLaborCost(record.laborCost || "")
    setHistoryWorkOrder(record.workOrder || "")
    setHistoryParts(record.parts || [])
    setEditingHistoryIndex(index)
    setShowMaintenanceRecordDialog(true)

    if (record.maintenancePlanId) {
      const plan = maintenanceSchedule.find((p) => p.id === record.maintenancePlanId)
      if (plan) {
        setSelectedMaintenancePlan(plan)
      }
    }

    if (record.completedTasks) {
      setCompletedTasks(record.completedTasks)
    }
  }

  // Function to add part to maintenance
  const addPart = (name: string, partNumber: string, quantity: number, cost: string) => {
    const newPart: MaintenanceHistoryPart = {
      name,
      partNumber: partNumber || undefined,
      quantity,
      cost: cost || undefined,
    }
    setHistoryParts([...historyParts, newPart])
  }

  // Maintenance plan functions
  const openMaintenanceDialog = (maintenance: MaintenanceScheduleItem) => {
    setSelectedMaintenancePlan(maintenance)
    // Additional logic here if needed
  }

  const onRegisterMaintenance = (maintenance: MaintenanceScheduleItem) => {
    setSelectedMaintenancePlan(maintenance)
    setHistoryType("Preventivo")
    setHistoryDescription(`${maintenance.name} - ${maintenance.description || ''}`)
    setHistoryHours(maintenance.hours.toString())

    const initialTasksState: Record<string, boolean> = {}
    maintenance.tasks?.forEach((task) => {
      initialTasksState[task.id] = false
    })
    setCompletedTasks(initialTasksState)

    const planParts: MaintenanceHistoryPart[] = []
    maintenance.tasks?.forEach((task) => {
      task.parts?.forEach((part) => {
        planParts.push({
          name: part.name,
          partNumber: part.partNumber,
          quantity: part.quantity,
          cost: part.cost?.toString(),
        })
      })
    })

    if (planParts.length > 0) {
      setHistoryParts(planParts)
    }

    setShowMaintenanceRecordDialog(true)
  }

  const markMaintenanceAsCompleted = (maintenanceId: string, completed = true) => {
    if (completed) {
      setCompletedMaintenances([...completedMaintenances, maintenanceId])
    } else {
      setCompletedMaintenances(completedMaintenances.filter((id) => id !== maintenanceId))
    }
  }

  const getNextMaintenance = () => {
    // Logic to calculate next maintenance based on current hours
    return null
  }

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true)
      
      const supabase = createClient()
      const user = (await supabase.auth.getUser()).data.user
      
      if (!user) {
        throw new Error("Usuario no autenticado")
      }

      // Update asset data
      const assetDataToUpdate = {
        asset_id: data.assetId,
        name: data.name,
        status: data.status,
        serial_number: data.serialNumber,
        location: data.location,
        department: data.department,
        purchase_date: data.purchaseDate.toISOString(),
        installation_date: data.installationDate?.toISOString(),
        warranty_expiration: data.warrantyExpiration?.toISOString(),
        initial_hours: Number(data.initialHours),
        current_hours: Number(data.currentHours),
        is_new: data.isNew,
        notes: data.notes,
        purchase_cost: data.purchaseCost || null,
        registration_info: data.registrationInfo,
        insurance_policy: data.insurancePolicy,
        insurance_start_date: data.insuranceCoverage?.startDate?.toISOString(),
        insurance_end_date: data.insuranceCoverage?.endDate?.toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("assets")
        .update(assetDataToUpdate)
        .eq("id", assetId)

      if (error) {
        throw error
      }

      toast({
        title: "Activo actualizado con éxito",
        description: `${data.name} ha sido actualizado correctamente.`,
        variant: "default",
      })

      router.push("/activos")
      router.refresh()
    } catch (error: any) {
      console.error("Error al actualizar activo:", error)
      toast({
        title: "Error al actualizar el activo",
        description: error.message || "Ha ocurrido un error inesperado.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Cargando información del activo...</span>
        </div>
      </div>
    )
  }

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="general" className={cn(getTabsWithErrors().general && "text-red-600")}>
          General
          {getTabsWithErrors().general && <AlertCircle className="ml-1 h-3 w-3" />}
        </TabsTrigger>
        <TabsTrigger value="technical" className={cn(getTabsWithErrors().technical && "text-red-600")}>
          Técnica
          {getTabsWithErrors().technical && <AlertCircle className="ml-1 h-3 w-3" />}
        </TabsTrigger>
        <TabsTrigger value="financial" className={cn(getTabsWithErrors().financial && "text-red-600")}>
          Financiera
          {getTabsWithErrors().financial && <AlertCircle className="ml-1 h-3 w-3" />}
        </TabsTrigger>
        <TabsTrigger value="maintenance-plan">Mantenimiento</TabsTrigger>
        <TabsTrigger value="incidents">Incidentes</TabsTrigger>
        <TabsTrigger value="documents">Documentos</TabsTrigger>
      </TabsList>

      <Form {...form}>
        <form 
          onSubmit={(e) => {
            // Only prevent default for the maintenance plan tab
            const activeTab = document.querySelector('[role="tabpanel"][data-state="active"]');
            if (activeTab?.getAttribute('data-value') === 'maintenance-plan') {
              e.preventDefault();
              return false;
            }
            return form.handleSubmit(onSubmit)(e);
          }} 
          className="space-y-6 pt-6"
        >
          <TabsContent value="general" className="space-y-6">
            <GeneralInfoTab
              control={form.control}
              selectedModel={selectedModel}
              onModelSelect={(model) => {
                setSelectedModel(model);
                
                // Fetch maintenance intervals for the new model
                if (model) {
                  const fetchModelIntervals = async () => {
                    try {
                      const response = await fetch(`/api/models/${model.id}/maintenance-intervals`);
                      
                      if (!response.ok) {
                        throw new Error('Error al cargar las actividades de mantenimiento');
                      }
                      
                      const maintenanceActivities = await response.json();
                      console.log("Actividades de mantenimiento cargadas:", maintenanceActivities);
                      
                      // Update the selected model with maintenance intervals
                      const maintenanceIntervals = maintenanceActivities.map((activity: any) => ({
                        hours: activity.interval_value,
                        type: activity.type,
                        id: activity.id,
                        name: activity.name,
                        description: activity.description || ''
                      }));
                      
                      setSelectedModel(prevModel => ({
                        ...prevModel!,
                        maintenanceIntervals
                      }));
                      
                      // Update maintenance schedules
                      const schedules = maintenanceActivities.map((activity: any) => {
                        const tasks = Array.isArray(activity.maintenance_tasks) 
                          ? activity.maintenance_tasks.map((task: any) => {
                              const parts = Array.isArray(task.task_parts) 
                                ? task.task_parts.map((part: any) => ({
                                    id: part.id,
                                    name: part.name,
                                    partNumber: part.part_number || '',
                                    quantity: part.quantity || 1,
                                    cost: part.cost
                                  }))
                                : []
                              
                              return {
                                id: task.id,
                                description: task.description,
                                type: task.type || 'Mantenimiento',
                                estimatedTime: task.estimated_time || 1,
                                requiresSpecialist: task.requires_specialist || false,
                                parts: parts
                              }
                            })
                          : []
                        
                        return {
                          id: activity.id,
                          hours: activity.interval_value,
                          name: activity.name || `Mantenimiento a las ${activity.interval_value} horas`,
                          description: activity.description || '',
                          tasks: tasks
                        }
                      });
                      
                      setMaintenanceSchedule(schedules);
                    } catch (error) {
                      console.error('Error al cargar las actividades de mantenimiento:', error);
                      setMaintenanceSchedule([]);
                    }
                  };
                  
                  fetchModelIntervals();
                } else {
                  setMaintenanceSchedule([]);
                }
              }}
              isNewEquipment={true}
              setIsNewEquipment={() => {}}
            />
          </TabsContent>

          <TabsContent value="technical" className="space-y-6">
            <TechnicalInfoTab
              control={form.control}
              uploadedPhotos={uploadedPhotos}
              setUploadedPhotos={setUploadedPhotos}
              setPhotoUploadOpen={setPhotoUploadOpen}
            />
          </TabsContent>
          
          <TabsContent value="financial" className="space-y-6">
            <FinancialInfoTab
              control={form.control}
              insuranceDocuments={[]}
              addInsuranceDocument={() => {}}
              removeInsuranceDocument={() => {}}
            />
          </TabsContent>
          
          <TabsContent value="maintenance-plan" className="space-y-6">
            <MaintenancePlanTab
              selectedModel={selectedModel}
              maintenanceSchedule={maintenanceSchedule}
              completedMaintenances={completedMaintenances}
              nextMaintenance={getNextMaintenance()}
              openMaintenanceDialog={openMaintenanceDialog}
              onRegisterMaintenance={onRegisterMaintenance}
              maintenanceHistory={maintenanceHistory}
              onEditMaintenanceHistory={editMaintenanceHistory}
              onRemoveMaintenanceHistory={removeMaintenanceHistory}
              onAddNewMaintenance={() => {
                resetHistoryForm();
                setShowMaintenanceRecordDialog(true);
              }}
            />
          </TabsContent>
          
          <TabsContent value="incidents" className="space-y-6">
            <IncidentsTab
              incidents={incidents.map(incident => ({
                date: new Date(incident.date),
                type: incident.type,
                reportedBy: incident.reported_by,
                description: incident.description,
                impact: incident.impact,
                resolution: incident.resolution,
                downtime: incident.downtime?.toString(),
                laborHours: incident.labor_hours?.toString(),
                laborCost: incident.labor_cost,
                parts: incident.parts ? JSON.parse(incident.parts) : undefined,
                totalCost: incident.total_cost,
                workOrder: incident.work_order,
                status: incident.status,
              }))}
              onAddIncident={handleAddIncident}
              onEditIncident={handleEditIncident}
              onRemoveIncident={handleRemoveIncident}
            />
          </TabsContent>
          
          <TabsContent value="documents" className="space-y-6">
            <DocumentsTab />
          </TabsContent>

          {/* Mostrar errores de validación si los hay */}
          {Object.keys(form.formState.errors).length > 0 && (
            <Alert variant="destructive" className="mt-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Errores de Validación</AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1">
                  {getFormErrors().map((error, index) => (
                    <div key={index} className="text-sm">
                      • {error}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-sm">
                  Por favor, corrija estos errores antes de continuar.
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-4 pt-4">
            <Button variant="outline" type="button" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || Object.keys(form.formState.errors).length > 0}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Actualizar Activo"
              )}
            </Button>
          </div>
        </form>
      </Form>

      {/* Diálogo para subir fotos */}
      <PhotoUploadDialog
        open={photoUploadOpen}
        onOpenChange={setPhotoUploadOpen}
        uploadedPhotos={uploadedPhotos}
        setUploadedPhotos={setUploadedPhotos}
      />

      {/* Diálogo para registrar incidentes */}
      <IncidentRegistrationDialog
        isOpen={showIncidentDialog}
        onClose={() => setShowIncidentDialog(false)}
        assetId={assetId}
        onSuccess={handleIncidentSuccess}
      />

      {/* Modular dialogs for maintenance */}
      <PartDialog
        open={isPartDialogOpen}
        onOpenChange={setIsPartDialogOpen}
        onAddPart={addPart}
      />

      <MaintenanceTasksDialog
        open={showMaintenanceTasksDialog}
        onOpenChange={setShowMaintenanceTasksDialog}
        selectedMaintenancePlan={selectedMaintenancePlan}
        completedTasks={completedTasks}
        setCompletedTasks={setCompletedTasks}
      />

      <MaintenanceRegistrationDialog
        open={showMaintenanceRecordDialog}
        onOpenChange={setShowMaintenanceRecordDialog}
        selectedMaintenancePlan={selectedMaintenancePlan}
        historyDate={historyDate}
        setHistoryDate={setHistoryDate}
        historyType={historyType}
        setHistoryType={setHistoryType}
        historyHours={historyHours}
        setHistoryHours={setHistoryHours}
        historyDescription={historyDescription}
        setHistoryDescription={setHistoryDescription}
        historyFindings={historyFindings}
        setHistoryFindings={setHistoryFindings}
        historyActions={historyActions}
        setHistoryActions={setHistoryActions}
        historyTechnician={historyTechnician}
        setHistoryTechnician={setHistoryTechnician}
        historyLaborHours={historyLaborHours}
        setHistoryLaborHours={setHistoryLaborHours}
        historyLaborCost={historyLaborCost}
        setHistoryLaborCost={setHistoryLaborCost}
        historyWorkOrder={historyWorkOrder}
        setHistoryWorkOrder={setHistoryWorkOrder}
        historyParts={historyParts}
        setHistoryParts={setHistoryParts}
        completedTasks={completedTasks}
        setCompletedTasks={setCompletedTasks}
        onOpenPartDialog={() => setIsPartDialogOpen(true)}
        onOpenTasksDialog={() => setShowMaintenanceTasksDialog(true)}
        onSubmit={() => addDetailedMaintenanceHistory()}
      />
    </Tabs>
  )
} 