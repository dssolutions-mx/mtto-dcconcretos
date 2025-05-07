"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertCircle,
  CheckSquare,
  Clock,
  Edit,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  Timer,
  Wrench,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"

// Datos de fallback para cuando no hay datos de la API
const fallbackData = [
  {
    id: "PM001",
    asset: {
      id: "A007",
      name: "Mezcladora de Concreto CR-15",
      model_id: "MOD001",
      current_hours: 700,
    },
    interval_value: 1000, // horas
    name: "Mantenimiento preventivo 1000h",
    next_due: "2023-07-15", // calculado
    status: "Programado",
  },
  {
    id: "PM002",
    asset: {
      id: "A008",
      name: "Grúa Torre GT-200",
      model_id: "MOD002",
      current_hours: 450,
    },
    interval_value: 500, // horas
    name: "Mantenimiento preventivo 500h",
    next_due: "2023-06-25", // calculado
    status: "Programado",
  },
]

interface PreventiveMaintenanceListProps {
  plans?: any[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function PreventiveMaintenanceList({ plans, isLoading = false, onRefresh }: PreventiveMaintenanceListProps) {
  const [searchTerm, setSearchTerm] = useState("")

  // Usar datos proporcionados o fallback
  const maintenanceData = plans || fallbackData;

  const filteredItems = maintenanceData.filter(
    (item) =>
      item.asset?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Calcular progreso y días restantes
  const calculateProgress = (plan: any) => {
    if (!plan.asset?.current_hours || !plan.interval_value) return 0;
    
    const lastCompleted = plan.asset.last_maintenance_date ? 
      new Date(plan.asset.last_maintenance_date) : new Date();
    
    // Si no hay fecha de próximo mantenimiento, devolver 0
    if (!plan.next_due) return 0;
    
    const nextDue = new Date(plan.next_due);
    const now = new Date();
    
    // Si ya pasó la fecha, retornar 100%
    if (nextDue < now) return 100;
    
    // Calcular el progreso basado en las horas
    const hoursRemaining = plan.interval_value - plan.asset.current_hours % plan.interval_value;
    const progress = 100 - (hoursRemaining / plan.interval_value * 100);
    
    return Math.max(0, Math.min(100, progress));
  }

  const calculateDaysRemaining = (plan: any) => {
    if (!plan.next_due) return 0;
    
    const nextDue = new Date(plan.next_due);
    const now = new Date();
    
    // Si ya pasó la fecha, retornar 0
    if (nextDue < now) return 0;
    
    const diffTime = Math.abs(nextDue.getTime() - now.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }
  
  const calculateHoursRemaining = (plan: any) => {
    if (!plan.asset?.current_hours || !plan.interval_value) return 0;
    
    const currentHours = plan.asset.current_hours;
    const nextServiceHours = Math.ceil(currentHours / plan.interval_value) * plan.interval_value;
    
    return nextServiceHours - currentHours;
  }

  const getStatusBadge = (plan: any) => {
    // Obtener estado del plan o inferirlo
    const status = plan.status || 'Desconocido';
    const daysRemaining = calculateDaysRemaining(plan);
    const progress = calculateProgress(plan);
    
    if (progress >= 95 || daysRemaining <= 3) {
      return <Badge variant="destructive">Urgente</Badge>;
    } else if (progress >= 80 || daysRemaining <= 14) {
      return <Badge variant="secondary">Próximo</Badge>;
    } else {
      return <Badge>En tiempo</Badge>;
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 95) return "bg-red-500";
    if (progress >= 80) return "bg-amber-500";
    return "bg-green-500";
  }

  // Render de esqueleto durante la carga
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-full md:w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            <Skeleton className="h-10 w-96" />
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-40" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Programas de Mantenimiento Preventivo</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar programas..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {onRefresh && (
              <Button variant="outline" size="icon" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
                <span className="sr-only">Actualizar</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="urgent">Urgentes</TabsTrigger>
            <TabsTrigger value="upcoming">Próximos</TabsTrigger>
            <TabsTrigger value="ontime">En Tiempo</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead>Intervalo</TableHead>
                    <TableHead>Horas Actuales</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Próximo Servicio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length > 0 ? (
                    filteredItems.map((plan) => {
                      const progress = calculateProgress(plan);
                      const daysRemaining = calculateDaysRemaining(plan);
                      const hoursRemaining = calculateHoursRemaining(plan);
                      
                      return (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">{plan.id}</TableCell>
                          <TableCell>{plan.asset?.name || 'N/A'}</TableCell>
                          <TableCell>Cada {plan.interval_value} horas</TableCell>
                          <TableCell>{plan.asset?.current_hours || 0} horas</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={progress} className={`h-2 ${getProgressColor(progress)}`} />
                              <span className="text-xs">{Math.round(progress)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{new Date(plan.next_due).toLocaleDateString()}</span>
                              <span className="text-xs text-muted-foreground">
                                En {daysRemaining} días ({hoursRemaining} horas)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(plan)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Abrir menú</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                  <Link href={`/preventivo/${plan.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    <span>Ver detalles</span>
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/preventivo/${plan.id}/editar`}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>Editar programa</span>
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Timer className="mr-2 h-4 w-4" />
                                  <span>Actualizar horas</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <CheckSquare className="mr-2 h-4 w-4" />
                                  <span>Ver checklist</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Wrench className="mr-2 h-4 w-4" />
                                  <span>Generar OT</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        No se encontraron planes de mantenimiento.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          {/* Las otras pestañas filtrarían por estado */}
          <TabsContent value="urgent">
            {/* Contenido filtrado solo para urgentes */}
            <div className="rounded-md border">
              <Table>
                {/* Similar al contenido anterior pero filtrado */}
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="upcoming">
            {/* Contenido filtrado solo para próximos */}
            <div className="rounded-md border">
              <Table>
                {/* Similar al contenido anterior pero filtrado */}
              </Table>
            </div>
          </TabsContent>
          
          <TabsContent value="ontime">
            {/* Contenido filtrado solo para en tiempo */}
            <div className="rounded-md border">
              <Table>
                {/* Similar al contenido anterior pero filtrado */}
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
