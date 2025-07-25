'use client';

import { useState, useEffect } from 'react';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Plus, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  Search, 
  Filter,
  TrendingUp,
  TrendingDown,
  Clock,
  Wrench,
  Calendar,
  User,
  Camera,
  Zap,
  Award,
  Target,
  ArrowUp,
  ArrowDown,
  Timer,
  CheckCircle2,
  XCircle,
  PlayCircle,
  PauseCircle,
  Star,
  Flame,
  Activity
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Status mapping to handle Spanish/English inconsistencies
const STATUS_MAPPING: Record<string, string> = {
  // Spanish statuses (current)
  'abierto': 'open',
  'pendiente': 'pending', 
  'en progreso': 'in_progress',
  'en proceso': 'in_progress',
  'resuelto': 'resolved',
  'cerrado': 'resolved',
  
  // English statuses
  'open': 'open',
  'pending': 'pending',
  'in progress': 'in_progress',
  'resolved': 'resolved',
  'closed': 'resolved'
};

const normalizeStatus = (status: string) => {
  if (!status) return '';
  return STATUS_MAPPING[status.toLowerCase()] || status.toLowerCase();
};

const getStatusInfo = (status: string) => {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case 'resolved':
      return { 
        label: 'Resuelto', 
        variant: 'outline' as const,
        color: 'text-white bg-green-600 border-green-600 hover:bg-green-700',
        icon: CheckCircle2,
        bgColor: 'bg-green-50'
      };
    case 'open':
      return { 
        label: 'Abierto', 
        variant: 'destructive' as const,
        color: 'text-white bg-red-600 border-red-600 hover:bg-red-700',
        icon: AlertCircle,
        bgColor: 'bg-red-50'
      };
    case 'pending':
      return { 
        label: 'Pendiente', 
        variant: 'outline' as const,
        color: 'text-white bg-orange-600 border-orange-600 hover:bg-orange-700',
        icon: Clock,
        bgColor: 'bg-orange-50'
      };
    case 'in_progress':
      return { 
        label: 'En Progreso', 
        variant: 'default' as const,
        color: 'text-white bg-blue-600 border-blue-600 hover:bg-blue-700',
        icon: PlayCircle,
        bgColor: 'bg-blue-50'
      };
    default:
      return { 
        label: status || 'Desconocido', 
        variant: 'secondary' as const,
        color: 'text-white bg-gray-600 border-gray-600 hover:bg-gray-700',
        icon: AlertTriangle,
        bgColor: 'bg-gray-50'
      };
  }
};

const getTypeInfo = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'falla':
    case 'falla eléctrica':
    case 'falla mecánica':
    case 'falla hidráulica':
      return { variant: 'destructive' as const, icon: XCircle, color: 'text-white bg-red-600 border-red-600' };
    case 'mantenimiento':
      return { variant: 'default' as const, icon: Wrench, color: 'text-white bg-blue-600 border-blue-600' };
    case 'accidente':
      return { variant: 'secondary' as const, icon: AlertTriangle, color: 'text-white bg-orange-600 border-orange-600' };
    case 'alerta':
      return { variant: 'default' as const, icon: AlertCircle, color: 'text-black bg-yellow-400 border-yellow-400' };
    default:
      return { variant: 'outline' as const, icon: AlertTriangle, color: 'text-white bg-gray-600 border-gray-600' };
  }
};

