"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, CalendarCheck, CheckCircle, Clock, CalendarIcon } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import Link from "next/link"
import { MaintenanceType, ServiceOrderPriority, WorkOrderStatus, WorkOrderComplete } from "@/types"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// Date picker component
function DatePicker({ date, setDate }: { date: Date | undefined, setDate: (date: Date | undefined) => void }) {
  return (
    <div className="grid gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
            locale={es}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Schema for work order completion
const workOrderCompletionSchema = z.object({
  completion_date: z.date({
    required_error: "La fecha de finalización es requerida",
  }),
  completion_time: z.string().min(1, "La hora de finalización es requerida"),
  downtime_hours: z.coerce.number().min(0, "Las horas de inactividad no pueden ser negativas"),
  technician_notes: z.string().optional(),
  resolution_details: z.string().min(1, "Los detalles de resolución son requeridos"),
  parts_used: z.array(
    z.object({
      part_id: z.string(),
      quantity: z.coerce.number().int().min(1),
      unit_price: z.coerce.number().min(0),
      total_price: z.coerce.number().min(0),
    })
  ).optional(),
  labor_hours: z.coerce.number().min(0, "Las horas de trabajo no pueden ser negativas"),
  labor_cost: z.coerce.number().min(0, "El costo de mano de obra no puede ser negativo"),
  total_cost: z.coerce.number().min(0, "El costo total no puede ser negativo"),
})

type WorkOrderCompletionFormValues = z.infer<typeof workOrderCompletionSchema>

interface WorkOrderCompletionFormProps {
  workOrderId: string
  initialData?: Partial<WorkOrderComplete>
}

export function WorkOrderCompletionForm({ workOrderId, initialData }: WorkOrderCompletionFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [workOrder, setWorkOrder] = useState<any>(null)
  const [requiredParts, setRequiredParts] = useState<any[]>([])

  // Default form values
  const defaultValues: Partial<WorkOrderCompletionFormValues> = {
    completion_date: initialData?.completion_date ? new Date(initialData.completion_date) : new Date(),
    completion_time: initialData?.completion_time || "",
    downtime_hours: initialData?.downtime_hours || 0,
    technician_notes: initialData?.technician_notes || "",
    resolution_details: initialData?.resolution_details || "",
    labor_hours: initialData?.labor_hours || 0,
    labor_cost: initialData?.labor_cost || 0,
    total_cost: initialData?.total_cost || 0,
    parts_used: [],
  }

  const form = useForm<WorkOrderCompletionFormValues>({
    resolver: zodResolver(workOrderCompletionSchema),
    defaultValues,
    mode: "onChange",
  })

  // Load work order details
  useEffect(() => {
    async function loadWorkOrder() {
      try {
        setIsLoading(true)
        const supabase = createClient()

        // Get work order data
        const { data: orderData, error: orderError } = await supabase
          .from("work_orders")
          .select(`
            *,
            asset:assets (*)
          `)
          .eq("id", workOrderId)
          .single()

        if (orderError) throw orderError
        setWorkOrder(orderData)

        // Parse required parts if they exist
        if (orderData.required_parts) {
          const parts = typeof orderData.required_parts === "string" 
            ? JSON.parse(orderData.required_parts) 
            : orderData.required_parts
          
          setRequiredParts(parts)
          
          // Set parts_used with the required parts
          form.setValue("parts_used", parts.map((part: any) => ({
            part_id: part.part_id,
            quantity: part.quantity,
            unit_price: part.unit_price,
            total_price: part.total_price
          })))
          
          // Calculate total cost including parts
          const partsCost = parts.reduce((sum: number, part: any) => sum + (part.total_price || 0), 0)
          form.setValue("total_cost", partsCost)
        }
      } catch (error) {
        console.error("Error loading work order:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar la orden de trabajo",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkOrder()
  }, [workOrderId, form])

  // Update total cost when labor cost changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "labor_cost" || name === "parts_used") {
        const partsCost = requiredParts.reduce((sum, part) => sum + (part.total_price || 0), 0)
        const laborCost = value.labor_cost || 0
        form.setValue("total_cost", partsCost + laborCost)
      }
    })
    
    return () => subscription.unsubscribe()
  }, [form, requiredParts])

  // Handle form submission
  async function onSubmit(data: WorkOrderCompletionFormValues) {
    try {
      setIsLoading(true)
      
      // Preparar datos para la API
      const formattedData = {
        workOrderId,
        completionData: {
          resolution_details: data.resolution_details,
          technician_notes: data.technician_notes || '',
          downtime_hours: data.downtime_hours || 0,
          labor_hours: data.labor_hours || 0,
          labor_cost: data.labor_cost || 0,
          completion_date: data.completion_date.toISOString(),
          completion_time: data.completion_time
        },
        maintenanceHistoryData: workOrder?.asset?.id ? {
          asset_id: workOrder.asset.id,
          date: data.completion_date.toISOString(),
          type: workOrder.type,
          description: workOrder.description,
          technician_id: workOrder.assigned_to,
          labor_hours: data.labor_hours,
          labor_cost: data.labor_cost.toString(),
          parts: requiredParts.length > 0 ? requiredParts : null,
          total_cost: data.total_cost.toString(),
          work_order_id: workOrderId,
          findings: data.technician_notes || null,
          actions: data.resolution_details
        } : null
      }
      
      // Llamar a la API
      const response = await fetch('/api/maintenance/work-completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al completar la orden de trabajo')
      }
      
      toast({
        title: "Orden completada",
        description: "La orden de trabajo se ha marcado como completada",
      })

      // Redirect to the work order details page
      router.push(`/ordenes/${workOrderId}`)
      router.refresh()
    } catch (error) {
      console.error("Error completing work order:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: typeof error === 'object' && error instanceof Error 
          ? error.message 
          : "No se pudo completar la orden de trabajo",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading && !workOrder) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Cargando orden de trabajo...</p>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Completar Orden de Trabajo</CardTitle>
            <CardDescription>
              Registre los detalles de finalización para la orden {workOrder?.order_id}
            </CardDescription>
          </div>
          <Button variant="outline" size="icon" asChild>
            <Link href={`/ordenes/${workOrderId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="completion_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de finalización</FormLabel>
                    <DatePicker
                      date={field.value}
                      setDate={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="completion_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora de finalización</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="resolution_details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalles de resolución</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalle las acciones realizadas para resolver el problema"
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
              name="technician_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas del técnico</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observaciones adicionales del técnico"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="downtime_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas de inactividad</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="labor_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas de trabajo</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="labor_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo de mano de obra</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-md font-medium">Repuestos utilizados</h3>
                <div className="text-right">
                  <p className="text-md font-medium">Costo total: ${form.watch("total_cost").toFixed(2)}</p>
                </div>
              </div>

              {requiredParts.length > 0 ? (
                <div className="border rounded-md p-4">
                  <div className="grid grid-cols-12 gap-2 font-medium text-sm mb-2">
                    <div className="col-span-5">Repuesto</div>
                    <div className="col-span-2">Cantidad</div>
                    <div className="col-span-2">Precio unit.</div>
                    <div className="col-span-3 text-right">Total</div>
                  </div>
                  
                  {requiredParts.map((part, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 text-sm py-2 border-t">
                      <div className="col-span-5">{part.part_name}</div>
                      <div className="col-span-2">{part.quantity}</div>
                      <div className="col-span-2">${part.unit_price.toFixed(2)}</div>
                      <div className="col-span-3 text-right">${part.total_price.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No hay repuestos registrados para esta orden</p>
              )}
            </div>
            
            <CardFooter className="px-0 pt-4 flex justify-end gap-2">
              <Button variant="outline" asChild>
                <Link href={`/ordenes/${workOrderId}`}>Cancelar</Link>
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Marcar como completada
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
} 