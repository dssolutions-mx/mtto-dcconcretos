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

import { GeneralInfoTab } from "./tabs/general-info-tab"
import { TechnicalInfoTab } from "./tabs/technical-info-tab"
import { FinancialInfoTab } from "./tabs/financial-info-tab"
import { MaintenancePlanTab } from "./tabs/maintenance-plan-tab"
import { MaintenanceHistoryTab } from "./tabs/maintenance-history-tab"
import { IncidentsTab } from "./tabs/incidents-tab"
import { DocumentsTab } from "./tabs/documents-tab"
import { PhotoUploadDialog } from "./dialogs/photo-upload-dialog"
import { createClient } from "@/lib/supabase"
import { EquipmentModelWithIntervals } from "@/types"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  assetId: z.string().min(1, "El ID del activo es requerido"),
  name: z.string().min(1, "El nombre es requerido"),
  serialNumber: z.string().min(1, "El número de serie es requerido"),
  location: z.string().min(1, "La ubicación es requerida"),
  department: z.string().min(1, "El departamento es requerido"),
  purchaseDate: z.date({
    required_error: "La fecha de adquisición es requerida",
  }),
  installationDate: z.date().optional(),
  initialHours: z.string().refine((val) => !isNaN(Number(val)), { message: "Debe ser un número válido" }),
  currentHours: z.string().refine((val) => !isNaN(Number(val)), { message: "Debe ser un número válido" }),
  status: z.string().min(1, "El estado es requerido"),
  notes: z.string().optional(),
  warrantyExpiration: z.date().optional(),
  isNew: z.boolean(),
  purchaseCost: z.string().optional(),
  registrationInfo: z.string().optional(),
  insurancePolicy: z.string().optional(),
  insuranceCoverage: z
    .object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    })
    .optional(),
})

type FormValues = z.infer<typeof formSchema>

interface PhotoWithDescription {
  file: File
  preview: string
  description: string
}

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

interface IncidentRecord {
  date: Date
  type: string
  reportedBy: string
  description: string
  impact?: string
  resolution?: string
  downtime?: string
  laborHours?: string
  laborCost?: string
  parts?: MaintenanceHistoryPart[]
  totalCost?: string
  workOrder?: string
  status?: string
}

interface InsuranceDocument {
  name: string
  file: File | null
  url?: string
}

interface MaintenanceSchedule {
  id: string
  hours: number
  name: string
  description: string
  tasks: MaintenanceTask[]
  completed?: boolean
  completionDate?: Date
  technician?: string
}

interface MaintenanceTask {
  id: string
  description: string
  type: string
  estimatedTime: number
  requiresSpecialist: boolean
  parts: MaintenancePart[]
  completed?: boolean
}

interface MaintenancePart {
  id: string
  name: string
  partNumber: string
  quantity: number
  cost?: number
}

interface Asset {
  id: string
  asset_id: string
  name: string
  serial_number: string
  location: string
  department: string
  purchase_date: string
  installation_date?: string
  initial_hours: number
  current_hours: number
  status: string
  notes?: string
  warranty_expiration?: string
  is_new: boolean
  registration_info?: string
  model_id?: string
  photos?: string[]
  insurance_policy?: string
  insurance_start_date?: string
  insurance_end_date?: string
  insurance_documents?: string[]
  purchase_cost?: string
}

interface AssetEditFormProps {
  assetId: string
}

