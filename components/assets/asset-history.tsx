"use client"

import { Checkbox } from "@/components/ui/checkbox"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  AlertCircle,
  Calendar,
  DollarSign,
  Download,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  Trash2,
  Loader2,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { useAsset, useMaintenanceHistory } from "@/hooks/useSupabase"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { MaintenanceHistory, AssetWithModel } from "@/types"

interface AssetHistoryProps {
  id: string
}

// Define types for UI state
interface MaintenancePart {
  id: string;
  name: string;
  quantity: string;
  cost: string;
}

interface NewMaintenanceForm {
  date: Date;
  type: string;
  hours: string;
  description: string;
  findings: string;
  actions: string;
  technician: string;
  laborHours: string;
  laborCost: string;
  workOrder: string;
  status?: string;
  parts: MaintenancePart[];
}

interface NewIncidentForm {
  date: Date;
  type: string;
  reportedBy: string;
  description: string;
  impact: string;
  resolution: string;
  downtime: string;
  laborHours: string;
  laborCost: string;
  workOrder: string;
  status?: string;
  parts: MaintenancePart[];
}

interface PartForm {
  id: string;
  name: string;
  quantity: number;
  cost: number;
}

interface CostDataPoint {
  month: string;
  preventivo: number;
  correctivo: number;
  total: number;
}

