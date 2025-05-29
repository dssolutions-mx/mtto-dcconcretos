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
  Wrench
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

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

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "resuelto":
      case "resolved":
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="h-3 w-3 mr-1" />Resuelto</Badge>
      case "pendiente":
      case "pending":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Pendiente</Badge>
      case "en progreso":
      case "en proceso":
      case "in progress":
        return <Badge variant="default"><AlertTriangle className="h-3 w-3 mr-1" />En Progreso</Badge>
      default:
        return <Badge variant="secondary">{status || "Desconocido"}</Badge>
    }
  };

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
  };

  const getAssetName = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    return asset ? `${asset.name} (${asset.asset_id})` : assetId;
  };

  // Filter incidents based on search and filters
  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = 
      incident.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.reported_by?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getAssetName(incident.asset_id).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || incident.status?.toLowerCase() === statusFilter;
    const matchesType = typeFilter === 'all' || incident.type?.toLowerCase() === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate statistics
  const totalIncidents = incidents.length;
  const pendingIncidents = incidents.filter(i => 
    ['pendiente', 'pending', 'en proceso', 'en progreso'].includes(i.status?.toLowerCase())
  ).length;
  const resolvedIncidents = incidents.filter(i => 
    ['resuelto', 'resolved'].includes(i.status?.toLowerCase())
  ).length;
  const totalDowntime = incidents.reduce((acc, i) => acc + (i.downtime || 0), 0);

  // Get recent incidents (last 7 days)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const recentIncidents = incidents.filter(i => 
    new Date(i.date || i.created_at) > oneWeekAgo
  ).length;

  // Get unique types and statuses for filters
  const uniqueTypes = [...new Set(incidents.map(i => i.type).filter(Boolean))];
  const uniqueStatuses = [...new Set(incidents.map(i => i.status).filter(Boolean))];

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
        text="Dashboard global de todos los incidentes del sistema"
      >
        <Button asChild>
          <Link href="/activos">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Incidente
          </Link>
        </Button>
      </DashboardHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <div className="text-2xl font-bold">{totalIncidents}</div>
                <p className="text-xs text-muted-foreground">Total Incidentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div className="ml-2">
                <div className="text-2xl font-bold text-red-600">{pendingIncidents}</div>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div className="ml-2">
                <div className="text-2xl font-bold text-green-600">{resolvedIncidents}</div>
                <p className="text-xs text-muted-foreground">Resueltos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-orange-500" />
              <div className="ml-2">
                <div className="text-2xl font-bold text-orange-600">{totalDowntime.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Horas Inactivo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <div className="ml-2">
                <div className="text-2xl font-bold text-blue-600">{recentIncidents}</div>
                <p className="text-xs text-muted-foreground">Últimos 7 días</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">Todos los Incidentes</TabsTrigger>
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
          <TabsTrigger value="resolved">Resueltos</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Todos los Incidentes</CardTitle>
              <CardDescription>
                Listado completo de incidentes en el sistema
              </CardDescription>
              
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por descripción, usuario o activo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {uniqueStatuses.map(status => (
                      <SelectItem key={status} value={status.toLowerCase()}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px]">
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
              </div>
            </CardHeader>
            <CardContent>
              {filteredIncidents.length === 0 ? (
                <div className="py-8 text-center border rounded-md bg-gray-50">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
                  <p className="text-lg font-medium">No hay incidentes</p>
                  <p className="text-muted-foreground mb-4">
                    {incidents.length === 0 
                      ? "No hay incidentes registrados en el sistema" 
                      : "No se encontraron incidentes con los filtros aplicados"
                    }
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Activo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Reportado por</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tiempo Inactivo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncidents.map((incident) => (
                      <TableRow key={incident.id}>
                        <TableCell>{formatDate(incident.date)}</TableCell>
                        <TableCell>
                          <Link 
                            href={`/activos/${incident.asset_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {getAssetName(incident.asset_id)}
                          </Link>
                        </TableCell>
                        <TableCell>{getTypeBadge(incident.type)}</TableCell>
                        <TableCell>{incident.reported_by}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={incident.description}>
                            {incident.description}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(incident.status || "")}</TableCell>
                        <TableCell>
                          {incident.downtime ? `${incident.downtime} hrs` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link href={`/activos/${incident.asset_id}/incidentes`}>
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Link>
                            </Button>
                            {incident.work_order_id && (
                              <Button
                                variant="default"
                                size="sm"
                                asChild
                              >
                                <Link href={`/ordenes/${incident.work_order_id}`}>
                                  <Wrench className="h-4 w-4 mr-1" />
                                  OT
                                </Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incidentes Pendientes</CardTitle>
              <CardDescription>
                Incidentes que requieren atención inmediata
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents
                    .filter(i => ['pendiente', 'pending', 'en proceso', 'en progreso'].includes(i.status?.toLowerCase()))
                    .map((incident) => (
                      <TableRow key={incident.id}>
                        <TableCell>{formatDate(incident.date)}</TableCell>
                        <TableCell>
                          <Link 
                            href={`/activos/${incident.asset_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {getAssetName(incident.asset_id)}
                          </Link>
                        </TableCell>
                        <TableCell>{getTypeBadge(incident.type)}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={incident.description}>
                            {incident.description}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <Link href={`/activos/${incident.asset_id}/incidentes`}>
                              <Eye className="h-4 w-4 mr-1" />
                              Ver Detalles
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incidentes Resueltos</CardTitle>
              <CardDescription>
                Historial de incidentes completados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Tiempo Resolución</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents
                    .filter(i => ['resuelto', 'resolved'].includes(i.status?.toLowerCase()))
                    .map((incident) => (
                      <TableRow key={incident.id}>
                        <TableCell>{formatDate(incident.date)}</TableCell>
                        <TableCell>
                          <Link 
                            href={`/activos/${incident.asset_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {getAssetName(incident.asset_id)}
                          </Link>
                        </TableCell>
                        <TableCell>{getTypeBadge(incident.type)}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={incident.description}>
                            {incident.description}
                          </div>
                        </TableCell>
                        <TableCell>
                          {incident.downtime ? `${incident.downtime} hrs` : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <Link href={`/activos/${incident.asset_id}/incidentes`}>
                              <Eye className="h-4 w-4 mr-1" />
                              Ver Detalles
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
} 