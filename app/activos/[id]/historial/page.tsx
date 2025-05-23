'use client';

import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AssetHistory } from "@/components/assets/asset-history";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAsset, useMaintenanceHistory, useIncidents } from "@/hooks/useSupabase";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function AssetHistoryPage({ params }: { params: { id: string } }) {
  const assetId = params.id;
  const [activeTab, setActiveTab] = useState("all");
  
  // Fetch the asset name to display in the heading
  const { asset, loading } = useAsset(assetId);
  const { history: maintenanceHistory, loading: maintenanceLoading } = useMaintenanceHistory(assetId);
  const { incidents, loading: incidentsLoading } = useIncidents(assetId);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };

  return (
    <DashboardShell>
      <DashboardHeader
        heading={loading ? `Cargando historial...` : `Historial del Activo: ${asset?.name || assetId}`}
        text="Historial completo de mantenimientos, incidentes, reemplazos de partes y costos asociados."
      >
        <Button variant="outline" asChild>
          <Link href={`/activos/${assetId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>

      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">Todo</TabsTrigger>
          <TabsTrigger value="maintenance">Mantenimientos</TabsTrigger>
          <TabsTrigger value="incidents">Incidentes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <AssetHistory id={assetId} />
        </TabsContent>
        
        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Mantenimientos</CardTitle>
            </CardHeader>
            <CardContent>
              {maintenanceLoading ? (
                <div>Cargando mantenimientos...</div>
              ) : maintenanceHistory.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No hay registros de mantenimiento</p>
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
                    {maintenanceHistory.map((maintenance) => (
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
                        <TableCell className="max-w-xs truncate">{maintenance.description}</TableCell>
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
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Incidentes</CardTitle>
            </CardHeader>
            <CardContent>
              {incidentsLoading ? (
                <div>Cargando incidentes...</div>
              ) : incidents.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No hay registros de incidentes</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Reportado por</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Impacto</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((incident) => (
                      <TableRow key={incident.id}>
                        <TableCell>{formatDate(incident.date)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={incident.type === 'Falla' ? 'destructive' : 
                                   incident.type === 'Alerta' ? 'default' : 'outline'}
                          >
                            {incident.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{incident.reported_by}</TableCell>
                        <TableCell className="max-w-xs truncate">{incident.description}</TableCell>
                        <TableCell>{incident.impact || "-"}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={incident.status === 'Resuelto' ? 'outline' : 
                                   incident.status === 'Pendiente' ? 'destructive' : 'default'}
                          >
                            {incident.status || 'Desconocido'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
