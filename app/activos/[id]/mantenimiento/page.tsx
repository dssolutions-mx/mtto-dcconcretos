'use client';

import { useState, useEffect, use } from 'react';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Plus, Calendar, Wrench, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useAsset, useMaintenanceHistory } from "@/hooks/useSupabase";
import { createClient } from "@/lib/supabase";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

interface MaintenancePageProps {
  params: Promise<{
    id: string
  }>
}

interface CyclicMaintenanceInterval {
  interval_id: string;
  interval_value: number;
  name: string;
  description: string;
  type: string;
  maintenance_category: string;
  is_recurring: boolean;
  is_first_cycle_only: boolean;
  current_cycle: number;
  next_due_hour: number;
  status: string;
  cycle_length: number;
}

export default function MaintenancePage({ params }: MaintenancePageProps) {
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  
  const { asset, loading: assetLoading, error: assetError } = useAsset(assetId);
  const { history: maintenanceHistory, loading: historyLoading, error: historyError } = useMaintenanceHistory(assetId);
  const [cyclicIntervals, setCyclicIntervals] = useState<CyclicMaintenanceInterval[]>([]);
  const [currentCycle, setCurrentCycle] = useState<number>(1);
  const [cycleLength, setCycleLength] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Load cyclic maintenance intervals
  useEffect(() => {
    async function fetchCyclicMaintenanceIntervals() {
      if (!asset?.model_id || asset.current_hours === undefined) return;
      
      try {
        setLoading(true);
        const supabase = createClient();
        
        // Get maintenance intervals for the model
        const { data: intervals, error: intervalsError } = await supabase
          .from("maintenance_intervals")
          .select(`
            *,
            maintenance_tasks(*)
          `)
          .eq("model_id", asset.model_id);
          
        if (intervalsError) throw intervalsError;
        
        if (intervals && intervals.length > 0) {
          // Calculate cycle length (highest interval)
          const maxInterval = Math.max(...intervals.map(i => i.interval_value));
          setCycleLength(maxInterval);
          
                     // Calculate current cycle
           const currentHours = asset.current_hours || 0;
           const currentCycleNum = Math.floor(currentHours / maxInterval) + 1;
           setCurrentCycle(currentCycleNum);
           
           // Find the highest maintenance performed in current cycle (for "covered" logic)
           const currentCycleStartHour = (currentCycleNum - 1) * maxInterval;
           const currentCycleEndHour = currentCycleNum * maxInterval;
           
           const currentCycleMaintenances = maintenanceHistory.filter(m => {
             const mHours = Number(m.hours) || 0;
             // Exclude maintenance that marks the end of previous cycle (exactly at cycle boundary)
             return mHours > currentCycleStartHour && mHours < currentCycleEndHour;
           });
           
           const highestMaintenanceInCycle = currentCycleMaintenances.length > 0 
             ? Math.max(...currentCycleMaintenances.map(m => Number(m.hours) || 0))
             : 0;
           
           // Process intervals for cyclic logic
           const processedIntervals: CyclicMaintenanceInterval[] = intervals.map(interval => {
             // Handle new fields with fallbacks for backward compatibility
             const isRecurring = (interval as any).is_recurring !== false; // Default to true
             const isFirstCycleOnly = (interval as any).is_first_cycle_only === true; // Default to false
             const category = (interval as any).maintenance_category || 'standard';
             
             // Calculate next due hour for current cycle
             let nextDueHour: number | null = null;
             let status = 'not_applicable';
             let cycleForService = currentCycleNum;
             
             if (!isFirstCycleOnly || currentCycleNum === 1) {
               // Calculate the due hour for current cycle
               nextDueHour = ((currentCycleNum - 1) * maxInterval) + interval.interval_value;
               
               // Special case: if nextDueHour exceeds the current cycle end, 
               // calculate for next cycle instead
               const currentCycleEndHour = currentCycleNum * maxInterval;
               if (nextDueHour > currentCycleEndHour) {
                 // This service belongs to next cycle
                 cycleForService = currentCycleNum + 1;
                 nextDueHour = (currentCycleNum * maxInterval) + interval.interval_value;
                 
                 // Only show next cycle services if they're within reasonable range (e.g., 1000 hours)
                 if (nextDueHour - currentHours <= 1000) {
                   status = 'scheduled';
                 } else {
                   status = 'not_applicable';
                 }
               } else {
                 // Current cycle logic (includes services that fall exactly at cycle boundary)
                 // Check if this specific interval was performed in the current cycle
                 const wasPerformedInCurrentCycle = nextDueHour !== null && currentCycleMaintenances.some(m => {
                   const maintenanceHours = Number(m.hours) || 0;
                   // The maintenance should match both the plan ID AND be in the right hour range for this cycle
                   const tolerance = 200; // Allow some tolerance for when maintenance is done early/late
                   
                   return m.maintenance_plan_id === interval.id && 
                          Math.abs(maintenanceHours - nextDueHour!) <= tolerance;
                 });
                 
                 if (wasPerformedInCurrentCycle) {
                   status = 'completed';
                 } else {
                   // Check if it's covered by a higher maintenance in current cycle
                   const cycleIntervalHour = nextDueHour - currentCycleStartHour; // Relative to cycle start
                   const highestRelativeHour = highestMaintenanceInCycle - currentCycleStartHour;
                   
                   if (highestRelativeHour >= cycleIntervalHour && highestMaintenanceInCycle > 0) {
                     status = 'covered';
                   } else if (currentHours >= nextDueHour) {
                     status = 'overdue';
                   } else if (currentHours >= nextDueHour - 100) {
                     status = 'upcoming';
                   } else {
                     status = 'scheduled';
                   }
                 }
               }
             }
            
            return {
              interval_id: interval.id,
              interval_value: interval.interval_value,
              name: interval.name,
              description: interval.description || '',
              type: interval.type,
              maintenance_category: category,
              is_recurring: isRecurring,
              is_first_cycle_only: isFirstCycleOnly,
              current_cycle: cycleForService,
              next_due_hour: nextDueHour || 0,
              status,
              cycle_length: maxInterval
            };
          });
          
          // Filter and sort - show relevant intervals for current cycle and near future
          const filtered = processedIntervals.filter(i => {
            // Show: overdue, upcoming, scheduled, covered
            // Don't show: not_applicable, completed (already done)
            return ['overdue', 'upcoming', 'scheduled', 'covered'].includes(i.status);
          });
          
          const sorted = filtered.sort((a, b) => {
            // First sort by cycle
            if (a.current_cycle !== b.current_cycle) {
              return a.current_cycle - b.current_cycle;
            }
            
            // Then by status priority
            const statusOrder = { 'overdue': 4, 'upcoming': 3, 'scheduled': 2, 'covered': 1 };
            const statusA = statusOrder[a.status as keyof typeof statusOrder] || 0;
            const statusB = statusOrder[b.status as keyof typeof statusOrder] || 0;
            
            if (statusA !== statusB) return statusB - statusA;
            return a.interval_value - b.interval_value;
          });
          
          // Debug logs
          if (sorted.length === 0) {
            console.log("⚠️ No intervals found after filtering");
            console.log("Processed intervals:", processedIntervals.length);
            console.log("All statuses:", processedIntervals.map(i => `${i.interval_value}h: ${i.status}`));
          }
          
          setCyclicIntervals(sorted);
        }
      } catch (err) {
        console.error("Error al cargar intervalos de mantenimiento cíclico:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }
    
    if (asset?.model_id && asset.current_hours !== undefined && !historyLoading) {
      fetchCyclicMaintenanceIntervals();
    }
  }, [asset, maintenanceHistory, historyLoading]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'overdue': return 'destructive';
      case 'upcoming': return 'default';
      case 'scheduled': return 'outline';
      case 'covered': return 'secondary';
      case 'not_applicable': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'overdue': return 'Vencido';
      case 'upcoming': return 'Próximo';
      case 'scheduled': return 'Programado';
      case 'covered': return 'Cubierto';
      case 'not_applicable': return 'No aplicable';
      default: return status;
    }
  };

  const calculateCycleInfo = () => {
    if (!asset?.current_hours || !cycleLength) return null;
    
    const currentHours = asset.current_hours;
    const hoursInCurrentCycle = currentHours % cycleLength;
    const nextCycleStartsAt = currentCycle * cycleLength;
    const hoursToNextCycle = nextCycleStartsAt - currentHours;
    
    return {
      hoursInCurrentCycle,
      nextCycleStartsAt,
      hoursToNextCycle,
      progressInCycle: (hoursInCurrentCycle / cycleLength) * 100
    };
  };

  const isLoading = assetLoading || historyLoading || loading;
  const anyError = assetError || historyError || error;

  const cycleInfo = calculateCycleInfo();

  return (
    <DashboardShell>
      <DashboardHeader
        heading={isLoading ? "Cargando plan de mantenimiento..." : `Plan de Mantenimiento Cíclico: ${asset?.name || ""}`}
        text={isLoading ? "" : `Programación cíclica de mantenimientos para ${asset?.asset_id || ""}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/activos/${assetId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/activos/${assetId}/historial`}>
              <Calendar className="mr-2 h-4 w-4" />
              Ver Historial
            </Link>
          </Button>
        </div>
      </DashboardHeader>

      {anyError && (
        <Alert variant="destructive">
          <AlertDescription>
            Error al cargar los datos: {anyError.message}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div className="h-6 w-1/3 bg-gray-200 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-4/6 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Cycle Information Card */}
          {cycleInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Información del Ciclo de Mantenimiento
                </CardTitle>
                <CardDescription>
                  Estado actual del ciclo de mantenimiento del equipo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Ciclo Actual</div>
                    <div className="text-2xl font-bold text-blue-600">
                      Ciclo {currentCycle}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Horas Actuales</div>
                    <div className="text-2xl font-bold">
                      {asset?.current_hours || 0}h
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Próximo Ciclo</div>
                    <div className="text-2xl font-bold text-green-600">
                      {cycleInfo.nextCycleStartsAt}h
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Faltan {cycleInfo.hoursToNextCycle}h
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Progreso del Ciclo</div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(cycleInfo.progressInCycle, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.round(cycleInfo.progressInCycle)}% completado
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Mantenimientos del Ciclo Actual</CardTitle>
              <CardDescription>
                Mantenimientos programados para el Ciclo {currentCycle} 
                {cycleLength > 0 && ` (cada ${cycleLength} horas)`}
              </CardDescription>
                             <div className="mt-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                 <p>
                   <span className="font-medium">Sistema Cíclico:</span> Los mantenimientos se repiten cada {cycleLength} horas. 
                   Después de completar el mantenimiento a las {cycleLength}h, el ciclo se reinicia y el próximo mantenimiento 
                   será a las {cycleLength + (cyclicIntervals[0]?.interval_value || 0)}h.
                 </p>
                 <p className="mt-1">
                   <span className="font-medium">Lógica de Cobertura:</span> Un mantenimiento mayor puede "cubrir" mantenimientos menores 
                   dentro del mismo ciclo. Por ejemplo, si se realiza el servicio de 600h, este cubre automáticamente el servicio de 300h en el mismo ciclo.
                 </p>
               </div>
                             <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                 <div className="flex items-center gap-2 text-xs">
                   <div className="h-3 w-3 rounded-full bg-red-600"></div>
                   <span>Vencido</span>
                 </div>
                 <div className="flex items-center gap-2 text-xs">
                   <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                   <span>Próximo (≤100h)</span>
                 </div>
                 <div className="flex items-center gap-2 text-xs">
                   <div className="h-3 w-3 rounded-full bg-green-500"></div>
                   <span>Programado</span>
                 </div>
                 <div className="flex items-center gap-2 text-xs">
                   <div className="h-3 w-3 rounded-full bg-blue-400"></div>
                   <span>Cubierto</span>
                 </div>
                 <div className="flex items-center gap-2 text-xs">
                   <div className="h-3 w-3 rounded-full bg-gray-400"></div>
                   <span>No aplicable</span>
                 </div>
               </div>
            </CardHeader>
            <CardContent>
              {cyclicIntervals.length === 0 ? (
                <div className="py-8 text-center border rounded-md bg-gray-50">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-2" />
                  <p className="text-lg font-medium">No hay intervalos de mantenimiento configurados</p>
                  <p className="text-muted-foreground">Configure intervalos en el modelo del equipo</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Intervalo Original</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Próximo a las</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                                         {cyclicIntervals.map((interval) => {
                       const isOverdue = interval.status === 'overdue';
                       const isUpcoming = interval.status === 'upcoming';
                       const isCovered = interval.status === 'covered';
                       const isNotApplicable = interval.status === 'not_applicable';
                       
                       return (
                         <TableRow 
                           key={interval.interval_id} 
                           className={
                             isOverdue ? "bg-red-50" : 
                             isUpcoming ? "bg-amber-50" : 
                             isCovered ? "bg-blue-50" :
                             isNotApplicable ? "bg-gray-50" : "bg-green-50"
                           }
                        >
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge 
                                variant={getStatusBadgeVariant(interval.status)}
                                className="whitespace-nowrap text-xs inline-flex mb-1"
                              >
                                {interval.type} {interval.interval_value}h
                              </Badge>
                              <div className="text-xs font-medium">
                                Categoría: {interval.maintenance_category}
                              </div>
                              {interval.is_first_cycle_only && (
                                <div className="text-xs text-orange-600">
                                  Solo primer ciclo
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{interval.name}</div>
                            {interval.description && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {interval.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">Cada {interval.interval_value} horas</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              En ciclo de {interval.cycle_length}h
                            </div>
                            <Badge variant="secondary" className="text-xs mt-1">
                              {interval.is_recurring ? 'Recurrente' : 'Una vez'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant={getStatusBadgeVariant(interval.status)}>
                                {getStatusLabel(interval.status)}
                              </Badge>
                              {interval.next_due_hour && asset?.current_hours && (
                                <div className="text-xs text-muted-foreground">
                                  {interval.status === 'overdue' ? (
                                    <span className="text-red-600 font-medium">
                                      Vencido por {asset.current_hours - interval.next_due_hour}h
                                    </span>
                                  ) : interval.status === 'upcoming' ? (
                                    <span className="text-amber-600 font-medium">
                                      Próximo en {interval.next_due_hour - asset.current_hours}h
                                    </span>
                                  ) : interval.status === 'scheduled' ? (
                                    <span className="text-green-600">
                                      Faltan {interval.next_due_hour - asset.current_hours}h
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {interval.next_due_hour ? (
                              <div className="space-y-1">
                                <div className="font-medium">{interval.next_due_hour}h</div>
                                <div className="text-xs text-muted-foreground">
                                  Ciclo {interval.current_cycle}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                No aplicable
                              </div>
                            )}
                          </TableCell>
                                                     <TableCell>
                             {interval.status === 'not_applicable' ? (
                               <Button 
                                 size="sm" 
                                 variant="outline"
                                 disabled
                                 className="opacity-50"
                               >
                                 No aplicable
                               </Button>
                             ) : interval.status === 'covered' ? (
                               <Button 
                                 size="sm" 
                                 variant="outline"
                                 disabled
                                 className="opacity-50"
                               >
                                 Cubierto
                               </Button>
                             ) : (
                               <Button 
                                 size="sm" 
                                 variant={isOverdue ? "destructive" : "default"}
                                 asChild
                               >
                                 <Link href={`/activos/${assetId}/mantenimiento/nuevo?planId=${interval.interval_id}&cycleHour=${interval.next_due_hour}`}>
                                   <Wrench className="h-4 w-4 mr-2" />
                                   {isOverdue ? "¡Urgente!" : isUpcoming ? "Programar" : "Registrar"}
                                 </Link>
                               </Button>
                             )}
                           </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimos Mantenimientos</CardTitle>
              <CardDescription>
                Los últimos 5 registros de mantenimiento realizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {maintenanceHistory.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-muted-foreground">No hay registros de mantenimiento para este activo.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenanceHistory.slice(0, 5).map((maintenance) => (
                      <TableRow key={maintenance.id}>
                        <TableCell>{formatDate(maintenance.date)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={maintenance.type === 'Preventivo' ? 'default' : 
                                    maintenance.type === 'Correctivo' ? 'destructive' : 'outline'}
                            className="whitespace-nowrap"
                          >
                            {maintenance.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{maintenance.hours}h</div>
                          {cycleLength > 0 && maintenance.hours && (
                            <div className="text-xs text-muted-foreground">
                              Ciclo {Math.floor(Number(maintenance.hours) / cycleLength) + 1}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{maintenance.description}</div>
                        </TableCell>
                        <TableCell>{maintenance.technician}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/activos/${assetId}/mantenimiento/${maintenance.id}`}>
                              Ver detalles
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              
              {maintenanceHistory.length > 5 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" asChild>
                    <Link href={`/activos/${assetId}/historial`}>
                      Ver todo el historial
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
} 
