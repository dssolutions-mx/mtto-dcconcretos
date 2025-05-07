"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { modelsApi } from "@/lib/api"
import { equipmentCategories, fuelTypes, maintenanceTypes } from "@/lib/constants"
import { toast } from "@/components/ui/use-toast"
import { EquipmentModel, UpdateEquipmentModel } from "@/types"
import { Json } from "@/lib/database.types"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Save, Trash, Edit, FileText, Loader2 } from "lucide-react"
import { useEquipmentModel } from "@/hooks/useSupabase"

// Interfaz para las tareas de mantenimiento
interface MaintenanceTask {
  id: string
  description: string
  type: string
  estimatedTime: number
  requiresSpecialist: boolean
  parts: MaintenancePart[]
}

// Interfaz para los repuestos de mantenimiento
interface MaintenancePart {
  id: string
  name: string
  partNumber: string
  quantity: number
  cost?: string
}

// Interfaz para los intervalos de mantenimiento
interface MaintenanceInterval {
  id?: string
  hours: number
  name: string
  description: string
  tasks: MaintenanceTask[]
}

interface SpecsGeneral {
  engineType?: string;
  power?: string;
  fuelType?: string;
  fuelCapacity?: string;
}

interface SpecsDimensions {
  length?: string;
  width?: string;
  height?: string;
  weight?: string;
  capacity?: string;
}

interface SpecsPerformance {
  maxSpeed?: string;
  maxLoad?: string;
  productivity?: string;
  operatingHours?: string;
}

interface Specifications {
  general?: SpecsGeneral;
  dimensions?: SpecsDimensions;
  performance?: SpecsPerformance;
}

interface EquipmentModelEditFormProps {
  modelId: string;
}

