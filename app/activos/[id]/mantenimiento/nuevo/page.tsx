'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ArrowLeft, PlusCircle, Minus, Check, Loader2, Wrench, Clock, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { useAsset } from "@/hooks/useSupabase";
import { createClient } from "@/lib/supabase";

interface MaintenancePart {
  name: string;
  partNumber?: string;
  quantity: number;
  cost?: string;
  source?: string;
}

// Add this interface to properly type the maintenance plan data
interface MaintenanceInterval {
  id: string;
  model_id: string | null;
  interval_value: number;
  hours?: number;
  days?: number;
  name: string;
  description: string | null;
  type: string;
  estimated_duration: number | null;
  created_at: string;
  updated_at: string;
  maintenance_tasks: MaintenanceTask[];
}

interface MaintenanceTask {
  id: string;
  description: string;
  task_parts: TaskPart[];
}

interface TaskPart {
  id: string;
  name: string;
  part_number?: string;
  quantity: number;
  cost?: string;
}

interface NewMaintenancePageProps {
  params: {
    id: string;
  };
}

export default function NewMaintenancePage({ params }: NewMaintenancePageProps) {
  const assetId = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('planId');
  const { toast } = useToast();
  
  const { asset, loading: assetLoading, error: assetError } = useAsset(assetId);
  
  const [date, setDate] = useState<Date>(new Date());
  const [type, setType] = useState<string>("Preventivo");
  const [hours, setHours] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [findings, setFindings] = useState<string>("");
  const [actions, setActions] = useState<string>("");
  const [technician, setTechnician] = useState<string>("");
  const [laborHours, setLaborHours] = useState<string>("");
  const [laborCost, setLaborCost] = useState<string>("");
  const [totalCost, setTotalCost] = useState<string>("");
  const [workOrder, setWorkOrder] = useState<string>("");
  const [parts, setParts] = useState<MaintenancePart[]>([]);
  
  const [newPartName, setNewPartName] = useState<string>("");
  const [newPartNumber, setNewPartNumber] = useState<string>("");
  const [newPartQuantity, setNewPartQuantity] = useState<string>("1");
  const [newPartCost, setNewPartCost] = useState<string>("");
  
  const [maintenancePlan, setMaintenancePlan] = useState<any>(null);
  const [maintenanceStatus, setMaintenanceStatus] = useState<{
    isOverdue: boolean;
    isPending: boolean;
    daysOverdue?: number;
    hoursOverdue?: number;
    progress: number;
    lastMaintenanceDate?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Cargar el plan de mantenimiento si se proporcionó un ID
  useEffect(() => {
    async function fetchMaintenancePlan() {
      if (!planId) return;
      
      try {
        setLoading(true);
        const supabase = createClient();
        
        // Obtener el plan de mantenimiento
        const { data: planData, error: planError } = await supabase
          .from("maintenance_intervals")
          .select(`
            *,
            maintenance_tasks(
              *,
              task_parts(*)
            )
          `)
          .eq("id", planId)
          .single();
          
        if (planError) throw planError;
        
        setMaintenancePlan(planData);
        
        // Obtener el último mantenimiento de este tipo
        const { data: lastMaintenanceData, error: historyError } = await supabase
          .from("maintenance_history")
          .select("*")
          .eq("maintenance_plan_id", planId)
          .eq("asset_id", assetId)
          .order("date", { ascending: false })
          .limit(1);
          
        if (historyError) {
          console.error("Error al cargar el último mantenimiento:", historyError);
          // No lanzar error, continuar con el flujo
        }
        
        // Calcular el estado del mantenimiento
        if (planData && asset) {
          const lastMaintenance = lastMaintenanceData && lastMaintenanceData.length > 0 ? lastMaintenanceData[0] : null;
          let lastMaintenanceHours = 0;
          let lastMaintenanceDate = asset.last_maintenance_date;
          
          if (lastMaintenance) {
            lastMaintenanceHours = Number(lastMaintenance.hours) || 0;
            lastMaintenanceDate = lastMaintenance.date;
          }
          
          // Calcular próximo mantenimiento por horas
          const interval = planData.interval_value || 0;
          const nextHours = lastMaintenanceHours + interval;
          
          // Calcular si está pendiente o vencido
          const currentHours = asset.current_hours || 0;
          const hoursOverdue = currentHours - nextHours;
          const isHoursOverdue = hoursOverdue >= 0;
          
          // Calcular días si hay intervalo por días
          let daysOverdue = 0;
          let isDaysOverdue = false;
          // Uncomment this if you have a days_interval field
          /*if (planData.days_interval && lastMaintenanceDate) {
            const daysSinceLastMaintenance = differenceInDays(
              new Date(), 
              new Date(lastMaintenanceDate)
            );
            daysOverdue = daysSinceLastMaintenance - planData.days_interval;
            isDaysOverdue = daysOverdue >= 0;
          }*/
          
          // Calcular el progreso
          let progress = 0;
          if (currentHours && lastMaintenanceHours && interval > 0) {
            const hoursDiff = currentHours - lastMaintenanceHours;
            progress = Math.min(Math.round((hoursDiff / interval) * 100), 100);
          }
          
          setMaintenanceStatus({
            isOverdue: isHoursOverdue /* || isDaysOverdue */,
            isPending: progress >= 90,
            hoursOverdue: isHoursOverdue ? hoursOverdue : undefined,
            // daysOverdue: isDaysOverdue ? daysOverdue : undefined,
            progress,
            lastMaintenanceDate: lastMaintenanceDate || undefined
          });
        }
        
        // Prellenar campos basados en el plan
        if (planData) {
          setType("Preventivo");
          setDescription(planData.description || "");
          // Establecer horas a las horas actuales del activo
          if (asset?.current_hours) {
            setHours(asset.current_hours.toString());
          }
          
          // Cargar los repuestos asociados a las tareas de mantenimiento
          if (planData.maintenance_tasks && planData.maintenance_tasks.length > 0) {
            const taskParts: MaintenancePart[] = [];
            
            planData.maintenance_tasks.forEach(task => {
              if (task.task_parts && task.task_parts.length > 0) {
                task.task_parts.forEach(part => {
                  taskParts.push({
                    name: part.name,
                    partNumber: part.part_number || undefined,
                    quantity: part.quantity,
                    cost: part.cost || undefined,
                    source: 'Tarea de Mantenimiento'
                  });
                });
              }
            });
            
            if (taskParts.length > 0) {
              setParts(taskParts);
            }
          }
        }
      } catch (err) {
        console.error("Error al cargar el plan de mantenimiento:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }
    
    if (planId) {
      fetchMaintenancePlan();
    }
  }, [planId, asset, assetId]);
  
  const addPart = () => {
    if (!newPartName || !newPartQuantity) return;
    
    const quantity = parseInt(newPartQuantity);
    if (isNaN(quantity) || quantity <= 0) return;
    
    setParts([
      ...parts,
      {
        name: newPartName,
        partNumber: newPartNumber || undefined,
        quantity,
        cost: newPartCost || undefined
      }
    ]);
    
    // Limpiar los campos
    setNewPartName("");
    setNewPartNumber("");
    setNewPartQuantity("1");
    setNewPartCost("");
  };
  
  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !type || !technician || !description) {
      toast({
        title: "Campos incompletos",
        description: "Por favor complete todos los campos obligatorios marcados con *",
        variant: "destructive",
      });
      return;
    }

    // Validar que las horas sean coherentes
    if (hours && asset?.current_hours) {
      const enteredHours = Number(hours);
      const currentHours = asset.current_hours;
      
      if (enteredHours < currentHours - 100) {
        toast({
          title: "Horas inconsistentes",
          description: `Las horas ingresadas (${enteredHours}) son muy menores a las actuales (${currentHours}). Verifique el valor.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      setIsSubmitting(true);
      const supabase = createClient();
      
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error("Usuario no autenticado");
      }

      // Paso 1: Crear Orden de Trabajo siguiendo el proceso administrativo correcto
      let workOrderId: string;
      
      if (planId) {
        // Mantenimiento Preventivo - usar función específica que requiere solo asset_id y maintenance_plan_id
        const { data: workOrderData, error: workOrderError } = await supabase.rpc('generate_preventive_work_order', {
          p_asset_id: assetId,
          p_maintenance_plan_id: planId
        });
        
        if (workOrderError) throw workOrderError;
        workOrderId = workOrderData;
      } else {
        // Mantenimiento Correctivo - crear directamente ya que no hay checklist asociado
        const workOrderData = {
          asset_id: assetId,
          description: description,
          type: 'corrective',
          requested_by: user.id,
          assigned_to: user.id,
          planned_date: date.toISOString(),
          estimated_duration: laborHours ? Number(laborHours) : 0,
          priority: 'Media',
          status: 'Pendiente'
        };

        const { data: workOrderResult, error: workOrderError } = await supabase
          .from('work_orders')
          .insert(workOrderData)
          .select('id')
          .single();
        
        if (workOrderError) throw workOrderError;
        workOrderId = workOrderResult.id;
      }

      // Paso 2: Agregar repuestos a la orden de trabajo si hay partes
      if (parts.length > 0) {
        const requiredParts = parts.map(part => ({
          name: part.name,
          part_number: part.partNumber || '',
          quantity: part.quantity,
          unit_price: part.cost ? Number(part.cost) : 0,
          total_price: part.cost ? Number(part.cost) * part.quantity : 0
        }));

        // Actualizar la orden de trabajo con los repuestos requeridos
        const { error: updateError } = await supabase
          .from('work_orders')
          .update({ required_parts: requiredParts })
          .eq('id', workOrderId);

        if (updateError) throw updateError;
      }

      // Paso 3: Completar la Orden de Trabajo - esto genera automáticamente todo lo demás
      const completionData = {
        completion_date: date.toISOString(),
        technician_id: user.id,
        technician_name: technician,
        findings: findings || '',
        actions: actions || '',
        notes: `Registro de mantenimiento ${type.toLowerCase()} realizado`,
        labor_hours: laborHours ? Number(laborHours) : 0,
        labor_cost: laborCost ? Number(laborCost) : 0,
        parts_used: parts.map(part => ({
          name: part.name,
          part_number: part.partNumber || '',
          quantity: part.quantity,
          cost: part.cost ? Number(part.cost) : 0
        })),
        photos: [], // En el futuro se pueden agregar fotos
        asset_hours: hours ? Number(hours) : null,
        asset_kilometers: null,
        created_by: user.id,
        reported_by_id: user.id,
        reported_by_name: technician
      };

      const { data: completionResult, error: completionError } = await supabase.rpc('complete_work_order', {
        p_work_order_id: workOrderId,
        p_completion_data: completionData
      });

      if (completionError) throw completionError;

      toast({
        title: "¡Mantenimiento registrado exitosamente!",
        description: `El mantenimiento ${planId ? 'programado' : 'correctivo'} ha sido procesado siguiendo el flujo administrativo completo. Se ha generado automáticamente la orden de trabajo y orden de servicio correspondientes.`,
      });

      // Redirigir a la página del mantenimiento o a la lista
      if (completionResult) {
        // El resultado debería ser el service_order_id
        router.push(`/activos/${assetId}/mantenimiento`);
      } else {
        router.push(`/activos/${assetId}/mantenimiento`);
      }
      
    } catch (err) {
      console.error("Error al registrar mantenimiento:", err);
      toast({
        title: "Error al registrar mantenimiento",
        description: err instanceof Error ? err.message : "Ha ocurrido un error inesperado en el proceso administrativo",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isLoading = assetLoading || loading;
  const anyError = assetError || error;
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Registrar Mantenimiento"
        text={`Registrar un nuevo mantenimiento para ${asset?.name || ""}`}
      >
        <Button variant="outline" asChild>
          <Link href={`/activos/${assetId}/mantenimiento`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      
      {anyError && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="bg-destructive/15 text-destructive p-4 rounded-md">
              <p className="font-medium">Error: {anyError.message}</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {maintenancePlan && (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Checkpoint de Mantenimiento
                  <Badge 
                    variant="outline" 
                    className="ml-2 whitespace-nowrap"
                  >
                    {maintenancePlan.type}
                    {maintenancePlan.interval_value && ` ${maintenancePlan.interval_value}h`}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Estás registrando el siguiente checkpoint de mantenimiento:
                </CardDescription>
              </div>
              
              {maintenanceStatus && (
                <div>
                  <Badge 
                    variant={maintenanceStatus.isOverdue ? "destructive" : maintenanceStatus.isPending ? "default" : "outline"}
                    className="text-sm px-3 py-1.5"
                  >
                    {maintenanceStatus.isOverdue ? "VENCIDO" : 
                     maintenanceStatus.isPending ? "PENDIENTE" : "PROGRAMADO"}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-md border p-3 space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Nombre del Checkpoint</div>
                  <div className="font-medium">{maintenancePlan.description}</div>
                </div>
                
                <div className="bg-white rounded-md border p-3 space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Frecuencia</div>
                  <div className="font-medium">
                    {maintenancePlan.interval_value && `Cada ${maintenancePlan.interval_value} horas`}
                  </div>
                </div>
                
                <div className="bg-white rounded-md border p-3 space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Tareas Incluidas</div>
                  <div className="font-medium">
                    {maintenancePlan.maintenance_tasks?.length || 0} tareas / {parts.length} repuestos
                  </div>
                </div>
              </div>
              
              {maintenanceStatus && (
                <div className="bg-white rounded-md border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Estado del Mantenimiento</div>
                    <div className="text-sm">
                      {maintenanceStatus.progress}% completado
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                    <div 
                      className={`h-2.5 rounded-full ${
                        maintenanceStatus.progress >= 100 ? 'bg-red-600' : 
                        maintenanceStatus.progress >= 90 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(maintenanceStatus.progress, 100)}%` }}
                    ></div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-2">
                    Horas actuales: {asset?.current_hours || 0}h
                  </div>
                  
                  {maintenanceStatus.lastMaintenanceDate && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                      <Clock className="h-4 w-4" />
                      Último mantenimiento: {formatDate(maintenanceStatus.lastMaintenanceDate)}
                    </div>
                  )}
                  
                  {maintenanceStatus.isOverdue && (
                    <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {maintenanceStatus.hoursOverdue !== undefined && (
                        <span>¡Mantenimiento vencido por {maintenanceStatus.hoursOverdue} horas!</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Información del Mantenimiento</CardTitle>
            <CardDescription>
              Registre los detalles del mantenimiento realizado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="date">Fecha de Realización *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      {date ? (
                        format(date, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(date) => date && setDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Mantenimiento *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Preventivo">Preventivo</SelectItem>
                    <SelectItem value="Correctivo">Correctivo</SelectItem>
                    <SelectItem value="Predictivo">Predictivo</SelectItem>
                    <SelectItem value="Mejora">Mejora</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="technician">Técnico Responsable *</Label>
                <Input
                  id="technician"
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  placeholder="Nombre del técnico"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="hours">Horómetro al Momento del Mantenimiento</Label>
                <Input
                  id="hours"
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder={`Horas actuales: ${asset?.current_hours || 0}`}
                />
                <p className="text-xs text-muted-foreground">
                  Registre las horas del equipo al momento de realizar el mantenimiento
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="workOrder">Orden de Trabajo</Label>
                <Input
                  id="workOrder"
                  value={workOrder}
                  onChange={(e) => setWorkOrder(e.target.value)}
                  placeholder="Número de orden de trabajo"
                />
                <p className="text-xs text-muted-foreground">
                  Número de referencia interno (opcional)
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descripción del Trabajo Realizado *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describa detalladamente el mantenimiento realizado..."
                rows={3}
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="findings">Hallazgos y Observaciones</Label>
                <Textarea
                  id="findings"
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Condiciones encontradas, desgastes, problemas identificados..."
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="actions">Acciones Correctivas Realizadas</Label>
                <Textarea
                  id="actions"
                  value={actions}
                  onChange={(e) => setActions(e.target.value)}
                  placeholder="Reparaciones, ajustes, calibraciones realizadas..."
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Información de Costos y Tiempos</CardTitle>
            <CardDescription>
              Registre los recursos utilizados (opcional pero recomendado)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="laborHours">Horas de Mano de Obra</Label>
                <Input
                  id="laborHours"
                  type="number"
                  step="0.5"
                  value={laborHours}
                  onChange={(e) => setLaborHours(e.target.value)}
                  placeholder="ej: 2.5"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="laborCost">Costo de Mano de Obra ($)</Label>
                <Input
                  id="laborCost"
                  type="number"
                  step="0.01"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="totalCost">Costo Total ($)</Label>
                <Input
                  id="totalCost"
                  type="number"
                  step="0.01"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Incluye mano de obra + repuestos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />
              Repuestos y Materiales Utilizados
            </CardTitle>
            <CardDescription>
              Registre los repuestos y materiales utilizados durante el mantenimiento
              {maintenancePlan && parts.length > 0 && (
                <span className="block mt-1 text-sm text-blue-600">
                  ✓ Se han cargado automáticamente los repuestos del plan de mantenimiento
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {parts.length > 0 ? (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium">Repuesto/Material</th>
                        <th className="text-left py-3 px-4 font-medium">Número de Parte</th>
                        <th className="text-left py-3 px-4 font-medium">Cantidad</th>
                        <th className="text-left py-3 px-4 font-medium">Costo Unitario</th>
                        <th className="text-left py-3 px-4 font-medium">Origen</th>
                        <th className="text-left py-3 px-4 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((part, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{part.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{part.partNumber || "-"}</td>
                          <td className="py-3 px-4">{part.quantity}</td>
                          <td className="py-3 px-4">{part.cost ? `$${part.cost}` : "-"}</td>
                          <td className="py-3 px-4">
                            {part.source ? (
                              <Badge variant="outline" className="text-xs">
                                {part.source}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">Manual</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => removePart(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 border rounded-lg bg-gray-50">
                <PlusCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p className="text-lg font-medium text-gray-600">No se han registrado repuestos</p>
                <p className="text-muted-foreground">Agregue los repuestos utilizados en este mantenimiento</p>
              </div>
            )}
            
            <div className="mt-6 p-4 border rounded-lg bg-blue-50">
              <h4 className="font-medium mb-4 text-blue-900">Agregar Nuevo Repuesto</h4>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 items-end">
                <div className="sm:col-span-2">
                  <Label htmlFor="newPartName">Nombre del Repuesto *</Label>
                  <Input
                    id="newPartName"
                    value={newPartName}
                    onChange={(e) => setNewPartName(e.target.value)}
                    placeholder="ej: Filtro de aceite"
                  />
                </div>
                <div>
                  <Label htmlFor="newPartNumber">Número de Parte</Label>
                  <Input
                    id="newPartNumber"
                    value={newPartNumber}
                    onChange={(e) => setNewPartNumber(e.target.value)}
                    placeholder="ej: ABC123"
                  />
                </div>
                <div>
                  <Label htmlFor="newPartQuantity">Cantidad *</Label>
                  <Input
                    id="newPartQuantity"
                    type="number"
                    min="1"
                    value={newPartQuantity}
                    onChange={(e) => setNewPartQuantity(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="newPartCost">Costo ($)</Label>
                  <Input
                    id="newPartCost"
                    type="number"
                    step="0.01"
                    value={newPartCost}
                    onChange={(e) => setNewPartCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Button
                    type="button"
                    onClick={addPart}
                    disabled={!newPartName || !newPartQuantity}
                    className="w-full"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> 
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mt-6">
          <CardFooter className="flex justify-between pt-6">
            <Button variant="outline" type="button" asChild>
              <Link href={`/activos/${assetId}/mantenimiento`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancelar
              </Link>
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || isLoading}
              className="min-w-[160px]"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Registrar Mantenimiento
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </DashboardShell>
  );
} 