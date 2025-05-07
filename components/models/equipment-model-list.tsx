"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Eye, FileText, Edit, RefreshCw } from "lucide-react"
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
        </CardContent>
      </Card>
    )
  }

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
            {displayData && displayData.length > 0 ? (
              displayData.map((model) => (
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
                        <Link href={`/modelos/${model.id}/documentos`}>
                          <FileText className="h-4 w-4" />
                          <span className="sr-only">Ver documentos</span>
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  No hay modelos registrados. Crea tu primer modelo para comenzar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
