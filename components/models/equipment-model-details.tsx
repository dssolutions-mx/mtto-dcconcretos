"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, FileText, Plus, Eye, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { useEquipmentModel } from "@/hooks/useSupabase"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Definir tipos para las especificaciones y tareas
interface ModelSpecifications {
  general?: Record<string, string>;
  dimensions?: Record<string, string>;
  performance?: Record<string, string>;
}

interface MaintenancePart {
  id: string;
  name: string;
  part_number: string;
  quantity: number;
  cost: string | null;
}

interface MaintenanceTask {
  id: string;
  description: string;
  type: string;
  estimated_time: number;
  requires_specialist: boolean;
  task_parts?: MaintenancePart[];
}

interface MaintenanceIntervalWithTasks {
  id: string;
  model_id: string | null;
  interval_value: number;
  name: string;
  description: string | null;
  type: string;
  estimated_duration: number | null;
  created_at: string;
  updated_at: string;
  maintenance_tasks?: MaintenanceTask[];
}

interface EquipmentModelDetailsProps {
  id: string
}

export function EquipmentModelDetails({ id }: EquipmentModelDetailsProps) {
  const { 
    model, 
    assets, 
    maintenanceIntervals, 
    documentation, 
    loading, 
    error, 
    refetch 
  } = useEquipmentModel(id);

  // Si está cargando, mostrar esqueletos
  if (loading) {
    return <EquipmentModelSkeleton />
  }

  // Si hay error, mostrar mensaje
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error al cargar datos del modelo: {error.message}
        </AlertDescription>
      </Alert>
    )
  }

  // Si no hay modelo, mostrar mensaje de no encontrado
  if (!model) {
    return (
      <Alert>
        <AlertDescription>
          No se encontró el modelo con ID: {id}
        </AlertDescription>
      </Alert>
    )
  }

  // Preparar datos formateados para las especificaciones
  const specifications = (model.specifications || {
    general: {},
    dimensions: {},
    performance: {}
  }) as ModelSpecifications;
  
  // Asegurar que los intervalos tienen la propiedad maintenance_tasks
  const intervalsWithTasks = maintenanceIntervals.map(interval => ({
    ...interval,
    maintenance_tasks: interval.maintenance_tasks || []
  })) as MaintenanceIntervalWithTasks[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">
                {model.manufacturer} {model.name}
              </CardTitle>
              <CardDescription className="text-lg">{model.category}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">ID: {model.model_id}</Badge>
              <Badge variant="outline">Año: {model.year_introduced || 'N/A'}</Badge>
              <Badge variant="outline">Vida útil: {model.expected_lifespan || 'N/A'} años</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Descripción</h3>
              <p>{model.description || 'Sin descripción'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Activos Asociados</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="text-2xl font-bold">{assets.length}</div>
                  <p className="text-sm text-muted-foreground">Equipos de este modelo</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Intervalos de Mantenimiento</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="text-2xl font-bold">{maintenanceIntervals.length}</div>
                  <p className="text-sm text-muted-foreground">Programas definidos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Documentos Técnicos</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="text-2xl font-bold">{documentation.length}</div>
                  <p className="text-sm text-muted-foreground">Archivos disponibles</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="specifications" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="specifications">Especificaciones</TabsTrigger>
          <TabsTrigger value="maintenance">Mantenimiento</TabsTrigger>
          <TabsTrigger value="documentation">Documentación</TabsTrigger>
          <TabsTrigger value="assets">Activos</TabsTrigger>
        </TabsList>

        <TabsContent value="specifications">
          <Card>
            <CardHeader>
              <CardTitle>Especificaciones Técnicas</CardTitle>
              <CardDescription>Detalles técnicos del modelo {model.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Información General</h3>
                {specifications.general && Object.keys(specifications.general).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(specifications.general).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No hay información general disponible</p>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-2">Dimensiones y Capacidad</h3>
                {specifications.dimensions && Object.keys(specifications.dimensions).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(specifications.dimensions).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No hay información de dimensiones disponible</p>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-2">Rendimiento</h3>
                {specifications.performance && Object.keys(specifications.performance).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(specifications.performance).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No hay información de rendimiento disponible</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Programas de Mantenimiento</CardTitle>
                <CardDescription>Intervalos y tareas de mantenimiento recomendados</CardDescription>
              </div>
              <Button size="sm" asChild>
                <Link href={`/modelos/${id}/editar?action=addInterval`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Intervalo
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {intervalsWithTasks.length > 0 ? (
                <div className="space-y-6">
                  {intervalsWithTasks.map((interval) => (
                    <Card key={interval.id} className="border-l-4 border-l-primary">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {interval.name} 
                              <Badge className="ml-2" variant="outline">
                                {interval.interval_value} {model.maintenance_unit === 'hours' ? 'Horas' : 'KM'}
                              </Badge>
                            </CardTitle>
                            <CardDescription>{interval.description}</CardDescription>
                          </div>
                          <Badge variant="secondary">
                            {interval.type}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Tareas</h4>
                            {interval.maintenance_tasks && interval.maintenance_tasks.length > 0 ? (
                              <div className="space-y-3">
                                {interval.maintenance_tasks.map((task, idx) => (
                                  <div key={idx} className="pl-5 border-l-2 border-gray-200">
                                    <div className="font-medium">{task.description}</div>
                                    <div className="text-sm text-muted-foreground mb-1">
                                      {task.type} • {task.estimated_time}h • 
                                      {task.requires_specialist ? ' Requiere especialista' : ' No requiere especialista'}
                                    </div>
                                    {task.task_parts && task.task_parts.length > 0 ? (
                                      <div className="mt-2">
                                        <div className="text-xs font-medium mb-1">Repuestos requeridos:</div>
                                        <ul className="list-disc pl-5 text-xs space-y-1">
                                          {task.task_parts.map((part, pidx) => (
                                            <li key={pidx}>
                                              {part.name} ({part.quantity}) - {part.part_number}
                                              {part.cost && ` - $${part.cost}`}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted-foreground">No hay tareas definidas</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No hay intervalos de mantenimiento definidos para este modelo.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentation">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Documentación Técnica</CardTitle>
                <CardDescription>Manuales y documentación del fabricante</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Subir Documento
              </Button>
            </CardHeader>
            <CardContent>
              {documentation.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tamaño</TableHead>
                      <TableHead>Subido</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentation.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.name}</TableCell>
                        <TableCell>{doc.type}</TableCell>
                        <TableCell>{doc.size}</TableCell>
                        <TableCell>{new Date(doc.uploaded_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={doc.file_url} target="_blank">
                              <Download className="h-4 w-4" />
                              <span className="sr-only">Descargar</span>
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No hay documentos disponibles para este modelo.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle>Activos Asociados</CardTitle>
              <CardDescription>Equipos registrados con este modelo</CardDescription>
            </CardHeader>
            <CardContent>
              {assets.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.asset_id}</TableCell>
                        <TableCell>{asset.name}</TableCell>
                        <TableCell>{asset.location}</TableCell>
                        <TableCell>
                          <Badge className={asset.status === 'Operativo' ? 'bg-green-100 text-green-800' : 
                                            asset.status === 'En Mantenimiento' ? 'bg-amber-100 text-amber-800' : 
                                            'bg-red-100 text-red-800'}>
                            {asset.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/activos/${asset.id}`}>
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Ver detalles</span>
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No hay activos registrados con este modelo.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Componente de esqueleto para estado de carga
function EquipmentModelSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader className="py-3">
                    <Skeleton className="h-5 w-24" />
                  </CardHeader>
                  <CardContent className="py-2">
                    <Skeleton className="h-8 w-12 mb-1" />
                    <Skeleton className="h-4 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Skeleton className="h-10 w-full" />
      
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-6 w-32 mb-3" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
                {i < 3 && <Skeleton className="h-px w-full my-6" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
