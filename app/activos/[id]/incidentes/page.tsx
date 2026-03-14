'use client';

import { useState, useEffect, use } from 'react';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Plus, CheckCircle, AlertCircle, Eye, FileText, Camera } from "lucide-react";
import Link from "next/link";
import { useAsset, useIncidents } from "@/hooks/useSupabase";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { IncidentRegistrationDialog } from "@/components/assets/dialogs/incident-registration-dialog";
import { useToast } from "@/hooks/use-toast";

interface IncidentPageProps {
  params: Promise<{
    id: string
  }>
}

export default function IncidentPage({ params }: IncidentPageProps) {
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  const { toast } = useToast();
  
  const { asset, loading: assetLoading, error: assetError } = useAsset(assetId);
  const { incidents, loading: incidentsLoading, error: incidentsError, refetch } = useIncidents(assetId);
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };

  const getStatusBadge = (status: string) => {
    // Normalizar estados equivalentes (compatibilidad hacia atrás)
    const normalized = status?.toLowerCase();
    const isResolved = normalized === 'resuelto' || normalized === 'cerrado';
    const isPending = normalized === 'pendiente';
    const isInProgress = normalized === 'en progreso';

    if (isResolved) {
      return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="h-3 w-3 mr-1" />Resuelto</Badge>
    }
    if (isPending) {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Pendiente</Badge>
    }
    if (isInProgress) {
      return <Badge variant="default"><AlertTriangle className="h-3 w-3 mr-1" />En Progreso</Badge>
    }
    switch (status?.toLowerCase()) {
      case "resuelto":
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="h-3 w-3 mr-1" />Resuelto</Badge>
      case "pendiente":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Pendiente</Badge>
      case "en progreso":
        return <Badge variant="default"><AlertTriangle className="h-3 w-3 mr-1" />En Progreso</Badge>
      default:
        return <Badge variant="secondary">{status || "Desconocido"}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case "falla":
      case "falla eléctrica":
      case "falla mecánica":
      case "falla hidráulica":
        return <Badge variant="destructive">{type}</Badge>
      case "alerta":
        return <Badge variant="default">{type}</Badge>
      case "accidente":
        return <Badge variant="secondary">{type}</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const isLoading = assetLoading || incidentsLoading;
  const anyError = assetError || incidentsError;

  return (
    <DashboardShell>
      <DashboardHeader
        heading={isLoading ? "Cargando incidentes..." : `Incidentes: ${asset?.name || ""}`}
        text={isLoading ? "" : `Registro y seguimiento de incidentes para ${asset?.asset_id || ""}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/activos/${assetId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <Button onClick={() => setShowIncidentDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Incidente
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
              <CardTitle>Registro de Incidentes</CardTitle>
              <CardDescription>
                Todos los incidentes reportados para este activo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <div className="py-8 text-center border rounded-md bg-gray-50">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
                  <p className="text-lg font-medium">No hay incidentes reportados</p>
                  <p className="text-muted-foreground mb-4">Este activo no tiene incidentes registrados</p>
                  <Button onClick={() => setShowIncidentDialog(true)} variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Registrar primer incidente
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Reportado por</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Estado</TableHead>
                                                <TableHead>Evidencia</TableHead>
                          <TableHead>Orden de Trabajo</TableHead>
                          <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((incident) => {
                      const evidence = getIncidentEvidence(incident);
                      return (
                        <TableRow key={incident.id}>
                          <TableCell>{formatDate(incident.date)}</TableCell>
                          <TableCell>{getTypeBadge(incident.type)}</TableCell>
                          <TableCell>{incident.reported_by}</TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={incident.description}>
                              {incident.description}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(incident.status || "")}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {evidence.length > 0 ? (
                                <Badge variant="outline" className="text-blue-600 border-blue-600">
                                  <Camera className="h-3 w-3 mr-1" />
                                  {evidence.length} archivo(s)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-500">
                                  <FileText className="h-3 w-3 mr-1" />
                                  Sin evidencia
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {incident.work_order_id ? (
                              <div className="flex flex-col gap-1">
                                <Badge variant="default" className="text-blue-600 border-blue-600 w-fit">
                                  <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                  </svg>
                                  OT Vinculada
                                </Badge>
                                {incident.purchase_order_id && (
                                  <Badge variant="outline" className="text-green-600 border-green-600 w-fit">
                                    <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                    </svg>
                                    OC Vinculada
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-gray-500">
                                  Sin OT
                                </Badge>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 px-2 text-xs"
                                  onClick={async () => {
                                    try {
                                      const response = await fetch('/api/work-orders/generate-from-incident', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          incident_id: incident.id,
                                          priority: incident.type?.toLowerCase().includes('crítica') || 
                                                    incident.type?.toLowerCase().includes('falla') ||
                                                    incident.type?.toLowerCase().includes('accidente') ? 'Alta' : 'Media'
                                        }),
                                      });
                                      
                                      if (response.ok) {
                                        // Recargar la página para mostrar la OT generada
                                        refetch();
                                        toast({
                                          title: "Orden de trabajo generada",
                                          description: "Se ha creado una orden de trabajo a partir del incidente.",
                                        });
                                      } else {
                                        toast({
                                          title: "Error",
                                          description: "No se pudo generar la orden de trabajo.",
                                          variant: "destructive"
                                        });
                                      }
                                    } catch (error) {
                                      toast({
                                        title: "Error",
                                        description: "Ocurrió un error al generar la orden de trabajo.",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                >
                                  Generar OT
                                </Button>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                              >
                                <Link href={`/incidentes/${incident.id}`}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  Ver Detalles
                                </Link>
                              </Button>
                              {incident.work_order_id && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  asChild
                                >
                                  <Link href={`/ordenes/${incident.work_order_id}`}>
                                    Ver OT
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Resumen estadístico */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{incidents.length}</div>
                <p className="text-xs text-muted-foreground">Total de Incidentes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">
                  {incidents.filter(i => {
                    const s = i.status?.toLowerCase();
                    return s === 'pendiente';
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">
                  {incidents.filter(i => {
                    const s = i.status?.toLowerCase();
                    return s === 'resuelto' || s === 'cerrado';
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">Resueltos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">
                  {incidents.reduce((acc, i) => acc + (i.downtime || 0), 0).toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">Horas Inactivo</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <IncidentRegistrationDialog
        isOpen={showIncidentDialog}
        onClose={() => setShowIncidentDialog(false)}
        assetId={assetId}
        onSuccess={() => {
          setShowIncidentDialog(false);
          refetch();
        }}
      />
    </DashboardShell>
  );
} 