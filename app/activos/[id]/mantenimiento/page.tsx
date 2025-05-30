'use client';

import { useState, useEffect, use } from 'react';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Plus, Calendar, Wrench, AlertCircle, CheckCircle2 } from "lucide-react";
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

export default function MaintenancePage({ params }: MaintenancePageProps) {
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  
  const { asset, loading: assetLoading, error: assetError } = useAsset(assetId);
  const { history: maintenanceHistory, loading: historyLoading, error: historyError } = useMaintenanceHistory(assetId);
  const [maintenanceIntervals, setMaintenanceIntervals] = useState<any[]>([]);
  const [pendingMaintenances, setPendingMaintenances] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Cargar los intervalos de mantenimiento para este modelo de equipo
  useEffect(() => {
    async function fetchMaintenanceIntervals() {
      if (!asset?.model_id) return;
      
      try {
        setLoading(true);
        const supabase = createClient();
        
        const { data, error } = await supabase
          .from("maintenance_intervals")
          .select(`
            *,
            maintenance_tasks(*)
          `)
          .eq("model_id", asset.model_id);
          
        if (error) throw error;
        
        setMaintenanceIntervals(data || []);
      } catch (err) {
        console.error("Error al cargar intervalos de mantenimiento:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }
    
    if (asset?.model_id) {
      fetchMaintenanceIntervals();
    }
  }, [asset]);

  // Procesar y filtrar mantenimientos pendientes
  useEffect(() => {
    if (!maintenanceIntervals.length || !asset) return;
    
    const currentHours = asset.current_hours || 0;
    
    // Encontrar la hora del último mantenimiento realizado (cualquier tipo)
    const allMaintenanceHours = maintenanceHistory
      .map(m => Number(m.hours) || 0)
      .filter(h => h > 0)
      .sort((a, b) => b - a); // Ordenar de mayor a menor
    
    const lastMaintenanceHours = allMaintenanceHours.length > 0 ? allMaintenanceHours[0] : 0;
    
    const pendingList = maintenanceIntervals.map(interval => {
      const intervalHours = interval.interval_value || 0;
      
      // Encontrar si este mantenimiento específico ya se realizó
      const lastMaintenanceOfType = maintenanceHistory.find(m => 
        m.maintenance_plan_id === interval.id
      );
      
      let lastMaintenanceDate = null;
      let lastMaintenanceHoursOfType = 0;
      let wasPerformed = false;
      let status = 'pending';
      let progress = 0;
      let nextHours = intervalHours;
      let urgencyLevel = 'normal';
      
      if (lastMaintenanceOfType) {
        // Este mantenimiento YA se realizó - completado, no mostrar
        lastMaintenanceHoursOfType = Number(lastMaintenanceOfType.hours) || 0;
        lastMaintenanceDate = lastMaintenanceOfType.date;
        wasPerformed = true;
        status = 'completed';
        progress = 100;
        urgencyLevel = 'low';
      } else {
        // Este mantenimiento NUNCA se realizó
        wasPerformed = false;
        
        // Verificar si fue "cubierto" por un mantenimiento posterior
        if (intervalHours <= lastMaintenanceHours) {
          // Fue cubierto por mantenimientos posteriores
          status = 'covered';
          progress = 100;
          urgencyLevel = 'low';
        } else if (currentHours >= intervalHours) {
          // Las horas actuales ya pasaron este intervalo - VENCIDO
          const hoursOverdue = currentHours - intervalHours;
          status = 'overdue';
          progress = 100;
          
          if (hoursOverdue > intervalHours * 0.5) {
            urgencyLevel = 'high';
          } else {
            urgencyLevel = 'medium';
          }
        } else {
          // Las horas actuales aún no llegan a este intervalo - PRÓXIMO/PROGRAMADO
          progress = Math.round((currentHours / intervalHours) * 100);
          const hoursRemaining = intervalHours - currentHours;
          
          // Nuevo criterio: urgencia si está a 100 horas o menos del servicio
          if (hoursRemaining <= 100) {
            status = 'upcoming';
            urgencyLevel = 'high';
          } else if (hoursRemaining <= 200) {
            status = 'upcoming';
            urgencyLevel = 'medium';
          } else {
            status = 'scheduled';
            urgencyLevel = 'low';
          }
        }
      }
      
      return {
        ...interval,
        nextHours,
        lastMaintenanceDate,
        lastMaintenanceHours: lastMaintenanceHoursOfType,
        status,
        progress,
        urgencyLevel,
        wasPerformed,
        lastMaintenance: lastMaintenanceOfType,
        intervalHours
      };
    });
    
    // Filtrar - mostrar todos los relevantes incluyendo futuros
    const filteredPending = pendingList.filter(interval => {
      // Mostrar:
      // 1. Vencidos (overdue) - nunca realizados y ya pasaron las horas
      // 2. Próximos a vencer (upcoming) - nunca realizados y cerca de las horas
      // 3. Cubiertos (covered) - nunca realizados pero cubiertos por posteriores
      // 4. Programados (scheduled) - todos los futuros para vista completa
      // NO mostrar solo: completed (ya realizados)
      return ['overdue', 'upcoming', 'covered', 'scheduled'].includes(interval.status);
    });
    
    // Ordenar por prioridad
    const sorted = filteredPending.sort((a, b) => {
      const priorityOrder = { 'overdue': 4, 'upcoming': 3, 'scheduled': 2, 'covered': 1 };
      const priorityA = priorityOrder[a.status as keyof typeof priorityOrder] || 0;
      const priorityB = priorityOrder[b.status as keyof typeof priorityOrder] || 0;
      
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      
      // Dentro de la misma prioridad, ordenar por urgencia
      const urgencyOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      const urgencyA = urgencyOrder[a.urgencyLevel as keyof typeof urgencyOrder] || 0;
      const urgencyB = urgencyOrder[b.urgencyLevel as keyof typeof urgencyOrder] || 0;
      
      if (urgencyA !== urgencyB) {
        return urgencyB - urgencyA;
      }
      
      // Finalmente por intervalo
      return a.interval_value - b.interval_value;
    });
    
    setPendingMaintenances(sorted);
  }, [maintenanceIntervals, asset, maintenanceHistory]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };

  const calculateNextMaintenance = (interval: any) => {
    if (!asset?.current_hours) {
      return (
        <div className="space-y-1">
          <div>No disponible</div>
          <div className="text-xs text-muted-foreground">
            Datos insuficientes
          </div>
        </div>
      );
    }
    
    const currentHours = asset.current_hours;
    
    // Para mantenimientos cubiertos
    if (interval.status === 'covered') {
      return (
        <div className="space-y-1">
          <div className="text-sm text-blue-600">Cubierto</div>
          <div className="text-xs text-muted-foreground">
            Por mantenimiento posterior
          </div>
        </div>
      );
    }
    
    // Para mantenimientos que ya se realizaron (tienen próximo ciclo)
    if (interval.wasPerformed && interval.nextHours) {
      const hoursRemaining = interval.nextHours - currentHours;
      
      return (
        <div className="space-y-1">
          <div className="font-medium">{interval.nextHours} horas</div>
          {hoursRemaining > 0 && (
            <div className="text-xs text-green-600">
              Faltan: {hoursRemaining} horas
            </div>
          )}
          {hoursRemaining <= 0 && (
            <div className="text-xs text-red-600 font-medium">
              ¡{Math.abs(hoursRemaining)} horas vencido!
            </div>
          )}
        </div>
      );
    }
    
    // Para mantenimientos que nunca se han realizado
    const targetHours = interval.intervalHours;
    const hoursRemaining = targetHours - currentHours;
    
    return (
      <div className="space-y-1">
        <div className="font-medium">{targetHours} horas</div>
        {interval.status === 'overdue' ? (
          <div className="text-xs text-red-600 font-medium">
            ¡{Math.abs(hoursRemaining)} horas vencido!
          </div>
        ) : (
          <div className={`text-xs ${
            hoursRemaining <= 100 ? 'text-red-600 font-medium' :
            hoursRemaining <= 200 ? 'text-amber-600 font-medium' :
            'text-muted-foreground'
          }`}>
            Faltan: {hoursRemaining} horas
          </div>
        )}
        {!interval.wasPerformed && (
          <div className="text-xs text-orange-600">
            Nunca realizado
          </div>
        )}
        {interval.status === 'upcoming' && interval.urgencyLevel === 'high' && (
          <div className="text-xs text-red-600 font-medium mt-1">
            🚨 Urgente - Próximo en ≤100h
          </div>
        )}
        {interval.status === 'upcoming' && interval.urgencyLevel === 'medium' && (
          <div className="text-xs text-amber-600 font-medium mt-1">
            ⚠️ Próximo - En ≤200h
          </div>
        )}
      </div>
    );
  };

  const isLoading = assetLoading || historyLoading || loading;
  const anyError = assetError || historyError || error;

  return (
    <DashboardShell>
      <DashboardHeader
        heading={isLoading ? "Cargando plan de mantenimiento..." : `Plan de Mantenimiento: ${asset?.name || ""}`}
        text={isLoading ? "" : `Programación y registro de mantenimientos para ${asset?.asset_id || ""}`}
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
          <Card>
            <CardHeader>
              <CardTitle>Mantenimientos Pendientes</CardTitle>
              <CardDescription>
                Mantenimientos que requieren atención en base a las horas actuales: {asset?.current_hours || 0} horas
              </CardDescription>
              <div className="mt-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                <p>
                  <span className="font-medium">Tipos de intervalos:</span> Los mantenimientos preventivos se realizan según intervalos predefinidos.
                  Cada checkpoint de mantenimiento se identifica por su tipo (Preventivo, etc.) y la frecuencia de horas.
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full bg-red-600"></div>
                  <span>Vencido (urgente)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                  <span>Vencido</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                  <span>Próximo (≤100h)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full bg-blue-400"></div>
                  <span>Cubierto</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <span>Programado</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pendingMaintenances.length === 0 ? (
                <div className="py-8 text-center border rounded-md bg-gray-50">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-2" />
                  <p className="text-lg font-medium">No hay mantenimientos pendientes</p>
                  <p className="text-muted-foreground">Todos los mantenimientos están al día</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Checkpoint</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Intervalo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Próximo a las</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingMaintenances.map((interval) => {
                      return (
                        <TableRow 
                          key={interval.id} 
                          className={
                            interval.status === 'overdue' && interval.urgencyLevel === 'high' ? "bg-red-50" : 
                            interval.status === 'overdue' && interval.urgencyLevel === 'medium' ? "bg-orange-50" :
                            interval.status === 'upcoming' && interval.urgencyLevel === 'high' ? "bg-red-50" :
                            interval.status === 'upcoming' ? "bg-amber-50" : 
                            interval.status === 'covered' ? "bg-blue-50" : 
                            interval.status === 'scheduled' ? "bg-green-50" : ""
                          }
                        >
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge 
                                variant={
                                  interval.status === 'overdue' && interval.urgencyLevel === 'high' ? "destructive" :
                                  interval.status === 'overdue' ? "default" :
                                  interval.status === 'upcoming' && interval.urgencyLevel === 'high' ? "destructive" :
                                  interval.status === 'upcoming' ? "default" : 
                                  interval.status === 'covered' ? "secondary" : 
                                  interval.status === 'scheduled' ? "outline" : "outline"
                                }
                                className="whitespace-nowrap text-xs inline-flex mb-1"
                              >
                                {interval.type}
                                {interval.interval_value && ` ${interval.interval_value}h`}
                              </Badge>
                              <div className="text-xs font-medium">
                                ID: {interval.id.substring(0, 8)}...
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{interval.description}</div>
                            {interval.wasPerformed && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Último: {formatDate(interval.lastMaintenanceDate)} a las {interval.lastMaintenanceHours}h
                              </div>
                            )}
                            {!interval.wasPerformed && interval.status === 'covered' && (
                              <div className="text-xs text-blue-600 mt-1">
                                📋 No realizado, pero cubierto por mantenimiento posterior
                              </div>
                            )}
                            {!interval.wasPerformed && interval.status !== 'covered' && (
                              <div className="text-xs text-orange-600 mt-1">
                                ⚠️ Nunca realizado
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">Cada {interval.interval_value} horas</div>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {interval.type}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {interval.interval_value}h
                              </Badge>
                            </div>
                            {interval.wasPerformed ? (
                              <div className="text-xs text-muted-foreground mt-1">
                                Desde las {interval.lastMaintenanceHours}h hasta las {interval.nextHours}h
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground mt-1">
                                {interval.status === 'covered' 
                                  ? `Cubierto por mantenimientos posteriores`                                  : `Desde 0h hasta las ${interval.intervalHours}h`
                                }
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                              <div 
                                className={`h-2.5 rounded-full ${
                                  interval.status === 'overdue' && interval.urgencyLevel === 'high' ? 'bg-red-600' :
                                  interval.status === 'overdue' ? 'bg-orange-500' :
                                  interval.status === 'upcoming' && interval.urgencyLevel === 'high' ? 'bg-red-500' :
                                  interval.status === 'upcoming' ? 'bg-amber-500' : 
                                  interval.status === 'covered' ? 'bg-blue-400' : 
                                  interval.status === 'scheduled' ? 'bg-green-500' : 'bg-gray-400'
                                }`}
                                style={{ width: `${Math.min(interval.progress, 100)}%` }}
                              ></div>
                            </div>
                            <div className="text-xs">
                              {interval.status === 'covered' ? 'Cubierto' : `${interval.progress}% completado`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Horas actuales: {asset?.current_hours || 0}h
                            </div>
                            {interval.status === 'overdue' && (
                              <div className="text-xs text-red-600 font-medium mt-1">
                                {interval.urgencyLevel === 'high' ? '🚨 Muy vencido' : '⚠️ Vencido'}
                              </div>
                            )}
                            {interval.status === 'upcoming' && interval.urgencyLevel === 'high' && (
                              <div className="text-xs text-red-600 font-medium mt-1">
                                🚨 Urgente - Próximo en ≤100h
                              </div>
                            )}
                            {interval.status === 'upcoming' && interval.urgencyLevel === 'medium' && (
                              <div className="text-xs text-amber-600 font-medium mt-1">
                                ⚠️ Próximo - En ≤200h
                              </div>
                            )}
                            {interval.status === 'covered' && (
                              <div className="text-xs text-blue-600 font-medium mt-1">
                                ℹ️ Cubierto por mantenimiento posterior
                              </div>
                            )}
                            {interval.status === 'scheduled' && (
                              <div className="text-xs text-green-600 font-medium mt-1">
                                📅 Programado para el futuro
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {calculateNextMaintenance(interval)}
                          </TableCell>
                          <TableCell>
                            {interval.status === 'covered' ? (
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
                                variant={
                                  interval.status === 'overdue' && interval.urgencyLevel === 'high' ? "destructive" :
                                  interval.status === 'overdue' || interval.status === 'upcoming' ? "default" : "outline"
                                }
                                asChild
                              >
                                <Link href={`/activos/${assetId}/mantenimiento/nuevo?planId=${interval.id}`}>
                                  <Wrench className="h-4 w-4 mr-2" />
                                  {interval.status === 'overdue' && interval.urgencyLevel === 'high' ? "¡Urgente!" :
                                   interval.status === 'overdue' ? "Registrar" : 
                                   interval.status === 'upcoming' ? "Programar" : "Registrar"}
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
                      <TableHead>Intervalo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenanceHistory.slice(0, 5).map((maintenance) => {
                      // Buscar el intervalo correspondiente a este mantenimiento
                      const relatedInterval = maintenanceIntervals.find(
                        interval => interval.id === maintenance.maintenance_plan_id
                      );
                      
                      return (
                      <TableRow 
                        key={maintenance.id}
                        className={
                          maintenance.maintenance_plan_id ? "bg-blue-50/50" : ""
                        }
                      >
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
                          {maintenance.maintenance_plan_id ? (
                            <div className="space-y-1">
                              <div className="font-medium">
                                {relatedInterval ? (
                                  <>
                                    <Badge 
                                      variant="secondary" 
                                      className="whitespace-nowrap text-xs"
                                    >
                                      {relatedInterval.type} {relatedInterval.interval_value}h
                                    </Badge>
                                  </>
                                ) : (
                                  "Plan asociado"
                                )}
                              </div>
                              {relatedInterval && (
                                <div className="text-xs text-muted-foreground">
                                  {relatedInterval.description}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">No asociado a un intervalo</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{maintenance.description}</div>
                          {maintenance.hours && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Horómetro: {maintenance.hours}h
                            </div>
                          )}
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
                    )})}
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
