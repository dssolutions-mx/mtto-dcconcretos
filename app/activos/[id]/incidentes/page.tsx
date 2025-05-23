'use client';

import { useState, useEffect, use } from 'react';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Plus, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useAsset, useIncidents } from "@/hooks/useSupabase";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { IncidentRegistrationDialog } from "@/components/assets/dialogs/incident-registration-dialog";

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
                      <TableHead>Impacto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tiempo Inactivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((incident) => (
                      <TableRow key={incident.id}>
                        <TableCell>{formatDate(incident.date)}</TableCell>
                        <TableCell>{getTypeBadge(incident.type)}</TableCell>
                        <TableCell>{incident.reported_by}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={incident.description}>
                            {incident.description}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-sm text-muted-foreground truncate" title={incident.impact || ""}>
                            {incident.impact || "No especificado"}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(incident.status || "")}</TableCell>
                        <TableCell>
                          {incident.downtime ? `${incident.downtime} hrs` : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
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
    </DashboardShell>
  );
} 