export function AssetEditForm({ assetId }: AssetEditFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedModel, setSelectedModel] = useState<EquipmentModelWithIntervals | null>(null)
  const [isNewEquipment, setIsNewEquipment] = useState(true)
  const [uploadedPhotos, setUploadedPhotos] = useState<PhotoWithDescription[]>([])
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistoryRecord[]>([])
  const [incidents, setIncidents] = useState<IncidentRecord[]>([])
  const [insuranceDocuments, setInsuranceDocuments] = useState<InsuranceDocument[]>([])
  const [maintenanceSchedule, setMaintenanceSchedule] = useState<MaintenanceSchedule[]>([])
  const [completedMaintenances, setCompletedMaintenances] = useState<string[]>([])
  
  // Form states
  const [historyDate, setHistoryDate] = useState<Date | undefined>(new Date())
  const [historyType, setHistoryType] = useState("")
  const [historyDescription, setHistoryDescription] = useState("")
  const [historyTechnician, setHistoryTechnician] = useState("")
  const [historyCost, setHistoryCost] = useState("")
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null)
  
  // Additional states from original component
  const [historyParts, setHistoryParts] = useState<MaintenanceHistoryPart[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPartDialogOpen, setIsPartDialogOpen] = useState(false)
  const [currentMaintenance, setCurrentMaintenance] = useState<MaintenanceSchedule | null>(null)
  const [currentPhotoDescription, setCurrentPhotoDescription] = useState("")
  const [historyHours, setHistoryHours] = useState("")
  const [historyFindings, setHistoryFindings] = useState("")
  const [historyActions, setHistoryActions] = useState("")
  const [historyLaborHours, setHistoryLaborHours] = useState("")
  const [historyLaborCost, setHistoryLaborCost] = useState("")
  const [historyWorkOrder, setHistoryWorkOrder] = useState("")
  const [showLinkMaintenancePlanDialog, setShowLinkMaintenancePlanDialog] = useState(false)
  const [selectedMaintenancePlan, setSelectedMaintenancePlan] = useState<MaintenanceSchedule | null>(null)
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({})
  const [searchMaintenancePlan, setSearchMaintenancePlan] = useState("")
  const [showMaintenanceTasksDialog, setShowMaintenanceTasksDialog] = useState(false)
  const [showMaintenanceRecordDialog, setShowMaintenanceRecordDialog] = useState(false)
  const [newPartName, setNewPartName] = useState("")
  const [newPartNumber, setNewPartNumber] = useState("")
  const [newPartQuantity, setNewPartQuantity] = useState(1)
  const [newPartCost, setNewPartCost] = useState("")
  
  // States for incidents
  const [incidentDate, setIncidentDate] = useState<Date | undefined>(new Date())
  const [incidentType, setIncidentType] = useState("")
  const [incidentReportedBy, setIncidentReportedBy] = useState("")
  const [incidentDescription, setIncidentDescription] = useState("")
  const [incidentImpact, setIncidentImpact] = useState("")
  const [incidentResolution, setIncidentResolution] = useState("")
  const [incidentDowntime, setIncidentDowntime] = useState("")
  const [incidentLaborHours, setIncidentLaborHours] = useState("")
  const [incidentLaborCost, setIncidentLaborCost] = useState("")
  const [incidentTotalCost, setIncidentTotalCost] = useState("")
  const [incidentWorkOrder, setIncidentWorkOrder] = useState("")
  const [incidentStatus, setIncidentStatus] = useState("Resuelto")
  const [incidentParts, setIncidentParts] = useState<MaintenanceHistoryPart[]>([])
  const [editingIncidentIndex, setEditingIncidentIndex] = useState<number | null>(null)
  const [showIncidentDialog, setShowIncidentDialog] = useState(false)
  const [partsDialogContext, setPartsDialogContext] = useState<'maintenance' | 'incident'>('maintenance')

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
      purchaseCost: "",
      registrationInfo: "",
      insurancePolicy: "",
      insuranceCoverage: { startDate: undefined, endDate: undefined },
    },
  })

  // Load asset data
  useEffect(() => {
    const loadAssetData = async () => {
      try {
        setIsLoading(true)
        const supabase = createClient()
        
        // Obtener información del activo
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
          // Populate form with asset data
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
            purchaseCost: asset.purchase_cost || "",
            insurancePolicy: asset.insurance_policy || "",
            insuranceCoverage: {
              startDate: asset.insurance_start_date ? new Date(asset.insurance_start_date) : undefined,
              endDate: asset.insurance_end_date ? new Date(asset.insurance_end_date) : undefined
            }
          })

          setIsNewEquipment(asset.is_new || false)

          // Set selected model if available
          if (asset.equipment_models && typeof asset.equipment_models === 'object') {
            setSelectedModel(asset.equipment_models as EquipmentModelWithIntervals)
            
            // Cargar planes de mantenimiento para este modelo
            if (asset.model_id) {
              await loadMaintenanceSchedules(asset.model_id)
            }
          }

          // Load existing photos
          if (asset.photos && asset.photos.length > 0) {
            const photoPromises = asset.photos.map(async (photoUrl: string, index: number) => {
              try {
                const response = await fetch(photoUrl)
                const blob = await response.blob()
                const file = new File([blob], `photo-${index}.jpg`, { type: blob.type })
                
                return {
                  file,
                  preview: photoUrl,
                  description: `Foto ${index + 1}` // You might want to store descriptions separately
                }
              } catch (error) {
                console.error("Error loading photo:", error)
                return null
              }
            })

            const photos = await Promise.all(photoPromises)
            setUploadedPhotos(photos.filter((photo): photo is PhotoWithDescription => photo !== null))
          }
          
          // Cargar documentos de seguro
          if (asset.insurance_documents && asset.insurance_documents.length > 0) {
            const docs = asset.insurance_documents.map((url: string) => {
              const fileName = url.split('/').pop() || 'documento.pdf'
              return {
                name: fileName,
                file: null,
                url
              }
            })
            setInsuranceDocuments(docs)
          }
          
          // Cargar historial de mantenimiento
          await loadMaintenanceHistory(assetId)
          
          // Cargar historial de incidentes
          await loadIncidentHistory(assetId)
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
  
  // Cargar historial de mantenimiento
  const loadMaintenanceHistory = async (id: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("maintenance_history")
        .select("*")
        .eq("asset_id", id)
        .order("date", { ascending: false })
      
      if (error) throw error
      
      if (data && data.length > 0) {
        const history: MaintenanceHistoryRecord[] = data.map(record => {
          return {
            date: new Date(record.date),
            type: record.type,
            hours: record.hours?.toString(),
            description: record.description,
            findings: record.findings || undefined,
            actions: record.actions || undefined,
            technician: record.technician,
            laborHours: record.labor_hours?.toString(),
            laborCost: record.labor_cost?.toString(),
            cost: record.total_cost?.toString(),
            workOrder: record.work_order || undefined,
            parts: record.parts && typeof record.parts === 'string' ? JSON.parse(record.parts) : undefined,
            maintenancePlanId: record.maintenance_plan_id || undefined,
            completedTasks: record.completed_tasks && typeof record.completed_tasks === 'string' ? JSON.parse(record.completed_tasks) : undefined
          }
        })
        
        setMaintenanceHistory(history)
      }
    } catch (error) {
      console.error("Error al cargar historial de mantenimiento:", error)
    }
  }
  
  // Cargar historial de incidentes
  const loadIncidentHistory = async (id: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("incident_history")
        .select("*")
        .eq("asset_id", id)
        .order("date", { ascending: false })
      
      if (error) throw error
      
      if (data && data.length > 0) {
        const history: IncidentRecord[] = data.map(record => {
          return {
            date: new Date(record.date),
            type: record.type,
            reportedBy: record.reported_by,
            description: record.description,
            impact: record.impact || undefined,
            resolution: record.resolution || undefined,
            downtime: record.downtime?.toString() || undefined,
            laborHours: record.labor_hours?.toString() || undefined,
            laborCost: record.labor_cost?.toString() || undefined,
            parts: Array.isArray(record.parts) ? record.parts : 
                   (typeof record.parts === 'string' && record.parts.trim() !== '') ? 
                   JSON.parse(record.parts) : [],
            totalCost: record.total_cost?.toString() || undefined,
            workOrder: record.work_order_text || undefined,
            status: record.status || "Resuelto",
          }
        })
        setIncidents(history)
      }
    } catch (error) {
      console.error("Error al cargar historial de incidentes:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo cargar el historial de incidentes.",
      })
    }
  }
  
  // Cargar intervalos de mantenimiento para el modelo
  const loadMaintenanceSchedules = async (modelId: string) => {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from("maintenance_intervals")
        .select(`
          *,
          maintenance_tasks(*)
        `)
        .eq("model_id", modelId)
        
      if (error) throw error
      
      if (data && data.length > 0) {
        const schedules: MaintenanceSchedule[] = data.map((activity: any) => {
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
            hours: activity.interval_value || activity.hours || 0,
            name: activity.name || `Mantenimiento a las ${activity.interval_value || activity.hours} horas`,
            description: activity.description || '',
            tasks: tasks
          }
        })
        
        setMaintenanceSchedule(schedules)
      }
    } catch (error) {
      console.error('Error al cargar las actividades de mantenimiento:', error)
    }
  }
  
  // Maintenance history handlers
  const addMaintenanceHistory = () => {
    if (historyDate && historyType && historyDescription && historyTechnician) {
      const newHistory: MaintenanceHistoryRecord = {
        date: historyDate,
        type: historyType,
        description: historyDescription,
        technician: historyTechnician,
        cost: historyCost || undefined,
        parts: historyParts.length > 0 ? [...historyParts] : undefined,
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
      try {
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

        // Guardar directamente en la base de datos
        const supabase = createClient()
        const user = (await supabase.auth.getUser()).data.user
      
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
          total_cost: newHistory.cost || null,
          work_order: historyWorkOrder || null,
          parts: historyParts.length > 0 ? JSON.stringify(historyParts) : null,
          maintenance_plan_id: selectedMaintenancePlan?.id || null,
          completed_tasks: Object.keys(completedTasks).length > 0 ? JSON.stringify(completedTasks) : null,
          created_by: user.id,
          created_at: new Date().toISOString()
        }
        
        const { error: recordError, data } = await supabase
          .from("maintenance_history")
          .insert(maintenanceData)
          .select()
          
        if (recordError) {
          throw recordError
        }
        
        // Actualizar las horas actuales del activo si se proporcionaron
        if (historyHours) {
          const { error: updateError } = await supabase
            .from("assets")
            .update({ 
              current_hours: parseInt(historyHours),
              last_maintenance_date: historyDate.toISOString(),
              updated_at: new Date().toISOString() 
            })
            .eq("id", assetId);
            
          if (updateError) {
            console.error("Error al actualizar las horas del activo:", updateError);
          } else {
            form.setValue("currentHours", historyHours);
          }
        }

        if (editingHistoryIndex !== null) {
          const updatedHistory = [...maintenanceHistory]
          updatedHistory[editingHistoryIndex] = newHistory
          setMaintenanceHistory(updatedHistory)
          setEditingHistoryIndex(null)
        } else {
          setMaintenanceHistory([...maintenanceHistory, newHistory])
        }
        
        toast({
          title: "Mantenimiento registrado",
          description: "El mantenimiento ha sido registrado correctamente"
        })

        resetHistoryForm()
        setShowMaintenanceRecordDialog(false)
      } catch (error: any) {
        console.error("Error al registrar mantenimiento:", error)
        toast({
          title: "Error al registrar mantenimiento",
          description: error.message || "Ocurrió un error inesperado",
          variant: "destructive"
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

  const removeMaintenanceHistory = async (index: number, id?: string) => {
    try {
      if (id) {
        // Si tenemos el ID, eliminamos de la base de datos
        const supabase = createClient()
        const { error } = await supabase
          .from("maintenance_history")
          .delete()
          .eq("id", id)
          
        if (error) throw error
      }
      
      const newHistory = [...maintenanceHistory]
      newHistory.splice(index, 1)
      setMaintenanceHistory(newHistory)
      
      toast({
        title: "Registro eliminado",
        description: "El registro de mantenimiento ha sido eliminado"
      })
    } catch (error: any) {
      console.error("Error al eliminar registro:", error)
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar el registro",
        variant: "destructive"
      })
    }
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

    if (record.maintenancePlanId) {
      const plan = maintenanceSchedule.find((p) => p.id === record.maintenancePlanId)
      if (plan) {
        setSelectedMaintenancePlan(plan)
      }
    }

    if (record.completedTasks) {
      setCompletedTasks(record.completedTasks)
    }
    
    setShowMaintenanceRecordDialog(true)
  }
  
  // Part management
  const addPart = () => {
    if (newPartName && newPartQuantity > 0) {
      const newPart: MaintenanceHistoryPart = {
        name: newPartName,
        partNumber: newPartNumber || undefined,
        quantity: newPartQuantity,
        cost: newPartCost || undefined,
      }
      setHistoryParts([...historyParts, newPart])
      setNewPartName("")
      setNewPartNumber("")
      setNewPartQuantity(1)
      setNewPartCost("")
      setIsPartDialogOpen(false)
    }
  }

  const removePart = (index: number) => {
    const newParts = [...historyParts]
    newParts.splice(index, 1)
    setHistoryParts(newParts)
  }
  
  // Incidents handlers
  const addIncident = async () => {
    if (incidentDate && incidentType && incidentReportedBy && incidentDescription) {
      try {
        const newIncident: IncidentRecord = {
          date: incidentDate,
          type: incidentType,
          reportedBy: incidentReportedBy,
          description: incidentDescription,
          impact: incidentImpact || undefined,
          resolution: incidentResolution || undefined,
          downtime: incidentDowntime || undefined,
          laborHours: incidentLaborHours || undefined,
          laborCost: incidentLaborCost || undefined,
          parts: incidentParts.length > 0 ? [...incidentParts] : undefined,
          totalCost: incidentTotalCost || undefined,
          workOrder: incidentWorkOrder || undefined,
          status: incidentStatus || "Resuelto",
        }

        // Save to database
        const supabase = createClient()
        const { error } = await supabase
          .from("incident_history")
          .insert({
            asset_id: assetId,
            date: incidentDate.toISOString(),
            type: incidentType,
            reported_by: incidentReportedBy,
            description: incidentDescription,
            impact: incidentImpact || null,
            resolution: incidentResolution || null,
            downtime: incidentDowntime ? parseFloat(incidentDowntime) : null,
            labor_hours: incidentLaborHours ? parseFloat(incidentLaborHours) : null,
            labor_cost: incidentLaborCost ? parseFloat(incidentLaborCost) : null,
            parts: incidentParts.length > 0 ? incidentParts : null,
            total_cost: incidentTotalCost ? parseFloat(incidentTotalCost) : null,
            work_order_text: incidentWorkOrder || null,
            status: incidentStatus || "Resuelto",
          } as any)

        if (error) {
          console.error("Error al registrar incidente:", error)
          toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo registrar el incidente. Intente nuevamente.",
          })
          return
        }

        if (editingIncidentIndex !== null) {
          const updatedIncidents = [...incidents]
          updatedIncidents[editingIncidentIndex] = newIncident
          setIncidents(updatedIncidents)
          setEditingIncidentIndex(null)
        } else {
          setIncidents([...incidents, newIncident])
        }

        // Reset form
        setIncidentDate(new Date())
        setIncidentType("")
        setIncidentReportedBy("")
        setIncidentDescription("")
        setIncidentImpact("")
        setIncidentResolution("")
        setIncidentDowntime("")
        setIncidentLaborHours("")
        setIncidentLaborCost("")
        setIncidentParts([])
        setIncidentTotalCost("")
        setIncidentWorkOrder("")
        setIncidentStatus("Resuelto")
        setShowIncidentDialog(false)

        toast({
          title: "Éxito",
          description: "Incidente registrado correctamente.",
        })
      } catch (error) {
        console.error("Error al registrar incidente:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo registrar el incidente. Intente nuevamente.",
        })
      }
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor complete los campos obligatorios: fecha, tipo, reportado por y descripción.",
      })
    }
  }
  
  const resetIncidentForm = () => {
    setIncidentDate(new Date())
    setIncidentType("")
    setIncidentReportedBy("")
    setIncidentDescription("")
    setIncidentImpact("")
    setIncidentResolution("")
    setIncidentDowntime("")
    setIncidentLaborHours("")
    setIncidentLaborCost("")
    setIncidentTotalCost("")
    setIncidentWorkOrder("")
    setIncidentStatus("Resuelto")
    setIncidentParts([])
    setEditingIncidentIndex(null)
  }

  const removeIncident = async (index: number, id?: string) => {
    try {
      if (id) {
        // Si tenemos el ID, eliminamos de la base de datos
        const supabase = createClient()
        const { error } = await supabase
          .from("incident_history")
          .delete()
          .eq("id", id)
          
        if (error) throw error
      }
      
      const updatedIncidents = [...incidents]
      updatedIncidents.splice(index, 1)
      setIncidents(updatedIncidents)
      
      toast({
        title: "Incidente eliminado",
        description: "El incidente ha sido eliminado correctamente"
      })
    } catch (error: any) {
      console.error("Error al eliminar incidente:", error)
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar el incidente",
        variant: "destructive"
      })
    }
  }

  const editIncident = (index: number) => {
    const incident = incidents[index]
    setIncidentDate(incident.date)
    setIncidentType(incident.type)
    setIncidentReportedBy(incident.reportedBy)
    setIncidentDescription(incident.description)
    setIncidentImpact(incident.impact || "")
    setIncidentResolution(incident.resolution || "")
    setIncidentDowntime(incident.downtime || "")
    setIncidentLaborHours(incident.laborHours || "")
    setIncidentLaborCost(incident.laborCost || "")
    setIncidentTotalCost(incident.totalCost || "")
    setIncidentWorkOrder(incident.workOrder || "")
    setIncidentStatus(incident.status || "Resuelto")
    setIncidentParts(incident.parts || [])
    setEditingIncidentIndex(index)
    setShowIncidentDialog(true)
  }
  
  // Insurance document handlers
  const addInsuranceDocument = (file: File) => {
    const newDoc: InsuranceDocument = {
      name: file.name,
      file: file,
    }
    setInsuranceDocuments([...insuranceDocuments, newDoc])
  }

  const removeInsuranceDocument = (index: number) => {
    setInsuranceDocuments(insuranceDocuments.filter((_, i) => i !== index))
  }
  
  // Maintenance plan handlers
  const openMaintenanceDialog = (maintenance: MaintenanceSchedule) => {
    setCurrentMaintenance(maintenance)
    setIsDialogOpen(true)
  }

  const markMaintenanceAsCompleted = (maintenanceId: string, completed = true) => {
    if (completed) {
      setCompletedMaintenances([...completedMaintenances, maintenanceId])
    } else {
      setCompletedMaintenances(completedMaintenances.filter((id) => id !== maintenanceId))
    }
  }

  const calculateNextMaintenanceHours = () => {
    if (!maintenanceSchedule.length || !form.getValues("currentHours")) return null

    const currentHours = Number.parseInt(form.getValues("currentHours"))
    const sortedSchedules = [...maintenanceSchedule].sort((a, b) => a.hours - b.hours)

    for (const schedule of sortedSchedules) {
      const nextOccurrence = Math.ceil(currentHours / schedule.hours) * schedule.hours
      if (nextOccurrence > currentHours) {
        return {
          hours: nextOccurrence,
          name: schedule.name,
          remaining: nextOccurrence - currentHours,
        }
      }
    }

    return null
  }
  
  // Maintenance plan handlers for tabs
  const getNextMaintenance = () => {
    return calculateNextMaintenanceHours()
  }

  const onRegisterMaintenance = (maintenance: MaintenanceSchedule) => {
    setCurrentMaintenance(maintenance)
    setSelectedMaintenancePlan(maintenance)
    setHistoryType("Preventivo")
    setHistoryDescription(`${maintenance.name} - ${maintenance.description}`)
    setHistoryHours(form.getValues("currentHours"))

    const initialTasksState: Record<string, boolean> = {}
    maintenance.tasks.forEach((task) => {
      initialTasksState[task.id] = false
    })
    setCompletedTasks(initialTasksState)

    const planParts: MaintenanceHistoryPart[] = []
    maintenance.tasks.forEach((task) => {
      task.parts.forEach((part) => {
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

    setTimeout(() => {
      setShowMaintenanceRecordDialog(true)
    }, 10)
  }
  
  // Funciones adicionales para diálogos
  const handleSelectMaintenancePlan = (plan: MaintenanceSchedule) => {
    setSelectedMaintenancePlan(plan)

    // Auto-populate fields based on the maintenance plan
    setHistoryType("Preventivo")
    setHistoryDescription(`${plan.name} - ${plan.description}`)
    setHistoryHours(plan.hours.toString())

    // Initialize completed tasks
    const initialTasksState: Record<string, boolean> = {}
    plan.tasks.forEach((task) => {
      initialTasksState[task.id] = false
    })
    setCompletedTasks(initialTasksState)

    // Auto-populate parts if available
    const planParts: MaintenanceHistoryPart[] = []
    plan.tasks.forEach((task) => {
      task.parts.forEach((part) => {
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

    setShowLinkMaintenancePlanDialog(false)
  }

  const handleOpenMaintenanceTasksDialog = () => {
    if (!selectedMaintenancePlan) return
    setShowMaintenanceTasksDialog(true)
  }

  const filteredMaintenancePlans = searchMaintenancePlan
    ? maintenanceSchedule.filter(
        (plan) =>
          plan.name.toLowerCase().includes(searchMaintenancePlan.toLowerCase()) ||
          plan.description.toLowerCase().includes(searchMaintenancePlan.toLowerCase()) ||
          plan.hours.toString().includes(searchMaintenancePlan),
      )
    : maintenanceSchedule
    
  // Add incident part function
  const addIncidentPart = () => {
    const newPart: MaintenanceHistoryPart = {
      name: newPartName,
      partNumber: newPartNumber || undefined,
      quantity: Number(newPartQuantity) || 1,
      cost: newPartCost || undefined,
    }
    setIncidentParts([...incidentParts, newPart])
    setNewPartName("")
    setNewPartNumber("")
    setNewPartQuantity(1)
    setNewPartCost("")
    setIsPartDialogOpen(false)
  }

  const removeIncidentPart = (index: number) => {
    const updatedParts = [...incidentParts]
    updatedParts.splice(index, 1)
    setIncidentParts(updatedParts)
  }

  const handleModelSelect = async (model: EquipmentModelWithIntervals | null) => {
    setSelectedModel(model)
    
    if (model) {
      form.setValue("name", `${model.name} - ${model.manufacturer}`)
      
      try {
        // Cargar los intervalos de mantenimiento
        await loadMaintenanceSchedules(model.id)
      } catch (error) {
        console.error('Error al cargar las actividades de mantenimiento:', error)
      }
    } else {
      setMaintenanceSchedule([])
    }
  }

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true)
      
      const supabase = createClient()
      const user = (await supabase.auth.getUser()).data.user
      
      if (!user) {
        throw new Error("Usuario no autenticado")
      }

      // Upload new photos
      const photoUrls: string[] = []
      
      for (const photo of uploadedPhotos) {
        // Check if it's a new photo (has a File object) or existing (just URL)
        if (photo.file && photo.preview.startsWith('data:')) {
          const fileName = `${data.assetId}/${Date.now()}-${photo.file.name}`
          const { data: uploadData, error } = await supabase.storage
            .from("asset-photos")
            .upload(fileName, photo.file)
          
          if (error) {
            throw error
          }
          
          const { data: publicUrlData } = supabase.storage
            .from("asset-photos")
            .getPublicUrl(fileName)
          
          photoUrls.push(publicUrlData.publicUrl)
        } else {
          // Existing photo, keep the URL
          photoUrls.push(photo.preview)
        }
      }
      
      // Upload insurance documents
      const insuranceDocUrls: string[] = []
      
      for (const doc of insuranceDocuments) {
        if (doc.url) {
          insuranceDocUrls.push(doc.url)
        } else if (doc.file) {
          const fileName = `${data.assetId}/insurance/${Date.now()}-${doc.file.name}`
          const { data: uploadData, error } = await supabase.storage.from("asset-documents").upload(fileName, doc.file)
          
          if (error) {
            throw error
          }
          
          const { data: publicUrlData } = supabase.storage.from("asset-documents").getPublicUrl(fileName)
          insuranceDocUrls.push(publicUrlData.publicUrl)
        }
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
        model_id: selectedModel?.id,
        photos: photoUrls,
        insurance_documents: insuranceDocUrls,
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
      <TabsList className="grid w-full grid-cols-7">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="technical">Técnica</TabsTrigger>
        <TabsTrigger value="financial">Financiera</TabsTrigger>
        <TabsTrigger value="maintenance-plan">Plan</TabsTrigger>
        <TabsTrigger value="maintenance-history">Historial</TabsTrigger>
        <TabsTrigger value="incidents">Incidentes</TabsTrigger>
        <TabsTrigger value="documents">Documentos</TabsTrigger>
      </TabsList>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-6">
          <TabsContent value="general" className="space-y-6">
            <GeneralInfoTab
              control={form.control}
              selectedModel={selectedModel}
              onModelSelect={handleModelSelect}
              isNewEquipment={isNewEquipment}
              setIsNewEquipment={setIsNewEquipment}
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
              insuranceDocuments={insuranceDocuments}
              addInsuranceDocument={addInsuranceDocument}
              removeInsuranceDocument={removeInsuranceDocument}
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
            />
          </TabsContent>
          
          <TabsContent value="maintenance-history" className="space-y-6">
            <MaintenanceHistoryTab
              isNewEquipment={isNewEquipment}
              maintenanceHistory={maintenanceHistory}
              onAddMaintenanceHistory={addMaintenanceHistory}
              onRemoveMaintenanceHistory={removeMaintenanceHistory}
              onEditMaintenanceHistory={editMaintenanceHistory}
              historyDate={historyDate}
              setHistoryDate={setHistoryDate}
              historyType={historyType}
              setHistoryType={setHistoryType}
              historyDescription={historyDescription}
              setHistoryDescription={setHistoryDescription}
              historyTechnician={historyTechnician}
              setHistoryTechnician={setHistoryTechnician}
              historyCost={historyCost}
              setHistoryCost={setHistoryCost}
              editingHistoryIndex={editingHistoryIndex}
              historyHours={historyHours}
              setHistoryHours={setHistoryHours}
              historyFindings={historyFindings}
              setHistoryFindings={setHistoryFindings}
              historyActions={historyActions}
              setHistoryActions={setHistoryActions}
              historyLaborHours={historyLaborHours}
              setHistoryLaborHours={setHistoryLaborHours}
              historyLaborCost={historyLaborCost}
              setHistoryLaborCost={setHistoryLaborCost}
              historyWorkOrder={historyWorkOrder}
              setHistoryWorkOrder={setHistoryWorkOrder}
              historyParts={historyParts}
              setHistoryParts={setHistoryParts}
              selectedMaintenancePlan={selectedMaintenancePlan}
              setSelectedMaintenancePlan={setSelectedMaintenancePlan}
              completedTasks={completedTasks}
              setCompletedTasks={setCompletedTasks}
              maintenanceSchedule={maintenanceSchedule}
              onAddDetailedMaintenanceHistory={addDetailedMaintenanceHistory}
              onOpenPartDialog={() => {
                setPartsDialogContext('maintenance')
                setIsPartDialogOpen(true)
              }}
              onOpenLinkMaintenancePlanDialog={() => setShowLinkMaintenancePlanDialog(true)}
            />
          </TabsContent>
          
          <TabsContent value="incidents" className="space-y-6">
            <IncidentsTab
              incidents={incidents}
              onAddIncident={() => setShowIncidentDialog(true)}
              onEditIncident={editIncident}
              onRemoveIncident={removeIncident}
            />
          </TabsContent>
          
          <TabsContent value="documents" className="space-y-6">
            <DocumentsTab />
          </TabsContent>

          <div className="flex justify-end space-x-4 pt-4">
            <Button variant="outline" type="button" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
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

      <PhotoUploadDialog
        open={photoUploadOpen}
        onOpenChange={setPhotoUploadOpen}
        uploadedPhotos={uploadedPhotos}
        setUploadedPhotos={setUploadedPhotos}
      />
      
      {/* Dialog para detalles de mantenimiento */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentMaintenance?.name}</DialogTitle>
            <DialogDescription>
              {currentMaintenance?.description} - {currentMaintenance?.hours} horas de operación
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Tareas de mantenimiento</h4>
              {currentMaintenance?.tasks.map((task) => (
                <div key={task.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{task.type}</Badge>
                      <span className="font-medium">{task.description}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{task.estimatedTime}h</span>
                  </div>
                  {task.requiresSpecialist && (
                    <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Requiere técnico especialista
                    </div>
                  )}
                  {task.parts.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium mb-1">Repuestos requeridos:</p>
                      <div className="space-y-1">
                        {task.parts.map((part) => (
                          <div key={part.id} className="text-xs flex justify-between">
                            <span>
                              {part.name} ({part.partNumber})
                            </span>
                            <span>Cantidad: {part.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {currentMaintenance?.tasks.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No hay tareas definidas para este mantenimiento.
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para agregar repuestos */}
      <Dialog open={isPartDialogOpen} onOpenChange={setIsPartDialogOpen}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Agregar Repuesto</DialogTitle>
            <DialogDescription>Ingrese la información del repuesto utilizado</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="partName">Nombre del Repuesto</Label>
              <Input
                id="partName"
                placeholder="Ej: Filtro de aceite"
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partNumber">Número de Parte</Label>
              <Input
                id="partNumber"
                placeholder="Ej: FO-1234"
                value={newPartNumber}
                onChange={(e) => setNewPartNumber(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partQuantity">Cantidad</Label>
                <Input
                  id="partQuantity"
                  type="number"
                  min="1"
                  value={newPartQuantity}
                  onChange={(e) => setNewPartQuantity(Number.parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partCost">Costo</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="partCost"
                    placeholder="0.00"
                    className="pl-8"
                    value={newPartCost}
                    onChange={(e) => setNewPartCost(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPartDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={partsDialogContext === 'incident' ? addIncidentPart : addPart} 
              disabled={!newPartName || newPartQuantity < 1}
            >
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para registrar incidente */}
      <Dialog open={showIncidentDialog} onOpenChange={setShowIncidentDialog}>
        <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <form onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            addIncident()
          }}>
            <DialogHeader>
              <DialogTitle>Registrar Incidente</DialogTitle>
              <DialogDescription>
                Registre los detalles del incidente o falla en el equipo
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant={"outline"}
                        className={cn("w-full pl-3 text-left font-normal", !incidentDate && "text-muted-foreground")}
                      >
                        {incidentDate ? format(incidentDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={incidentDate} onSelect={setIncidentDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Incidente</Label>
                  <Select onValueChange={(value) => setIncidentType(value)} value={incidentType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Falla eléctrica">Falla eléctrica</SelectItem>
                      <SelectItem value="Falla mecánica">Falla mecánica</SelectItem>
                      <SelectItem value="Falla hidráulica">Falla hidráulica</SelectItem>
                      <SelectItem value="Falla de software">Falla de software</SelectItem>
                      <SelectItem value="Accidente">Accidente</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Reportado por</Label>
                  <Input
                    placeholder="Nombre de quien reporta"
                    value={incidentReportedBy}
                    onChange={(e) => setIncidentReportedBy(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  placeholder="Describa el incidente detalladamente"
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  required
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Impacto</Label>
                  <Textarea
                    placeholder="Impacto en la operación o producción"
                    value={incidentImpact}
                    onChange={(e) => setIncidentImpact(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Resolución</Label>
                  <Textarea
                    placeholder="Cómo se resolvió el incidente"
                    value={incidentResolution}
                    onChange={(e) => setIncidentResolution(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select onValueChange={(value) => setIncidentStatus(value)} value={incidentStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendiente">Pendiente</SelectItem>
                      <SelectItem value="En progreso">En progreso</SelectItem>
                      <SelectItem value="Resuelto">Resuelto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tiempo de Inactividad (horas)</Label>
                  <Input
                    type="number"
                    placeholder="Ej: 8"
                    value={incidentDowntime}
                    onChange={(e) => setIncidentDowntime(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Horas de Trabajo</Label>
                  <Input
                    type="number"
                    placeholder="Ej: 4"
                    value={incidentLaborHours}
                    onChange={(e) => setIncidentLaborHours(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Costo de Mano de Obra</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="0.00"
                      className="pl-8"
                      value={incidentLaborCost}
                      onChange={(e) => setIncidentLaborCost(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Costo Total</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="0.00"
                      className="pl-8"
                      value={incidentTotalCost}
                      onChange={(e) => setIncidentTotalCost(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Orden de Trabajo</Label>
                <Input
                  placeholder="Ej: OT-12345"
                  value={incidentWorkOrder}
                  onChange={(e) => setIncidentWorkOrder(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Repuestos Utilizados</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    setPartsDialogContext('incident')
                    setIsPartDialogOpen(true)
                  }}>
                    <Plus className="mr-1 h-4 w-4" /> Agregar Repuesto
                  </Button>
                </div>

                {incidentParts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Número de Parte</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Costo</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incidentParts.map((part, index) => (
                          <TableRow key={index}>
                            <TableCell>{part.name}</TableCell>
                            <TableCell>{part.partNumber || "-"}</TableCell>
                            <TableCell>{part.quantity}</TableCell>
                            <TableCell>{part.cost || "-"}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeIncidentPart(index)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border rounded-md">
                    No hay repuestos registrados para este incidente.
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowIncidentDialog(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={!incidentDate || !incidentType || !incidentReportedBy || !incidentDescription}
              >
                {editingIncidentIndex !== null ? "Actualizar" : "Registrar"} Incidente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para vincular plan de mantenimiento */}
      <Dialog open={showLinkMaintenancePlanDialog} onOpenChange={setShowLinkMaintenancePlanDialog}>
        <DialogContent className="max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular a Plan de Mantenimiento</DialogTitle>
            <DialogDescription>Seleccione un plan de mantenimiento para vincular a este registro</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <Command className="rounded-lg border shadow-md">
                <CommandInput
                  placeholder="Buscar plan de mantenimiento..."
                  value={searchMaintenancePlan}
                  onValueChange={setSearchMaintenancePlan}
                />
                <CommandList>
                  <CommandEmpty>No se encontraron planes de mantenimiento.</CommandEmpty>
                  <CommandGroup heading="Planes de Mantenimiento Disponibles">
                    {filteredMaintenancePlans.map((plan) => (
                      <CommandItem
                        key={plan.id}
                        onSelect={() => handleSelectMaintenancePlan(plan)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          <span>{plan.name}</span>
                          <Badge variant="outline" className="ml-2">
                            {plan.hours} horas
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{plan.tasks.length} tareas</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>

              {maintenanceSchedule.length === 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No hay planes disponibles</AlertTitle>
                  <AlertDescription>
                    No hay planes de mantenimiento disponibles para este modelo de equipo.
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-sm text-muted-foreground">
                <Info className="h-4 w-4 inline-block mr-1" />
                Al vincular un plan de mantenimiento, se auto-completarán algunos campos y se podrán registrar las
                tareas completadas.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkMaintenancePlanDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para gestionar tareas del plan de mantenimiento */}
      <Dialog open={showMaintenanceTasksDialog} onOpenChange={setShowMaintenanceTasksDialog}>
        <DialogContent className="max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar Tareas Completadas</DialogTitle>
            <DialogDescription>Marque las tareas que se completaron durante este mantenimiento</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedMaintenancePlan && (
              <div className="space-y-4">
                <div className="p-3 border rounded-md bg-muted/20">
                  <h3 className="font-medium">{selectedMaintenancePlan.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedMaintenancePlan.description}</p>
                </div>

                <div className="space-y-2">
                  {selectedMaintenancePlan.tasks.map((task) => (
                    <div key={task.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={`task-${task.id}`}
                        checked={completedTasks[task.id] || false}
                        onCheckedChange={(checked) => {
                          setCompletedTasks({
                            ...completedTasks,
                            [task.id]: !!checked,
                          })
                        }}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <Label htmlFor={`task-${task.id}`} className="text-sm font-medium">
                          {task.description}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {task.type} - {task.estimatedTime}h{task.requiresSpecialist && " - Requiere especialista"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allTasks: Record<string, boolean> = {}
                      selectedMaintenancePlan.tasks.forEach((task) => {
                        allTasks[task.id] = true
                      })
                      setCompletedTasks(allTasks)
                    }}
                  >
                    Marcar todas
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCompletedTasks({})
                    }}
                  >
                    Desmarcar todas
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMaintenanceTasksDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setShowMaintenanceTasksDialog(false)}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para registrar mantenimiento desde el plan */}
      <Dialog open={showMaintenanceRecordDialog} onOpenChange={setShowMaintenanceRecordDialog}>
        <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Mantenimiento</DialogTitle>
            <DialogDescription>
              {selectedMaintenancePlan
                ? `${selectedMaintenancePlan.name} - ${selectedMaintenancePlan.hours} horas`
                : "Registre los detalles del mantenimiento realizado"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-5 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn("w-full pl-3 text-left font-normal", !historyDate && "text-muted-foreground")}
                    >
                      {historyDate ? format(historyDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={historyDate} onSelect={setHistoryDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Mantenimiento</Label>
                <Select onValueChange={setHistoryType} value={historyType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Preventivo">Preventivo</SelectItem>
                    <SelectItem value="Correctivo">Correctivo</SelectItem>
                    <SelectItem value="Predictivo">Predictivo</SelectItem>
                    <SelectItem value="Overhaul">Overhaul</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Horas del Equipo</Label>
                <Input
                  type="number"
                  placeholder="Ej: 500"
                  value={historyHours}
                  onChange={(e) => setHistoryHours(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  placeholder="Describa el mantenimiento realizado"
                  value={historyDescription}
                  onChange={(e) => setHistoryDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Hallazgos</Label>
                <Textarea
                  placeholder="Hallazgos durante el mantenimiento"
                  value={historyFindings}
                  onChange={(e) => setHistoryFindings(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Acciones Realizadas</Label>
                <Textarea
                  placeholder="Acciones realizadas durante el mantenimiento"
                  value={historyActions}
                  onChange={(e) => setHistoryActions(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Técnico</Label>
                <Input
                  placeholder="Nombre del técnico"
                  value={historyTechnician}
                  onChange={(e) => setHistoryTechnician(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Horas de Trabajo</Label>
                <Input
                  type="number"
                  placeholder="Ej: 4"
                  value={historyLaborHours}
                  onChange={(e) => setHistoryLaborHours(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Costo de Mano de Obra</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="0.00"
                    className="pl-8"
                    value={historyLaborCost}
                    onChange={(e) => setHistoryLaborCost(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Orden de Trabajo</Label>
                <Input
                  placeholder="Ej: OT-12345"
                  value={historyWorkOrder}
                  onChange={(e) => setHistoryWorkOrder(e.target.value)}
                />
              </div>
            </div>

            {selectedMaintenancePlan && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Tareas Completadas</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleOpenMaintenanceTasksDialog}>
                    <ClipboardList className="mr-1 h-4 w-4" /> Gestionar Tareas
                  </Button>
                </div>

                <div className="border rounded-md p-3 bg-muted/20">
                  {Object.keys(completedTasks).length > 0 ? (
                    <div className="space-y-2">
                      {selectedMaintenancePlan.tasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`plan-task-${task.id}`}
                            checked={completedTasks[task.id] || false}
                            onCheckedChange={(checked) => {
                              setCompletedTasks({
                                ...completedTasks,
                                [task.id]: !!checked,
                              })
                            }}
                          />
                          <Label htmlFor={`plan-task-${task.id}`} className="text-sm">
                            {task.description}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-sm text-muted-foreground">
                      No hay tareas marcadas como completadas
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Repuestos Utilizados</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  setPartsDialogContext('maintenance')
                  setIsPartDialogOpen(true)
                }}>
                  <Plus className="mr-1 h-4 w-4" /> Agregar Repuesto
                </Button>
              </div>

              {historyParts.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Número de Parte</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Costo</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyParts.map((part, index) => (
                        <TableRow key={index}>
                          <TableCell>{part.name}</TableCell>
                          <TableCell>{part.partNumber || "-"}</TableCell>
                          <TableCell>{part.quantity}</TableCell>
                          <TableCell>{part.cost || "-"}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePart(index)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground border rounded-md">
                  No hay repuestos registrados para este mantenimiento.
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMaintenanceRecordDialog(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={addDetailedMaintenanceHistory}
              disabled={!historyDate || !historyType || !historyDescription || !historyTechnician}
            >
              {editingHistoryIndex !== null ? "Actualizar" : "Registrar"} Mantenimiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
} 