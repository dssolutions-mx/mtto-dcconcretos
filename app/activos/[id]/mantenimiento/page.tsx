'use client';

import { useState, useEffect } from 'react';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Plus, Calendar, Wrench } from "lucide-react";
import Link from "next/link";
import { useAsset, useMaintenanceHistory } from "@/hooks/useSupabase";
import { createClient } from "@/lib/supabase";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface MaintenancePageProps {
  params: {
    id: string
  }
}

export default function MaintenancePage({ params }: MaintenancePageProps) {
  const assetId = params.id;
  
  const { asset, loading: assetLoading, error: assetError } = useAsset(assetId);
  const { history: maintenanceHistory, loading: historyLoading, error: historyError } = useMaintenanceHistory(assetId);
  const [maintenanceIntervals, setMaintenanceIntervals] = useState<any[]>([]);
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };

  const calculateNextMaintenance = (interval: any) => {
    if (!asset?.current_hours || !interval.hours) return "No disponible";
    
    // Encontrar el último mantenimiento de este tipo
    const lastMaintenance = maintenanceHistory.find(m => 
      m.maintenance_plan_id === interval.id
    );
    
    let baseHours = asset.current_hours;
    if (lastMaintenance?.hours) {
      baseHours = Number(lastMaintenance.hours);
    }
    
    const nextHours = baseHours + interval.hours;
    return `${nextHours} horas`;
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
              <CardTitle>Plan de Mantenimiento Preventivo</CardTitle>
              <CardDescription>
                Intervalos de mantenimiento recomendados para este modelo de equipo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {maintenanceIntervals.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-muted-foreground">No hay planes de mantenimiento definidos para este modelo de equipo.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Intervalo</TableHead>
                      <TableHead>Próximo a las</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenanceIntervals.map((interval) => (
                      <TableRow key={interval.id}>
                        <TableCell>
                          <Badge variant="outline">{interval.type}</Badge>
                        </TableCell>
                        <TableCell>{interval.description}</TableCell>
                        <TableCell>Cada {interval.hours} horas</TableCell>
                        <TableCell>{calculateNextMaintenance(interval)}</TableCell>
                        <TableCell>
                          <Button size="sm" asChild>
                            <Link href={`/activos/${assetId}/mantenimiento/nuevo?planId=${interval.id}`}>
                              <Wrench className="h-4 w-4 mr-2" />
                              Registrar
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
                          >
                            {maintenance.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{maintenance.description}</TableCell>
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