'use client';

import { useState, useEffect, use } from 'react';
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
import { CalendarIcon, ArrowLeft, PlusCircle, Minus, Check, Loader2, Wrench, Clock, AlertTriangle, Camera, FileText, ClipboardList, DollarSign, Calendar as CalendarPlanIcon, AlertCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { useAsset } from "@/hooks/useSupabase";
import { createClient } from "@/lib/supabase";
import { EvidenceUpload, type EvidencePhoto } from "@/components/ui/evidence-upload";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MaintenancePart {
  name: string;
  partNumber?: string;
  quantity: number;
  estimatedCost?: string;
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
  params: Promise<{
    id: string;
  }>;
}

export default function NewMaintenancePage({ params }: NewMaintenancePageProps) {
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('planId');
  const { toast } = useToast();
  
  const { asset, loading: assetLoading, error: assetError } = useAsset(assetId);
  
  // Planning-focused state variables
  const [plannedDate, setPlannedDate] = useState<Date>(new Date());
  const [maintenanceType, setMaintenanceType] = useState<string>("Preventivo");
  const [proposedTechnician, setProposedTechnician] = useState<string>("");
  const [workDescription, setWorkDescription] = useState<string>("");
  const [workScope, setWorkScope] = useState<string>("");
  const [estimatedDuration, setEstimatedDuration] = useState<string>("");
  const [estimatedLaborCost, setEstimatedLaborCost] = useState<string>("");
  const [estimatedTotalCost, setEstimatedTotalCost] = useState<string>("");
  const [priority, setPriority] = useState<string>("Media");
  const [requiredParts, setRequiredParts] = useState<MaintenancePart[]>([]);
  
  // New part form state
  const [newPartName, setNewPartName] = useState<string>("");
  const [newPartNumber, setNewPartNumber] = useState<string>("");
  const [newPartQuantity, setNewPartQuantity] = useState<string>("1");
  const [newPartEstimatedCost, setNewPartEstimatedCost] = useState<string>("");
  
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
  
  // Evidence state for planning documentation
  const [planningDocuments, setPlanningDocuments] = useState<EvidencePhoto[]>([]);
  const [showDocumentsDialog, setShowDocumentsDialog] = useState(false);
  
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
          
          // Calcular el progreso
          let progress = 0;
          if (currentHours && lastMaintenanceHours && interval > 0) {
            const hoursDiff = currentHours - lastMaintenanceHours;
            progress = Math.min(Math.round((hoursDiff / interval) * 100), 100);
          }
          
          setMaintenanceStatus({
            isOverdue: isHoursOverdue,
            isPending: progress >= 90,
            hoursOverdue: isHoursOverdue ? hoursOverdue : undefined,
            progress,
            lastMaintenanceDate: lastMaintenanceDate || undefined
          });
        }
        
        // Pre-rellenar campos basados en el plan
        if (planData) {
          setMaintenanceType("Preventivo");
          setWorkDescription(planData.description || "");
          
          // Establecer duración estimada si está disponible
          if (planData.estimated_duration) {
            setEstimatedDuration(planData.estimated_duration.toString());
          }
          
          // Cargar los repuestos requeridos de las tareas de mantenimiento
          if (planData.maintenance_tasks && planData.maintenance_tasks.length > 0) {
            const taskParts: MaintenancePart[] = [];
            
            planData.maintenance_tasks.forEach((task: MaintenanceTask) => {
              if (task.task_parts && task.task_parts.length > 0) {
                task.task_parts.forEach((part: TaskPart) => {
                  taskParts.push({
                    name: part.name,
                    partNumber: part.part_number || undefined,
                    quantity: part.quantity,
                    estimatedCost: part.cost || undefined,
                    source: 'Plan de Mantenimiento'
                  });
                });
              }
            });
            
            if (taskParts.length > 0) {
              setRequiredParts(taskParts);
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
    
    setRequiredParts([
      ...requiredParts,
      {
        name: newPartName,
        partNumber: newPartNumber || undefined,
        quantity,
        estimatedCost: newPartEstimatedCost || undefined
      }
    ]);
    
    // Limpiar los campos
    setNewPartName("");
    setNewPartNumber("");
    setNewPartQuantity("1");
    setNewPartEstimatedCost("");
  };
  
  const removePart = (index: number) => {
    setRequiredParts(requiredParts.filter((_, i) => i !== index));
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };
  
  const calculateEstimatedTotalCost = () => {
    const laborCost = Number(estimatedLaborCost) || 0;
    const partsCost = requiredParts.reduce((total, part) => {
      const cost = Number(part.estimatedCost) || 0;
      return total + (cost * part.quantity);
    }, 0);
    
    const total = laborCost + partsCost;
    setEstimatedTotalCost(total.toFixed(2));
  };
  
  useEffect(() => {
    calculateEstimatedTotalCost();
  }, [estimatedLaborCost, requiredParts]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!plannedDate || !maintenanceType || !proposedTechnician || !workDescription) {
      toast({
        title: "Campos incompletos",
        description: "Por favor complete todos los campos obligatorios marcados con *",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      const supabase = createClient();
      
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error("Usuario no autenticado");
      }

      const workOrderData = {
        asset_id: assetId,
        description: workDescription,
        scope: workScope || null,
        type: planId ? 'preventive' : 'corrective',
        requested_by: user.id,
        assigned_to: user.id,
        planned_date: plannedDate.toISOString(),
        estimated_duration: estimatedDuration ? Number(estimatedDuration) : 0,
        priority: priority,
        status: 'Pendiente',
        maintenance_plan_id: planId || null,
        estimated_cost: estimatedTotalCost ? Number(estimatedTotalCost) : 0,
        creation_photos: planningDocuments.length > 0 ? planningDocuments.map(doc => ({
          url: doc.url,
          description: doc.description,
          category: doc.category,
          uploaded_at: doc.uploaded_at,
          bucket_path: doc.bucket_path
        })) : []
      };

      const { data: workOrderResult, error: workOrderError } = await supabase
        .from('work_orders')
        .insert(workOrderData)
        .select('id, order_id')
        .single();
      
      if (workOrderError) throw workOrderError;

      // Agregar repuestos requeridos a la orden de trabajo
      if (requiredParts.length > 0) {
        const partsData = requiredParts.map(part => ({
          name: part.name,
          part_number: part.partNumber || '',
          quantity: part.quantity,
          unit_price: part.estimatedCost ? Number(part.estimatedCost) : 0,
          total_price: part.estimatedCost ? Number(part.estimatedCost) * part.quantity : 0
        }));

        const { error: updateError } = await supabase
          .from('work_orders')
          .update({ required_parts: partsData })
          .eq('id', workOrderResult.id);

        if (updateError) throw updateError;
      }

      toast({
        title: "¡Orden de Trabajo programada exitosamente!",
        description: `Se ha generado la Orden de Trabajo ${workOrderResult.order_id} para mantenimiento ${planId ? 'preventivo' : 'correctivo'}. La orden está programada para ${format(plannedDate, "dd/MM/yyyy")} y lista para generar órdenes de compra si es necesario.`,
      });

      // Redirigir a la vista de órdenes de trabajo
      router.push(`/ordenes`);
      
    } catch (err) {
      console.error("Error al programar mantenimiento:", err);
      toast({
        title: "Error al programar mantenimiento",
        description: err instanceof Error ? err.message : "Ha ocurrido un error inesperado en el proceso de programación",
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
        heading="Programar Mantenimiento"
        text={`Crear orden de trabajo y programar mantenimiento para ${asset?.name || ""}`}
      >
        <Button variant="outline" asChild>
          <Link href={`/activos/${assetId}/mantenimiento`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      
      {/* Planning Stage Indicator */}
      <Alert className="mb-6 border-blue-200 bg-blue-50">
        <CalendarPlanIcon className="h-4 w-4" />
        <AlertDescription className="text-blue-800">
          <strong>Etapa de Planificación:</strong> Está programando una orden de trabajo. 
          Esta información se utilizará para coordinar disponibilidad del equipo, generar órdenes de compra y calcular costos antes de la ejecución.
        </AlertDescription>
      </Alert>
      
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
                  Plan de Mantenimiento Programado
                  <Badge 
                    variant="outline" 
                    className="ml-2 whitespace-nowrap"
                  >
                    {maintenancePlan.type}
                    {maintenancePlan.interval_value && ` ${maintenancePlan.interval_value}h`}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Está programando el siguiente mantenimiento preventivo:
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
                  <div className="text-sm font-medium text-muted-foreground">Descripción del Plan</div>
                  <div className="font-medium">{maintenancePlan.description}</div>
                </div>
                
                <div className="bg-white rounded-md border p-3 space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Frecuencia</div>
                  <div className="font-medium">
                    {maintenancePlan.interval_value && `Cada ${maintenancePlan.interval_value} horas`}
                  </div>
                </div>
                
                <div className="bg-white rounded-md border p-3 space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Recursos Requeridos</div>
                  <div className="font-medium">
                    {maintenancePlan.maintenance_tasks?.length || 0} tareas / {requiredParts.length} repuestos
                  </div>
                </div>
              </div>
              
              {maintenanceStatus && (
                <div className="bg-white rounded-md border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Estado del Mantenimiento</div>
                    <div className="text-sm">
                      {maintenanceStatus.progress}% del intervalo completado
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
                    Horas actuales del equipo: {asset?.current_hours || 0}h
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
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Información de Programación
            </CardTitle>
            <CardDescription>
              Configure la programación y recursos necesarios para la orden de trabajo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="plannedDate">Fecha Programada *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !plannedDate && "text-muted-foreground"
                      )}
                    >
                      {plannedDate ? (
                        format(plannedDate, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={plannedDate}
                      onSelect={(date) => date && setPlannedDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Fecha tentativa cuando se realizará el mantenimiento
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maintenanceType">Tipo de Mantenimiento *</Label>
                <Select value={maintenanceType} onValueChange={setMaintenanceType}>
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
                <Label htmlFor="priority">Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baja">Baja</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Crítica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="proposedTechnician">Técnico Propuesto *</Label>
                <Input
                  id="proposedTechnician"
                  value={proposedTechnician}
                  onChange={(e) => setProposedTechnician(e.target.value)}
                  placeholder="Nombre del técnico asignado"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Técnico responsable propuesto para ejecutar el trabajo
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="estimatedDuration">Duración Estimada (horas)</Label>
                <Input
                  id="estimatedDuration"
                  type="number"
                  step="0.5"
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(e.target.value)}
                  placeholder="ej: 4.5"
                />
                <p className="text-xs text-muted-foreground">
                  Tiempo estimado para completar el mantenimiento
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="workDescription">Descripción del Trabajo Planificado *</Label>
              <Textarea
                id="workDescription"
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Describa el trabajo de mantenimiento a realizar..."
                rows={3}
                required
              />
              <p className="text-xs text-muted-foreground">
                Detalle las actividades y procedimientos planificados
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="workScope">Alcance y Consideraciones Especiales</Label>
              <Textarea
                id="workScope"
                value={workScope}
                onChange={(e) => setWorkScope(e.target.value)}
                placeholder="Incluya requisitos especiales, condiciones de trabajo, coordinaciones necesarias..."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Información adicional para la planificación y coordinación
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Estimación de Costos
            </CardTitle>
            <CardDescription>
              Calcule los costos estimados para generar órdenes de compra y presupuestos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="estimatedLaborCost">Costo Estimado de Mano de Obra ($)</Label>
                <Input
                  id="estimatedLaborCost"
                  type="number"
                  step="0.01"
                  value={estimatedLaborCost}
                  onChange={(e) => setEstimatedLaborCost(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Incluye técnicos, horas extras, especialistas
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="estimatedTotalCost">Costo Total Estimado ($)</Label>
                <Input
                  id="estimatedTotalCost"
                  type="number"
                  step="0.01"
                  value={estimatedTotalCost}
                  onChange={(e) => setEstimatedTotalCost(e.target.value)}
                  placeholder="0.00"
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  Calculado automáticamente: mano de obra + repuestos
                </p>
              </div>
              
              <div className="space-y-2 flex flex-col justify-end">
                <Alert className="bg-green-50 border-green-200">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 text-sm">
                    Esta estimación se usará para crear órdenes de compra y solicitar fondos
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />
              Repuestos y Materiales Requeridos
            </CardTitle>
            <CardDescription>
              Especifique los repuestos y materiales necesarios para este mantenimiento
              {maintenancePlan && requiredParts.length > 0 && (
                <span className="block mt-1 text-sm text-blue-600">
                  ✓ Se han cargado automáticamente los repuestos del plan de mantenimiento
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requiredParts.length > 0 ? (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium">Repuesto/Material</th>
                        <th className="text-left py-3 px-4 font-medium">Número de Parte</th>
                        <th className="text-left py-3 px-4 font-medium">Cantidad</th>
                        <th className="text-left py-3 px-4 font-medium">Costo Estimado</th>
                        <th className="text-left py-3 px-4 font-medium">Origen</th>
                        <th className="text-left py-3 px-4 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requiredParts.map((part, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{part.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{part.partNumber || "-"}</td>
                          <td className="py-3 px-4">{part.quantity}</td>
                          <td className="py-3 px-4">{part.estimatedCost ? `$${part.estimatedCost}` : "-"}</td>
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
                <p className="text-lg font-medium text-gray-600">No se han especificado repuestos</p>
                <p className="text-muted-foreground">Agregue los repuestos y materiales necesarios</p>
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
                  <Label htmlFor="newPartEstimatedCost">Costo Estimado ($)</Label>
                  <Input
                    id="newPartEstimatedCost"
                    type="number"
                    step="0.01"
                    value={newPartEstimatedCost}
                    onChange={(e) => setNewPartEstimatedCost(e.target.value)}
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

        {/* Planning Documentation Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documentación de Planificación
            </CardTitle>
            <CardDescription>
              Adjunte documentos de referencia, manuales, diagramas o fotos del estado actual del equipo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Incluya manuales de mantenimiento, diagramas, fotos del estado actual, especificaciones técnicas
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDocumentsDialog(true)}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Agregar Documentos
              </Button>
            </div>

            {planningDocuments.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {planningDocuments.map((doc) => (
                  <Card key={doc.id} className="overflow-hidden">
                    <div className="aspect-video relative bg-muted">
                      {doc.url.includes('image') || doc.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                        <img
                          src={doc.url}
                          alt={doc.description}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 left-2 text-xs"
                      >
                        {doc.category}
                      </Badge>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate">
                        {doc.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {planningDocuments.length === 0 && (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No se han agregado documentos de planificación
                </p>
                <p className="text-xs text-muted-foreground">
                  Opcional: Agregue documentos de referencia para la ejecución
                </p>
              </div>
            )}
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
              className="min-w-[200px]"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Programando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Crear Orden de Trabajo
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <EvidenceUpload
        open={showDocumentsDialog}
        onOpenChange={setShowDocumentsDialog}
        evidence={planningDocuments}
        setEvidence={setPlanningDocuments}
        context="maintenance"
        assetId={assetId}
        title="Documentación de Planificación"
        description="Suba documentos de referencia, manuales, diagramas, fotos del estado actual del equipo y cualquier documentación relevante para la planificación del mantenimiento"
      />
    </DashboardShell>
  );
} 