export function AssetHistory({ id }: AssetHistoryProps) {
  const router = useRouter()
  
  // Fetch real data from Supabase
  const { asset, loading: assetLoading, error: assetError } = useAsset(id) as 
    { asset: AssetWithModel | null, loading: boolean, error: Error | null };
  const { history: maintenanceHistory, loading: historyLoading, error: historyError } = useMaintenanceHistory(id);
  
  const [costHistory, setCostHistory] = useState<CostDataPoint[]>([]);
  const [metrics, setMetrics] = useState<any>({
    totalMaintenanceCost: 0,
    preventiveCost: 0,
    correctiveCost: 0,
    totalDowntime: 0,
    mtbf: 0,
    mttr: 0,
    availability: 0,
  });
  
  // Process maintenance history to calculate cost metrics
  useEffect(() => {
    if (maintenanceHistory && maintenanceHistory.length > 0) {
      // Calculate cost metrics
      let totalCost = 0;
      let preventiveCost = 0;
      let correctiveCost = 0;
      let totalDowntime = 0;
      
      // Create a map for monthly costs
      const monthlyData = new Map<string, { preventivo: number; correctivo: number; total: number }>();
      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      
      maintenanceHistory.forEach(maintenance => {
        const cost = maintenance.total_cost ? parseFloat(maintenance.total_cost.toString()) : 0;
        totalCost += cost;
        
        if (maintenance.type === 'Preventivo') {
          preventiveCost += cost;
        } else {
          correctiveCost += cost;
        }
        
        // Calculating downtime - assume it's stored in a notes field or similar
        // Since downtime isn't in the type, we can calculate it from other fields or just use a placeholder
        const downtime = maintenance.hours || 0;
        totalDowntime += downtime;
        
        // Calculate monthly costs for the chart
        if (maintenance.date) {
          const date = new Date(maintenance.date);
          const monthIndex = date.getMonth();
          const monthName = months[monthIndex];
          
          if (!monthlyData.has(monthName)) {
            monthlyData.set(monthName, { preventivo: 0, correctivo: 0, total: 0 });
          }
          
          const monthData = monthlyData.get(monthName)!;
          if (maintenance.type === 'Preventivo') {
            monthData.preventivo += cost;
          } else {
            monthData.correctivo += cost;
          }
          monthData.total += cost;
        }
      });
      
      // Convert the map to an array for the chart
      const costHistoryArray: CostDataPoint[] = Array.from(monthlyData.entries()).map(([month, data]) => ({
        month,
        preventivo: data.preventivo,
        correctivo: data.correctivo,
        total: data.total
      }));
      
      // Simple and limited MTBF and MTTR calculation
      // This is a simplified approach - in a real app you'd use more sophisticated methods
      const mtbf = maintenanceHistory.length > 1 && 
        typeof maintenanceHistory[0]?.hours === 'number' && 
        typeof maintenanceHistory[maintenanceHistory.length - 1]?.hours === 'number' ? 
        ((maintenanceHistory[0]?.hours ?? 0) - (maintenanceHistory[maintenanceHistory.length - 1]?.hours ?? 0)) / maintenanceHistory.length : 0;
      
      const mttr = totalDowntime > 0 && maintenanceHistory.length > 0 ? 
        totalDowntime / maintenanceHistory.length : 0;
      
      // Calculate availability (simplified)
      const totalTime = mtbf * maintenanceHistory.length;
      const availability = totalTime > 0 ? 
        ((totalTime - totalDowntime) / totalTime) * 100 : 0;
      
      setCostHistory(costHistoryArray);
      setMetrics({
        totalMaintenanceCost: totalCost,
        preventiveCost,
        correctiveCost,
        totalDowntime,
        mtbf,
        mttr,
        availability: availability.toFixed(1)
      });
    }
  }, [maintenanceHistory]);

  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState("all")
  const [showAddMaintenanceDialog, setShowAddMaintenanceDialog] = useState(false)
  const [showAddIncidentDialog, setShowAddIncidentDialog] = useState(false)
  const [showCompletePlanDialog, setShowCompletePlanDialog] = useState(false)
  const [showPartsDialog, setShowPartsDialog] = useState(false)
  const [currentPartsList, setCurrentPartsList] = useState<"maintenance" | "incident" | "plan">("maintenance")
  const [selectedMaintenancePlan, setSelectedMaintenancePlan] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // New part form state
  const [newPart, setNewPart] = useState<PartForm>({
    id: `new-part-${Date.now()}`,
    name: "",
    quantity: 1,
    cost: 0
  });

  // Estados para el nuevo registro de mantenimiento
  const [newMaintenance, setNewMaintenance] = useState<NewMaintenanceForm>({
    date: new Date(),
    type: "Preventivo",
    hours: "",
    description: "",
    findings: "",
    actions: "",
    technician: "",
    laborHours: "",
    laborCost: "",
    workOrder: "",
    status: "Completado",
    parts: [{ id: "new-part-1", name: "", quantity: "1", cost: "" }],
  })

  // Estados para el nuevo registro de incidente
  const [newIncident, setNewIncident] = useState<NewIncidentForm>({
    date: new Date(),
    type: "Falla",
    reportedBy: "",
    description: "",
    impact: "",
    resolution: "",
    downtime: "",
    laborHours: "",
    laborCost: "",
    workOrder: "",
    status: "Resuelto",
    parts: [{ id: "new-part-inc-1", name: "", quantity: "1", cost: "" }],
  })

  // Estados para completar plan de mantenimiento
  const [completionPlan, setCompletionPlan] = useState({
    date: new Date(),
    hours: "",
    technician: "",
    findings: "",
    actions: "",
    laborHours: "",
    laborCost: "",
    tasks: [] as { id: string; description: string; completed: boolean }[],
    parts: [{ id: "new-part-plan-1", name: "", quantity: "1", cost: "" }],
  })

  // Handler functions
  const handleAddPart = () => {
    const partToAdd = {
      id: `part-${Date.now()}`,
      name: newPart.name,
      quantity: newPart.quantity.toString(),
      cost: newPart.cost.toString()
    };
    
    if (currentPartsList === "maintenance") {
      setNewMaintenance({
        ...newMaintenance,
        parts: [...newMaintenance.parts, partToAdd]
      });
    } else if (currentPartsList === "incident") {
      setNewIncident({
        ...newIncident,
        parts: [...newIncident.parts, partToAdd]
      });
    } else {
      setCompletionPlan({
        ...completionPlan,
        parts: [...completionPlan.parts, partToAdd]
      });
    }
    
    // Reset form
    setNewPart({
      id: `new-part-${Date.now()}`,
      name: "",
      quantity: 1,
      cost: 0
    });
    
    setShowPartsDialog(false);
  };
  
  const handleRemovePart = (partId: string, type: "maintenance" | "incident" | "plan") => {
    if (type === "maintenance") {
      setNewMaintenance({
        ...newMaintenance,
        parts: newMaintenance.parts.filter(part => part.id !== partId)
      });
    } else if (type === "incident") {
      setNewIncident({
        ...newIncident,
        parts: newIncident.parts.filter(part => part.id !== partId)
      });
    } else {
      setCompletionPlan({
        ...completionPlan,
        parts: completionPlan.parts.filter(part => part.id !== partId)
      });
    }
  };
  
  const handleOpenCompletePlanDialog = (plan: any) => {
    setSelectedMaintenancePlan(plan);
    setCompletionPlan({
      ...completionPlan,
      tasks: plan.tasks.map((task: any) => ({
        id: task.id,
        description: task.description,
        completed: false
      }))
    });
    setShowCompletePlanDialog(true);
  };
  
  const handleSubmitMaintenance = async () => {
    try {
      setIsSubmitting(true);
      
      // Calculate total cost
      const partsCost = newMaintenance.parts.reduce((sum, part) => {
        return sum + (Number(part.quantity) * Number(part.cost) || 0);
      }, 0);
      
      const laborCost = Number(newMaintenance.laborCost) || 0;
      const totalCost = partsCost + laborCost;
      
      const supabase = createClient();
      
      const maintenanceData = {
        asset_id: id,
        date: format(newMaintenance.date, "yyyy-MM-dd"),
        type: newMaintenance.type,
        hours: Number(newMaintenance.hours) || null,
        description: newMaintenance.description,
        findings: newMaintenance.findings || null,
        actions: newMaintenance.actions || null,
        technician: newMaintenance.technician,
        labor_hours: Number(newMaintenance.laborHours) || null,
        labor_cost: newMaintenance.laborCost ? newMaintenance.laborCost.toString() : null,
        parts_cost: partsCost ? partsCost.toString() : null,
        total_cost: totalCost ? totalCost.toString() : null,
        work_order: newMaintenance.workOrder || null,
        status: newMaintenance.status || "Completado"
      };
      
      const { error } = await supabase
        .from("maintenance_history")
        .insert(maintenanceData);
      
      if (error) throw error;
      
      // Reset form and close dialog
      setNewMaintenance({
        date: new Date(),
        type: "Preventivo",
        hours: "",
        description: "",
        findings: "",
        actions: "",
        technician: "",
        laborHours: "",
        laborCost: "",
        workOrder: "",
        status: "Completado",
        parts: []
      });
      
      setShowAddMaintenanceDialog(false);
      
      // Refresh maintenance history
      window.location.reload();
      
    } catch (err) {
      console.error("Error al guardar mantenimiento:", err);
      alert("Error al guardar el registro de mantenimiento.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSubmitIncident = async () => {
    // This would be implemented similar to handleSubmitMaintenance
    // For now, just close the dialog
    setShowAddIncidentDialog(false);
  };
  
  const handleCompleteMaintenance = async (e: React.MouseEvent) => {
    // Detener cualquier comportamiento por defecto
    e.preventDefault();
    
    try {
      // Aquí agregaríamos lógica para validar antes de enviar
      if (!completionPlan.technician || !completionPlan.hours) {
        alert("Por favor complete los campos obligatorios");
        return;
      }
      
      setIsSubmitting(true);
      
      // En una implementación futura, aquí iría el código para guardar en la base de datos
      
      // Cerramos el diálogo solo después de validar
      setShowCompletePlanDialog(false);
    } catch (err) {
      console.error("Error al completar el mantenimiento:", err);
      alert("Ha ocurrido un error al procesar la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrar por término de búsqueda y fecha
  const filterByDate = (items: any[]) => {
    if (!items) return [];
    
    if (dateFilter === "all") return items;

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const lastThreeMonths = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    const lastSixMonths = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    return items.filter((item) => {
      const itemDate = new Date(item.date);
      switch (dateFilter) {
        case "month":
          return itemDate >= lastMonth;
        case "three-months":
          return itemDate >= lastThreeMonths;
        case "six-months":
          return itemDate >= lastSixMonths;
        case "year":
          return itemDate >= lastYear;
        default:
          return true;
      }
    });
  };

  if (assetLoading || historyLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (assetError || historyError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {assetError?.message || historyError?.message || "Error al cargar el historial del activo"}
        </AlertDescription>
      </Alert>
    );
  }

  const filteredMaintenance = filterByDate(maintenanceHistory || [])
    .filter((item) =>
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.technician.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
  // Since we may not have incident history yet, let's just use an empty array
  const filteredIncidents: any[] = [];
  
  // For now, we'll have empty parts replacement history
  const partsReplacementHistory: any[] = [];
  
  // For now, we don't have maintenance plans implemented
  const maintenancePlans: any[] = [];

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "dd/MM/yyyy", { locale: es });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{asset?.name}</CardTitle>
              <CardDescription className="text-lg">
                {asset?.model?.manufacturer || "N/A"} - S/N: {asset?.serial_number || "N/A"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">ID: {asset?.id}</Badge>
              <Badge variant="outline">Ubicación: {asset?.location || "N/A"}</Badge>
              <Badge variant="outline">Compra: {asset?.purchase_date ? formatDate(asset.purchase_date) : "N/A"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Costo Total de Mantenimiento</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-2xl font-bold">${metrics.totalMaintenanceCost}</div>
                <p className="text-sm text-muted-foreground">
                  Preventivo: ${metrics.preventiveCost} | Correctivo: ${metrics.correctiveCost}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Tiempo Fuera de Servicio</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-2xl font-bold">{metrics.totalDowntime} horas</div>
                <p className="text-sm text-muted-foreground">Disponibilidad: {metrics.availability}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">MTBF</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-2xl font-bold">{metrics.mtbf} horas</div>
                <p className="text-sm text-muted-foreground">Tiempo medio entre fallos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">MTTR</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="text-2xl font-bold">{metrics.mttr} horas</div>
                <p className="text-sm text-muted-foreground">Tiempo medio para reparar</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar en historial..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por fecha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el historial</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
              <SelectItem value="three-months">Últimos 3 meses</SelectItem>
              <SelectItem value="six-months">Últimos 6 meses</SelectItem>
              <SelectItem value="year">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="maintenance" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="maintenance">Mantenimientos</TabsTrigger>
          <TabsTrigger value="incidents">Incidentes</TabsTrigger>
          <TabsTrigger value="parts">Reemplazo de Partes</TabsTrigger>
          <TabsTrigger value="costs">Costos</TabsTrigger>
          <TabsTrigger value="plan">Plan de Mantenimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historial de Mantenimientos</CardTitle>
                <CardDescription>Registro de todos los mantenimientos realizados</CardDescription>
              </div>
              <Button onClick={() => setShowAddMaintenanceDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Registrar Mantenimiento
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Hallazgos</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead>OT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaintenance.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDate(item.date)}</TableCell>
                        <TableCell>
                          <Badge variant={item.type === "Preventivo" ? "default" : "secondary"}>{item.type}</Badge>
                        </TableCell>
                        <TableCell>{item.hours}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.technician}</TableCell>
                        <TableCell>{item.findings}</TableCell>
                        <TableCell>${item.total_cost}</TableCell>
                        <TableCell>{item.work_order}</TableCell>
                      </TableRow>
                    ))}
                    
                    {filteredMaintenance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                          No hay registros de mantenimiento
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historial de Incidentes</CardTitle>
                <CardDescription>Registro de todos los incidentes y fallas</CardDescription>
              </div>
              <Button onClick={() => setShowAddIncidentDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Registrar Incidente
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Reportado por</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Impacto</TableHead>
                      <TableHead>Tiempo Inactivo</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncidents.length > 0 ? (
                      filteredIncidents.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.date}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.type}</Badge>
                          </TableCell>
                          <TableCell>{item.reportedBy}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell>{item.impact}</TableCell>
                          <TableCell>{item.downtime} horas</TableCell>
                          <TableCell>${item.total_cost}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                          No hay registros de incidentes
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Remaining tabs with simplified implementation */}
        <TabsContent value="parts">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Reemplazo de Partes</CardTitle>
              <CardDescription>Esta funcionalidad estará disponible próximamente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  El registro detallado de reemplazo de partes estará disponible en una próxima actualización.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Costos</CardTitle>
              <CardDescription>Análisis de costos de mantenimiento</CardDescription>
            </CardHeader>
            <CardContent>
              {costHistory.length > 0 ? (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => `$${value}`} />
                      <Legend />
                      <Bar dataKey="preventivo" name="Mantenimiento Preventivo" fill="#4f46e5" />
                      <Bar dataKey="correctivo" name="Mantenimiento Correctivo" fill="#f97316" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No hay suficientes datos para mostrar el historial de costos
                  </p>
                </div>
              )}

              <Separator className="my-6" />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Resumen de Costos</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Costo Total</p>
                      <p className="text-2xl font-bold">${metrics.totalMaintenanceCost}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Costo Preventivo</p>
                      <p className="text-2xl font-bold">${metrics.preventiveCost}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Costo Correctivo</p>
                      <p className="text-2xl font-bold">${metrics.correctiveCost}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Plan de Mantenimiento</CardTitle>
                <CardDescription>Programación de mantenimientos preventivos</CardDescription>
              </div>
              {/* Agregar el type="button" para evitar envíos accidentales */}
              <Button type="button" disabled={true} onClick={(e) => {
                // Prevenir propagación de eventos
                e.preventDefault();
                e.stopPropagation();
                alert("Funcionalidad en desarrollo");
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Programar Mantenimiento
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Los planes de mantenimiento preventivo estarán disponibles en una próxima actualización.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog definitions remain the same */}
      <Dialog open={showAddMaintenanceDialog} onOpenChange={setShowAddMaintenanceDialog}>
        <DialogContent className="sm:max-w-[600px]" onSubmit={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Registrar Mantenimiento</DialogTitle>
            <DialogDescription>Ingrese los detalles del mantenimiento realizado en este activo</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maintenanceDate">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newMaintenance.date && "text-muted-foreground",
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {newMaintenance.date ? (
                        format(newMaintenance.date, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={newMaintenance.date}
                      onSelect={(date) => date && setNewMaintenance({ ...newMaintenance, date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenanceType">Tipo</Label>
                <Select
                  value={newMaintenance.type}
                  onValueChange={(value) => setNewMaintenance({ ...newMaintenance, type: value })}
                >
                  <SelectTrigger id="maintenanceType">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Preventivo">Preventivo</SelectItem>
                    <SelectItem value="Correctivo">Correctivo</SelectItem>
                    <SelectItem value="Predictivo">Predictivo</SelectItem>
                    <SelectItem value="Overhaul">Overhaul</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maintenanceHours">Horas del Equipo</Label>
                <Input
                  id="maintenanceHours"
                  type="number"
                  placeholder="Ej: 500"
                  value={newMaintenance.hours}
                  onChange={(e) => setNewMaintenance({ ...newMaintenance, hours: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenanceTechnician">Técnico</Label>
                <Input
                  id="maintenanceTechnician"
                  placeholder="Nombre del técnico"
                  value={newMaintenance.technician}
                  onChange={(e) => setNewMaintenance({ ...newMaintenance, technician: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenanceDescription">Descripción</Label>
              <Textarea
                id="maintenanceDescription"
                placeholder="Descripción del mantenimiento realizado"
                value={newMaintenance.description}
                onChange={(e) => setNewMaintenance({ ...newMaintenance, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowAddMaintenanceDialog(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmitMaintenance}
              disabled={
                isSubmitting ||
                !newMaintenance.date ||
                !newMaintenance.type ||
                !newMaintenance.technician ||
                !newMaintenance.description
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Mantenimiento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddIncidentDialog} onOpenChange={setShowAddIncidentDialog}>
        <DialogContent className="sm:max-w-[600px]" onSubmit={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Registrar Incidente</DialogTitle>
            <DialogDescription>Ingrese los detalles del incidente</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incidentDate">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newIncident.date && "text-muted-foreground",
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {newIncident.date ? (
                        format(newIncident.date, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={newIncident.date}
                      onSelect={(date) => date && setNewIncident({ ...newIncident, date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="incidentType">Tipo</Label>
                <Select
                  value={newIncident.type}
                  onValueChange={(value) => setNewIncident({ ...newIncident, type: value })}
                >
                  <SelectTrigger id="incidentType">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Falla">Falla</SelectItem>
                    <SelectItem value="Parada">Parada</SelectItem>
                    <SelectItem value="Desperfecto">Desperfecto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incidentDescription">Descripción</Label>
                <Textarea
                  id="incidentDescription"
                  placeholder="Descripción del incidente"
                  value={newIncident.description}
                  onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reportedBy">Reportado por</Label>
                <Input
                  id="reportedBy"
                  placeholder="Nombre de la persona que reportó el incidente"
                  value={newIncident.reportedBy}
                  onChange={(e) => setNewIncident({ ...newIncident, reportedBy: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="impact">Impacto</Label>
                <Textarea
                  id="impact"
                  placeholder="Impacto del incidente"
                  value={newIncident.impact}
                  onChange={(e) => setNewIncident({ ...newIncident, impact: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolution">Resolución</Label>
                <Textarea
                  id="resolution"
                  placeholder="Resolución del incidente"
                  value={newIncident.resolution}
                  onChange={(e) => setNewIncident({ ...newIncident, resolution: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="downtime">Tiempo Inactivo</Label>
                <Input
                  id="downtime"
                  type="number"
                  placeholder="Tiempo inactivo en horas"
                  value={newIncident.downtime}
                  onChange={(e) => setNewIncident({ ...newIncident, downtime: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="laborHours">Horas de Trabajo</Label>
                <Input
                  id="laborHours"
                  type="number"
                  placeholder="Horas de trabajo invertidas"
                  value={newIncident.laborHours}
                  onChange={(e) => setNewIncident({ ...newIncident, laborHours: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="laborCost">Costo Laboral</Label>
                <Input
                  id="laborCost"
                  type="number"
                  placeholder="Costo laboral del incidente"
                  value={newIncident.laborCost}
                  onChange={(e) => setNewIncident({ ...newIncident, laborCost: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workOrder">Orden de Trabajo</Label>
                <Input
                  id="workOrder"
                  placeholder="Número de la orden de trabajo"
                  value={newIncident.workOrder}
                  onChange={(e) => setNewIncident({ ...newIncident, workOrder: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowAddIncidentDialog(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmitIncident}>
              Guardar Incidente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCompletePlanDialog} onOpenChange={setShowCompletePlanDialog}>
        <DialogContent className="sm:max-w-[600px]" onSubmit={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Completar Mantenimiento</DialogTitle>
            <DialogDescription>Ingrese los detalles del mantenimiento realizado</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="completionDate">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !completionPlan.date && "text-muted-foreground",
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {completionPlan.date ? (
                        format(completionPlan.date, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={completionPlan.date}
                      onSelect={(date) => date && setCompletionPlan({ ...completionPlan, date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="completionHours">Horas del Equipo</Label>
                <Input
                  id="completionHours"
                  type="number"
                  placeholder="Ej: 500"
                  value={completionPlan.hours}
                  onChange={(e) => setCompletionPlan({ ...completionPlan, hours: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="completionTechnician">Técnico</Label>
                <Input
                  id="completionTechnician"
                  placeholder="Nombre del técnico"
                  value={completionPlan.technician}
                  onChange={(e) => setCompletionPlan({ ...completionPlan, technician: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="completionFindings">Hallazgos</Label>
                <Textarea
                  id="completionFindings"
                  placeholder="Hallazgos del mantenimiento"
                  value={completionPlan.findings}
                  onChange={(e) => setCompletionPlan({ ...completionPlan, findings: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="completionActions">Acciones</Label>
                <Textarea
                  id="completionActions"
                  placeholder="Acciones tomadas"
                  value={completionPlan.actions}
                  onChange={(e) => setCompletionPlan({ ...completionPlan, actions: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="completionLaborHours">Horas de Trabajo</Label>
                <Input
                  id="completionLaborHours"
                  type="number"
                  placeholder="Horas de trabajo invertidas"
                  value={completionPlan.laborHours}
                  onChange={(e) => setCompletionPlan({ ...completionPlan, laborHours: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="completionLaborCost">Costo Laboral</Label>
                <Input
                  id="completionLaborCost"
                  type="number"
                  placeholder="Costo laboral del mantenimiento"
                  value={completionPlan.laborCost}
                  onChange={(e) => setCompletionPlan({ ...completionPlan, laborCost: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="completionTasks">Tareas</Label>
                <Textarea
                  id="completionTasks"
                  placeholder="Tareas realizadas"
                  value={completionPlan.tasks.map(task => task.description).join("\n")}
                  onChange={(e) => setCompletionPlan({
                    ...completionPlan,
                    tasks: e.target.value.split("\n").map((description, index) => ({
                      id: `task-${index + 1}`,
                      description,
                      completed: false
                    }))
                  })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCompletePlanDialog(false)}>
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={(e) => handleCompleteMaintenance(e)}
              disabled={isSubmitting || !completionPlan.technician || !completionPlan.hours}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Completar Mantenimiento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPartsDialog} onOpenChange={setShowPartsDialog}>
        <DialogContent className="sm:max-w-[450px]" onSubmit={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Agregar Repuesto</DialogTitle>
            <DialogDescription>Ingrese los detalles del repuesto</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="partName">Nombre</Label>
              <Input
                id="partName"
                placeholder="Nombre del repuesto"
                value={newPart.name}
                onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partQuantity">Cantidad</Label>
              <Input
                id="partQuantity"
                type="number"
                placeholder="Cantidad"
                value={newPart.quantity.toString()}
                onChange={(e) => setNewPart({ ...newPart, quantity: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partCost">Costo</Label>
              <Input
                id="partCost"
                type="number"
                placeholder="Costo"
                value={newPart.cost.toString()}
                onChange={(e) => setNewPart({ ...newPart, cost: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowPartsDialog(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddPart}>
              Agregar Repuesto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
