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
import { CalendarIcon, ArrowLeft, PlusCircle, Minus, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
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
        
        const { data, error } = await supabase
          .from("maintenance_intervals")
          .select(`
            *,
            maintenance_tasks(*)
          `)
          .eq("id", planId)
          .single();
          
        if (error) throw error;
        
        setMaintenancePlan(data);
        // Prellenar campos basados en el plan
        if (data) {
          setType("Preventivo");
          setDescription(data.description || "");
          // Establecer horas a las horas actuales del activo
          if (asset?.current_hours) {
            setHours(asset.current_hours.toString());
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
  }, [planId, asset]);
  
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
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !type || !technician) {
      toast({
        title: "Campos incompletos",
        description: "Por favor complete los campos obligatorios: fecha, tipo y técnico",
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
      
      // Preparar los datos del mantenimiento
      const maintenanceData = {
        asset_id: assetId,
        date: date.toISOString().split('T')[0],
        type,
        hours: hours ? Number(hours) : null,
        description,
        findings: findings || null,
        actions: actions || null,
        technician,
        labor_hours: laborHours ? Number(laborHours) : null,
        labor_cost: laborCost ? laborCost : null,
        total_cost: totalCost ? totalCost : null,
        work_order: workOrder || null,
        parts: parts.length > 0 ? JSON.stringify(parts) : null,
        maintenance_plan_id: planId || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Insertar el registro de mantenimiento
      const { data, error: insertError } = await supabase
        .from("maintenance_history")
        .insert(maintenanceData)
        .select()
        .single();
        
      if (insertError) throw insertError;
      
      // Si se proporcionaron horas, actualizar las horas actuales del activo
      if (hours) {
        const { error: updateError } = await supabase
          .from("assets")
          .update({ 
            current_hours: Number(hours),
            last_maintenance_date: date.toISOString().split('T')[0],
            updated_at: new Date().toISOString() 
          })
          .eq("id", assetId);
          
        if (updateError) {
          console.error("Error al actualizar las horas del activo:", updateError);
          // No lanzar error, seguir con el flujo normal
        }
      }
      
      toast({
        title: "Mantenimiento registrado",
        description: "El mantenimiento ha sido registrado correctamente",
      });
      
      // Redirigir a la página de detalles del mantenimiento
      if (data?.id) {
        router.push(`/activos/${assetId}/mantenimiento/${data.id}`);
      } else {
        router.push(`/activos/${assetId}/mantenimiento`);
      }
      
    } catch (err) {
      console.error("Error al registrar mantenimiento:", err);
      toast({
        title: "Error al registrar mantenimiento",
        description: err instanceof Error ? err.message : "Ha ocurrido un error",
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
      
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Información del Mantenimiento</CardTitle>
            <CardDescription>
              Registre los detalles del mantenimiento realizado
              {maintenancePlan && (
                <span className="block mt-1">
                  Plan de mantenimiento: <span className="font-medium">{maintenancePlan.description}</span>
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="date">Fecha *</Label>
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
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="hours">Horas de Operación</Label>
                <Input
                  id="hours"
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="Horas actuales de operación"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="technician">Técnico *</Label>
                <Input
                  id="technician"
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  placeholder="Nombre del técnico"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descripción *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del mantenimiento realizado"
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="findings">Hallazgos</Label>
                <Textarea
                  id="findings"
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="Hallazgos durante el mantenimiento"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="actions">Acciones Realizadas</Label>
                <Textarea
                  id="actions"
                  value={actions}
                  onChange={(e) => setActions(e.target.value)}
                  placeholder="Acciones realizadas durante el mantenimiento"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="laborHours">Horas de Trabajo</Label>
                <Input
                  id="laborHours"
                  type="number"
                  value={laborHours}
                  onChange={(e) => setLaborHours(e.target.value)}
                  placeholder="Horas de mano de obra"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="laborCost">Costo de Mano de Obra</Label>
                <Input
                  id="laborCost"
                  type="number"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  placeholder="Costo de mano de obra"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="totalCost">Costo Total</Label>
                <Input
                  id="totalCost"
                  type="number"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  placeholder="Costo total del mantenimiento"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="workOrder">Orden de Trabajo</Label>
              <Input
                id="workOrder"
                value={workOrder}
                onChange={(e) => setWorkOrder(e.target.value)}
                placeholder="Número de orden de trabajo"
              />
            </div>
          </CardContent>
        </Card>
        
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Repuestos Utilizados</CardTitle>
            <CardDescription>
              Registre los repuestos utilizados durante el mantenimiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {parts.length > 0 ? (
              <div className="space-y-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Nombre</th>
                      <th className="text-left py-2">Número</th>
                      <th className="text-left py-2">Cantidad</th>
                      <th className="text-left py-2">Costo</th>
                      <th className="text-left py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((part, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2">{part.name}</td>
                        <td className="py-2">{part.partNumber || "-"}</td>
                        <td className="py-2">{part.quantity}</td>
                        <td className="py-2">{part.cost || "-"}</td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => removePart(index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No se han agregado repuestos
              </div>
            )}
            
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
              <div className="sm:col-span-2">
                <Label htmlFor="newPartName">Nombre</Label>
                <Input
                  id="newPartName"
                  value={newPartName}
                  onChange={(e) => setNewPartName(e.target.value)}
                  placeholder="Nombre del repuesto"
                />
              </div>
              <div>
                <Label htmlFor="newPartNumber">Número</Label>
                <Input
                  id="newPartNumber"
                  value={newPartNumber}
                  onChange={(e) => setNewPartNumber(e.target.value)}
                  placeholder="Número de parte"
                />
              </div>
              <div>
                <Label htmlFor="newPartQuantity">Cantidad</Label>
                <Input
                  id="newPartQuantity"
                  type="number"
                  min="1"
                  value={newPartQuantity}
                  onChange={(e) => setNewPartQuantity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="newPartCost">Costo</Label>
                <Input
                  id="newPartCost"
                  type="number"
                  value={newPartCost}
                  onChange={(e) => setNewPartCost(e.target.value)}
                  placeholder="Costo unitario"
                />
              </div>
              <div className="sm:col-span-5 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPart}
                  className="ml-auto"
                  disabled={!newPartName}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Agregar Repuesto
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="mt-6">
          <CardFooter className="flex justify-between pt-6">
            <Button variant="outline" type="button" asChild>
              <Link href={`/activos/${assetId}/mantenimiento`}>Cancelar</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Guardar Mantenimiento
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </DashboardShell>
  );
} 