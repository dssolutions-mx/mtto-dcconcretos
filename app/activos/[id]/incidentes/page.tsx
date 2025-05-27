'use client';

import { useState, useEffect, use } from 'react';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, AlertTriangle, CheckCircle, AlertCircle, Eye, FileText, Camera } from "lucide-react";
import Link from "next/link";
import { useAsset, useIncidents } from "@/hooks/useSupabase";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { IncidentRegistrationDialog } from "@/components/assets/dialogs/incident-registration-dialog";
import { EvidenceViewer, type EvidenceItem } from "@/components/ui/evidence-viewer";

interface IncidentPageProps {
  params: Promise<{
    id: string
  }>
}

export default function IncidentPage({ params }: IncidentPageProps) {
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  
  const { asset, loading: assetLoading, error: assetError } = useAsset(assetId);
  const { incidents, loading: incidentsLoading, error: incidentsError, refetch } = useIncidents(assetId);
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [showIncidentDetails, setShowIncidentDetails] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };

  const getStatusBadge = (status: string) => {
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

  const getIncidentEvidence = (incident: any): EvidenceItem[] => {
    if (!incident.documents) return [];
    
    try {
      // Handle both old format (string[]) and new format (EvidenceItem[])
      if (Array.isArray(incident.documents)) {
        if (typeof incident.documents[0] === 'string') {
          // Old format: array of URLs
          return incident.documents.map((url: string, index: number) => ({
            id: `${incident.id}_${index}`,
            url,
            description: `Evidencia del incidente ${index + 1}`,
            category: 'documentacion_soporte',
            uploaded_at: incident.created_at || new Date().toISOString()
          }));
        } else {
          // New format: array of evidence objects
          return incident.documents;
        }
      }
      return [];
    } catch (error) {
      console.error('Error parsing incident evidence:', error);
      return [];
    }
  };

  const handleViewIncident = (incident: any) => {
    setSelectedIncident(incident);
    setShowIncidentDetails(true);
  };

  const isLoading = assetLoading || incidentsLoading;
  const anyError = assetError || incidentsError;

  return (
    <DashboardShell>
      <DashboardHeader
        heading={isLoading ? "Cargando incidentes..." : `Gestión de Incidentes: ${asset?.name || ""}`}
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
                              <Badge variant="default" className="text-blue-600 border-blue-600">
                                <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                OT Vinculada
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500">
                                Sin OT
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewIncident(incident)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver Detalles
                              </Button>
                              {incident.work_order_id && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => window.open(`/ordenes/${incident.work_order_id}`, '_blank')}
                                >
                                  Ver OT
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
                  {incidents.filter(i => i.status?.toLowerCase() === 'pendiente').length}
                </div>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">
                  {incidents.filter(i => i.status?.toLowerCase() === 'resuelto').length}
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

      <Dialog open={showIncidentDetails} onOpenChange={setShowIncidentDetails}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Incidente</DialogTitle>
            <DialogDescription>
              Información completa del incidente y evidencia asociada
            </DialogDescription>
          </DialogHeader>
          
          {selectedIncident && (
            <div className="space-y-6">
              {/* Información básica del incidente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Información General</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="text-sm font-medium">Fecha:</span>
                      <p className="text-sm text-muted-foreground">{formatDate(selectedIncident.date)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Tipo:</span>
                      <div className="mt-1">{getTypeBadge(selectedIncident.type)}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Estado:</span>
                      <div className="mt-1">{getStatusBadge(selectedIncident.status || "")}</div>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Reportado por:</span>
                      <p className="text-sm text-muted-foreground">{selectedIncident.reported_by}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Impacto y Costos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="text-sm font-medium">Tiempo Inactivo:</span>
                      <p className="text-sm text-muted-foreground">
                        {selectedIncident.downtime ? `${selectedIncident.downtime} hrs` : "No especificado"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Horas de Trabajo:</span>
                      <p className="text-sm text-muted-foreground">
                        {selectedIncident.labor_hours ? `${selectedIncident.labor_hours} hrs` : "No especificado"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Costo Total:</span>
                      <p className="text-sm text-muted-foreground">
                        {selectedIncident.total_cost ? `$${selectedIncident.total_cost}` : "No especificado"}
                      </p>
                    </div>
                    {selectedIncident.work_order_text && (
                      <div>
                        <span className="text-sm font-medium">Orden de Trabajo:</span>
                        <p className="text-sm text-muted-foreground">{selectedIncident.work_order_text}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Descripción e impacto */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Descripción del Incidente</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{selectedIncident.description}</p>
                  {selectedIncident.impact && (
                    <div className="mt-4">
                      <span className="text-sm font-medium">Impacto:</span>
                      <p className="text-sm text-muted-foreground mt-1">{selectedIncident.impact}</p>
                    </div>
                  )}
                  {selectedIncident.resolution && (
                    <div className="mt-4">
                      <span className="text-sm font-medium">Resolución:</span>
                      <p className="text-sm text-muted-foreground mt-1">{selectedIncident.resolution}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Repuestos utilizados */}
              {selectedIncident.parts && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Repuestos Utilizados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {JSON.parse(selectedIncident.parts).map((part: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                          <div>
                            <span className="text-sm font-medium">{part.name}</span>
                            {part.partNumber && (
                              <span className="text-xs text-muted-foreground ml-2">({part.partNumber})</span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-sm">Cant: {part.quantity}</span>
                            {part.cost && (
                              <span className="text-xs text-muted-foreground ml-2">${part.cost}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Evidencia del incidente */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Evidencia del Incidente</CardTitle>
                </CardHeader>
                <CardContent>
                  <EvidenceViewer 
                    evidence={getIncidentEvidence(selectedIncident)}
                    title=""
                    showCategories={true}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
} 