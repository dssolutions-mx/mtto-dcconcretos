'use client';

import { useState, useMemo, useEffect, use } from "react";
import { useAsset, useMaintenanceHistory, useIncidents, useUpcomingMaintenance } from "@/hooks/useSupabase";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { ArrowLeft, FileText, History, Wrench, Calendar, Edit, Camera, ExternalLink, AlertTriangle, CheckCircle, AlertCircle, Clock, ClipboardCheck, Plus, Gauge, Users, MapPin, Calendar as CalendarIcon, Package, Settings } from "lucide-react";
import { format, formatDistance, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Asset, AssetWithModel, EquipmentModel } from "@/types";
import { createClient } from "@/lib/supabase";

// Define category type
type CategoryInfo = {
  label: string;
  color: string;
  icon: string;
};

type CategoryMap = {
  [key: string]: CategoryInfo;
};

// Map of category codes to more readable names and styling
const PHOTO_CATEGORIES: CategoryMap = {
  'frontal': { label: 'Vista Frontal', color: 'bg-blue-500', icon: '🔍' },
  'trasera': { label: 'Vista Trasera', color: 'bg-green-500', icon: '🔍' },
  'lateral': { label: 'Vista Lateral', color: 'bg-yellow-500', icon: '🔍' },
  'interior': { label: 'Interior', color: 'bg-purple-500', icon: '🏠' },
  'motor': { label: 'Motor', color: 'bg-red-500', icon: '⚙️' },
  'placa': { label: 'Placa/Serial', color: 'bg-indigo-500', icon: '🔢' },
  'detalles': { label: 'Detalles', color: 'bg-orange-500', icon: '🔎' },
  'daños': { label: 'Daños/Problemas', color: 'bg-red-700', icon: '⚠️' },
  'otros': { label: 'Otros', color: 'bg-gray-500', icon: '📷' },
};