const getPriorityInfo = (status: string, daysSinceCreated: number) => {
  const normalized = normalizeStatus(status);
  
  if (normalized === 'resolved') {
    return { level: 'resolved', color: 'text-white bg-green-600 border-green-600', label: 'Completado', icon: CheckCircle2 };
  }
  
  if (daysSinceCreated >= 7) {
    return { level: 'critical', color: 'text-white bg-red-600 border-red-600', label: 'Crítico', icon: Flame };
  } else if (daysSinceCreated >= 3) {
    return { level: 'high', color: 'text-white bg-orange-600 border-orange-600', label: 'Alto', icon: ArrowUp };
  } else if (daysSinceCreated >= 1) {
    return { level: 'medium', color: 'text-black bg-yellow-400 border-yellow-400', label: 'Medio', icon: Timer };
  } else {
    return { level: 'low', color: 'text-white bg-blue-600 border-blue-600', label: 'Nuevo', icon: Star };
  }
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  useEffect(() => {
    fetchIncidents();
    fetchAssets();
  }, []);

  const fetchIncidents = async () => {
    try {
      const response = await fetch('/api/incidents');
      if (response.ok) {
        const data = await response.json();
        setIncidents(data);
      } else {
        setError('Error al cargar los incidentes');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/assets');
      if (response.ok) {
        const data = await response.json();
        setAssets(data);
      }
    } catch (err) {
      console.error('Error fetching assets:', err);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };

  const getAssetName = (incident: any) => {
    // Use the processed asset display name from API if available
    if (incident.asset_display_name && incident.asset_code) {
      return `${incident.asset_code}`;
    }
    // Fallback to old logic
    const asset = assets.find(a => a.id === incident.asset_id);
    return asset ? asset.asset_id : 'N/A';
  };

  const getAssetFullName = (incident: any) => {
    if (incident.asset_display_name) {
      return incident.asset_display_name;
    }
    const asset = assets.find(a => a.id === incident.asset_id);
    return asset ? asset.name : 'Activo no encontrado';
  };

  const getReporterName = (incident: any) => {
    if (incident.reported_by_name) {
      return incident.reported_by_name;
    }
    // Handle old UUID format
    if (incident.reported_by && incident.reported_by.length > 30) {
      return 'Usuario del sistema';
    }
    return incident.reported_by || 'Usuario desconocido';
  };

  const getDaysSinceCreated = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Enhanced filtering with priority
  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = 
      incident.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getReporterName(incident).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getAssetName(incident).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getAssetFullName(incident).toLowerCase().includes(searchTerm.toLowerCase());
    
    const normalizedStatus = normalizeStatus(incident.status);
    const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
    const matchesType = typeFilter === 'all' || incident.type?.toLowerCase() === typeFilter.toLowerCase();
    
    const daysSince = getDaysSinceCreated(incident.created_at);
    const priority = getPriorityInfo(incident.status, daysSince);
    const matchesPriority = priorityFilter === 'all' || priority.level === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });

  // Calculate enhanced statistics
  const totalIncidents = incidents.length;
  const openIncidents = incidents.filter(i => ['open', 'pending'].includes(normalizeStatus(i.status))).length;
  const inProgressIncidents = incidents.filter(i => normalizeStatus(i.status) === 'in_progress').length;
  const resolvedIncidents = incidents.filter(i => normalizeStatus(i.status) === 'resolved').length;
  const totalDowntime = incidents.reduce((acc, i) => acc + (i.downtime || 0), 0);

  // Priority-based statistics
  const criticalIncidents = incidents.filter(i => {
    const days = getDaysSinceCreated(i.created_at);
    const priority = getPriorityInfo(i.status, days);
    return priority.level === 'critical';
  }).length;

  // Gamification metrics
  const resolutionRate = totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0;
  const avgResolutionTime = resolvedIncidents > 0 ? Math.round(totalDowntime / resolvedIncidents * 10) / 10 : 0;

  // Get recent incidents (last 7 days)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentIncidents = incidents.filter(i => 
    new Date(i.date || i.created_at) > oneWeekAgo
  ).length;

  // Get unique types and statuses for filters
  const uniqueTypes = [...new Set(incidents.map(i => i.type).filter(Boolean))];
  const uniqueStatuses = [...new Set(incidents.map(i => normalizeStatus(i.status)).filter(Boolean))];

  // Enhanced Mobile Incident Card Component
  const IncidentCard = ({ incident }: { incident: any }) => {
    const statusInfo = getStatusInfo(incident.status);
    const typeInfo = getTypeInfo(incident.type);
    const daysSince = getDaysSinceCreated(incident.created_at);
    const priority = getPriorityInfo(incident.status, daysSince);
    const StatusIcon = statusInfo.icon;
    const TypeIcon = typeInfo.icon;
    const PriorityIcon = priority.icon;

    return (
      <Card className={`mb-4 border-l-4 ${
        priority.level === 'critical' ? 'border-l-red-500' :
        priority.level === 'high' ? 'border-l-orange-500' :
        priority.level === 'medium' ? 'border-l-yellow-500' :
        'border-l-green-500'
      } hover:shadow-md transition-shadow duration-200`}>
        <CardContent className="p-4">
          {/* Header with Status and Priority */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <Badge variant={statusInfo.variant} className={`${statusInfo.color} flex items-center gap-1`}>
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </Badge>
              <Badge variant={priority.level === 'critical' ? 'destructive' : 'outline'} 
                     className={`${priority.color} flex items-center gap-1`}>
                <PriorityIcon className="h-3 w-3" />
                {priority.label}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDate(incident.date)}
            </div>
          </div>

          {/* Type Badge */}
          <div className="mb-3">
            <Badge variant={typeInfo.variant} className={`${typeInfo.color} flex items-center gap-1 w-fit`}>
              <TypeIcon className="h-3 w-3" />
              {incident.type}
            </Badge>
          </div>
          
                     {/* Asset Link */}
           <Link 
             href={`/activos/${incident.asset_id}`}
             className="block font-medium text-blue-600 hover:underline mb-2"
             title={getAssetFullName(incident)}
           >
             <div className="font-semibold">{getAssetName(incident)}</div>
             <div className="text-xs text-gray-500 font-normal">{getAssetFullName(incident)}</div>
           </Link>
          
                     {/* Description */}
           <p className="text-sm text-gray-600 mb-3" 
              style={{ 
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
              title={incident.description}>
             {incident.description}
           </p>
          
                     {/* Metadata */}
           <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
             <div className="flex items-center gap-1">
               <User className="h-3 w-3" />
               <span className="truncate max-w-[100px]">{getReporterName(incident)}</span>
             </div>
             {incident.downtime && (
               <div className="flex items-center gap-1">
                 <Clock className="h-3 w-3" />
                 {incident.downtime} hrs
               </div>
             )}
             <div className="flex items-center gap-1">
               <Calendar className="h-3 w-3" />
               {daysSince} días
             </div>
           </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link href={`/activos/${incident.asset_id}/incidentes`}>
                <Eye className="h-4 w-4 mr-1" />
                Ver
              </Link>
            </Button>
            {incident.work_order_id && (
              <Button variant="default" size="sm" asChild className="flex-1">
                <Link href={`/ordenes/${incident.work_order_id}`}>
                  <Wrench className="h-4 w-4 mr-1" />
                  OT
                </Link>
              </Button>
            )}
            {normalizeStatus(incident.status) !== 'resolved' && (
              <Button variant="ghost" size="sm" className="p-2">
                <Camera className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Enhanced Incidents List Component
  const IncidentsList = ({ incidents }: { incidents: any[] }) => {
    return (
      <>
        {/* Mobile View */}
        <div className="md:hidden space-y-4">
          {incidents.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
              <p className="text-lg font-medium">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || priorityFilter !== 'all'
                  ? "No hay incidentes con estos filtros" 
                  : "¡Excelente! No hay incidentes abiertos"
                }
              </p>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || priorityFilter !== 'all'
                  ? "Prueba ajustando los filtros para ver más resultados" 
                  : "Tu equipo está funcionando perfectamente"
                }
              </p>
            </div>
          ) : (
            incidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block">
          {incidents.length === 0 ? (
            <div className="py-8 text-center border rounded-md bg-gray-50">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
              <p className="text-lg font-medium">No hay incidentes</p>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || priorityFilter !== 'all'
                  ? "No se encontraron incidentes con los filtros aplicados" 
                  : "No hay incidentes registrados en el sistema"
                }
              </p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Estado</TableHead>
                      <TableHead className="w-[80px]">Prioridad</TableHead>
                      <TableHead className="w-[100px]">Fecha</TableHead>
                      <TableHead className="w-[150px]">Activo</TableHead>
                      <TableHead className="w-[100px]">Tipo</TableHead>
                      <TableHead className="w-[120px]">Reportado por</TableHead>
                      <TableHead className="min-w-[200px]">Descripción</TableHead>
                      <TableHead className="w-[80px]">T. Inactivo</TableHead>
                      <TableHead className="w-[120px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((incident) => {
                      const statusInfo = getStatusInfo(incident.status);
                      const typeInfo = getTypeInfo(incident.type);
                      const daysSince = getDaysSinceCreated(incident.created_at);
                      const priority = getPriorityInfo(incident.status, daysSince);
                      const StatusIcon = statusInfo.icon;
                      const PriorityIcon = priority.icon;

                      return (
                        <TableRow key={incident.id} className="hover:bg-gray-50">
                          <TableCell className="p-2">
                            <Badge variant={statusInfo.variant} className={`${statusInfo.color} flex items-center gap-1 w-fit text-xs`}>
                              <StatusIcon className="h-3 w-3" />
                              <span className="hidden sm:inline">{statusInfo.label}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="p-2">
                            <Badge variant={priority.level === 'critical' ? 'destructive' : 'outline'} 
                                   className={`${priority.color} flex items-center gap-1 w-fit text-xs`}>
                              <PriorityIcon className="h-3 w-3" />
                              <span className="hidden sm:inline">{priority.label}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="p-2 text-sm">{format(new Date(incident.date), "dd/MM/yy")}</TableCell>
                          <TableCell className="p-2">
                            <Link 
                              href={`/activos/${incident.asset_id}`}
                              className="text-blue-600 hover:underline block"
                              title={getAssetFullName(incident)}
                            >
                              <div className="font-semibold text-sm">{getAssetName(incident)}</div>
                              <div className="text-xs text-gray-500 truncate max-w-[140px]">{getAssetFullName(incident)}</div>
                            </Link>
                          </TableCell>
                          <TableCell className="p-2">
                            <Badge variant={typeInfo.variant} className={`${typeInfo.color} text-xs`}>
                              {incident.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="text-sm truncate max-w-[120px]" title={getReporterName(incident)}>
                              {getReporterName(incident)}
                            </div>
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="text-sm max-w-[250px]" 
                                 style={{ 
                                   display: '-webkit-box',
                                   WebkitLineClamp: 2,
                                   WebkitBoxOrient: 'vertical',
                                   overflow: 'hidden'
                                 }}
                                 title={incident.description}>
                              {incident.description}
                            </div>
                          </TableCell>
                          <TableCell className="p-2 text-sm">
                            {incident.downtime ? `${incident.downtime}h` : '-'}
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" asChild className="h-8 px-2">
                                <Link href={`/activos/${incident.asset_id}/incidentes`}>
                                  <Eye className="h-3 w-3" />
                                  <span className="hidden lg:inline ml-1">Ver</span>
                                </Link>
                              </Button>
                              {incident.work_order_id && (
                                <Button variant="default" size="sm" asChild className="h-8 px-2">
                                  <Link href={`/ordenes/${incident.work_order_id}`}>
                                    <Wrench className="h-3 w-3" />
                                    <span className="hidden lg:inline ml-1">OT</span>
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
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Cargando incidentes..." text="" />
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
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Gestión de Incidentes"
        text="Centro de control para todos los incidentes del sistema"
      >
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <Link href="/activos">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Reportar Incidente</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        </Button>
      </DashboardHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Gamification Progress Section */}
      <Card className="mb-6 bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Award className="h-5 w-5" />
                Panel de Rendimiento
              </CardTitle>
              <CardDescription className="text-blue-600">
                Progreso del equipo en gestión de incidentes
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <Star className="h-4 w-4" />
              <span className="font-bold">{resolutionRate}%</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{resolvedIncidents}</div>
              <div className="text-xs text-muted-foreground">Resueltos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{openIncidents + inProgressIncidents}</div>
              <div className="text-xs text-muted-foreground">Activos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{recentIncidents}</div>
              <div className="text-xs text-muted-foreground">Esta semana</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{avgResolutionTime}h</div>
              <div className="text-xs text-muted-foreground">Tiempo prom.</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Tasa de resolución</span>
              <span className="font-medium">{resolutionRate}%</span>
            </div>
            <Progress value={resolutionRate} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Activity className="h-4 w-4 text-blue-500" />
              <div className="ml-2">
                <div className="text-2xl font-bold">{totalIncidents}</div>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Flame className="h-4 w-4 text-red-500" />
              <div className="ml-2">
                <div className="text-2xl font-bold text-red-600">{criticalIncidents}</div>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <div className="ml-2">
                <div className="text-2xl font-bold text-orange-600">{openIncidents}</div>
                <p className="text-xs text-muted-foreground">Abiertos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <PlayCircle className="h-4 w-4 text-blue-500" />
              <div className="ml-2">
                <div className="text-2xl font-bold text-blue-600">{inProgressIncidents}</div>
                <p className="text-xs text-muted-foreground">En Progreso</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div className="ml-2">
                <div className="text-2xl font-bold text-green-600">{resolvedIncidents}</div>
                <p className="text-xs text-muted-foreground">Resueltos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <div className="ml-2">
                <div className="text-2xl font-bold text-purple-600">{recentIncidents}</div>
                <p className="text-xs text-muted-foreground">Nuevos 7d</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="critical">Críticos</TabsTrigger>
          <TabsTrigger value="active">Activos</TabsTrigger>
          <TabsTrigger value="resolved">Resueltos</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Todos los Incidentes</CardTitle>
              <CardDescription>
                Gestión completa de incidentes con filtros avanzados
              </CardDescription>
              
              {/* Enhanced Filters */}
              <div className="flex flex-col gap-4 mt-4">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por descripción, usuario o activo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="flex-1 min-w-[120px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      {uniqueStatuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {getStatusInfo(status).label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="flex-1 min-w-[120px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      {uniqueTypes.map(type => (
                        <SelectItem key={type} value={type.toLowerCase()}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="flex-1 min-w-[120px]">
                      <SelectValue placeholder="Prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las prioridades</SelectItem>
                      <SelectItem value="critical">Crítico</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                      <SelectItem value="medium">Medio</SelectItem>
                      <SelectItem value="low">Nuevo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <IncidentsList incidents={filteredIncidents} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="critical" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Flame className="h-5 w-5" />
                Incidentes Críticos
              </CardTitle>
              <CardDescription>
                Incidentes que requieren atención inmediata (7+ días sin resolver)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncidentsList 
                incidents={incidents.filter(i => {
                  const days = getDaysSinceCreated(i.created_at);
                  const priority = getPriorityInfo(i.status, days);
                  return priority.level === 'critical';
                })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertCircle className="h-5 w-5" />
                Incidentes Activos
              </CardTitle>
              <CardDescription>
                Incidentes abiertos y en progreso que necesitan seguimiento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncidentsList 
                incidents={incidents.filter(i => 
                  ['open', 'pending', 'in_progress'].includes(normalizeStatus(i.status))
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                Incidentes Resueltos
              </CardTitle>
              <CardDescription>
                Historial de incidentes completados exitosamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IncidentsList 
                incidents={incidents.filter(i => 
                  normalizeStatus(i.status) === 'resolved'
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
} 