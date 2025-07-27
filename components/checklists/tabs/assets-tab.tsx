"use client"

import { useState, useEffect } from "react"
import { useAssets } from "@/hooks/useSupabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  Users, 
  MapPin, 
  Calendar, 
  Wrench, 
  Plus, 
  Search, 
  Eye, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Building
} from "lucide-react"
import Link from "next/link"
import { EquipmentModel, Asset } from "@/types"

interface AssetsTabProps {
  model: EquipmentModel
}

interface AssetWithRelations extends Asset {
  plants?: {
    id: string
    name: string
    code: string
    business_units?: {
      id: string
      name: string
      code: string
    }
  }
  departments?: {
    id: string
    name: string
    code: string
  }
  equipment_models?: EquipmentModel
}

export function AssetsTab({ model }: AssetsTabProps) {
  const { assets, loading, error, refetch } = useAssets()
  const [searchTerm, setSearchTerm] = useState("")

  // Filter assets by model and cast to include relations
  const modelAssets = (assets as AssetWithRelations[]).filter(asset => asset.model_id === model.id)

  const filteredAssets = modelAssets.filter(
    (asset) =>
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.asset_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.location || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.plants?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Group assets by status
  const operationalAssets = filteredAssets.filter(a => a.status === 'operational')
  const maintenanceAssets = filteredAssets.filter(a => a.status === 'maintenance')
  const repairAssets = filteredAssets.filter(a => a.status === 'repair')
  const inactiveAssets = filteredAssets.filter(a => a.status !== 'operational')

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Operativo</Badge>
      case 'maintenance':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Wrench className="h-3 w-3 mr-1" />Mantenimiento</Badge>
      case 'repair':
        return <Badge variant="secondary" className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Reparación</Badge>
      case 'inactive':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Inactivo</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatHours = (hours?: number) => {
    if (!hours) return "0 hrs"
    return `${hours.toLocaleString()} hrs`
  }

  const formatKilometers = (km?: number) => {
    if (!km) return "0 km"
    return `${km.toLocaleString()} km`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p>Cargando activos para {model.name}...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="bg-red-50 text-red-800 p-4 rounded-md">
            <p className="font-medium">Error al cargar activos</p>
            <p className="text-sm">{error.message}</p>
            <Button onClick={() => refetch()} variant="outline" className="mt-4">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (modelAssets.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No hay activos registrados</h3>
          <p className="text-sm text-muted-foreground text-center mt-1 mb-4">
            No se han registrado activos para el modelo {model.name}.
          </p>
          <Button asChild>
            <Link href={`/activos/crear?model=${model.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar primer activo
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with search and actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            Activos del modelo {model.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {modelAssets.length} activos registrados
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar activos..."
              className="pl-8 w-[250px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button asChild>
            <Link href={`/activos/crear?model=${model.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Activo
            </Link>
          </Button>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Operativos</p>
                <p className="text-2xl font-bold text-green-600">{operationalAssets.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En Mantenimiento</p>
                <p className="text-2xl font-bold text-yellow-600">{maintenanceAssets.length}</p>
              </div>
              <Wrench className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En Reparación</p>
                <p className="text-2xl font-bold text-red-600">{repairAssets.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inactivos</p>
                <p className="text-2xl font-bold text-gray-600">{inactiveAssets.length}</p>
              </div>
              <Clock className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Activos</CardTitle>
          <CardDescription>
            Todos los activos registrados para el modelo {model.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAssets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No se encontraron activos</p>
              {searchTerm && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="mt-2"
                >
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Horas/Km</TableHead>
                    <TableHead>Último Mantenimiento</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {(asset.asset_id || 'XX').substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{asset.name}</p>
                            <p className="text-sm text-muted-foreground">{asset.asset_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(asset.status || 'unknown')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            {asset.location && <p>{asset.location}</p>}
                            {asset.plants?.name && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {asset.plants.name}
                              </p>
                            )}
                            {asset.departments?.name && (
                              <p className="text-xs text-muted-foreground">
                                {asset.departments.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {asset.current_hours ? (
                            <p>{formatHours(asset.current_hours)}</p>
                          ) : asset.current_kilometers ? (
                            <p>{formatKilometers(asset.current_kilometers)}</p>
                          ) : (
                            <p className="text-muted-foreground">Sin registros</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {asset.last_maintenance_date ? (
                            <span>{new Date(asset.last_maintenance_date).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-muted-foreground">Sin mantenimiento</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/activos/${asset.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {filteredAssets.length > 0 && (
        <div className="text-sm text-muted-foreground text-center py-4 border-t">
          Mostrando {filteredAssets.length} de {modelAssets.length} activos para {model.name}
        </div>
      )}
    </div>
  )
} 