export default function AssetDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  
  const { asset: rawAsset, loading, error } = useAsset(assetId);
  const { history: maintenanceHistory, loading: maintenanceLoading } = useMaintenanceHistory(assetId);
  const { incidents, loading: incidentsLoading } = useIncidents(assetId);
  const [activeTab, setActiveTab] = useState("status");
  const [upcomingMaintenances, setUpcomingMaintenances] = useState<any[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [maintenanceIntervals, setMaintenanceIntervals] = useState<any[]>([]);
  const [completedChecklists, setCompletedChecklists] = useState<any[]>([]);
  const [checklistsLoading, setChecklistsLoading] = useState(true);
  const [pendingChecklists, setPendingChecklists] = useState<any[]>([]);
  const [pendingChecklistsLoading, setPendingChecklistsLoading] = useState(true);
  
  // Map the asset with equipment_models to use model property
  const asset = useMemo(() => {
    if (!rawAsset) return null;
    
    const assetWithModel: AssetWithModel = {
      ...rawAsset,
      model: (rawAsset as any).equipment_models as EquipmentModel
    };
    
    return assetWithModel;
  }, [rawAsset]);
  
  // Fetch upcoming maintenances with corrected logic
  useEffect(() => {
    if (assetId && asset) {
      const fetchUpcomingMaintenances = async () => {
        try {
          setUpcomingLoading(true);
          const response = await fetch(`/api/calendar/upcoming-maintenance?assetId=${assetId}`);
          if (response.ok) {
            const data = await response.json();
            console.log('API Response for asset', assetId, ':', data);
            // API should return overdue and upcoming maintenances for this asset
            setUpcomingMaintenances(data.upcomingMaintenances || []);
          } else {
            console.error('Error fetching upcoming maintenance:', response.statusText);
            setUpcomingMaintenances([]);
          }
        } catch (error) {
          console.error('Error fetching upcoming maintenance:', error);
          setUpcomingMaintenances([]);
        } finally {
          setUpcomingLoading(false);
        }
      };
      
      fetchUpcomingMaintenances();
    }
  }, [assetId, asset, maintenanceHistory]);
  
  // Add a new effect to fetch maintenance intervals
  useEffect(() => {
    if (asset?.model_id) {
      const fetchMaintenanceIntervals = async () => {
        try {
          const supabase = createClient();
          
          const { data, error } = await supabase
            .from("maintenance_intervals")
            .select("*")
            .eq("model_id", asset.model_id!); // Use non-null assertion since we check above
            
          if (error) throw error;
          setMaintenanceIntervals(data || []);
        } catch (err) {
          console.error("Error fetching maintenance intervals:", err);
        }
      };
      
      fetchMaintenanceIntervals();
    }
  }, [asset?.model_id]);
  
  // Add a new effect to fetch completed checklists
  useEffect(() => {
    if (assetId) {
      const fetchCompletedChecklists = async () => {
        try {
          setChecklistsLoading(true)
          
          const response = await fetch(`/api/checklists/schedules?status=completado&assetId=${assetId}`)
          if (response.ok) {
            const result = await response.json()
            setCompletedChecklists(result.data || [])
          } else {
            console.error('Error fetching completed checklists:', response.statusText)
            setCompletedChecklists([])
          }
        } catch (err) {
          console.error("Error fetching completed checklists:", err)
          setCompletedChecklists([])
        } finally {
          setChecklistsLoading(false)
        }
      }
      
      fetchCompletedChecklists()
    }
  }, [assetId])
  
  // Add a new effect to fetch pending checklists
  useEffect(() => {
    if (assetId) {
      const fetchPendingChecklists = async () => {
        try {
          setPendingChecklistsLoading(true)
          
          const response = await fetch(`/api/checklists/schedules?status=pendiente&assetId=${assetId}`)
          if (response.ok) {
            const result = await response.json()
            setPendingChecklists(result.data || [])
          } else {
            console.error('Error fetching pending checklists:', response.statusText)
            setPendingChecklists([])
          }
        } catch (err) {
          console.error("Error fetching pending checklists:", err)
          setPendingChecklists([])
        } finally {
          setPendingChecklistsLoading(false)
        }
      }
      
      fetchPendingChecklists()
    }
  }, [assetId])
  
  // Función para mostrar el estado con un color adecuado
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return <Badge className="bg-green-500">Operativo</Badge>
      case "maintenance":
        return <Badge className="bg-yellow-500">En Mantenimiento</Badge>
      case "repair":
        return <Badge className="bg-red-500">En Reparación</Badge>
      case "inactive":
        return <Badge variant="outline">Inactivo</Badge>
      default:
        return <Badge variant="secondary">{status || "Desconocido"}</Badge>
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading=""
        text=""
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/activos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Activos
            </Link>
          </Button>
        </div>
      </DashboardHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Error al cargar los datos del activo: {error.message}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Professional Clean Asset Header - Mobile Optimized */}
          <Card className="border-2">
            <CardHeader className="pb-3 md:pb-4">
              {/* Main Asset Title and Status */}
              <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2 min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold break-words">{asset?.name}</h1>
                  <div className="flex flex-col space-y-1 sm:space-y-0 sm:flex-row sm:items-center sm:gap-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">{asset?.asset_id}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="break-words">{asset?.model?.manufacturer} {asset?.model?.name || "Sin modelo"}</span>
                    {asset?.serial_number && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="break-words">S/N: {asset.serial_number}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 self-start">
                  {getStatusBadge(asset?.status || "")}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              {/* Key Metrics Row - Professional Style */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-4 md:mb-6">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold">{asset?.current_hours || 0}h</div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">Horas Operación</div>
                </div>
                
                <div className="text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                    {asset?.current_kilometers || 0}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Kilómetros
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                    {maintenanceHistory.length > 0 && asset?.current_hours && maintenanceHistory[0]?.hours ? 
                      `${asset.current_hours - maintenanceHistory[0].hours}h` : 
                      "0h"
                    }
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">Desde Último Mant.</div>
                </div>
                
                <div className="text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                    {(incidents.filter(i => i.status === 'Pendiente').length + pendingChecklists.length)}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">Tareas Pendientes</div>
                </div>
              </div>
              
              {/* Secondary Information and Actions - Mobile Optimized */}
              <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center lg:justify-between pt-4 border-t">
                <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="break-words">{asset?.location || "Sin ubicación"}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 flex-shrink-0" />
                    <span className="break-words">{asset?.department || "Sin departamento"}</span>
                  </span>
                  {asset?.purchase_date && (
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span className="break-words">Compra: {formatDate(asset.purchase_date)}</span>
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:gap-2">
                  <Button size="sm" asChild className="w-full sm:w-auto justify-center">
                    <Link href={`/activos/${assetId}/mantenimiento/nuevo`}>
                      <Wrench className="h-4 w-4 mr-2" />
                      Nueva Orden
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild className="w-full sm:w-auto justify-center">
                    <Link href={`/activos/${assetId}/incidentes`}>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Incidente
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild className="w-full sm:w-auto justify-center">
                    <Link href={`/activos/${assetId}/editar`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="status" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start mb-4 h-auto p-1 flex-wrap gap-1">
              <TabsTrigger value="status" className="text-xs sm:text-sm px-3 py-2">Estado & Mantenimiento</TabsTrigger>
              <TabsTrigger value="incidents" className="text-xs sm:text-sm px-3 py-2 relative">
                <span>Incidentes & Checklists</span>
                {(incidents.filter(i => i.status === 'Pendiente').length > 0 || pendingChecklists.length > 0) && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center min-w-[20px]">
                    {incidents.filter(i => i.status === 'Pendiente').length + pendingChecklists.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="technical" className="text-xs sm:text-sm px-3 py-2">Información Técnica</TabsTrigger>
              <TabsTrigger value="documentation" className="text-xs sm:text-sm px-3 py-2">Documentación</TabsTrigger>
            </TabsList>
            
            <TabsContent value="status" className="space-y-4">
              {/* Critical Alerts Section */}
              {(upcomingMaintenances.filter(m => m.status === 'overdue').length > 0 || 
                incidents.filter(i => i.status === 'Pendiente').length > 0 ||
                pendingChecklists.length > 0) && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {upcomingMaintenances.filter(m => m.status === 'overdue').length > 0 && (
                        <p><strong>{upcomingMaintenances.filter(m => m.status === 'overdue').length}</strong> mantenimiento(s) vencido(s)</p>
                      )}
                      {incidents.filter(i => i.status === 'Pendiente').length > 0 && (
                        <p><strong>{incidents.filter(i => i.status === 'Pendiente').length}</strong> incidente(s) pendiente(s)</p>
                      )}
                      {pendingChecklists.length > 0 && (
                        <p><strong>{pendingChecklists.length}</strong> checklist(s) pendiente(s)</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Maintenance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Próximos Mantenimientos
                    </CardTitle>
                    <CardDescription>
                      Mantenimientos programados para este activo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {upcomingLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : upcomingMaintenances.length === 0 ? (
                      <div className="text-center py-6 space-y-3">
                        <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
                        <div>
                          <p className="text-sm font-medium text-green-700">Mantenimientos al día</p>
                          <p className="text-xs text-muted-foreground mt-1">No hay mantenimientos vencidos o próximos</p>
                        </div>
                        <Button variant="outline" size="sm" asChild className="mt-2">
                          <Link href={`/activos/${assetId}/mantenimiento`}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Ver calendario completo
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {upcomingMaintenances.slice(0, 3).map((maintenance, index) => (
                          <div key={index} className={`border rounded-lg p-3 ${
                            maintenance.status === 'overdue' ? 'border-red-300 bg-red-50' : 
                            maintenance.status === 'upcoming' ? 'border-amber-300 bg-amber-50' : 
                            'border-gray-200 bg-white'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                              <div className="min-w-0 flex-1">
                                <Badge 
                                  variant={
                                    maintenance.status === 'overdue' ? 'destructive' : 
                                    maintenance.status === 'upcoming' ? 'default' : 'outline'
                                  }
                                  className="mb-2"
                                >
                                  {maintenance.status === 'overdue' ? '🚨 Vencido' : 
                                   maintenance.status === 'upcoming' ? '⏰ Próximo' : 
                                   maintenance.status === 'scheduled' ? '📅 Programado' : '✅ Cubierto'}
                                </Badge>
                                <h4 className="font-medium text-sm sm:text-base break-words">{maintenance.intervalName}</h4>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={`text-xs self-start ${
                                  maintenance.urgency === 'high' ? 'border-red-500 text-red-600 bg-red-50' : 
                                  maintenance.urgency === 'medium' ? 'border-yellow-500 text-yellow-600 bg-yellow-50' : 
                                  'border-green-500 text-green-600 bg-green-50'
                                }`}
                              >
                                {maintenance.urgency === 'high' ? 'Alta prioridad' : 
                                 maintenance.urgency === 'medium' ? 'Media prioridad' : 'Baja prioridad'}
                              </Badge>
                            </div>
                            <div className="space-y-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 flex-shrink-0" />
                                <span className="break-words">
                                  {maintenance.unit === 'hours' ? 
                                    `${maintenance.currentValue}/${maintenance.targetValue} horas` : 
                                    `${maintenance.currentValue}/${maintenance.targetValue} km`}
                                  {maintenance.status === 'overdue' && (
                                    <span className="font-medium text-red-600 ml-2">
                                      (Excedido por {Math.abs(maintenance.valueRemaining)} {maintenance.unit === 'hours' ? 'h' : 'km'})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                                <span className="break-words">
                                  {maintenance.status === 'overdue' ? 
                                    `Vencido - debió realizarse antes` :
                                    `Estimado: ${format(parseISO(maintenance.estimatedDate), "dd MMM yyyy", { locale: es })}`
                                  }
                                </span>
                              </div>
                            </div>
                            {maintenance.status === 'overdue' && (
                              <div className="mt-3 pt-2 border-t border-red-200">
                                <Button size="sm" variant="destructive" asChild className="w-full">
                                  <Link href={`/activos/${assetId}/mantenimiento/nuevo?planId=${maintenance.intervalId}`}>
                                    <Wrench className="h-4 w-4 mr-2" />
                                    Registrar Mantenimiento Urgente
                                  </Link>
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                        {upcomingMaintenances.length > 3 && (
                          <div className="mt-3 text-center">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/activos/${assetId}/mantenimiento`}>
                                Ver todos ({upcomingMaintenances.length}) mantenimientos
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Maintenance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Últimos Mantenimientos
                    </CardTitle>
                    <CardDescription>
                      Historial reciente de mantenimientos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {maintenanceLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : maintenanceHistory.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground">Sin historial de mantenimiento</p>
                        <Button variant="outline" className="mt-4" asChild>
                          <Link href={`/activos/${assetId}/mantenimiento/nuevo`}>
                            Registrar primer mantenimiento
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {maintenanceHistory.slice(0, 4).map((maintenance) => (
                          <div key={maintenance.id} className="border rounded-md p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <Badge 
                                  variant={maintenance.type === 'Preventivo' ? 'default' : 
                                          maintenance.type === 'Correctivo' ? 'destructive' : 'outline'}
                                  className="mb-1"
                                >
                                  {maintenance.type}
                                </Badge>
                                <h4 className="font-medium text-sm">{formatDate(maintenance.date)}</h4>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {maintenance.hours}h
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{maintenance.technician || "No asignado"}</p>
                          </div>
                        ))}
                        {maintenanceHistory.length > 4 && (
                          <div className="mt-2 text-center">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/activos/${assetId}/historial`}>
                                Ver historial completo
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="incidents" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Incidents */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Incidentes Recientes
                    </CardTitle>
                    <CardDescription>
                      Últimos problemas reportados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {incidentsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : incidents.length === 0 ? (
                      <div className="text-center py-4">
                        <CheckCircle className="mx-auto h-8 w-8 text-green-500" />
                        <p className="text-muted-foreground mt-2">Sin incidentes reportados</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {incidents.slice(0, 3).map((incident) => (
                          <div key={incident.id} className="border rounded-md p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <Badge 
                                  variant={incident.type === 'Falla' ? 'destructive' : 'outline'}
                                  className="mb-1"
                                >
                                  {incident.type}
                                </Badge>
                                <h4 className="font-medium text-sm">{formatDate(incident.date)}</h4>
                              </div>
                              <Badge 
                                variant={incident.status === 'Resuelto' ? 'outline' : 
                                        incident.status === 'Pendiente' ? 'destructive' : 'default'}
                                className="flex items-center gap-1"
                              >
                                {incident.status === 'Resuelto' ? (
                                  <CheckCircle className="h-3 w-3" />
                                ) : incident.status === 'Pendiente' ? (
                                  <AlertCircle className="h-3 w-3" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3" />
                                )}
                                {incident.status || 'En proceso'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{incident.reported_by}</p>
                            <p className="text-sm mt-1 line-clamp-2">{incident.description}</p>
                          </div>
                        ))}
                        {incidents.length > 3 && (
                          <div className="mt-2 text-center">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/activos/${assetId}/incidentes`}>
                                Ver todos ({incidents.length})
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pending Checklists */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Checklists Pendientes
                    </CardTitle>
                    <CardDescription>
                      Inspecciones por realizar
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pendingChecklistsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : pendingChecklists.length === 0 ? (
                      <div className="text-center py-4">
                        <CheckCircle className="mx-auto h-8 w-8 text-green-500" />
                        <p className="text-muted-foreground mt-2">Sin checklists pendientes</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingChecklists.slice(0, 3).map((checklist) => (
                          <div key={checklist.id} className="border rounded-md p-3 border-amber-200 bg-amber-50">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <Badge 
                                  variant="default"
                                  className="mb-1 bg-amber-500"
                                >
                                  Pendiente
                                </Badge>
                                <h4 className="font-medium text-sm">{formatDate(checklist.scheduled_date || checklist.created_at)}</h4>
                              </div>
                              <Badge 
                                variant={checklist.checklists?.frequency === 'diario' ? 'default' : 
                                        checklist.checklists?.frequency === 'semanal' ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {checklist.checklists?.frequency || 'N/A'}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium">{checklist.checklists?.name || 'Sin nombre'}</p>
                            <div className="mt-2">
                              <Button size="sm" variant="outline" className="w-full" asChild>
                                <Link href={`/checklists/ejecutar/${checklist.id}`}>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Ejecutar
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                        {pendingChecklists.length > 3 && (
                          <div className="mt-2 text-center">
                            <p className="text-sm text-muted-foreground">
                              {pendingChecklists.length - 3} más pendientes
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Completed Checklists */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5" />
                      Checklists Completados
                    </CardTitle>
                    <CardDescription>
                      Últimas inspecciones realizadas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {checklistsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : completedChecklists.length === 0 ? (
                      <div className="text-center py-4">
                        <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground mt-2">Sin checklists completados</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {completedChecklists.slice(0, 3).map((checklist) => (
                          <div key={checklist.id} className="border rounded-md p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <Badge 
                                  variant="outline"
                                  className="mb-1 bg-green-50 border-green-200 text-green-700"
                                >
                                  Completado
                                </Badge>
                                <h4 className="font-medium text-sm">{formatDate(checklist.updated_at)}</h4>
                              </div>
                              <Badge 
                                variant={checklist.checklists?.frequency === 'diario' ? 'default' : 
                                        checklist.checklists?.frequency === 'semanal' ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {checklist.checklists?.frequency || 'N/A'}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium">{checklist.checklists?.name || 'Sin nombre'}</p>
                            <p className="text-sm text-muted-foreground">
                              {checklist.profiles ? 
                                `${checklist.profiles.nombre} ${checklist.profiles.apellido}` : 
                                'No especificado'}
                            </p>
                          </div>
                        ))}
                        {completedChecklists.length > 3 && (
                          <div className="mt-2 text-center">
                            <p className="text-sm text-muted-foreground">
                              {completedChecklists.length - 3} más completados
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="technical" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Especificaciones Técnicas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <dl className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Número de Serie</dt>
                          <dd className="text-lg">{asset?.serial_number || "No especificado"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Modelo</dt>
                          <dd className="text-lg">{asset?.model?.name || "No especificado"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Fabricante</dt>
                          <dd className="text-lg">{asset?.model?.manufacturer || "No especificado"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Unidad de Mantenimiento</dt>
                          <dd className="text-lg">{asset?.model?.maintenance_unit || "No especificada"}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <dl className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Horas Iniciales</dt>
                          <dd className="text-lg">{asset?.initial_hours !== null ? `${asset?.initial_hours} horas` : "No especificadas"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Kilómetros Iniciales</dt>
                          <dd className="text-lg">{asset?.initial_kilometers !== null ? `${asset?.initial_kilometers} km` : "No aplicable"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Categoría</dt>
                          <dd className="text-lg">{asset?.model?.category || "No especificada"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Año de Introducción</dt>
                          <dd className="text-lg">{asset?.model?.year_introduced || "No especificado"}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  
                  {asset?.notes && (
                    <>
                      <Separator className="my-6" />
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Notas Adicionales</h4>
                        <p className="text-sm">{asset.notes}</p>
                      </div>
                    </>
                  )}
                  
                  {asset?.photos && asset.photos.length > 0 && (
                    <>
                      <Separator className="my-6" />
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-4">Fotografías del Activo</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {asset.photos.map((photoUrl, index) => {
                            // Extract category from filename (if present)
                            const categoryMatch = photoUrl.match(/\/(\d+)-([^\/]+)-([^\/]+\.[^\/]+)$/);
                            const categoryCode = categoryMatch ? categoryMatch[2] : "otros";
                            const categoryInfo = PHOTO_CATEGORIES[categoryCode] || PHOTO_CATEGORIES.otros;
                            
                            // Extract original filename for additional context
                            const filename = categoryMatch ? categoryMatch[3] : photoUrl.split('/').pop() || "";
                            
                            return (
                              <div key={index} className="relative border rounded-lg overflow-hidden group">
                                <div className="absolute top-2 left-2 z-10">
                                  <Badge className={`${categoryInfo.color} text-white px-2 py-1`}>
                                    <span className="mr-1">{categoryInfo.icon}</span>
                                    {categoryInfo.label}
                                  </Badge>
                                </div>
                                <img 
                                  src={photoUrl} 
                                  alt={`${categoryInfo.label} - ${filename}`} 
                                  className="w-full h-40 object-cover"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="truncate">{filename}</span>
                                    <a 
                                      href={photoUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-white hover:text-blue-300 transition-colors"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="documentation" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Documentación</CardTitle>
                    <CardDescription>Manuales y documentación técnica relacionada</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {asset?.insurance_documents && asset.insurance_documents.length > 0 ? (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground">Documentos de Seguro</h4>
                        <div className="space-y-2">
                          {asset.insurance_documents.map((docUrl, index) => {
                            // Extract filename from URL
                            const filename = docUrl.split('/').pop() || `Documento ${index + 1}`;
                            
                            return (
                              <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{filename}</span>
                                </div>
                                <a
                                  href={docUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <Button variant="ghost" size="sm">
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    Ver
                                  </Button>
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                        <h3 className="mt-4 text-lg font-medium">No hay documentos disponibles</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Los documentos técnicos se encuentran asociados al modelo de equipo.
                        </p>
                        {asset?.model && (
                          <Button variant="outline" className="mt-4" asChild>
                            <Link href={`/modelos/${asset.model.id}`}>
                              Ver documentación del modelo
                            </Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Información Financiera</CardTitle>
                    <CardDescription>Datos administrativos y financieros</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-4">
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Fecha de Compra</dt>
                        <dd className="text-lg">{formatDate(asset?.purchase_date || null)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Costo de Adquisición</dt>
                        <dd className="text-lg">{asset?.purchase_cost || "No especificado"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Garantía Válida Hasta</dt>
                        <dd className="text-lg">{formatDate(asset?.warranty_expiration || null)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Información de Registro</dt>
                        <dd className="text-lg">{asset?.registration_info || "No especificada"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Póliza de Seguro</dt>
                        <dd className="text-lg">{asset?.insurance_policy || "No especificada"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Seguro Válido Hasta</dt>
                        <dd className="text-lg">{formatDate(asset?.insurance_end_date || null)}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </DashboardShell>
  );
} 