export function EquipmentModelEditForm({ modelId }: EquipmentModelEditFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showIntervalForm = searchParams.get('action') === 'addInterval'
  
  // Estados para manejar el formulario
  const [model, setModel] = useState<EquipmentModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [selectedFuelType, setSelectedFuelType] = useState<string>("")
  
  // Estados para mantenimientos
  const [maintenanceIntervals, setMaintenanceIntervals] = useState<MaintenanceInterval[]>([])
  const [newInterval, setNewInterval] = useState({
    hours: 0,
    name: "",
    description: "",
  })
  
  // Estado para el diálogo de tareas
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [currentIntervalIndex, setCurrentIntervalIndex] = useState<number | null>(null)
  const [currentTask, setCurrentTask] = useState<MaintenanceTask | null>(null)
  const [isEditingTask, setIsEditingTask] = useState(false)

  // Estado para el diálogo de repuestos
  const [isPartDialogOpen, setIsPartDialogOpen] = useState(false)
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number | null>(null)
  const [currentPart, setCurrentPart] = useState<MaintenancePart | null>(null)
  const [isEditingPart, setIsEditingPart] = useState(false)

  // Usar el hook personalizado para obtener los intervalos de mantenimiento
  const { maintenanceIntervals: fetchedIntervals } = useEquipmentModel(modelId);

  // Cargar datos del modelo existente
  useEffect(() => {
    async function loadModel() {
      try {
        setIsLoading(true)
        const modelData = await modelsApi.getById(modelId)
        
        if (modelData) {
          setModel(modelData)
          setSelectedCategory(modelData.category)
          
          // Extraer el tipo de combustible si existe en las especificaciones
          if (
            modelData.specifications && 
            typeof modelData.specifications === 'object' && 
            'general' in (modelData.specifications as any) && 
            (modelData.specifications as any).general && 
            'fuelType' in (modelData.specifications as any).general
          ) {
            setSelectedFuelType((modelData.specifications as any).general.fuelType as string)
          }
        }
      } catch (err) {
        console.error("Error al cargar el modelo:", err)
        setError(err instanceof Error ? err : new Error("Error al cargar datos del modelo"))
        
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar la información del modelo",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadModel()
  }, [modelId])

  // Formatear y cargar los intervalos de mantenimiento
  useEffect(() => {
    if (fetchedIntervals && fetchedIntervals.length > 0) {
      // Convertir de formato DB a formato local
      const formattedIntervals: MaintenanceInterval[] = fetchedIntervals.map(interval => {
        const tasks = interval.maintenance_tasks || [];
        
        return {
          id: interval.id,
          hours: interval.interval_value,
          name: interval.name,
          description: interval.description || '',
          tasks: tasks.map(task => ({
            id: task.id,
            description: task.description,
            type: task.type,
            estimatedTime: task.estimated_time || 1,
            requiresSpecialist: task.requires_specialist || false,
            parts: [] // En este nivel no tenemos las partes cargadas
          }))
        };
      });
      
      setMaintenanceIntervals(formattedIntervals);
    }
  }, [fetchedIntervals]);

  // Función para agregar un nuevo intervalo de mantenimiento
  const addMaintenanceInterval = async () => {
    if (newInterval.hours > 0 && newInterval.name && newInterval.description) {
      try {
        // Crear el intervalo en la base de datos
        const savedInterval = await modelsApi.createMaintenanceInterval({
          model_id: modelId,
          interval_value: newInterval.hours,
          name: newInterval.name,
          description: newInterval.description || null,
          type: "Preventivo",
          estimated_duration: 0, // Se actualizará al agregar tareas
        });
        
        // Agregar al estado local
        setMaintenanceIntervals([
          ...maintenanceIntervals,
          {
            id: savedInterval.id,
            hours: newInterval.hours,
            name: newInterval.name,
            description: newInterval.description,
            tasks: [],
          },
        ]);
        
        // Limpiar el formulario
        setNewInterval({ hours: 0, name: "", description: "" });
        
        toast({
          title: "Intervalo agregado",
          description: "Se ha agregado el nuevo intervalo de mantenimiento",
        });
      } catch (err) {
        console.error("Error al agregar intervalo:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo agregar el intervalo de mantenimiento",
        });
      }
    }
  }

  // Función para eliminar un intervalo de mantenimiento
  const removeMaintenanceInterval = async (index: number) => {
    const interval = maintenanceIntervals[index];
    if (!interval.id) return;
    
    try {
      // Eliminar de la base de datos
      await modelsApi.deleteMaintenanceInterval(interval.id);
      
      // Eliminar del estado local
      setMaintenanceIntervals(maintenanceIntervals.filter((_, i) => i !== index));
      
      toast({
        title: "Intervalo eliminado",
        description: "Se ha eliminado el intervalo de mantenimiento",
      });
    } catch (err) {
      console.error("Error al eliminar intervalo:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el intervalo de mantenimiento",
      });
    }
  }

  // Función para abrir el diálogo de tareas
  const openTaskDialog = (intervalIndex: number, task: MaintenanceTask | null = null) => {
    setCurrentIntervalIndex(intervalIndex)
    setCurrentTask(task)
    setIsEditingTask(!!task)
    setIsTaskDialogOpen(true)
  }

  // Función para guardar una tarea
  const saveTask = async (task: MaintenanceTask) => {
    if (currentIntervalIndex === null) return;

    const interval = maintenanceIntervals[currentIntervalIndex];
    if (!interval.id) return;

    try {
      let savedTask;
      
      if (isEditingTask && currentTask) {
        // Actualizar tarea existente
        savedTask = await modelsApi.updateMaintenanceTask(task.id, {
          description: task.description,
          type: task.type,
          estimated_time: task.estimatedTime,
          requires_specialist: task.requiresSpecialist,
        });
      } else {
        // Crear nueva tarea
        savedTask = await modelsApi.createMaintenanceTask({
          interval_id: interval.id,
          description: task.description,
          type: task.type,
          estimated_time: task.estimatedTime,
          requires_specialist: task.requiresSpecialist,
        });
      }
      
      // Actualizar el estado local
      const updatedIntervals = [...maintenanceIntervals];
      
      if (isEditingTask && currentTask) {
        // Editar tarea existente
        const taskIndex = updatedIntervals[currentIntervalIndex].tasks.findIndex((t) => t.id === currentTask.id);
        if (taskIndex !== -1) {
          updatedIntervals[currentIntervalIndex].tasks[taskIndex] = {
            ...task,
            id: savedTask.id,
          };
        }
      } else {
        // Agregar nueva tarea
        updatedIntervals[currentIntervalIndex].tasks.push({
          ...task,
          id: savedTask.id,
        });
      }
      
      setMaintenanceIntervals(updatedIntervals);
      setIsTaskDialogOpen(false);
      setCurrentTask(null);
      setIsEditingTask(false);
      
      toast({
        title: isEditingTask ? "Tarea actualizada" : "Tarea agregada",
        description: isEditingTask 
          ? "La tarea ha sido actualizada correctamente" 
          : "La tarea ha sido agregada correctamente",
      });
    } catch (err) {
      console.error("Error al guardar la tarea:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar la tarea de mantenimiento",
      });
    }
  }

  // Función para eliminar una tarea
  const removeTask = async (intervalIndex: number, taskId: string) => {
    try {
      // Eliminar de la base de datos
      await modelsApi.deleteMaintenanceTask(taskId);
      
      // Actualizar el estado local
      const updatedIntervals = [...maintenanceIntervals];
      updatedIntervals[intervalIndex].tasks = updatedIntervals[intervalIndex].tasks.filter(
        (task) => task.id !== taskId
      );
      setMaintenanceIntervals(updatedIntervals);
      
      toast({
        title: "Tarea eliminada",
        description: "La tarea ha sido eliminada correctamente",
      });
    } catch (err) {
      console.error("Error al eliminar la tarea:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar la tarea de mantenimiento",
      });
    }
  }

  // Función para abrir el diálogo de repuestos
  const openPartDialog = (intervalIndex: number, taskIndex: number, part: MaintenancePart | null = null) => {
    setCurrentIntervalIndex(intervalIndex)
    setCurrentTaskIndex(taskIndex)
    setCurrentPart(part)
    setIsEditingPart(!!part)
    setIsPartDialogOpen(true)
  }

  // Función para guardar un repuesto
  const savePart = async (part: MaintenancePart) => {
    if (currentIntervalIndex === null || currentTaskIndex === null) return;

    const task = maintenanceIntervals[currentIntervalIndex].tasks[currentTaskIndex];
    if (!task.id) return;

    try {
      let savedPart;
      
      if (isEditingPart && currentPart) {
        // Actualizar repuesto existente
        savedPart = await modelsApi.updateTaskPart(part.id, {
          name: part.name,
          part_number: part.partNumber,
          quantity: part.quantity,
          cost: part.cost || null,
        });
      } else {
        // Crear nuevo repuesto
        savedPart = await modelsApi.createTaskPart({
          task_id: task.id,
          name: part.name,
          part_number: part.partNumber,
          quantity: part.quantity,
          cost: part.cost || null,
        });
      }
      
      // Actualizar el estado local
      const updatedIntervals = [...maintenanceIntervals];
      
      if (isEditingPart && currentPart) {
        // Editar repuesto existente
        const partIndex = updatedIntervals[currentIntervalIndex].tasks[currentTaskIndex].parts.findIndex(
          (p) => p.id === currentPart.id
        );
        if (partIndex !== -1) {
          updatedIntervals[currentIntervalIndex].tasks[currentTaskIndex].parts[partIndex] = {
            ...part,
            id: savedPart.id,
          };
        }
      } else {
        // Agregar nuevo repuesto
        updatedIntervals[currentIntervalIndex].tasks[currentTaskIndex].parts.push({
          ...part,
          id: savedPart.id,
        });
      }
      
      setMaintenanceIntervals(updatedIntervals);
      setIsPartDialogOpen(false);
      setCurrentPart(null);
      setIsEditingPart(false);
      
      toast({
        title: isEditingPart ? "Repuesto actualizado" : "Repuesto agregado",
        description: isEditingPart 
          ? "El repuesto ha sido actualizado correctamente" 
          : "El repuesto ha sido agregado correctamente",
      });
    } catch (err) {
      console.error("Error al guardar el repuesto:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el repuesto",
      });
    }
  }

  // Función para eliminar un repuesto
  const removePart = async (intervalIndex: number, taskIndex: number, partId: string) => {
    try {
      // Eliminar de la base de datos
      await modelsApi.deleteTaskPart(partId);
      
      // Actualizar el estado local
      const updatedIntervals = [...maintenanceIntervals];
      updatedIntervals[intervalIndex].tasks[taskIndex].parts = 
        updatedIntervals[intervalIndex].tasks[taskIndex].parts.filter(part => part.id !== partId);
      setMaintenanceIntervals(updatedIntervals);
      
      toast({
        title: "Repuesto eliminado",
        description: "El repuesto ha sido eliminado correctamente",
      });
    } catch (err) {
      console.error("Error al eliminar el repuesto:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el repuesto",
      });
    }
  }

  // Función para actualizar el modelo
  const handleUpdateModel = async () => {
    try {
      setIsSubmitting(true)
      setError(null)

      // Obtener los valores del formulario
      const modelData: UpdateEquipmentModel = {
        name: (document.getElementById("modelName") as HTMLInputElement).value,
        manufacturer: (document.getElementById("manufacturer") as HTMLInputElement).value,
        category: selectedCategory,
        description: (document.getElementById("description") as HTMLTextAreaElement).value,
        year_introduced: Number((document.getElementById("yearIntroduced") as HTMLInputElement).value) || null,
        expected_lifespan: Number((document.getElementById("expectedLifespan") as HTMLInputElement).value) || null,
        specifications: {
          general: {
            engineType: (document.getElementById("engineType") as HTMLInputElement)?.value,
            power: (document.getElementById("power") as HTMLInputElement)?.value,
            fuelType: selectedFuelType,
            fuelCapacity: (document.getElementById("fuelCapacity") as HTMLInputElement)?.value,
          },
          dimensions: {
            length: (document.getElementById("length") as HTMLInputElement)?.value,
            width: (document.getElementById("width") as HTMLInputElement)?.value,
            height: (document.getElementById("height") as HTMLInputElement)?.value,
            weight: (document.getElementById("weight") as HTMLInputElement)?.value,
            capacity: (document.getElementById("capacity") as HTMLInputElement)?.value,
          },
          performance: {
            maxSpeed: (document.getElementById("maxSpeed") as HTMLInputElement)?.value,
            maxLoad: (document.getElementById("maxLoad") as HTMLInputElement)?.value,
            productivity: (document.getElementById("productivity") as HTMLInputElement)?.value,
            operatingHours: (document.getElementById("operatingHours") as HTMLInputElement)?.value,
          }
        } as Json
      }

      // Validar campos obligatorios
      if (!modelData.name || !modelData.manufacturer || !modelData.category) {
        throw new Error("Por favor completa los campos obligatorios: Nombre, Fabricante y Categoría")
      }

      console.log("Actualizando modelo:", modelData)
      
      // Actualizar el modelo en la base de datos
      const updatedModel = await modelsApi.update(modelId, modelData)
      
      console.log("Modelo actualizado con éxito:", updatedModel)
      
      toast({
        title: "Modelo actualizado",
        description: "El modelo de equipo ha sido actualizado correctamente",
      })
      
      // Redirigir a la página de detalles del modelo
      router.push(`/modelos/${modelId}`)
      router.refresh()
    } catch (err) {
      console.error("Error al actualizar el modelo:", err)
      setError(err instanceof Error ? err : new Error("Error al actualizar el modelo"))
      
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Error al actualizar el modelo",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!model) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          No se pudo cargar el modelo. Por favor, intenta nuevamente.
        </AlertDescription>
      </Alert>
    )
  }

  // Extraer valores de las especificaciones para mostrarlos en el formulario
  const specifications = model.specifications || {}
  const general = typeof specifications === 'object' && 'general' in (specifications as any) 
    ? (specifications as any).general || {} 
    : {}
  const dimensions = typeof specifications === 'object' && 'dimensions' in (specifications as any) 
    ? (specifications as any).dimensions || {} 
    : {}
  const performance = typeof specifications === 'object' && 'performance' in (specifications as any) 
    ? (specifications as any).performance || {} 
    : {}

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información del Modelo</CardTitle>
          <CardDescription>Modifica la información básica del modelo de equipo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="modelName">Nombre del Modelo</Label>
              <Input 
                id="modelName" 
                placeholder="Ej: CR-15" 
                defaultValue={model.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input 
                id="manufacturer" 
                placeholder="Ej: ConcreMix" 
                defaultValue={model.manufacturer}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <Select 
              value={selectedCategory} 
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {equipmentCategories.map((category: string) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea 
              id="description" 
              placeholder="Descripción general del modelo" 
              rows={3} 
              defaultValue={model.description || ''}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="yearIntroduced">Año de Introducción</Label>
              <Input 
                id="yearIntroduced" 
                type="number" 
                placeholder="Ej: 2020" 
                defaultValue={model.year_introduced || ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedLifespan">Vida Útil Esperada (años)</Label>
              <Input 
                id="expectedLifespan" 
                type="number" 
                placeholder="Ej: 10" 
                defaultValue={model.expected_lifespan || ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Especificaciones Técnicas</CardTitle>
          <CardDescription>Información detallada sobre las características técnicas del equipo</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="dimensions">Dimensiones</TabsTrigger>
              <TabsTrigger value="performance">Rendimiento</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="engineType">Tipo de Motor</Label>
                  <Input 
                    id="engineType" 
                    placeholder="Ej: Diésel 4 cilindros" 
                    defaultValue={general?.engineType || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="power">Potencia</Label>
                  <Input 
                    id="power" 
                    placeholder="Ej: 120 HP" 
                    defaultValue={general?.power || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuelType">Tipo de Combustible</Label>
                  <Select 
                    value={selectedFuelType} 
                    onValueChange={setSelectedFuelType}
                  >
                    <SelectTrigger id="fuelType">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {fuelTypes.map((type: string) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuelCapacity">Capacidad de Combustible</Label>
                  <Input 
                    id="fuelCapacity" 
                    placeholder="Ej: 200 L" 
                    defaultValue={general?.fuelCapacity || ''}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="dimensions" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="length">Longitud</Label>
                  <Input 
                    id="length" 
                    placeholder="Ej: 5.5 m" 
                    defaultValue={dimensions?.length || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="width">Ancho</Label>
                  <Input 
                    id="width" 
                    placeholder="Ej: 2.3 m" 
                    defaultValue={dimensions?.width || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Altura</Label>
                  <Input 
                    id="height" 
                    placeholder="Ej: 3.1 m" 
                    defaultValue={dimensions?.height || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Peso</Label>
                  <Input 
                    id="weight" 
                    placeholder="Ej: 5000 kg" 
                    defaultValue={dimensions?.weight || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacidad</Label>
                  <Input 
                    id="capacity" 
                    placeholder="Ej: 2.5 m³" 
                    defaultValue={dimensions?.capacity || ''}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxSpeed">Velocidad Máxima</Label>
                  <Input 
                    id="maxSpeed" 
                    placeholder="Ej: 25 km/h" 
                    defaultValue={performance?.maxSpeed || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxLoad">Carga Máxima</Label>
                  <Input 
                    id="maxLoad" 
                    placeholder="Ej: 10000 kg" 
                    defaultValue={performance?.maxLoad || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productivity">Productividad</Label>
                  <Input 
                    id="productivity" 
                    placeholder="Ej: 50 m³/h" 
                    defaultValue={performance?.productivity || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="operatingHours">Horas de Operación Recomendadas</Label>
                  <Input 
                    id="operatingHours" 
                    placeholder="Ej: 8000 h/año" 
                    defaultValue={performance?.operatingHours || ''}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Agregar la sección de intervalos de mantenimiento */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Plan de Mantenimiento</CardTitle>
            <CardDescription>Define los mantenimientos específicos recomendados por el fabricante</CardDescription>
          </div>
          <Button variant="outline" onClick={() => router.push(`/modelos/${modelId}`)}>
            <FileText className="mr-2 h-4 w-4" />
            Ver Plan
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horas</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tareas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceIntervals.map((interval, intervalIndex) => (
                    <TableRow key={interval.id || intervalIndex}>
                      <TableCell>{interval.hours}</TableCell>
                      <TableCell>{interval.name}</TableCell>
                      <TableCell>{interval.description}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{interval.tasks.length} tareas</Badge>
                            <Button variant="ghost" size="sm" onClick={() => openTaskDialog(intervalIndex)}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {interval.tasks.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {interval.tasks.map((task) => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between text-xs border-l-2 border-primary pl-2"
                                >
                                  <div className="flex-1">
                                    <div className="font-medium">{task.description}</div>
                                    <div className="text-muted-foreground">
                                      {task.type} • {task.estimatedTime}h • {task.parts?.length || 0} repuestos
                                    </div>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => openTaskDialog(intervalIndex, task)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                      onClick={() => removeTask(intervalIndex, task.id)}
                                    >
                                      <Trash className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => removeMaintenanceInterval(intervalIndex)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {maintenanceIntervals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        No hay intervalos de mantenimiento definidos
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Agregar Nuevo Intervalo de Mantenimiento</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="intervalHours">Horas</Label>
                  <Input
                    id="intervalHours"
                    type="number"
                    placeholder="Ej: 500"
                    value={newInterval.hours || ""}
                    onChange={(e) => setNewInterval({ ...newInterval, hours: Number.parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="intervalName">Nombre</Label>
                  <Input
                    id="intervalName"
                    placeholder="Ej: Mantenimiento 500 horas"
                    value={newInterval.name}
                    onChange={(e) => setNewInterval({ ...newInterval, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="intervalDescription">Descripción</Label>
                  <div className="flex gap-2">
                    <Input
                      id="intervalDescription"
                      placeholder="Descripción breve"
                      value={newInterval.description}
                      onChange={(e) => setNewInterval({ ...newInterval, description: e.target.value })}
                    />
                    <Button type="button" onClick={addMaintenanceInterval}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo para agregar/editar tareas */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditingTask ? "Editar Tarea" : "Agregar Nueva Tarea"}</DialogTitle>
            <DialogDescription>
              {isEditingTask
                ? "Modifica los detalles de la tarea de mantenimiento"
                : "Ingresa los detalles de la nueva tarea de mantenimiento"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="taskDescription">Descripción</Label>
              <Input
                id="taskDescription"
                placeholder="Ej: Cambio de aceite y filtro"
                defaultValue={currentTask?.description || ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taskType">Tipo</Label>
                <Select defaultValue={currentTask?.type || ""}>
                  <SelectTrigger id="taskType">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {maintenanceTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taskTime">Tiempo Estimado (horas)</Label>
                <Input
                  id="taskTime"
                  type="number"
                  step="0.5"
                  min="0.5"
                  defaultValue={currentTask?.estimatedTime || "1"}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="requiresSpecialist"
                defaultChecked={currentTask?.requiresSpecialist || false}
              />
              <Label htmlFor="requiresSpecialist">Requiere técnico especialista</Label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Repuestos Requeridos</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Si es una tarea nueva, primero creamos una tarea temporal
                    if (!isEditingTask) {
                      const newTask: MaintenanceTask = {
                        id: `task-${Date.now()}`,
                        description: (document.getElementById("taskDescription") as HTMLInputElement).value,
                        type:
                          (document.querySelector("[data-value]") as HTMLElement)?.getAttribute("data-value") || "Inspección",
                        estimatedTime:
                          Number.parseFloat((document.getElementById("taskTime") as HTMLInputElement).value) || 1,
                        requiresSpecialist: (document.getElementById("requiresSpecialist") as HTMLInputElement).checked,
                        parts: [],
                      }
                      setCurrentTask(newTask);
                      
                      // Ahora que tenemos una tarea temporal, podemos abrir el diálogo de repuestos
                      if (currentIntervalIndex !== null) {
                        const taskIndex = maintenanceIntervals[currentIntervalIndex].tasks.length;
                        openPartDialog(currentIntervalIndex, taskIndex);
                      }
                    } else if (currentTask && currentIntervalIndex !== null) {
                      // Para tareas existentes, hacemos lo mismo que antes
                      const taskIndex = maintenanceIntervals[currentIntervalIndex].tasks.findIndex(
                        (t) => t.id === currentTask.id,
                      );
                      if (taskIndex !== -1) {
                        openPartDialog(currentIntervalIndex, taskIndex);
                      }
                    }
                  }}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Agregar
                </Button>
              </div>
              <div className="rounded-md border">
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
                    {(currentTask?.parts || []).map((part, partIndex) => (
                      <TableRow key={part.id}>
                        <TableCell>{part.name}</TableCell>
                        <TableCell>{part.partNumber}</TableCell>
                        <TableCell>{part.quantity}</TableCell>
                        <TableCell>{part.cost ? `$${part.cost}` : "N/A"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                if (currentTask && currentIntervalIndex !== null) {
                                  const taskIndex = maintenanceIntervals[currentIntervalIndex].tasks.findIndex(
                                    (t) => t.id === currentTask.id,
                                  )
                                  if (taskIndex !== -1) {
                                    openPartDialog(currentIntervalIndex, taskIndex, part)
                                  }
                                }
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500"
                              onClick={() => {
                                if (currentTask && currentIntervalIndex !== null) {
                                  const taskIndex = maintenanceIntervals[currentIntervalIndex].tasks.findIndex(
                                    (t) => t.id === currentTask.id,
                                  )
                                  if (taskIndex !== -1) {
                                    removePart(currentIntervalIndex, taskIndex, part.id)
                                    // Actualizar la tarea actual para reflejar el cambio
                                    setCurrentTask({
                                      ...currentTask,
                                      parts: currentTask.parts.filter(p => p.id !== part.id)
                                    })
                                  }
                                }
                              }}
                            >
                              <Trash className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!currentTask?.parts || currentTask.parts.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">
                          No hay repuestos registrados para esta tarea
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                // Guardar la tarea con los datos actualizados
                const newTask: MaintenanceTask = {
                  id: currentTask?.id || `task-${Date.now()}`,
                  description: (document.getElementById("taskDescription") as HTMLInputElement).value,
                  type:
                    (document.querySelector("[data-value]") as HTMLElement)?.getAttribute("data-value") || "Inspección",
                  estimatedTime:
                    Number.parseFloat((document.getElementById("taskTime") as HTMLInputElement).value) || 1,
                  requiresSpecialist: (document.getElementById("requiresSpecialist") as HTMLInputElement).checked,
                  parts: currentTask?.parts || [],
                }
                saveTask(newTask)
              }}
            >
              {isEditingTask ? "Actualizar" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para agregar/editar repuestos */}
      <Dialog open={isPartDialogOpen} onOpenChange={setIsPartDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isEditingPart ? "Editar Repuesto" : "Agregar Repuesto"}</DialogTitle>
            <DialogDescription>
              {isEditingPart
                ? "Modifica los detalles del repuesto"
                : "Ingresa los detalles del repuesto requerido para esta tarea"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="partName">Nombre del Repuesto</Label>
              <Input id="partName" placeholder="Ej: Filtro de aceite" defaultValue={currentPart?.name || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partNumber">Número de Parte</Label>
              <Input id="partNumber" placeholder="Ej: FO-1234" defaultValue={currentPart?.partNumber || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partQuantity">Cantidad</Label>
              <Input id="partQuantity" type="number" min="1" defaultValue={currentPart?.quantity || "1"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partCost">Costo Unitario ($)</Label>
              <Input id="partCost" placeholder="Ej: 25.50" defaultValue={currentPart?.cost || ""} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPartDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                // Guardar el repuesto con los datos actualizados
                const newPart: MaintenancePart = {
                  id: currentPart?.id || `part-${Date.now()}`,
                  name: (document.getElementById("partName") as HTMLInputElement).value,
                  partNumber: (document.getElementById("partNumber") as HTMLInputElement).value,
                  quantity: Number.parseInt((document.getElementById("partQuantity") as HTMLInputElement).value) || 1,
                  cost: (document.getElementById("partCost") as HTMLInputElement).value,
                }
                savePart(newPart)
                
                // Si estamos añadiendo un repuesto a una tarea nueva, actualizamos la tarea actual
                if (currentTask && !isEditingTask) {
                  setCurrentTask({
                    ...currentTask,
                    parts: [...(currentTask.parts || []), newPart]
                  })
                }
              }}
            >
              {isEditingPart ? "Actualizar" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/modelos/${modelId}`)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleUpdateModel}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 