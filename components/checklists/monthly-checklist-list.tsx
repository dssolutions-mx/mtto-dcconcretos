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
import { ClipboardCheck, Edit, Eye, MoreHorizontal, Search, Trash, Loader2 } from "lucide-react"
import Link from "next/link"
import { useChecklistSchedules } from "@/hooks/useChecklists"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { isDateToday } from "@/lib/utils/date-utils"

export function MonthlyChecklistList() {
  const [searchTerm, setSearchTerm] = useState("")
  const { schedules, loading, error, fetchSchedules } = useChecklistSchedules()
  
  useEffect(() => {
    // Fetch monthly checklists
    fetchSchedules('pendiente', 'mensual')
  }, [fetchSchedules])

  // Filter only TODAY's checklists using UTC-based date comparison
  const todaysChecklists = schedules.filter(checklist => {
    return isDateToday(checklist.scheduled_date)
  })

  const filteredChecklists = todaysChecklists.filter(
    (checklist) =>
      checklist.checklists?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.assets?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.profiles?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.profiles?.apellido?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completado":
        return <Badge className="bg-green-500">Completado</Badge>
      case "pendiente":
        return <Badge variant="outline">Programado</Badge>
      case "vencido":
        return <Badge variant="destructive">Atrasado</Badge>
      case "con_problemas":
        return <Badge variant="destructive">Con Problemas</Badge>
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
          <CardTitle>Checklists Mensuales - Hoy</CardTitle>
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
            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium">No hay checklists mensuales programados para hoy</p>
            <p className="text-sm mt-2">¡Todos los checklists del día han sido completados!</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Equipo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha Programada</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChecklists.map((checklist) => (
                  <TableRow key={checklist.id}>
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
                      {checklist.maintenance_plan_id ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          Mantenimiento Preventivo
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          Rutinario
                        </Badge>
                      )}
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
          Mostrando {filteredChecklists.length} de {todaysChecklists.length} checklists para hoy
        </div>
      </CardFooter>
    </Card>
  )
}
