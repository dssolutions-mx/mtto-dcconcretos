"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { Plus, Save, Trash, Upload, Edit, FileText, Loader2, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { modelsApi } from "@/lib/api"
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InsertEquipmentModel, FileUpload } from "@/types"
import { equipmentCategories, fuelTypes, maintenanceTypes, measurementUnits } from "@/lib/constants"

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

  // Estado de formulario controlado (tarea)
  const [taskFormData, setTaskFormData] = useState<{
    description: string
    type: string
    estimatedTime: number
    requiresSpecialist: boolean
  }>({ description: "", type: "Inspección", estimatedTime: 1, requiresSpecialist: false })

  // Estado de formulario controlado (repuesto)
  const [partFormData, setPartFormData] = useState<{
    name: string
    partNumber: string
    quantity: number
    cost: string
  }>({ name: "", partNumber: "", quantity: 1, cost: "" })

  // Estado para la unidad de mantenimiento
  const [maintenanceUnit, setMaintenanceUnit] = useState<string>("hours")

  // Función para agregar un nuevo intervalo de mantenimiento
  const addMaintenanceInterval = useCallback(() => {
    if (newInterval.hours > 0 && newInterval.name && newInterval.description) {
      setMaintenanceIntervals((prev) => [
        ...prev,
        {
          ...newInterval,
          tasks: [],
        },
      ])
      setNewInterval({ hours: 0, name: "", description: "" })
    }
  }, [newInterval])

  // Función para eliminar un intervalo de mantenimiento
  const removeMaintenanceInterval = useCallback((index: number) => {
    setMaintenanceIntervals((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Función para abrir el diálogo de tareas
  const openTaskDialog = useCallback((intervalIndex: number, task: MaintenanceTask | null = null) => {
    setCurrentIntervalIndex(intervalIndex)
    setCurrentTask(task)
    setIsEditingTask(!!task)
    setCurrentTaskIndex(null)
    setTaskFormData({
      description: task?.description || "",
      type: task?.type || "Inspección",
      estimatedTime: task?.estimatedTime || 1,
      requiresSpecialist: task?.requiresSpecialist || false,
    })
    setIsTaskDialogOpen(true)
  }, [])

  // Función para guardar una tarea
  const saveTask = useCallback((task: MaintenanceTask) => {
    if (currentIntervalIndex === null) return

    setMaintenanceIntervals((prev) => {
      const updated = [...prev]
      if (isEditingTask && currentTask) {
        const taskIndex = updated[currentIntervalIndex].tasks.findIndex((t) => t.id === currentTask.id)
        if (taskIndex !== -1) updated[currentIntervalIndex].tasks[taskIndex] = task
      } else {
        updated[currentIntervalIndex].tasks = [...updated[currentIntervalIndex].tasks, task]
      }
      return updated
    })
    setIsTaskDialogOpen(false)
    setCurrentTask(null)
    setIsEditingTask(false)
    setCurrentTaskIndex(null)
  }, [currentIntervalIndex, currentTask, isEditingTask])

  // Función para eliminar una tarea
  const removeTask = useCallback((intervalIndex: number, taskId: string) => {
    setMaintenanceIntervals((prev) => {
      const updated = [...prev]
      updated[intervalIndex].tasks = updated[intervalIndex].tasks.filter((task) => task.id !== taskId)
      return updated
    })
  }, [])

  // Función para abrir el diálogo de repuestos
  const openPartDialog = useCallback((intervalIndex: number, taskIndex: number, part: MaintenancePart | null = null) => {
    setCurrentIntervalIndex(intervalIndex)
    setCurrentTaskIndex(taskIndex)
    setCurrentPart(part)
    setIsEditingPart(!!part)
    setPartFormData({
      name: part?.name || "",
      partNumber: part?.partNumber || "",
      quantity: part?.quantity || 1,
      cost: part?.cost || "",
    })
    setIsPartDialogOpen(true)
  }, [])

  // Función para guardar un repuesto
  const savePart = useCallback((part: MaintenancePart) => {
    if (currentIntervalIndex === null || currentTaskIndex === null) return

    // Si estamos trabajando con una tarea temporal (currentTaskIndex === -1)
    if (currentTaskIndex === -1 && currentTask) {
      if (isEditingPart && currentPart) {
        // Editar repuesto existente en la tarea temporal
        const updatedParts = currentTask.parts.map(p => 
          p.id === currentPart.id ? part : p
        )
        setCurrentTask({ ...currentTask, parts: updatedParts })
      } else {
        // Agregar nuevo repuesto a la tarea temporal
        setCurrentTask({ ...currentTask, parts: [...currentTask.parts, part] })
      }
    } else {
      // Trabajar con tareas ya guardadas en los intervalos
      const updatedIntervals = [...maintenanceIntervals]
      
      // Verificar que la tarea existe en el array
      if (!updatedIntervals[currentIntervalIndex].tasks[currentTaskIndex]) {
        console.error("Task not found at index:", currentTaskIndex)
        return
      }

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
    }

    setIsPartDialogOpen(false)
    setCurrentPart(null)
    setIsEditingPart(false)
  }, [currentIntervalIndex, currentPart, currentTask, currentTaskIndex, isEditingPart, maintenanceIntervals])

  // Función para eliminar un repuesto
  const removePart = useCallback((intervalIndex: number, taskIndex: number, partId: string) => {
    // Si es una tarea temporal (taskIndex === -1)
    if (taskIndex === -1 && currentTask) {
      const updatedParts = currentTask.parts.filter((part) => part.id !== partId)
      setCurrentTask({ ...currentTask, parts: updatedParts })
    } else {
      // Tarea existente en los intervalos
      setMaintenanceIntervals((prev) => {
        const updated = [...prev]
        const task = updated[intervalIndex]?.tasks?.[taskIndex]
        if (!task) return prev
        task.parts = task.parts.filter((part) => part.id !== partId)
        return updated
      })
    }
  }, [currentTask])

  // Resetear formulario cuando se cierran diálogos
  useEffect(() => {
    if (!isTaskDialogOpen) {
      setTaskFormData({ description: "", type: "Inspección", estimatedTime: 1, requiresSpecialist: false })
      setCurrentTask(null)
      setIsEditingTask(false)
      setCurrentTaskIndex(null)
    }
  }, [isTaskDialogOpen])

  useEffect(() => {
    if (!isPartDialogOpen) {
      setPartFormData({ name: "", partNumber: "", quantity: 1, cost: "" })
      setCurrentPart(null)
      setIsEditingPart(false)
    }
  }, [isPartDialogOpen])

  // Mantener currentTask en sync cuando editamos una tarea existente vía intervals (repuestos)
  useEffect(() => {
    if (!isTaskDialogOpen || currentIntervalIndex === null || !currentTask || !isEditingTask) return
    const taskIndex = maintenanceIntervals[currentIntervalIndex]?.tasks.findIndex((t) => t.id === currentTask.id)
    if (taskIndex === -1) return
    const updatedTask = maintenanceIntervals[currentIntervalIndex].tasks[taskIndex]
    if (updatedTask && JSON.stringify(updatedTask.parts || []) !== JSON.stringify(currentTask.parts || [])) setCurrentTask(updatedTask)
  }, [currentIntervalIndex, currentTask, isEditingTask, isTaskDialogOpen, maintenanceIntervals])

  const PartTableRow = useMemo(() => {
    const Row = memo(
      ({ part, onEdit, onDelete }: { part: MaintenancePart; onEdit: () => void; onDelete: () => void }) => (
        <TableRow>
          <TableCell>{part.name}</TableCell>
          <TableCell>{part.partNumber}</TableCell>
          <TableCell>{part.quantity}</TableCell>
          <TableCell>{part.cost ? `$${part.cost}` : "N/A"}</TableCell>
          <TableCell>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onEdit}>
                <Edit className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={onDelete}>
                <Trash className="h-3 w-3" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ),
    )
    Row.displayName = "PartTableRow"
    return Row
  }, [])

  // Funciones para manejo de documentos
  const handleFileSelect = (documentType: 'operationManual' | 'maintenanceGuide' | 'partsList', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setDocumentUploads(prev => ({
        ...prev,
        [documentType]: file
      }));
    }
  };

  const uploadDocument = async (documentType: 'operationManual' | 'maintenanceGuide' | 'partsList', modelId: string) => {
    const file = documentUploads[documentType];
    if (!file) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se ha seleccionado ningún archivo",
      });
      return;
    }

    setUploadingDocuments(prev => ({ ...prev, [documentType]: true }));

    try {
      console.log("Uploading document:", {
        documentType,
        modelId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });

      const fileUpload: FileUpload = {
        name: file.name,
        type: getDocumentTypeLabel(documentType),
        size: file.size,
        file: file
      };

      const documentUrl = await modelsApi.uploadDocument(modelId, fileUpload);
      
      console.log("Document uploaded successfully:", documentUrl);
      
      setUploadedDocuments(prev => ({
        ...prev,
        [documentType]: documentUrl
      }));

      toast({
        title: "Documento subido",
        description: `${getDocumentTypeLabel(documentType)} subido correctamente`,
      });

    } catch (error) {
      console.error("Error uploading document:", error);
      
      let errorMessage = "Error al subir el documento";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setUploadingDocuments(prev => ({ ...prev, [documentType]: false }));
    }
  };

  const getDocumentTypeLabel = (documentType: 'operationManual' | 'maintenanceGuide' | 'partsList') => {
    const labels = {
      operationManual: "Manual de Operación",
      maintenanceGuide: "Guía de Mantenimiento", 
      partsList: "Lista de Repuestos"
    };
    return labels[documentType];
  };

  // Función para guardar el modelo
  const handleSaveModel = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Obtener los valores del formulario desde el estado
      const modelData: InsertEquipmentModel = {
        model_id: `MOD${Date.now().toString().substring(8)}`, // Generar un ID único
        name: basicInfo.modelName,
        manufacturer: basicInfo.manufacturer,
        category: selectedCategory,
        description: basicInfo.description,
        year_introduced: Number(basicInfo.yearIntroduced) || null,
        expected_lifespan: Number(basicInfo.expectedLifespan) || null,
        maintenance_unit: maintenanceUnit,
        specifications: {
          general: {
            engineType: specifications.general.engineType,
            power: specifications.general.power,
            fuelType: selectedFuelType,
            fuelCapacity: specifications.general.fuelCapacity,
          },
          dimensions: {
            length: specifications.dimensions.length,
            width: specifications.dimensions.width,
            height: specifications.dimensions.height,
            weight: specifications.dimensions.weight,
            capacity: specifications.dimensions.capacity,
          },
          performance: {
            maxSpeed: specifications.performance.maxSpeed,
            maxLoad: specifications.performance.maxLoad,
            productivity: specifications.performance.productivity,
            operatingHours: specifications.performance.operatingHours,
          }
        }
      };

      // Validar campos obligatorios
      if (!modelData.name || !modelData.manufacturer || !modelData.category) {
        throw new Error("Por favor completa los campos obligatorios: Nombre, Fabricante y Categoría");
      }

      console.log("Guardando modelo:", modelData);

      // Guardar modelo con intervalos, tareas y repuestos en bulk (optimizado)
      const savedModel = await modelsApi.createWithHierarchy(modelData, maintenanceIntervals);

      console.log("Modelo guardado con éxito:", savedModel);

      // Subir documentos si existen
      if (savedModel) {
        const documentTypes: Array<'operationManual' | 'maintenanceGuide' | 'partsList'> = ['operationManual', 'maintenanceGuide', 'partsList'];

        for (const docType of documentTypes) {
          if (documentUploads[docType]) {
            await uploadDocument(docType, savedModel.id);
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

  // Estado para documentos
  const [documentUploads, setDocumentUploads] = useState<{
    operationManual: File | null;
    maintenanceGuide: File | null;
    partsList: File | null;
  }>({
    operationManual: null,
    maintenanceGuide: null,
    partsList: null,
  });

  const [uploadingDocuments, setUploadingDocuments] = useState<{
    operationManual: boolean;
    maintenanceGuide: boolean;
    partsList: boolean;
  }>({
    operationManual: false,
    maintenanceGuide: false,
    partsList: false,
  });

  const [uploadedDocuments, setUploadedDocuments] = useState<{
    operationManual: string | null;
    maintenanceGuide: string | null;
    partsList: string | null;
  }>({
    operationManual: null,
    maintenanceGuide: null,
    partsList: null,
  });

  // Estado para información básica del modelo
  const [basicInfo, setBasicInfo] = useState({
    modelName: "",
    manufacturer: "",
    description: "",
    yearIntroduced: "",
    expectedLifespan: "",
  });

  // Estado para especificaciones técnicas
  const [specifications, setSpecifications] = useState({
    general: {
      engineType: "",
      power: "",
      fuelCapacity: "",
    },
    dimensions: {
      length: "",
      width: "",
      height: "",
      weight: "",
      capacity: "",
    },
    performance: {
      maxSpeed: "",
      maxLoad: "",
      productivity: "",
      operatingHours: "",
    }
  });

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
              <Input 
                id="modelName" 
                placeholder="Ej: CR-15" 
                value={basicInfo.modelName}
                onChange={(e) => setBasicInfo(prev => ({ ...prev, modelName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input 
                id="manufacturer" 
                placeholder="Ej: ConcreMix" 
                value={basicInfo.manufacturer}
                onChange={(e) => setBasicInfo(prev => ({ ...prev, manufacturer: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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
            <Textarea 
              id="description" 
              placeholder="Descripción general del modelo" 
              rows={3}
              value={basicInfo.description}
              onChange={(e) => setBasicInfo(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="yearIntroduced">Año de Introducción</Label>
              <Input 
                id="yearIntroduced" 
                type="number" 
                placeholder="Ej: 2020" 
                value={basicInfo.yearIntroduced}
                onChange={(e) => setBasicInfo(prev => ({ ...prev, yearIntroduced: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedLifespan">Vida Útil Esperada (años)</Label>
              <Input 
                id="expectedLifespan" 
                type="number" 
                placeholder="Ej: 10" 
                value={basicInfo.expectedLifespan}
                onChange={(e) => setBasicInfo(prev => ({ ...prev, expectedLifespan: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenanceUnit">Unidad de Mantenimiento</Label>
              <Select
                value={maintenanceUnit}
                onValueChange={setMaintenanceUnit}
              >
                <SelectTrigger id="maintenanceUnit">
                  <SelectValue placeholder="Seleccionar unidad" />
                </SelectTrigger>
                <SelectContent>
                  {measurementUnits.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <Input 
                    id="engineType" 
                    placeholder="Ej: Diésel 4 cilindros" 
                    value={specifications.general.engineType}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      general: { ...prev.general, engineType: e.target.value } 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="power">Potencia</Label>
                  <Input 
                    id="power" 
                    placeholder="Ej: 120 HP" 
                    value={specifications.general.power}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      general: { ...prev.general, power: e.target.value } 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuelType">Tipo de Combustible</Label>
                  <Select value={selectedFuelType} onValueChange={setSelectedFuelType}>
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
                  <Input 
                    id="fuelCapacity" 
                    placeholder="Ej: 200 L" 
                    value={specifications.general.fuelCapacity}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      general: { ...prev.general, fuelCapacity: e.target.value } 
                    }))}
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
                    value={specifications.dimensions.length}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      dimensions: { ...prev.dimensions, length: e.target.value } 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="width">Ancho</Label>
                  <Input 
                    id="width" 
                    placeholder="Ej: 2.3 m" 
                    value={specifications.dimensions.width}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      dimensions: { ...prev.dimensions, width: e.target.value } 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Altura</Label>
                  <Input 
                    id="height" 
                    placeholder="Ej: 3.1 m" 
                    value={specifications.dimensions.height}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      dimensions: { ...prev.dimensions, height: e.target.value } 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Peso</Label>
                  <Input 
                    id="weight" 
                    placeholder="Ej: 5000 kg" 
                    value={specifications.dimensions.weight}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      dimensions: { ...prev.dimensions, weight: e.target.value } 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacidad</Label>
                  <Input 
                    id="capacity" 
                    placeholder="Ej: 2.5 m³" 
                    value={specifications.dimensions.capacity}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      dimensions: { ...prev.dimensions, capacity: e.target.value } 
                    }))}
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
                    value={specifications.performance.maxSpeed}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      performance: { ...prev.performance, maxSpeed: e.target.value } 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxLoad">Carga Máxima</Label>
                  <Input 
                    id="maxLoad" 
                    placeholder="Ej: 10000 kg" 
                    value={specifications.performance.maxLoad}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      performance: { ...prev.performance, maxLoad: e.target.value } 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productivity">Productividad</Label>
                  <Input 
                    id="productivity" 
                    placeholder="Ej: 50 m³/h" 
                    value={specifications.performance.productivity}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      performance: { ...prev.performance, productivity: e.target.value } 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="operatingHours">Horas de Operación Recomendadas</Label>
                  <Input 
                    id="operatingHours" 
                    placeholder="Ej: 8000 h/año" 
                    value={specifications.performance.operatingHours}
                    onChange={(e) => setSpecifications(prev => ({ 
                      ...prev, 
                      performance: { ...prev.performance, operatingHours: e.target.value } 
                    }))}
                  />
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
                    <TableHead>{maintenanceUnit === 'kilometers' ? 'Kilómetros' : 'Horas'}</TableHead>
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
                  <Label htmlFor="intervalHours">{maintenanceUnit === 'kilometers' ? 'Kilómetros' : 'Horas'}</Label>
                  <Input
                    id="intervalHours"
                    type="number"
                    placeholder={maintenanceUnit === 'kilometers' ? "Ej: 10000" : "Ej: 500"}
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
                <Input 
                  id="manualUpload" 
                  type="file" 
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileSelect('operationManual', e)}
                />
                {uploadedDocuments.operationManual ? (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Subido</span>
                  </div>
                ) : documentUploads.operationManual ? (
                  <span className="text-sm text-muted-foreground">
                    {documentUploads.operationManual.name}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenanceGuideUpload">Guía de Mantenimiento</Label>
              <div className="flex items-center gap-2">
                <Input 
                  id="maintenanceGuideUpload" 
                  type="file" 
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileSelect('maintenanceGuide', e)}
                />
                {uploadedDocuments.maintenanceGuide ? (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Subido</span>
                  </div>
                ) : documentUploads.maintenanceGuide ? (
                  <span className="text-sm text-muted-foreground">
                    {documentUploads.maintenanceGuide.name}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partsListUpload">Lista de Repuestos</Label>
              <div className="flex items-center gap-2">
                <Input 
                  id="partsListUpload" 
                  type="file" 
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => handleFileSelect('partsList', e)}
                />
                {uploadedDocuments.partsList ? (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Subido</span>
                  </div>
                ) : documentUploads.partsList ? (
                  <span className="text-sm text-muted-foreground">
                    {documentUploads.partsList.name}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          
          {(documentUploads.operationManual || documentUploads.maintenanceGuide || documentUploads.partsList) && (
            <div className="text-sm text-muted-foreground mt-4">
              <p>📄 Los documentos se subirán automáticamente al guardar el modelo.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo para agregar/editar tareas */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isEditingTask ? "Editar Tarea" : "Agregar Nueva Tarea"}</DialogTitle>
            <DialogDescription>
              {isEditingTask
                ? "Modifica los detalles de la tarea de mantenimiento"
                : "Ingresa los detalles de la nueva tarea de mantenimiento"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label htmlFor="taskDescription">Descripción</Label>
              <Textarea
                id="taskDescription"
                placeholder="Ej: Cambio de aceite y filtro"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData((prev) => ({ ...prev, description: e.target.value }))}
                className="min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taskType">Tipo</Label>
                <Select value={taskFormData.type} onValueChange={(value) => setTaskFormData((prev) => ({ ...prev, type: value }))}>
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
                  value={taskFormData.estimatedTime}
                  onChange={(e) =>
                    setTaskFormData((prev) => ({ ...prev, estimatedTime: Number.parseFloat(e.target.value) || 1 }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="requiresSpecialist" checked={taskFormData.requiresSpecialist} onChange={(e) => setTaskFormData((prev) => ({ ...prev, requiresSpecialist: e.target.checked }))} />
              <Label htmlFor="requiresSpecialist">Requiere técnico especialista</Label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Repuestos Requeridos</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentIntervalIndex === null) return

                    // Draft task: mantener ID/partes entre múltiples repuestos antes de guardar la tarea
                    if (!isEditingTask) {
                      const preservedId = currentTask?.id || `task-${Date.now()}`
                      const preservedParts = currentTask?.parts || []
                      setCurrentTask({
                        id: preservedId,
                        description: taskFormData.description,
                        type: taskFormData.type,
                        estimatedTime: taskFormData.estimatedTime,
                        requiresSpecialist: taskFormData.requiresSpecialist,
                        parts: preservedParts,
                      })
                      openPartDialog(currentIntervalIndex, -1)
                      return
                    }

                    // Existing task in intervals
                    if (currentTask) {
                      const taskIndex = maintenanceIntervals[currentIntervalIndex].tasks.findIndex((t) => t.id === currentTask.id)
                      if (taskIndex !== -1) openPartDialog(currentIntervalIndex, taskIndex)
                    }
                  }}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Agregar
                </Button>
              </div>
              <div className="rounded-md border max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Número de Parte</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(currentTask?.parts || []).map((part) => (
                      <PartTableRow
                        key={part.id}
                        part={part}
                        onEdit={() => {
                          if (currentIntervalIndex === null || !currentTask) return
                          if (isEditingTask) {
                            const taskIndex = maintenanceIntervals[currentIntervalIndex].tasks.findIndex((t) => t.id === currentTask.id)
                            if (taskIndex !== -1) openPartDialog(currentIntervalIndex, taskIndex, part)
                          } else {
                            openPartDialog(currentIntervalIndex, -1, part)
                          }
                        }}
                        onDelete={() => {
                          if (currentIntervalIndex === null || !currentTask) return
                          if (isEditingTask) {
                            const taskIndex = maintenanceIntervals[currentIntervalIndex].tasks.findIndex((t) => t.id === currentTask.id)
                            if (taskIndex !== -1) removePart(currentIntervalIndex, taskIndex, part.id)
                          } else {
                            removePart(currentIntervalIndex, -1, part.id)
                          }
                        }}
                      />
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
                // Guardar la tarea con los datos actualizados (preservar repuestos en draft)
                const newTask: MaintenanceTask = {
                  id: currentTask?.id || `task-${Date.now()}`,
                  description: taskFormData.description,
                  type: taskFormData.type,
                  estimatedTime: taskFormData.estimatedTime,
                  requiresSpecialist: taskFormData.requiresSpecialist,
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
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isEditingPart ? "Editar Repuesto" : "Agregar Repuesto"}</DialogTitle>
            <DialogDescription>
              {isEditingPart
                ? "Modifica los detalles del repuesto"
                : "Ingresa los detalles del repuesto requerido para esta tarea"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label htmlFor="partName">Nombre del Repuesto</Label>
              <Input
                id="partName"
                placeholder="Ej: Filtro de aceite"
                value={partFormData.name}
                onChange={(e) => setPartFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partNumber">Número de Parte</Label>
              <Input
                id="partNumber"
                placeholder="Ej: FO-1234"
                value={partFormData.partNumber}
                onChange={(e) => setPartFormData((prev) => ({ ...prev, partNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partQuantity">Cantidad</Label>
              <Input
                id="partQuantity"
                type="number"
                min="1"
                value={partFormData.quantity}
                onChange={(e) => setPartFormData((prev) => ({ ...prev, quantity: Number.parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partCost">Costo Unitario ($)</Label>
              <Input
                id="partCost"
                placeholder="Ej: 25.50"
                value={partFormData.cost}
                onChange={(e) => setPartFormData((prev) => ({ ...prev, cost: e.target.value }))}
              />
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
                  name: partFormData.name,
                  partNumber: partFormData.partNumber,
                  quantity: partFormData.quantity,
                  cost: partFormData.cost,
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
