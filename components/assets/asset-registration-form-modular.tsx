"use client"

import { useState } from "react"
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
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { ModelSelector } from "./model-selector"
import { DocumentUpload } from "./document-upload"
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
  isNew: z.boolean().default(true),
  purchaseCost: z.string().optional(),
  registrationInfo: z.string().optional(),
  insurancePolicy: z.string().optional(),
  insuranceCoverage: z
    .object({
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    })
    .optional(),
  maintenanceHistory: z
    .array(
      z.object({
        date: z.date(),
        type: z.string(),
        description: z.string(),
        technician: z.string(),
        cost: z.string().optional(),
        parts: z
          .array(
            z.object({
              name: z.string(),
              partNumber: z.string().optional(),
              quantity: z.number(),
              cost: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
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

export function AssetRegistrationFormModular() {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedModel, setSelectedModel] = useState<EquipmentModelWithIntervals | null>(null)
  const [isNewEquipment, setIsNewEquipment] = useState(true)
  const [uploadedPhotos, setUploadedPhotos] = useState<PhotoWithDescription[]>([])
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
      maintenanceHistory: undefined,
    },
  })

  const handleModelSelect = async (model: EquipmentModelWithIntervals | null) => {
    setSelectedModel(model)
    
    if (model) {
      form.setValue("name", `${model.name} - ${model.manufacturer}`)
      
      try {
        const response = await fetch(`/api/models/${model.id}/maintenance-intervals`)
        
        if (!response.ok) {
          throw new Error('Error al cargar las actividades de mantenimiento')
        }
        
        const maintenanceActivities = await response.json()
        console.log("Actividades de mantenimiento cargadas:", maintenanceActivities)
        
        const updatedModel = {...model}
        updatedModel.maintenanceIntervals = maintenanceActivities.map((activity: any) => ({
          hours: activity.interval_value,
          type: activity.type,
          id: activity.id,
          name: activity.name,
          description: activity.description || ''
        }))
        
        setSelectedModel(updatedModel)
        
        const schedules: MaintenanceSchedule[] = maintenanceActivities.map((activity: any) => {
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
    } else {
      setMaintenanceSchedule([])
    }
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

  const addDetailedMaintenanceHistory = () => {
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

  // Maintenance plan functions
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

  // Photo management
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const reader = new FileReader()

      reader.onloadend = () => {
        setUploadedPhotos([
          ...uploadedPhotos,
          {
            file,
            preview: reader.result as string,
            description: currentPhotoDescription || `Foto ${uploadedPhotos.length + 1}`,
          },
        ])
        setCurrentPhotoDescription("")
      }

      reader.readAsDataURL(file)
      setPhotoUploadOpen(false)
    }
  }

  const removePhoto = (index: number) => {
    const newPhotos = [...uploadedPhotos]
    newPhotos.splice(index, 1)
    setUploadedPhotos(newPhotos)
  }

  // Función para agregar incidente
  const addIncident = () => {
    if (!incidentDate || !incidentType || !incidentReportedBy || !incidentDescription) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor complete los campos obligatorios: fecha, tipo, reportado por y descripción.",
      })
      return
    }

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
      status: incidentStatus,
    }

    if (editingIncidentIndex !== null) {
      const updatedIncidents = [...incidents]
      updatedIncidents[editingIncidentIndex] = newIncident
      setIncidents(updatedIncidents)
      setEditingIncidentIndex(null)
    } else {
      setIncidents([...incidents, newIncident])
    }

    resetIncidentForm()
    setShowIncidentDialog(false)
  }

  // Las funciones de manejo de incidentes están ahora implementadas directamente en el botón
  // para evitar cualquier problema con la propagación de eventos al formulario principal

  const removeIncident = (index: number) => {
    const updatedIncidents = [...incidents]
    updatedIncidents.splice(index, 1)
    setIncidents(updatedIncidents)
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

  const resetIncidentForm = () => {
    // Inicializa con valores predeterminados claros
    const today = new Date()
    setIncidentDate(today)
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

  // Maintenance plan handlers for tabs
  const getNextMaintenance = () => {
    return calculateNextMaintenanceHours()
  }

  const onRegisterMaintenance = (maintenance: MaintenanceSchedule) => {
    setCurrentMaintenance(maintenance)
    setSelectedMaintenancePlan(maintenance)
    setHistoryType("Preventivo")
    setHistoryDescription(`${maintenance.name} - ${maintenance.description}`)
    setHistoryHours(maintenance.hours.toString())

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

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true)
      
      const supabase = createClient()
      const user = (await supabase.auth.getUser()).data.user
      
      if (!user) {
        throw new Error("Usuario no autenticado")
      }
      
      // Upload photos
      const assetId = data.assetId
      const photoUrls: string[] = []
      
      for (const photo of uploadedPhotos) {
        const fileName = `${assetId}/${Date.now()}-${photo.file.name}`
        const { data: uploadData, error } = await supabase.storage.from("asset-photos").upload(fileName, photo.file)
        
        if (error) {
          throw error
        }
        
        const { data: publicUrlData } = supabase.storage.from("asset-photos").getPublicUrl(fileName)
        photoUrls.push(publicUrlData.publicUrl)
      }
      
      // Upload insurance documents
      const insuranceDocUrls: string[] = []
      
      for (const doc of insuranceDocuments) {
        if (doc.file) {
          const fileName = `${assetId}/insurance/${Date.now()}-${doc.file.name}`
          const { data: uploadData, error } = await supabase.storage.from("asset-documents").upload(fileName, doc.file)
          
          if (error) {
            throw error
          }
          
          const { data: publicUrlData } = supabase.storage.from("asset-documents").getPublicUrl(fileName)
          insuranceDocUrls.push(publicUrlData.publicUrl)
        }
      }
      
      // Create asset data
      const assetDataToSave = {
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
        purchase_cost: data.purchaseCost ? data.purchaseCost : null,
        registration_info: data.registrationInfo,
        insurance_policy: data.insurancePolicy,
        insurance_start_date: data.insuranceCoverage?.startDate?.toISOString(),
        insurance_end_date: data.insuranceCoverage?.endDate?.toISOString(),
        model_id: selectedModel?.id,
        photos: photoUrls,
        insurance_documents: insuranceDocUrls,
        created_by: user.id,
        created_at: new Date().toISOString(),
      }
      
      // Create asset in database
      const { data: insertedAsset, error } = await supabase
        .from("assets")
        .insert([assetDataToSave])
        .select()
        .single()
        
      if (error) {
        throw error
      }
      
      // Save maintenance history if exists
      if (maintenanceHistory.length > 0 && insertedAsset?.id) {
        for (const record of maintenanceHistory) {
          const maintenanceData = {
            asset_id: insertedAsset.id,
            date: record.date.toISOString(),
            type: record.type,
            description: record.description,
            technician: record.technician,
            findings: record.findings || null,
            actions: record.actions || null,
            hours: record.hours ? parseInt(record.hours) : null,
            labor_hours: record.laborHours ? parseFloat(record.laborHours) : null,
            labor_cost: record.laborCost || null,
            total_cost: record.cost || null,
            work_order: record.workOrder || null,
            parts: record.parts ? JSON.stringify(record.parts) : null,
            maintenance_plan_id: record.maintenancePlanId || null,
            completed_tasks: record.completedTasks ? JSON.stringify(record.completedTasks) : null,
            created_by: user.id,
            created_at: new Date().toISOString()
          }
          
          const { error: recordError } = await supabase
            .from("maintenance_history")
            .insert(maintenanceData)
            
          if (recordError) {
            console.error("Error al guardar historial de mantenimiento:", recordError)
          }
        }
      }
      
      // Save incidents if exist
      if (incidents.length > 0 && insertedAsset?.id) {
        for (const incident of incidents) {
          const incidentData = {
            asset_id: insertedAsset.id,
            date: incident.date.toISOString(),
            type: incident.type,
            reported_by: incident.reportedBy,
            description: incident.description,
            impact: incident.impact || null,
            resolution: incident.resolution || null,
            downtime: incident.downtime ? parseFloat(incident.downtime) : null,
            labor_hours: incident.laborHours ? parseFloat(incident.laborHours) : null,
            labor_cost: incident.laborCost || null,
            parts: incident.parts ? JSON.stringify(incident.parts) : null,
            total_cost: incident.totalCost || null,
            work_order: incident.workOrder || null,
            status: incident.status || "Resuelto",
            created_by: user.id,
            created_at: new Date().toISOString()
          }
          
          const { error: incidentError } = await supabase
            .from("incident_history")
            .insert(incidentData)
            
          if (incidentError) {
            console.error("Error al guardar historial de incidentes:", incidentError)
          }
        }
      }
      
      toast({
        title: "Activo registrado con éxito",
        description: `${data.name} ha sido registrado correctamente.`,
        variant: "default",
      })
      
      router.push("/activos")
      router.refresh()
    } catch (error: any) {
      console.error("Error al registrar activo:", error)
      toast({
        title: "Error al registrar el activo",
        description: error.message || "Ha ocurrido un error inesperado.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Additional functions from original component
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

  return (
    <div className="space-y-6">
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
          <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6 pt-6">
            <TabsContent value="general" className="space-y-6">
              <GeneralInfoTab
                control={form.control as any}
                selectedModel={selectedModel}
                onModelSelect={handleModelSelect}
                isNewEquipment={isNewEquipment}
                setIsNewEquipment={setIsNewEquipment}
              />
            </TabsContent>

            <TabsContent value="technical" className="space-y-6">
              <TechnicalInfoTab
                control={form.control as any}
                uploadedPhotos={uploadedPhotos}
                setUploadedPhotos={setUploadedPhotos}
                setPhotoUploadOpen={setPhotoUploadOpen}
              />
            </TabsContent>

            <TabsContent value="financial" className="space-y-6">
              <FinancialInfoTab
                control={form.control as any}
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
                onOpenPartDialog={() => setIsPartDialogOpen(true)}
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
                    Registrando...
                  </>
                ) : (
                  "Registrar Activo"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </Tabs>

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
            <Button onClick={addPart} disabled={!newPartName || newPartQuantity < 1}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para registrar incidente */}
      <Dialog open={showIncidentDialog} onOpenChange={setShowIncidentDialog}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-[700px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                <Select onValueChange={setIncidentType} value={incidentType}>
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
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  placeholder="Describa el incidente detalladamente"
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Impacto</Label>
                <Textarea
                  placeholder="Impacto en la operación o producción"
                  value={incidentImpact}
                  onChange={(e) => setIncidentImpact(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Resolución</Label>
                <Textarea
                  placeholder="Cómo se resolvió el incidente"
                  value={incidentResolution}
                  onChange={(e) => setIncidentResolution(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select onValueChange={setIncidentStatus} value={incidentStatus}>
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tiempo de Inactividad (horas)</Label>
                <Input
                  type="number"
                  placeholder="Ej: 8"
                  value={incidentDowntime}
                  onChange={(e) => setIncidentDowntime(e.target.value)}
                />
              </div>

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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label>Orden de Trabajo</Label>
                <Input
                  placeholder="Ej: OT-12345"
                  value={incidentWorkOrder}
                  onChange={(e) => setIncidentWorkOrder(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Repuestos Utilizados</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsPartDialogOpen(true)}>
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
            <Button type="button" onClick={addIncident} disabled={!incidentDate || !incidentType || !incidentReportedBy || !incidentDescription}>
              {editingIncidentIndex !== null ? "Actualizar" : "Registrar"} Incidente
            </Button>
          </DialogFooter>
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
                <Button type="button" variant="outline" size="sm" onClick={() => setIsPartDialogOpen(true)}>
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
              onClick={() => {
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

                  setMaintenanceHistory([...maintenanceHistory, newHistory])

                  if (selectedMaintenancePlan) {
                    markMaintenanceAsCompleted(selectedMaintenancePlan.id, true)
                  }

                  resetHistoryForm()
                  setShowMaintenanceRecordDialog(false)
                }
              }}
              disabled={!historyDate || !historyType || !historyDescription || !historyTechnician}
            >
              Registrar Mantenimiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 