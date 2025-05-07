"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Save, Trash, Upload, Edit, FileText, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { modelsApi } from "@/lib/api"
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InsertEquipmentModel } from "@/types"

// Categorías de equipos para el selector
const equipmentCategories = [
  "Mezcladora de Concreto",
  "Grúa Torre",
  "Generador Eléctrico",
  "Montacargas Eléctrico",
  "Compresor Industrial",
  "Excavadora",
  "Cargador Frontal",
  "Retroexcavadora",
  "Bomba de Concreto",
  "Plataforma Elevadora",
]

// Tipos de mantenimiento
const maintenanceTypes = [
  "Inspección",
  "Lubricación",
  "Ajuste",
  "Limpieza",
  "Reemplazo",
  "Calibración",
  "Prueba",
  "Overhaul",
]

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
}

// Interfaz para los intervalos de mantenimiento
interface MaintenanceInterval {
  hours: number
  name: string
  description: string
  tasks: MaintenanceTask[]
}

export function EquipmentModelForm() {
  const router = useRouter()
  const [maintenanceIntervals, setMaintenanceIntervals] = useState<MaintenanceInterval[]>([
    {
      hours: 250,
      name: "Mantenimiento 250 horas",
      description: "Mantenimiento básico cada 250 horas de operación",
      tasks: [
        {
          id: "task1",
          description: "Cambio de aceite y filtro",
          type: "Reemplazo",
          estimatedTime: 1,
          requiresSpecialist: false,
          parts: [
            { id: "part1", name: "Aceite 15W-40", partNumber: "OIL-1540", quantity: 1 },
            { id: "part2", name: "Filtro de aceite", partNumber: "FO-1234", quantity: 1 },
          ],
        },
        {
          id: "task2",
          description: "Inspección de sistema eléctrico",
          type: "Inspección",
          estimatedTime: 0.5,
          requiresSpecialist: false,
          parts: [],
        },
      ],
    },
    {
      hours: 500,
      name: "Mantenimiento 500 horas",
      description: "Mantenimiento intermedio cada 500 horas de operación",
      tasks: [
        {
          id: "task3",
          description: "Cambio de filtro de combustible",
          type: "Reemplazo",
          estimatedTime: 0.5,
          requiresSpecialist: false,
          parts: [{ id: "part3", name: "Filtro de combustible", partNumber: "FC-5678", quantity: 1 }],
        },
      ],
    },
    {
      hours: 1000,
      name: "Mantenimiento 1000 horas",
      description: "Mantenimiento mayor cada 1000 horas de operación",
      tasks: [
        {
          id: "task4",
          description: "Calibración de válvulas",
          type: "Calibración",
          estimatedTime: 2,
          requiresSpecialist: true,
          parts: [],
        },
      ],
    },
  ])

  // Estado para el nuevo intervalo
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

  // Función para agregar un nuevo intervalo de mantenimiento
  const addMaintenanceInterval = () => {
    if (newInterval.hours > 0 && newInterval.name && newInterval.description) {
      setMaintenanceIntervals([
        ...maintenanceIntervals,
        {
          ...newInterval,
          tasks: [],
        },
      ])
      setNewInterval({ hours: 0, name: "", description: "" })
    }
  }

  // Función para eliminar un intervalo de mantenimiento
  const removeMaintenanceInterval = (index: number) => {
    setMaintenanceIntervals(maintenanceIntervals.filter((_, i) => i !== index))
  }

  // Función para abrir el diálogo de tareas
  const openTaskDialog = (intervalIndex: number, task: MaintenanceTask | null = null) => {
    setCurrentIntervalIndex(intervalIndex)
    setCurrentTask(task)
    setIsEditingTask(!!task)
    setIsTaskDialogOpen(true)
  }

  // Función para guardar una tarea
  const saveTask = (task: MaintenanceTask) => {
    if (currentIntervalIndex === null) return

    const updatedIntervals = [...maintenanceIntervals]

    if (isEditingTask && currentTask) {
      // Editar tarea existente
      const taskIndex = updatedIntervals[currentIntervalIndex].tasks.findIndex((t) => t.id === currentTask.id)
      if (taskIndex !== -1) {
        updatedIntervals[currentIntervalIndex].tasks[taskIndex] = task
      }
    } else {
      // Agregar nueva tarea
      updatedIntervals[currentIntervalIndex].tasks.push(task)
    }

    setMaintenanceIntervals(updatedIntervals)
    setIsTaskDialogOpen(false)
    setCurrentTask(null)
    setIsEditingTask(false)
  }

  // Función para eliminar una tarea
  const removeTask = (intervalIndex: number, taskId: string) => {
    const updatedIntervals = [...maintenanceIntervals]
    updatedIntervals[intervalIndex].tasks = updatedIntervals[intervalIndex].tasks.filter((task) => task.id !== taskId)
    setMaintenanceIntervals(updatedIntervals)
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
  const savePart = (part: MaintenancePart) => {
    if (currentIntervalIndex === null || currentTaskIndex === null) return

    const updatedIntervals = [...maintenanceIntervals]

    if (isEditingPart && currentPart) {
      // Editar repuesto existente
      const partIndex = updatedIntervals[currentIntervalIndex].tasks[currentTaskIndex].parts.findIndex(
        (p) => p.id === currentPart.id,
      )
      if (partIndex !== -1) {
        updatedIntervals[currentIntervalIndex].tasks[currentTaskIndex].parts[partIndex] = part
      }
    } else {
      // Agregar nuevo repuesto
      updatedIntervals[currentIntervalIndex].tasks[currentTaskIndex].parts.push(part)
    }

    setMaintenanceIntervals(updatedIntervals)
    setIsPartDialogOpen(false)
    setCurrentPart(null)
    setIsEditingPart(false)
  }

  // Función para eliminar un repuesto
  const removePart = (intervalIndex: number, taskIndex: number, partId: string) => {
    const updatedIntervals = [...maintenanceIntervals]
    updatedIntervals[intervalIndex].tasks[taskIndex].parts = updatedIntervals[intervalIndex].tasks[
      taskIndex
    ].parts.filter((part) => part.id !== partId)
    setMaintenanceIntervals(updatedIntervals)
  }

  // Función para guardar el modelo
  const handleSaveModel = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Obtener los valores del formulario
      const modelData: InsertEquipmentModel = {
        model_id: `MOD${Date.now().toString().substring(8)}`, // Generar un ID único
        name: (document.getElementById("modelName") as HTMLInputElement).value,
        manufacturer: (document.getElementById("manufacturer") as HTMLInputElement).value,
        category: selectedCategory,
        description: (document.getElementById("description") as HTMLTextAreaElement).value,
        year_introduced: Number((document.getElementById("yearIntroduced") as HTMLInputElement).value) || null,
        expected_lifespan: Number((document.getElementById("expectedLifespan") as HTMLInputElement).value) || null,
        maintenance_unit: "hours", // Por defecto en horas
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
        }
      };

      // Validar campos obligatorios
      if (!modelData.name || !modelData.manufacturer || !modelData.category) {
        throw new Error("Por favor completa los campos obligatorios: Nombre, Fabricante y Categoría");
      }

      console.log("Guardando modelo:", modelData);
      
      // Guardar el modelo en la base de datos
      const savedModel = await modelsApi.create(modelData);
      
      console.log("Modelo guardado con éxito:", savedModel);
      
      // Ahora guardar los intervalos de mantenimiento
      if (savedModel && maintenanceIntervals.length > 0) {
        for (const interval of maintenanceIntervals) {
          const savedInterval = await modelsApi.createMaintenanceInterval({
            model_id: savedModel.id,
            interval_value: interval.hours,
            name: interval.name,
            description: interval.description || null,
            type: "Preventivo",
            estimated_duration: interval.tasks.reduce((sum, task) => sum + (task.estimatedTime || 0), 0),
          });
          
          // Guardar las tareas de cada intervalo
          if (savedInterval && interval.tasks.length > 0) {
            for (const task of interval.tasks) {
              const savedTask = await modelsApi.createMaintenanceTask({
                interval_id: savedInterval.id,
                description: task.description,
                type: task.type,
                estimated_time: task.estimatedTime,
                requires_specialist: task.requiresSpecialist,
              });
              
              // Guardar los repuestos de cada tarea
              if (savedTask && task.parts.length > 0) {
                for (const part of task.parts) {
                  await modelsApi.createTaskPart({
                    task_id: savedTask.id,
                    name: part.name,
                    part_number: part.partNumber,
                    quantity: part.quantity,
                    cost: null, // No tenemos información de costo en el formulario
                  });
                }
              }
            }
          }
        }
      }

      // Mostrar mensaje de éxito
      toast({
        title: "Modelo guardado con éxito",
        description: "Se ha creado correctamente el modelo de equipo",
      });

      // Redirigir a la lista de modelos
      router.push("/modelos");
    } catch (err) {
      console.error("Error al guardar el modelo:", err);
      setError(err instanceof Error ? err : new Error("Error al guardar el modelo"));
      
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Error al guardar el modelo",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Agregar estas líneas abajo de la definición de useState para maintenanceIntervals
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedFuelType, setSelectedFuelType] = useState<string>("");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información del Modelo</CardTitle>
          <CardDescription>Ingresa la información básica del modelo de equipo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="modelName">Nombre del Modelo</Label>
              <Input id="modelName" placeholder="Ej: CR-15" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input id="manufacturer" placeholder="Ej: ConcreMix" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <Select onValueChange={setSelectedCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {equipmentCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" placeholder="Descripción general del modelo" rows={3} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="yearIntroduced">Año de Introducción</Label>
              <Input id="yearIntroduced" type="number" placeholder="Ej: 2020" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedLifespan">Vida Útil Esperada (años)</Label>
              <Input id="expectedLifespan" type="number" placeholder="Ej: 10" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Especificaciones Técnicas</CardTitle>
          <CardDescription>Ingresa las especificaciones técnicas del modelo</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="dimensions">Dimensiones</TabsTrigger>
              <TabsTrigger value="performance">Rendimiento</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="engineType">Tipo de Motor</Label>
                  <Input id="engineType" placeholder="Ej: Diésel 4 cilindros" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="power">Potencia</Label>
                  <Input id="power" placeholder="Ej: 120 HP" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuelType">Tipo de Combustible</Label>
                  <Select onValueChange={setSelectedFuelType}>
                    <SelectTrigger id="fuelType">
                      <SelectValue placeholder="Seleccionar combustible" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diesel">Diésel</SelectItem>
                      <SelectItem value="gasoline">Gasolina</SelectItem>
                      <SelectItem value="electric">Eléctrico</SelectItem>
                      <SelectItem value="hybrid">Híbrido</SelectItem>
                      <SelectItem value="gas">Gas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuelCapacity">Capacidad de Combustible</Label>
                  <Input id="fuelCapacity" placeholder="Ej: 200 L" />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="dimensions" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="length">Longitud</Label>
                  <Input id="length" placeholder="Ej: 5.5 m" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="width">Ancho</Label>
                  <Input id="width" placeholder="Ej: 2.3 m" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Altura</Label>
                  <Input id="height" placeholder="Ej: 3.1 m" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Peso</Label>
                  <Input id="weight" placeholder="Ej: 5000 kg" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacidad</Label>
                  <Input id="capacity" placeholder="Ej: 2.5 m³" />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxSpeed">Velocidad Máxima</Label>
                  <Input id="maxSpeed" placeholder="Ej: 25 km/h" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxLoad">Carga Máxima</Label>
                  <Input id="maxLoad" placeholder="Ej: 10000 kg" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productivity">Productividad</Label>
                  <Input id="productivity" placeholder="Ej: 50 m³/h" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="operatingHours">Horas de Operación Recomendadas</Label>
                  <Input id="operatingHours" placeholder="Ej: 8000 h/año" />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Plan de Mantenimiento</CardTitle>
            <CardDescription>Define los mantenimientos específicos recomendados por el fabricante</CardDescription>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <FileText className="mr-2 h-4 w-4" />
            Generar Plan
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
                    <TableRow key={intervalIndex}>
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
                              {interval.tasks.map((task, taskIndex) => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between text-xs border-l-2 border-primary pl-2"
                                >
                                  <div className="flex-1">
                                    <div className="font-medium">{task.description}</div>
                                    <div className="text-muted-foreground">
                                      {task.type} • {task.estimatedTime}h • {task.parts.length} repuestos
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

      <Card>
        <CardHeader>
          <CardTitle>Documentación Técnica</CardTitle>
          <CardDescription>Sube la documentación técnica del fabricante</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="manualUpload">Manual de Operación</Label>
              <div className="flex items-center gap-2">
                <Input id="manualUpload" type="file" />
                <Button variant="outline" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Subir
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenanceGuideUpload">Guía de Mantenimiento</Label>
              <div className="flex items-center gap-2">
                <Input id="maintenanceGuideUpload" type="file" />
                <Button variant="outline" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Subir
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partsListUpload">Lista de Repuestos</Label>
              <div className="flex items-center gap-2">
                <Input id="partsListUpload" type="file" />
                <Button variant="outline" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Subir
                </Button>
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

            {currentTask && currentIntervalIndex !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Repuestos Requeridos</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const taskIndex = maintenanceIntervals[currentIntervalIndex].tasks.findIndex(
                        (t) => t.id === currentTask.id,
                      )
                      if (taskIndex !== -1) {
                        openPartDialog(currentIntervalIndex, taskIndex)
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
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentTask.parts.map((part, partIndex) => (
                        <TableRow key={part.id}>
                          <TableCell>{part.name}</TableCell>
                          <TableCell>{part.partNumber}</TableCell>
                          <TableCell>{part.quantity}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  const taskIndex = maintenanceIntervals[currentIntervalIndex].tasks.findIndex(
                                    (t) => t.id === currentTask.id,
                                  )
                                  if (taskIndex !== -1) {
                                    openPartDialog(currentIntervalIndex, taskIndex, part)
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
                                  const taskIndex = maintenanceIntervals[currentIntervalIndex].tasks.findIndex(
                                    (t) => t.id === currentTask.id,
                                  )
                                  if (taskIndex !== -1) {
                                    removePart(currentIntervalIndex, taskIndex, part.id)
                                  }
                                }}
                              >
                                <Trash className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {currentTask.parts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-4">
                            No hay repuestos registrados para esta tarea
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                // Aquí normalmente guardaríamos la tarea
                // Para este ejemplo, simulamos guardar una tarea con datos de ejemplo
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPartDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                // Aquí normalmente guardaríamos el repuesto
                // Para este ejemplo, simulamos guardar un repuesto con datos de ejemplo
                const newPart: MaintenancePart = {
                  id: currentPart?.id || `part-${Date.now()}`,
                  name: (document.getElementById("partName") as HTMLInputElement).value,
                  partNumber: (document.getElementById("partNumber") as HTMLInputElement).value,
                  quantity: Number.parseInt((document.getElementById("partQuantity") as HTMLInputElement).value) || 1,
                }
                savePart(newPart)
              }}
            >
              {isEditingPart ? "Actualizar" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Botón de guardar */}
      <Card>
        <CardHeader>
          <CardTitle>Guardar Modelo</CardTitle>
          <CardDescription>Guarda el modelo con toda la información configurada</CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-end">
          {error && (
            <Alert variant="destructive" className="mr-auto">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleSaveModel} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Modelo
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
