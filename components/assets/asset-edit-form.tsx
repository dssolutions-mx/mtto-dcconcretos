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
  purchaseCost: z.number()
    .min(0, "El costo de adquisición debe ser mayor o igual a 0")
    .optional(),
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
            purchaseCost: typeof asset.purchase_cost === 'number' ? asset.purchase_cost : (asset.purchase_cost ? parseFloat(asset.purchase_cost) : undefined),
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
        purchase_cost: data.purchaseCost?.toString() || null,
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
      <TabsList className="grid w-full grid-cols-7">
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
              selectedModel={null}
              onModelSelect={() => {}}
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
              selectedModel={null}
              maintenanceSchedule={[]}
              completedMaintenances={[]}
              nextMaintenance={null}
              openMaintenanceDialog={() => {}}
              onRegisterMaintenance={() => {}}
            />
          </TabsContent>
          
          <TabsContent value="maintenance-history" className="space-y-6">
            <MaintenanceHistoryTab
              isNewEquipment={true}
              maintenanceHistory={[]}
              onAddMaintenanceHistory={() => {}}
              onRemoveMaintenanceHistory={() => {}}
              onEditMaintenanceHistory={() => {}}
              historyDate={new Date()}
              setHistoryDate={() => {}}
              historyType=""
              setHistoryType={() => {}}
              historyDescription=""
              setHistoryDescription={() => {}}
              historyTechnician=""
              setHistoryTechnician={() => {}}
              historyCost=""
              setHistoryCost={() => {}}
              editingHistoryIndex={null}
              historyHours=""
              setHistoryHours={() => {}}
              historyFindings=""
              setHistoryFindings={() => {}}
              historyActions=""
              setHistoryActions={() => {}}
              historyLaborHours=""
              setHistoryLaborHours={() => {}}
              historyLaborCost=""
              setHistoryLaborCost={() => {}}
              historyWorkOrder=""
              setHistoryWorkOrder={() => {}}
              historyParts={[]}
              setHistoryParts={() => {}}
              selectedMaintenancePlan={null}
              setSelectedMaintenancePlan={() => {}}
              completedTasks={{}}
              setCompletedTasks={() => {}}
              maintenanceSchedule={[]}
              onAddDetailedMaintenanceHistory={() => {}}
              onOpenPartDialog={() => {}}
              onOpenLinkMaintenancePlanDialog={() => {}}
            />
          </TabsContent>
          
          <TabsContent value="incidents" className="space-y-6">
            <IncidentsTab
              incidents={[]}
              onAddIncident={() => {}}
              onEditIncident={() => {}}
              onRemoveIncident={() => {}}
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
    </Tabs>
  )
} 