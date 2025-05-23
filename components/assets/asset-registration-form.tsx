"use client"

import type React from "react"

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
import { ModelSelector } from "./model-selector"
import { DocumentUpload } from "./document-upload"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { EquipmentModelWithIntervals } from "@/types" // Importar la interfaz extendida
import { useToast } from "@/components/ui/use-toast"

// Datos de ejemplo para mantenimientos específicos
const maintenanceSchedules = [
  {
    modelId: "MOD001",
    schedules: [
      {
        id: "maint-1",
        hours: 250,
        name: "Mantenimiento 250 horas",
        description: "Mantenimiento básico cada 250 horas de operación",
        tasks: [
          {
            id: "task-1",
            description: "Cambio de aceite y filtro",
            type: "Reemplazo",
            estimatedTime: 1,
            requiresSpecialist: false,
            parts: [
              { id: "part-1", name: "Aceite 15W-40", partNumber: "OIL-1540", quantity: 1 },
              { id: "part-2", name: "Filtro de aceite", partNumber: "FO-1234", quantity: 1 },
            ],
          },
          {
            id: "task-2",
            description: "Inspección de sistema eléctrico",
            type: "Inspección",
            estimatedTime: 0.5,
            requiresSpecialist: false,
            parts: [],
          },
        ],
      },
      {
        id: "maint-2",
        hours: 500,
        name: "Mantenimiento 500 horas",
        description: "Mantenimiento intermedio cada 500 horas de operación",
        tasks: [
          {
            id: "task-3",
            description: "Cambio de filtro de combustible",
            type: "Reemplazo",
            estimatedTime: 0.5,
            requiresSpecialist: false,
            parts: [{ id: "part-3", name: "Filtro de combustible", partNumber: "FC-5678", quantity: 1 }],
          },
        ],
      },
      {
        id: "maint-3",
        hours: 1000,
        name: "Mantenimiento 1000 horas",
        description: "Mantenimiento mayor cada 1000 horas de operación",
        tasks: [
          {
            id: "task-4",
            description: "Calibración de válvulas",
            type: "Calibración",
            estimatedTime: 2,
            requiresSpecialist: true,
            parts: [],
          },
        ],
      },
    ],
  },
  {
    modelId: "MOD002",
    schedules: [
      {
        id: "maint-4",
        hours: 100,
        name: "Mantenimiento 100 horas",
        description: "Mantenimiento básico cada 100 horas de operación",
        tasks: [],
      },
      {
        id: "maint-5",
        hours: 500,
        name: "Mantenimiento 500 horas",
        description: "Mantenimiento completo cada 500 horas de operación",
        tasks: [],
      },
    ],
  },
]

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

interface PhotoWithDescription {
  file: File
  preview: string
  description: string
}

