"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Eye, FileText, Edit, RefreshCw, Copy, Trash2, Factory, Calendar, Gauge } from "lucide-react"
import { EquipmentModel } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"

interface EquipmentModelListProps {
  models?: EquipmentModel[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function EquipmentModelList({ models, isLoading = false, onRefresh }: EquipmentModelListProps) {
  // Usamos directamente los modelos pasados como prop
  const displayData = models || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Modelos de Equipos</CardTitle>
          <CardDescription>Cargando modelos...</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile skeleton */}
          <div className="md:hidden space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <div className="flex gap-2 mt-3">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Desktop skeleton */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Unidad de Mantenimiento</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Mobile Card Component
  const EquipmentModelCard = ({ model }: { model: EquipmentModel }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with model name and ID */}
          <div className="flex justify-between items-start">
            <div>
              <Link href={`/modelos/${model.id}`} className="text-lg font-semibold hover:underline">
                {model.manufacturer} {model.name}
              </Link>
              <p className="text-sm text-muted-foreground">ID: {model.model_id}</p>
            </div>
            <Badge variant="outline" className="capitalize">
              {model.maintenance_unit === 'hours' ? 'Horas' : 'Kilómetros'}
            </Badge>
          </div>

          {/* Key information */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Categoría:</span>
              <span>{model.category}</span>
            </div>
            
            {model.year_introduced && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Año:</span>
                <span>{model.year_introduced}</span>
              </div>
            )}
            
            {/* TODO: Add assets count when available */}
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Activos asociados:</span>
              <span className="text-muted-foreground">Ver detalles</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link href={`/modelos/${model.id}`}>
                <Eye className="h-4 w-4 mr-1" />
                Ver
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link href={`/modelos/${model.id}/editar`}>
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link href={`/modelos/${model.id}/copiar`}>
                <Copy className="h-4 w-4 mr-1" />
                Copiar
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Modelos de Equipos</CardTitle>
          <CardDescription>Lista de todos los modelos de equipos registrados en el sistema.</CardDescription>
        </div>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {displayData && displayData.length > 0 ? (
          <>
            {/* Mobile View - Cards */}
            <div className="md:hidden space-y-4">
              {displayData.map((model) => (
                <EquipmentModelCard key={model.id} model={model} />
              ))}
            </div>

            {/* Desktop View - Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Fabricante</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Unidad de Mantenimiento</TableHead>
                    <TableHead>Año</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className="font-medium">{model.model_id}</TableCell>
                      <TableCell>{model.name}</TableCell>
                      <TableCell>{model.manufacturer}</TableCell>
                      <TableCell>{model.category}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {model.maintenance_unit === 'hours' ? 'Horas' : 'Kilómetros'}
                        </Badge>
                      </TableCell>
                      <TableCell>{model.year_introduced || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/modelos/${model.id}`}>
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Ver detalles</span>
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/modelos/${model.id}/editar`}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/modelos/${model.id}/copiar`}>
                              <Copy className="h-4 w-4" />
                              <span className="sr-only">Copiar</span>
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/modelos/${model.id}/eliminar`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                              <span className="sr-only">Eliminar</span>
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Factory className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No hay modelos registrados</h3>
            <p className="text-sm">Crea tu primer modelo para comenzar.</p>
            <Button className="mt-4" asChild>
              <Link href="/modelos/crear">
                Crear Modelo
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
