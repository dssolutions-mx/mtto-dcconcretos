"use client"

import { useState, useEffect } from "react"
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
import { ClipboardCheck, Edit, Eye, MoreHorizontal, Search, Trash, Loader2, Wrench } from "lucide-react"
import Link from "next/link"
import { useChecklistSchedules } from "@/hooks/useChecklists"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

export function PreventiveChecklistList() {
  const [searchTerm, setSearchTerm] = useState("")
  const { schedules, loading, error, fetchSchedules } = useChecklistSchedules()
  
  useEffect(() => {
    // Fetch all checklists (we'll filter for preventive ones)
    fetchSchedules('pendiente')
  }, [fetchSchedules])

  // Filter only preventive maintenance checklists
  const preventiveChecklists = schedules.filter(
    (checklist) => checklist.maintenance_plan_id !== null && checklist.maintenance_plan_id !== undefined
  )

  const filteredChecklists = preventiveChecklists.filter(
    (checklist) =>
      checklist.checklists?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.assets?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.assets?.asset_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.profiles?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.profiles?.apellido?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completado":
        return <Badge className="bg-green-500">Completado</Badge>
      case "pendiente":
        return <Badge variant="outline">Pendiente</Badge>
      case "con_problemas":
        return <Badge variant="destructive">Con Problemas</Badge>
      case "vencido":
        return <Badge variant="destructive">Vencido</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }
  
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'dd/MM/yyyy', { locale: es })
    } catch (e) {
      return 'Fecha inválida'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-600" />
            <CardTitle>Checklists de Mantenimiento Preventivo</CardTitle>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar checklists..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Cargando checklists...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
            <p className="font-medium">Error al cargar los checklists</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : filteredChecklists.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium mb-2">No hay checklists de mantenimiento preventivo</p>
            <p className="text-sm">Los checklists aparecerán aquí cuando se programen desde una orden de trabajo de mantenimiento.</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Equipo/Activo</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Fecha Programada</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChecklists.map((checklist) => (
                  <TableRow key={checklist.id}>
                    <TableCell className="font-medium">{checklist.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{checklist.checklists?.name || 'Sin nombre'}</p>
                        <p className="text-xs text-muted-foreground">
                          {checklist.checklists?.equipment_models?.manufacturer} {checklist.checklists?.equipment_models?.name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{checklist.assets?.name || 'Sin activo'}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {checklist.assets?.asset_id || 'N/A'}
                        </p>
                        {checklist.assets?.location && (
                          <div className="text-sm text-gray-500">
                            📍 {(checklist.assets as any).plants?.name || checklist.assets.location || 'Sin planta'}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {checklist.checklists?.frequency || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(checklist.scheduled_date)}</TableCell>
                    <TableCell>{getStatusBadge(checklist.status)}</TableCell>
                    <TableCell>
                      {checklist.profiles ? 
                        `${checklist.profiles.nombre} ${checklist.profiles.apellido}` : 
                        'No asignado'}
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
                            <Link href={`/checklists/ejecutar/${checklist.id}`}>
                              <ClipboardCheck className="mr-2 h-4 w-4" />
                              <span>Ejecutar</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/checklists/programados/${checklist.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              <span>Ver detalles</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash className="mr-2 h-4 w-4" />
                            <span>Eliminar</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          Mostrando {filteredChecklists.length} de {preventiveChecklists.length} checklists de mantenimiento preventivo
        </div>
      </CardFooter>
    </Card>
  )
} 