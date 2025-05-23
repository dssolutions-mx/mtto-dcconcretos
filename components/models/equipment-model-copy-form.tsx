'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { createClient } from "@/lib/supabase"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Define interfaces for the data types
interface EquipmentModel {
  id: string
  model_id: string
  name: string
  manufacturer: string
  category: string
  description: string | null
  year_introduced: number | null
  expected_lifespan: number | null
  specifications: any | null
  maintenance_unit: string
  created_at: string
  updated_at: string
}

interface MaintenanceInterval {
  id: string
  model_id: string | null
  interval_value: number
  name: string
  description: string | null
  type: string
  estimated_duration: number | null
  created_at: string
  updated_at: string
}

// Form schema for validation
const formSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  manufacturer: z.string().min(1, "El fabricante es requerido"),
  category: z.string().min(1, "La categoría es requerida"),
  description: z.string().optional(),
  year_introduced: z.string().optional(),
  expected_lifespan: z.string().optional(),
  specifications: z.string().optional(),
  maintenance_unit: z.string().default("hours"),
})

type FormValues = z.infer<typeof formSchema>

export function EquipmentModelCopyForm({ sourceModelId }: { sourceModelId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceModel, setSourceModel] = useState<EquipmentModel | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      manufacturer: "",
      category: "",
      description: "",
      year_introduced: "",
      expected_lifespan: "",
      specifications: "",
      maintenance_unit: "hours",
    },
  })

  // Load the source model data
  useEffect(() => {
    const fetchSourceModel = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const supabase = createClient()
        
        // Fetch the model details
        const { data: model, error: modelError } = await supabase
          .from('equipment_models')
          .select('*')
          .eq('id', sourceModelId)
          .single()
          
        if (modelError) throw modelError
        if (!model) throw new Error('Modelo no encontrado')
        
        setSourceModel(model as EquipmentModel)
        
        // Pre-fill the form with the source model data, suggesting it's a copy
        form.reset({
          name: `${model.name} (Copia)`,
          manufacturer: model.manufacturer,
          category: model.category,
          description: model.description || "",
          year_introduced: model.year_introduced?.toString() || "",
          expected_lifespan: model.expected_lifespan?.toString() || "",
          specifications: model.specifications ? JSON.stringify(model.specifications) : "",
          maintenance_unit: model.maintenance_unit,
        })
        
      } catch (err: any) {
        console.error("Error loading source model:", err)
        setError(err.message || 'Error al cargar el modelo original')
      } finally {
        setLoading(false)
      }
    }
    
    fetchSourceModel()
  }, [sourceModelId, form])

  async function onSubmit(values: FormValues) {
    setLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()
      
      // Generate a model_id if needed
      // We'll use a simple format based on manufacturer + name
      const modelIdBase = `${values.manufacturer.substring(0, 3)}-${values.name.substring(0, 3)}`.toUpperCase()
      const timestamp = new Date().getTime().toString().substring(9, 13)
      const model_id = `${modelIdBase}-${timestamp}`
      
      // Parse numeric fields
      const year_introduced = values.year_introduced ? parseInt(values.year_introduced) : null
      const expected_lifespan = values.expected_lifespan ? parseInt(values.expected_lifespan) : null
      
      // Parse specifications JSON if provided
      let specifications = null
      if (values.specifications) {
        try {
          specifications = JSON.parse(values.specifications)
        } catch (e) {
          // If not valid JSON, store as a string in an object
          specifications = { text: values.specifications }
        }
      }
      
      // 1. Create the new model
      const { data: newModel, error: createError } = await supabase
        .from('equipment_models')
        .insert({
          model_id,
          name: values.name,
          manufacturer: values.manufacturer,
          category: values.category,
          description: values.description || null,
          year_introduced,
          expected_lifespan,
          specifications,
          maintenance_unit: values.maintenance_unit,
        })
        .select()
        .single()
      
      if (createError) throw createError
      if (!newModel) throw new Error('Error al crear el nuevo modelo')
      
      // 2. Copy maintenance intervals if available
      if (sourceModel) {
        const { data: intervals, error: intervalsError } = await supabase
          .from('maintenance_intervals')
          .select('*')
          .eq('model_id', sourceModelId)
        
        if (intervalsError) throw intervalsError
        
        if (intervals && intervals.length > 0) {
          // Create new intervals for the copied model
          const newIntervals = intervals.map((interval: MaintenanceInterval) => ({
            model_id: newModel.id,
            interval_value: interval.interval_value,
            name: interval.name,
            description: interval.description,
            type: interval.type,
            estimated_duration: interval.estimated_duration,
          }))
          
          const { data: createdIntervals, error: insertError } = await supabase
            .from('maintenance_intervals')
            .insert(newIntervals)
            .select()
          
          if (insertError) throw insertError
          
          // Copy maintenance tasks for each interval
          if (createdIntervals && createdIntervals.length > 0) {
            // Create a mapping between old interval IDs and new interval IDs
            const intervalMapping: Record<string, string> = {}
            intervals.forEach((oldInterval, index) => {
              if (createdIntervals[index]) {
                intervalMapping[oldInterval.id] = createdIntervals[index].id
              }
            })
            
            // Get all tasks for the source intervals
            const intervalIds = intervals.map(interval => interval.id)
            const { data: tasks, error: tasksError } = await supabase
              .from('maintenance_tasks')
              .select('*')
              .in('interval_id', intervalIds)
            
            if (tasksError) throw tasksError
            
            if (tasks && tasks.length > 0) {
              // Create new tasks mapped to the new intervals
              const newTasks: {
                interval_id: string;
                description: string;
                type: string;
                estimated_time: number | null;
                requires_specialist: boolean | null;
              }[] = [];
              
              // Map tasks to their new intervals
              tasks.forEach(task => {
                if (task.interval_id && intervalMapping[task.interval_id]) {
                  newTasks.push({
                    interval_id: intervalMapping[task.interval_id],
                    description: task.description,
                    type: task.type,
                    estimated_time: task.estimated_time,
                    requires_specialist: task.requires_specialist
                  });
                }
              });
              
              if (newTasks.length > 0) {
                const { data: createdTasks, error: insertTasksError } = await supabase
                  .from('maintenance_tasks')
                  .insert(newTasks)
                  .select()
                
                if (insertTasksError) throw insertTasksError
                
                // Create a mapping between old task IDs and new task IDs
                if (createdTasks && createdTasks.length > 0) {
                  const taskMapping: Record<string, string> = {}
                  tasks.forEach((oldTask, index) => {
                    if (createdTasks[index]) {
                      taskMapping[oldTask.id] = createdTasks[index].id
                    }
                  })
                  
                  // Get all task_parts for the source tasks
                  const taskIds = tasks.map(task => task.id)
                  const { data: taskParts, error: taskPartsError } = await supabase
                    .from('task_parts')
                    .select('*')
                    .in('task_id', taskIds)
                  
                  if (taskPartsError) throw taskPartsError
                  
                  if (taskParts && taskParts.length > 0) {
                    // Create new task_parts mapped to the new tasks
                    const newTaskParts = taskParts
                      .filter(part => part.task_id && taskMapping[part.task_id])
                      .map(part => ({
                        task_id: taskMapping[part.task_id!],
                        name: part.name,
                        part_number: part.part_number,
                        quantity: part.quantity,
                        cost: part.cost
                      }))
                    
                    if (newTaskParts.length > 0) {
                      const { error: insertPartsError } = await supabase
                        .from('task_parts')
                        .insert(newTaskParts)
                      
                      if (insertPartsError) throw insertPartsError
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // Redirect to the new model page
      router.push(`/modelos/${newModel.id}`)
      
    } catch (err: any) {
      console.error("Error copying model:", err)
      setError(err.message || 'Error al copiar el modelo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="manufacturer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fabricante</FormLabel>
                  <FormControl>
                    <Input placeholder="Ingrese el fabricante" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Modelo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ingrese el nombre del modelo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Excavadora, Generador" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="year_introduced"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Año de Introducción</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 2023" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="expected_lifespan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vida Útil Esperada (años)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: 10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="maintenance_unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidad de Mantenimiento</FormLabel>
                  <FormControl>
                    <Input placeholder="hours/kilometers" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Descripción general del modelo de equipo"
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="specifications"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Especificaciones Técnicas</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Especificaciones técnicas detalladas del modelo (JSON o texto)"
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <Button type="submit" disabled={loading}>
            {loading ? "Copiando..." : "Copiar Modelo"}
          </Button>
        </form>
      </Form>
    </div>
  )
} 