export function AssetRegistrationForm() {
  const router = useRouter()
  const [selectedModel, setSelectedModel] = useState<EquipmentModelWithIntervals | null>(null)
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistoryRecord[]>([])
  const [historyDate, setHistoryDate] = useState<Date | undefined>(new Date())
  const [historyType, setHistoryType] = useState("")
  const [historyDescription, setHistoryDescription] = useState("")
  const [historyTechnician, setHistoryTechnician] = useState("")
  const [historyCost, setHistoryCost] = useState("")
  const [historyParts, setHistoryParts] = useState<MaintenanceHistoryPart[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPartDialogOpen, setIsPartDialogOpen] = useState(false)
  const [currentMaintenance, setCurrentMaintenance] = useState<MaintenanceSchedule | null>(null)
  const [completedMaintenances, setCompletedMaintenances] = useState<string[]>([])
  const [maintenanceSchedule, setMaintenanceSchedule] = useState<MaintenanceSchedule[]>([])
  const [isNewEquipment, setIsNewEquipment] = useState(true)
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false)
  const [insuranceDocuments, setInsuranceDocuments] = useState<InsuranceDocument[]>([])
  const [newPartName, setNewPartName] = useState("")
  const [newPartNumber, setNewPartNumber] = useState("")
  const [newPartQuantity, setNewPartQuantity] = useState(1)
  const [newPartCost, setNewPartCost] = useState("")
  const [uploadedPhotos, setUploadedPhotos] = useState<PhotoWithDescription[]>([])
  const [currentPhotoDescription, setCurrentPhotoDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [historyHours, setHistoryHours] = useState("")
  const [historyFindings, setHistoryFindings] = useState("")
  const [historyActions, setHistoryActions] = useState("")
  const [historyLaborHours, setHistoryLaborHours] = useState("")
  const [historyLaborCost, setHistoryLaborCost] = useState("")
  const [historyWorkOrder, setHistoryWorkOrder] = useState("")
  const [editingHistoryIndex, setEditingHistoryIndex] = useState<number | null>(null)
  const [showLinkMaintenancePlanDialog, setShowLinkMaintenancePlanDialog] = useState(false)
  const [selectedMaintenancePlan, setSelectedMaintenancePlan] = useState<MaintenanceSchedule | null>(null)
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({})
  const [searchMaintenancePlan, setSearchMaintenancePlan] = useState("")
  const [showMaintenanceTasksDialog, setShowMaintenanceTasksDialog] = useState(false)
  const [showMaintenanceRecordDialog, setShowMaintenanceRecordDialog] = useState(false)
  const [incidents, setIncidents] = useState<IncidentRecord[]>([])
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
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false)
  const { toast } = useToast()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
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
      maintenanceHistory: [],
    },
  })

  const handleModelSelect = async (model: EquipmentModelWithIntervals | null) => {
    setSelectedModel(model);
    
    if (model) {
      form.setValue("name", `${model.name} - ${model.manufacturer}`);
      
      try {
        // Cargar las actividades de mantenimiento de Supabase
        const response = await fetch(`/api/models/${model.id}/maintenance-intervals`);
        
        if (!response.ok) {
          throw new Error('Error al cargar las actividades de mantenimiento');
        }
        
        const maintenanceActivities = await response.json();
        console.log("Actividades de mantenimiento cargadas:", maintenanceActivities);
        
        // Examinar la estructura de los datos recibidos (para depuración)
        if (maintenanceActivities && maintenanceActivities.length > 0) {
          console.log("Estructura de la primera actividad:", maintenanceActivities[0]);
          
          if (maintenanceActivities[0].maintenance_tasks && maintenanceActivities[0].maintenance_tasks.length > 0) {
            console.log("Estructura de la primera tarea:", maintenanceActivities[0].maintenance_tasks[0]);
            
            // Examinar las propiedades disponibles en task para encontrar parts
            const task = maintenanceActivities[0].maintenance_tasks[0];
            console.log("Propiedades de task:", Object.keys(task));
            
            if (task.task_parts) {
              console.log("Tiene task_parts:", task.task_parts);
            } else if (task.maintenance_parts) {
              console.log("Tiene maintenance_parts:", task.maintenance_parts);
            } else if (task.parts) {
              console.log("Tiene parts:", task.parts);
            } else {
              console.log("No se encontraron propiedades de partes en la tarea");
            }
          } else {
            console.log("No hay tareas (maintenance_tasks) en la primera actividad");
          }
        }
        
        // Actualizar el modelo con las actividades de mantenimiento
        const updatedModel = {...model};
        updatedModel.maintenanceIntervals = maintenanceActivities.map((activity: any) => ({
          hours: activity.interval_value,
          type: activity.type,
          id: activity.id,
          name: activity.name,
          description: activity.description || ''
        }));
        
        setSelectedModel(updatedModel);
        
        // Convertir las actividades de la base de datos al formato usado por el componente
        const schedules: MaintenanceSchedule[] = maintenanceActivities.map((activity: any) => {
          // Process tasks for this maintenance activity
          const tasks = Array.isArray(activity.maintenance_tasks) 
            ? activity.maintenance_tasks.map((task: any) => {
                // Process parts for this task
                const parts = Array.isArray(task.task_parts) 
                  ? task.task_parts.map((part: any) => ({
                      id: part.id,
                      name: part.name,
                      partNumber: part.part_number || '',
                      quantity: part.quantity || 1,
                      cost: part.cost
                    }))
                  : [];
                
                return {
                  id: task.id,
                  description: task.description,
                  type: task.type || 'Mantenimiento',
                  estimatedTime: task.estimated_time || 1,
                  requiresSpecialist: task.requires_specialist || false,
                  parts: parts
                };
              })
            : [];
          
          return {
            id: activity.id,
            hours: activity.interval_value,
            name: activity.name || `Mantenimiento a las ${activity.interval_value} horas`,
            description: activity.description || '',
            tasks: tasks
          };
        });
        
        console.log("Actividades de mantenimiento procesadas:", schedules);
        setMaintenanceSchedule(schedules);
      } catch (error) {
        console.error('Error al cargar las actividades de mantenimiento:', error);
        setMaintenanceSchedule([]);
      }
    } else {
      setMaintenanceSchedule([]);
    }
  }

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
        // Estamos editando un registro existente
        const updatedHistory = [...maintenanceHistory]
        updatedHistory[editingHistoryIndex] = newHistory
        setMaintenanceHistory(updatedHistory)
        setEditingHistoryIndex(null)
      } else {
        // Estamos agregando un nuevo registro
        setMaintenanceHistory([...maintenanceHistory, newHistory])
      }

      // Reset form fields
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
        // Estamos editando un registro existente
        const updatedHistory = [...maintenanceHistory]
        updatedHistory[editingHistoryIndex] = newHistory
        setMaintenanceHistory(updatedHistory)
        setEditingHistoryIndex(null)
      } else {
        // Estamos agregando un nuevo registro
        setMaintenanceHistory([...maintenanceHistory, newHistory])
      }

      // Reset form fields
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

    // Si hay un plan de mantenimiento asociado, seleccionarlo
    if (record.maintenancePlanId) {
      const plan = maintenanceSchedule.find((p) => p.id === record.maintenancePlanId)
      if (plan) {
        setSelectedMaintenancePlan(plan)
      }
    }

    // Si hay tareas completadas, cargarlas
    if (record.completedTasks) {
      setCompletedTasks(record.completedTasks)
    }
  }

  const openMaintenanceDialog = (maintenance: MaintenanceSchedule) => {
    setCurrentMaintenance(maintenance)
    setIsDialogOpen(true)
  }

  const markMaintenanceAsCompleted = (maintenanceId: string, completed = true) => {
    if (completed) {
      setCompletedMaintenances([...completedMaintenances, maintenanceId])

      // Actualizar el estado de las tareas en el plan de mantenimiento
      const updatedSchedule = maintenanceSchedule.map((schedule) => {
        if (schedule.id === maintenanceId) {
          return {
            ...schedule,
            completed: true,
            completionDate: new Date(),
            tasks: schedule.tasks.map((task) => ({
              ...task,
              completed: true,
            })),
          }
        }
        return schedule
      })

      setMaintenanceSchedule(updatedSchedule)
    } else {
      setCompletedMaintenances(completedMaintenances.filter((id) => id !== maintenanceId))

      // Actualizar el estado de las tareas en el plan de mantenimiento
      const updatedSchedule = maintenanceSchedule.map((schedule) => {
        if (schedule.id === maintenanceId) {
          return {
            ...schedule,
            completed: false,
            completionDate: undefined,
            tasks: schedule.tasks.map((task) => ({
              ...task,
              completed: false,
            })),
          }
        }
        return schedule
      })

      setMaintenanceSchedule(updatedSchedule)
    }
  }

  const calculateNextMaintenanceHours = () => {
    if (!maintenanceSchedule.length || !form.getValues("currentHours")) return null

    const currentHours = Number.parseInt(form.getValues("currentHours"))
    const sortedSchedules = [...maintenanceSchedule].sort((a, b) => a.hours - b.hours)

    // Encontrar el próximo mantenimiento basado en las horas actuales
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

  const nextMaintenance = calculateNextMaintenanceHours()

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

  const addInsuranceDocument = (file: File) => {
    setInsuranceDocuments([
      ...insuranceDocuments,
      {
        name: file.name,
        file: file,
      },
    ])
  }

  const removeInsuranceDocument = (index: number) => {
    const newDocs = [...insuranceDocuments]
    newDocs.splice(index, 1)
    setInsuranceDocuments(newDocs)
  }

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
      setHistoryParts(planParts);
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

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true)
      
      const supabase = createClient()
      const user = (await supabase.auth.getUser()).data.user
      
      if (!user) {
        throw new Error("Usuario no autenticado")
      }
      
      // Subir fotos primero si hay algunas
      const assetId = data.assetId
      const photoUrls: string[] = []
      
      // Upload each photo
      for (const photo of uploadedPhotos) {
        const fileName = `${assetId}/${Date.now()}-${photo.file.name}`
        const { data: uploadData, error } = await supabase.storage.from("asset-photos").upload(fileName, photo.file)
        
        if (error) {
          throw error
        }
        
        // Get public URL
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
          
          // Get public URL
          const { data: publicUrlData } = supabase.storage.from("asset-documents").getPublicUrl(fileName)
          
          insuranceDocUrls.push(publicUrlData.publicUrl)
        }
      }
      
      // Preparar los datos para guardar
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
      };
      
      // Crear el activo en la base de datos
      const { data: insertedAsset, error } = await supabase
        .from("assets")
        .insert([assetDataToSave])
        .select()
        .single()
        
      if (error) {
        throw error
      }
      
      // Guardar historial de mantenimiento si existe
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
          };
          
          const { error: recordError } = await supabase
            .from("maintenance_history")
            .insert(maintenanceData);
            
          if (recordError) {
            console.error("Error al guardar historial de mantenimiento:", recordError);
          }
        }
      }
      
      // Guardar incidentes si existen
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
          };
          
          const { error: incidentError } = await supabase
            .from("incident_history")
            .insert(incidentData);
            
          if (incidentError) {
            console.error("Error al guardar historial de incidentes:", incidentError);
          }
        }
      }
      
      toast({
        title: "Activo registrado con éxito",
        description: `${data.name} ha sido registrado correctamente.`,
        variant: "default",
      })
      
      // Redireccionar a la lista de activos después de un éxito
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

  // Función para eliminar incidente
  const removeIncident = (index: number) => {
    const updatedIncidents = [...incidents]
    updatedIncidents.splice(index, 1)
    setIncidents(updatedIncidents)
  }

  // Función para editar incidente
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

  // Función para resetear el formulario de incidentes
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

  // Función para agregar repuesto a incidente
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
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="grid w-full grid-cols-7">
        <TabsTrigger value="general">Información General</TabsTrigger>
        <TabsTrigger value="technical">Información Técnica</TabsTrigger>
        <TabsTrigger value="financial">Información Financiera</TabsTrigger>
        <TabsTrigger value="maintenance">Plan de Mantenimiento</TabsTrigger>
        <TabsTrigger value="history">Historial</TabsTrigger>
        <TabsTrigger value="incidents">Incidentes</TabsTrigger>
        <TabsTrigger value="documents">Documentación</TabsTrigger>
      </TabsList>

      <Form {...form}>
        <form 
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            // Solo enviar si el usuario realmente hizo clic en el botón de envío
            const submitEvent = e.nativeEvent as SubmitEvent;
            if (submitEvent.submitter && submitEvent.submitter.getAttribute('type') === 'submit' && 
                !submitEvent.submitter.classList.contains('prevent-submit')) {
              form.handleSubmit(onSubmit)(e);
            } else {
              e.preventDefault();
            }
          }} 
          className="space-y-6 pt-6"
        >
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información General del Activo</CardTitle>
                <CardDescription>
                  Ingrese la información básica del activo y seleccione el modelo de equipo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <FormField
                      control={form.control}
                      name="isNew"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked)
                                setIsNewEquipment(checked)
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Equipo nuevo</FormLabel>
                            <FormDescription>
                              {field.value
                                ? "El equipo es nuevo y no tiene historial de mantenimiento previo"
                                : "El equipo es usado y tiene historial de mantenimiento previo"}
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="assetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID del Activo</FormLabel>
                        <FormControl>
                          <Input placeholder="EQ-0001" {...field} />
                        </FormControl>
                        <FormDescription>Identificador único para este activo</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label>Modelo de Equipo</Label>
                    <ModelSelector onModelSelect={handleModelSelect} />
                    <p className="text-sm text-muted-foreground">Seleccione un modelo de equipo existente</p>

                    {selectedModel && (
                      <div className="mt-4 p-4 border rounded-md bg-muted/50">
                        <h4 className="font-medium mb-2">Información del Modelo Seleccionado</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="font-medium">ID:</span> {selectedModel.id}
                          </div>
                          <div>
                            <span className="font-medium">Nombre:</span> {selectedModel.name}
                          </div>
                          <div>
                            <span className="font-medium">Fabricante:</span> {selectedModel.manufacturer}
                          </div>
                          <div>
                            <span className="font-medium">Categoría:</span> {selectedModel.category}
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="font-medium text-sm">Intervalos de Mantenimiento:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {selectedModel.maintenanceIntervals && selectedModel.maintenanceIntervals.map((interval, index) => (
                              <div key={index} className="text-xs px-2 py-1 bg-primary/10 rounded-md">
                                {interval.hours}h ({interval.type})
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Activo</FormLabel>
                          <FormControl>
                            <Input placeholder="Nombre del activo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="serialNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Serie</FormLabel>
                          <FormControl>
                            <Input placeholder="SN-12345678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ubicación</FormLabel>
                          <FormControl>
                            <Input placeholder="Planta 1, Área de Producción" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departamento</FormLabel>
                          <FormControl>
                            <Input placeholder="Producción" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="purchaseDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Fecha de Adquisición</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground",
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP", { locale: es })
                                  ) : (
                                    <span>Seleccionar fecha</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar estado" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="operational">Operativo</SelectItem>
                              <SelectItem value="maintenance">En Mantenimiento</SelectItem>
                              <SelectItem value="repair">En Reparación</SelectItem>
                              <SelectItem value="inactive">Inactivo</SelectItem>
                              <SelectItem value="retired">Retirado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="registrationInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Información de Registro</FormLabel>
                        <FormControl>
                          <Input placeholder="Placa, matrícula, etc." {...field} />
                        </FormControl>
                        <FormDescription>Información de registro del activo (placa de vehículo, etc.)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="technical" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información Técnica</CardTitle>
                <CardDescription>Detalles técnicos y especificaciones del activo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="initialHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horas Iniciales de Operación</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormDescription>Horas de operación al momento de la adquisición</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horas Actuales de Operación</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormDescription>Horas actuales de operación del equipo</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="installationDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Instalación</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP", { locale: es })
                                ) : (
                                  <span>Seleccionar fecha</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>Fecha en que el equipo fue instalado</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="warrantyExpiration"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Expiración de Garantía</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP", { locale: es })
                                ) : (
                                  <span>Seleccionar fecha</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>Fecha en que expira la garantía del equipo</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas Adicionales</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Información adicional sobre el activo"
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <Label>Fotografías del Equipo</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {uploadedPhotos.map((photo, index) => (
                      <div key={index} className="relative border rounded-lg overflow-hidden">
                        <img
                          src={photo.preview || "/placeholder.svg"}
                          alt={photo.description || `Foto ${index + 1}`}
                          className="w-full h-40 object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-2">
                          <p className="text-xs truncate" title={photo.description}>
                            {photo.description || `Foto ${index + 1}`}
                          </p>
                        </div>
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-white/90 hover:bg-white"
                            onClick={() => {
                              const newDescription = prompt("Ingrese nueva descripción:", photo.description);
                              if (newDescription !== null) {
                                const updatedPhotos = [...uploadedPhotos];
                                updatedPhotos[index] = { ...photo, description: newDescription };
                                setUploadedPhotos(updatedPhotos);
                              }
                            }}
                          >
                            <Pencil className="h-4 w-4 text-gray-600" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => removePhoto(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div
                      className="border border-dashed rounded-lg p-4 flex flex-col items-center justify-center min-h-[150px] cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setPhotoUploadOpen(true)}
                    >
                      <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Agregar fotografía</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información Financiera</CardTitle>
                <CardDescription>Detalles financieros y de seguros del activo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="purchaseCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo de Adquisición</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="0.00" className="pl-8" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>Costo de adquisición del activo</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="insurancePolicy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Póliza de Seguro</FormLabel>
                      <FormControl>
                        <Input placeholder="POL-12345678" {...field} />
                      </FormControl>
                      <FormDescription>Número de póliza de seguro del activo</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="insuranceCoverage.startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Inicio de Cobertura</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP", { locale: es })
                                ) : (
                                  <span>Seleccionar fecha</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>Fecha de inicio de la cobertura del seguro</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="insuranceCoverage.endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fin de Cobertura</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP", { locale: es })
                                ) : (
                                  <span>Seleccionar fecha</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>Fecha de finalización de la cobertura del seguro</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <Label>Documentos de Seguro</Label>
                  <div className="space-y-2">
                    {insuranceDocuments.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{doc.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeInsuranceDocument(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        id="insuranceDoc"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            addInsuranceDocument(e.target.files[0])
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById("insuranceDoc")?.click()}
                        className="w-full"
                      >
                        <FileUp className="mr-2 h-4 w-4" />
                        Subir documento de seguro
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Plan de Mantenimiento</CardTitle>
                <CardDescription>
                  Plan de mantenimiento recomendado por el fabricante para este modelo de equipo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedModel ? (
                  <>
                    {nextMaintenance && (
                      <Alert className="bg-amber-50 border-amber-200">
                        <Clock className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800">Próximo mantenimiento</AlertTitle>
                        <AlertDescription className="text-amber-700">
                          {nextMaintenance.name} a las {nextMaintenance.hours} horas (faltan {nextMaintenance.remaining}{" "}
                          horas)
                        </AlertDescription>
                      </Alert>
                    )}

                    {maintenanceSchedule.length > 0 ? (
                      <div className="space-y-4">
                        {maintenanceSchedule.map((maintenance) => (
                          <Card
                            key={maintenance.id}
                            className={cn(
                              "border transition-colors",
                              completedMaintenances.includes(maintenance.id) ? "bg-green-50 border-green-200" : "",
                            )}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={completedMaintenances.includes(maintenance.id) ? "outline" : "default"}
                                  >
                                    {maintenance.hours} horas
                                  </Badge>
                                  <h3 className="font-medium">{maintenance.name}</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                  {completedMaintenances.includes(maintenance.id) ? (
                                    <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">
                                      <Check className="mr-1 h-3 w-3" /> Completado
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                              <CardDescription className="mt-1">{maintenance.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="pb-2">
                              {maintenance.tasks.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium">Tareas ({maintenance.tasks.length})</h4>
                                  <div className="space-y-1">
                                    {maintenance.tasks.map((task) => (
                                      <div key={task.id} className="flex items-start gap-2 text-sm">
                                        <div className="h-5 w-5 mt-0.5 flex-shrink-0">
                                          {task.completed ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                          ) : (
                                            <div className="h-5 w-5 rounded-full border border-muted-foreground" />
                                          )}
                                        </div>
                                        <div>
                                          <p className="font-medium">{task.description}</p>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{task.type}</span>
                                            <span>•</span>
                                            <span>{task.estimatedTime}h</span>
                                            {task.requiresSpecialist && (
                                              <>
                                                <span>•</span>
                                                <span className="text-amber-600 flex items-center gap-1">
                                                  <AlertCircle className="h-3 w-3" />
                                                  Requiere especialista
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                            <CardFooter className="flex justify-between pt-2">
                              <Button variant="outline" size="sm" onClick={() => openMaintenanceDialog(maintenance)}>
                                Ver detalles
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                type="button" // Añadir explícitamente type="button"
                                onClick={(e) => {
                                  // Prevenir explícitamente cualquier propagación de eventos
                                  e.preventDefault();
                                  e.stopPropagation();
                                  
                                  // Inicializar los campos del formulario de mantenimiento
                                  setCurrentMaintenance(maintenance);
                                  setSelectedMaintenancePlan(maintenance);
                                  setHistoryType("Preventivo");
                                  setHistoryDescription(`${maintenance.name} - ${maintenance.description}`);
                                  setHistoryHours(maintenance.hours.toString());

                                  // Initialize completed tasks
                                  const initialTasksState: Record<string, boolean> = {};
                                  maintenance.tasks.forEach((task) => {
                                    initialTasksState[task.id] = false;
                                  });
                                  setCompletedTasks(initialTasksState);

                                  // Auto-populate parts if available
                                  const planParts: MaintenanceHistoryPart[] = [];
                                  maintenance.tasks.forEach((task) => {
                                    task.parts.forEach((part) => {
                                      planParts.push({
                                        name: part.name,
                                        partNumber: part.partNumber,
                                        quantity: part.quantity,
                                        cost: part.cost?.toString(),
                                      });
                                    });
                                  });

                                  if (planParts.length > 0) {
                                    setHistoryParts(planParts);
                                  }

                                  // Abrir el diálogo de registro de mantenimiento
                                  // en un setTimeout para asegurar que el evento click actual
                                  // haya terminado de procesarse completamente
                                  setTimeout(() => {
                                    setShowMaintenanceRecordDialog(true);
                                  }, 10);
                                }}
                              >
                                Registrar Mantenimiento
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No hay un plan de mantenimiento definido para este modelo de equipo.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Seleccione un modelo de equipo para ver el plan de mantenimiento recomendado.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Mantenimiento</CardTitle>
                <CardDescription>
                  {isNewEquipment
                    ? "Este es un equipo nuevo sin historial de mantenimiento previo"
                    : "Registre el historial de mantenimiento previo del activo"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isNewEquipment && (
                  <div className="space-y-4">
                    <Tabs defaultValue="detailed" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="basic">Registro Básico</TabsTrigger>
                        <TabsTrigger value="detailed">Registro Detallado</TabsTrigger>
                      </TabsList>

                      <TabsContent value="basic" className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Fecha</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !historyDate && "text-muted-foreground",
                                  )}
                                >
                                  {historyDate ? (
                                    format(historyDate, "PPP", { locale: es })
                                  ) : (
                                    <span>Seleccionar fecha</span>
                                  )}
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
                                <SelectItem value="preventive">Preventivo</SelectItem>
                                <SelectItem value="corrective">Correctivo</SelectItem>
                                <SelectItem value="predictive">Predictivo</SelectItem>
                                <SelectItem value="overhaul">Overhaul</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Descripción</Label>
                          <Textarea
                            placeholder="Describa el mantenimiento realizado"
                            value={historyDescription}
                            onChange={(e) => setHistoryDescription(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Técnico</Label>
                            <Input
                              placeholder="Nombre del técnico"
                              value={historyTechnician}
                              onChange={(e) => setHistoryTechnician(e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Costo</Label>
                            <div className="relative">
                              <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="0.00"
                                className="pl-8"
                                value={historyCost}
                                onChange={(e) => setHistoryCost(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <Button
                          type="button"
                          onClick={addMaintenanceHistory}
                          className="mt-4"
                          disabled={!historyDate || !historyType || !historyDescription || !historyTechnician}
                        >
                          <Plus className="mr-2 h-4 w-4" /> {editingHistoryIndex !== null ? "Actualizar" : "Agregar"}{" "}
                          Registro
                        </Button>
                      </TabsContent>

                      <TabsContent value="detailed" className="space-y-4 pt-4">
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-center">
                              <CardTitle className="text-lg">Detalles del Mantenimiento</CardTitle>
                              {selectedMaintenancePlan ? (
                                <Badge className="flex items-center gap-1 bg-green-100 text-green-800 hover:bg-green-200">
                                  <LinkIcon className="h-3 w-3" />
                                  Plan: {selectedMaintenancePlan.name}
                                </Badge>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowLinkMaintenancePlanDialog(true)}
                                  className="text-xs"
                                >
                                  <LinkIcon className="mr-1 h-3 w-3" />
                                  Vincular a Plan
                                </Button>
                              )}
                            </div>
                            <CardDescription>
                              Registre información detallada del mantenimiento realizado
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>Fecha</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !historyDate && "text-muted-foreground",
                                      )}
                                    >
                                      {historyDate ? (
                                        format(historyDate, "PPP", { locale: es })
                                      ) : (
                                        <span>Seleccionar fecha</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={historyDate}
                                      onSelect={setHistoryDate}
                                      initialFocus
                                    />
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
                                    <SelectItem value="preventive">Preventivo</SelectItem>
                                    <SelectItem value="corrective">Correctivo</SelectItem>
                                    <SelectItem value="predictive">Predictivo</SelectItem>
                                    <SelectItem value="overhaul">Overhaul</SelectItem>
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleOpenMaintenanceTasksDialog}
                                  >
                                    <ClipboardList className="mr-1 h-4 w-4" /> Gestionar Tareas
                                  </Button>
                                </div>
                                <div className="border rounded-md p-3 bg-muted/20">
                                  {Object.keys(completedTasks).length > 0 ? (
                                    <div className="space-y-2">
                                      {selectedMaintenancePlan.tasks.map((task) => (
                                        <div key={task.id} className="flex items-center gap-2">
                                          {completedTasks[task.id] ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <div className="h-4 w-4 rounded-full border border-muted-foreground" />
                                          )}
                                          <span className="text-sm">{task.description}</span>
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
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsPartDialogOpen(true)}
                                >
                                  <Plus className="mr-1 h-4 w-4" /> Agregar Repuesto
                                </Button>
                              </div>

                              {historyParts.length > 0 ? (
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
                              ) : (
                                <div className="text-center py-4 text-muted-foreground border rounded-md">
                                  No hay repuestos registrados para este mantenimiento.
                                </div>
                              )}
                            </div>
                          </CardContent>
                          <CardFooter>
                            <Button
                              type="button"
                              onClick={addDetailedMaintenanceHistory}
                              className="w-full"
                              disabled={!historyDate || !historyType || !historyDescription || !historyTechnician}
                            >
                              <Plus className="mr-2 h-4 w-4" />{" "}
                              {editingHistoryIndex !== null ? "Actualizar" : "Agregar"} Registro Detallado
                            </Button>
                          </CardFooter>
                        </Card>
                      </TabsContent>
                    </Tabs>

                    {maintenanceHistory.length > 0 ? (
                      <div className="space-y-4">
                        <Separator />
                        <h4 className="font-medium">Registros de Mantenimiento</h4>
                        <div className="space-y-2">
                          {maintenanceHistory.map((record, index) => (
                            <div key={index} className="border rounded-md overflow-hidden">
                              <div className="flex items-start justify-between p-3 bg-muted/50">
                                <div className="space-y-1">
                                  <div className="font-medium">
                                    {format(record.date, "PPP", { locale: es })} - {record.type}
                                    {record.hours && <span className="ml-2">({record.hours} horas)</span>}
                                  </div>
                                  <div className="text-sm text-muted-foreground">{record.description}</div>
                                  <div className="text-xs">Técnico: {record.technician}</div>
                                  {record.cost && <div className="text-xs">Costo: ${record.cost}</div>}
                                  {record.laborHours && (
                                    <div className="text-xs">Horas de trabajo: {record.laborHours}</div>
                                  )}
                                  {record.workOrder && <div className="text-xs">OT: {record.workOrder}</div>}
                                  {record.maintenancePlanId && (
                                    <div className="text-xs flex items-center gap-1 text-blue-600">
                                      <LinkIcon className="h-3 w-3" />
                                      <span>Vinculado a plan de mantenimiento</span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => editMaintenanceHistory(index)}
                                    className="h-8"
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeMaintenanceHistory(index)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-100"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {record.findings && (
                                <div className="px-3 py-2 border-t">
                                  <h5 className="text-xs font-medium">Hallazgos:</h5>
                                  <p className="text-xs">{record.findings}</p>
                                </div>
                              )}
                              {record.actions && (
                                <div className="px-3 py-2 border-t">
                                  <h5 className="text-xs font-medium">Acciones:</h5>
                                  <p className="text-xs">{record.actions}</p>
                                </div>
                              )}
                              {record.completedTasks && Object.keys(record.completedTasks).length > 0 && (
                                <div className="px-3 py-2 border-t">
                                  <h5 className="text-xs font-medium mb-1">Tareas completadas:</h5>
                                  <div className="space-y-1">
                                    {maintenanceSchedule
                                      .find((plan) => plan.id === record.maintenancePlanId)
                                      ?.tasks.filter((task) => record.completedTasks?.[task.id])
                                      .map((task) => (
                                        <div key={task.id} className="flex items-center gap-1 text-xs">
                                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                                          <span>{task.description}</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                              {record.parts && record.parts.length > 0 && (
                                <div className="p-3 border-t">
                                  <h5 className="text-xs font-medium mb-2">Repuestos utilizados:</h5>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Nombre</TableHead>
                                        <TableHead className="text-xs">Número de Parte</TableHead>
                                        <TableHead className="text-xs">Cantidad</TableHead>
                                        <TableHead className="text-xs">Costo</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {record.parts.map((part, partIndex) => (
                                        <TableRow key={partIndex}>
                                          <TableCell className="text-xs">{part.name}</TableCell>
                                          <TableCell className="text-xs">{part.partNumber || "-"}</TableCell>
                                          <TableCell className="text-xs">{part.quantity}</TableCell>
                                          <TableCell className="text-xs">{part.cost || "-"}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        {isNewEquipment
                          ? "Este es un equipo nuevo sin historial de mantenimiento previo."
                          : "No hay registros de mantenimiento. Agregue el historial de mantenimiento previo del activo."}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="incidents" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Incidentes</CardTitle>
                <CardDescription>
                  Registre incidentes ocurridos con este equipo, como fallas, averías o problemas reportados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    {incidents.length === 0 ? "No hay incidentes registrados para este activo." : `${incidents.length} incidente(s) registrado(s).`}
                  </div>
                  <Button onClick={() => {
                    resetIncidentForm()
                    setShowIncidentDialog(true)
                  }} size="sm">
                    <Plus className="mr-1 h-4 w-4" /> Registrar Incidente
                  </Button>
                </div>

                {incidents.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Reportado por</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="w-[100px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incidents.map((incident, index) => (
                          <TableRow key={index}>
                            <TableCell>{format(incident.date, "dd/MM/yyyy")}</TableCell>
                            <TableCell>{incident.type}</TableCell>
                            <TableCell>{incident.reportedBy}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{incident.description}</TableCell>
                            <TableCell>
                              <Badge variant={incident.status === "Resuelto" ? "outline" : "secondary"}>
                                {incident.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => editIncident(index)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeIncident(index)}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Documentación</CardTitle>
                <CardDescription>
                  Suba documentación técnica, manuales, y otros archivos relacionados con el activo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <DocumentUpload
                  label="Manual de Usuario"
                  helperText="Suba el manual de usuario proporcionado por el fabricante"
                />

                <DocumentUpload label="Manual de Servicio" helperText="Suba el manual de servicio y mantenimiento" />

                <DocumentUpload
                  label="Certificados"
                  helperText="Suba certificados de garantía, calidad, o cumplimiento"
                />

                <DocumentUpload label="Otros Documentos" helperText="Suba cualquier otra documentación relevante" />
              </CardContent>
            </Card>
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

      {/* Diálogo de detalles de mantenimiento */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-[600px] max-h-[90vh] overflow-y-auto" onSubmit={(e) => e.preventDefault()}>
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

              {!completedMaintenances.includes(currentMaintenance?.id || "") && (
                <div className="mt-4 space-y-4">
                  <Separator />
                  <div className="space-y-2">
                    <Label htmlFor="maintenanceCompleted">¿Este mantenimiento ya fue realizado?</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="maintenanceCompleted" />
                      <label
                        htmlFor="maintenanceCompleted"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Marcar como completado
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (currentMaintenance) {
                  const isCompleted = (document.getElementById("maintenanceCompleted") as HTMLInputElement)?.checked
                  if (isCompleted) {
                    markMaintenanceAsCompleted(currentMaintenance.id)
                  }
                  setIsDialogOpen(false)
                }
              }}
            >
              {completedMaintenances.includes(currentMaintenance?.id || "") ? "Cerrar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para agregar repuestos */}
      <Dialog open={isPartDialogOpen} onOpenChange={setIsPartDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-[500px] max-h-[90vh] overflow-y-auto" onSubmit={(e) => e.preventDefault()}>
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

      {/* Diálogo para vincular plan de mantenimiento */}
      <Dialog open={showLinkMaintenancePlanDialog} onOpenChange={setShowLinkMaintenancePlanDialog}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-[500px] max-h-[90vh] overflow-y-auto" onSubmit={(e) => e.preventDefault()}>
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

      {/* Diálogo para gestionar tareas del plan de mantenimiento */}
      <Dialog open={showMaintenanceTasksDialog} onOpenChange={setShowMaintenanceTasksDialog}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-[500px] max-h-[90vh] overflow-y-auto" onSubmit={(e) => e.preventDefault()}>
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
                      // Marcar todas las tareas como completadas
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
                      // Desmarcar todas las tareas
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

      {/* Diálogo para subir fotos */}
      <Dialog open={photoUploadOpen} onOpenChange={setPhotoUploadOpen}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-[500px] max-h-[90vh] overflow-y-auto" onSubmit={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Subir fotografía del equipo</DialogTitle>
            <DialogDescription>Suba una fotografía clara del equipo para su identificación</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="photoDescription">Descripción de la fotografía</Label>
              <Input 
                id="photoDescription" 
                placeholder="Ej: Vista frontal del equipo, Panel de control, Estado actual..." 
                value={currentPhotoDescription}
                onChange={(e) => setCurrentPhotoDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ingrese una descripción que ayude a identificar qué muestra esta fotografía
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="photoUpload">Seleccionar archivo</Label>
              <Input id="photoUpload" type="file" accept="image/*" onChange={handlePhotoUpload} />
              <p className="text-xs text-muted-foreground">
                Formatos admitidos: JPG, PNG, GIF. Tamaño máximo: 10MB
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPhotoUploadOpen(false)
              setCurrentPhotoDescription("")
            }}>
              Cancelar
            </Button>
            <Button 
              disabled={!currentPhotoDescription.trim()} 
              onClick={() => {
                document.getElementById("photoUpload")?.click()
              }}
            >
              Continuar con la fotografía
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para registrar mantenimiento desde el plan */}
      <Dialog open={showMaintenanceRecordDialog} onOpenChange={setShowMaintenanceRecordDialog}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-[700px] max-h-[90vh] overflow-y-auto" onSubmit={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
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
                    <SelectItem value="preventive">Preventivo</SelectItem>
                    <SelectItem value="corrective">Correctivo</SelectItem>
                    <SelectItem value="predictive">Predictivo</SelectItem>
                    <SelectItem value="overhaul">Overhaul</SelectItem>
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
            <Button variant="outline" onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMaintenanceRecordDialog(false);
            }}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                // Detener cualquier comportamiento por defecto
                e.preventDefault();
                e.stopPropagation();
                
                if (historyDate && historyType && historyDescription && historyTechnician) {
                  const totalPartsCost = historyParts.reduce((total, part) => {
                    return total + (Number(part.cost) || 0) * part.quantity
                  }, 0);

                  const laborCost = Number(historyLaborCost) || 0;
                  const totalCost = totalPartsCost + laborCost;

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
                  };

                  // Agregar el registro al historial
                  setMaintenanceHistory([...maintenanceHistory, newHistory]);

                  // Si hay un plan de mantenimiento seleccionado, marcarlo como completado
                  if (selectedMaintenancePlan) {
                    markMaintenanceAsCompleted(selectedMaintenancePlan.id, true);
                  }

                  // Resetear el formulario
                  resetHistoryForm();

                  // Cerrar el diálogo
                  setShowMaintenanceRecordDialog(false);
                }
              }}
              disabled={!historyDate || !historyType || !historyDescription || !historyTechnician}
            >
              Registrar Mantenimiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para registrar incidente */}
      <Dialog open={showIncidentDialog} onOpenChange={setShowIncidentDialog}>
        <DialogContent className="max-w-[95vw] w-full md:max-w-[700px] max-h-[90vh] overflow-y-auto" onSubmit={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
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
            <Button type="button" onClick={addIncident}>
              {editingIncidentIndex !== null ? "Actualizar" : "Registrar"} Incidente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}
