"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Eye, FileText, AlertTriangle, Clock, RefreshCw } from "lucide-react"
import { Asset } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"

interface AssetsListProps {
  assets?: Asset[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function AssetsList({ assets, isLoading = false, onRefresh }: AssetsListProps) {
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

  // Función para obtener información de próximo mantenimiento
  const getNextMaintenance = (asset: Asset) => {
    // Esto se podría mejorar consultando los planes de mantenimiento reales
    return "Programado";
  }

  // Función para obtener alertas
  const getAlerts = (asset: Asset) => {
    // Lógica para determinar alertas (mantenimientos vencidos, etc.)
    return 0;
  }

  if (isLoading) {
  return (
    <Card>
      <CardHeader>
          <CardTitle>Activos Registrados</CardTitle>
          <CardDescription>Cargando activos...</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Próximo Mantenimiento</TableHead>
                <TableHead>Alertas</TableHead>
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
        <CardTitle>Activos Registrados</CardTitle>
        <CardDescription>Lista de todos los equipos y activos registrados en el sistema.</CardDescription>
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
              <TableHead>Ubicación</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Próximo Mantenimiento</TableHead>
              <TableHead>Alertas</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets && assets.length > 0 ? (
              assets.map((asset) => (
              <TableRow key={asset.id}>
                  <TableCell className="font-medium">{asset.asset_id}</TableCell>
                <TableCell>{asset.name}</TableCell>
                  <TableCell>{asset.location || "-"}</TableCell>
                  <TableCell>{getStatusBadge(asset.status || "")}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
                      <span>{getNextMaintenance(asset)}</span>
                  </div>
                </TableCell>
                <TableCell>
                    {getAlerts(asset) > 0 ? (
                    <div className="flex items-center">
                      <AlertTriangle className="mr-1 h-4 w-4 text-amber-500" />
                        <span>{getAlerts(asset)}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Ninguna</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/activos/${asset.id}`}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Ver detalles</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/activos/${asset.id}/historial`}>
                        <FileText className="h-4 w-4" />
                        <span className="sr-only">Ver historial</span>
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  No hay activos registrados. Crea tu primer activo para comenzar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

