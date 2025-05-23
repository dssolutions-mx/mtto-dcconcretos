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

export function WeeklyChecklistList() {
  const [searchTerm, setSearchTerm] = useState("")
  const { schedules, loading, error, fetchSchedules } = useChecklistSchedules()
  
  useEffect(() => {
    // Fetch weekly checklists
    fetchSchedules('pendiente', 'semanal')
  }, [fetchSchedules])

  const filteredChecklists = schedules.filter(
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
          <CardTitle>Checklists Semanales</CardTitle>
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
            No se encontraron checklists semanales.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Equipo</TableHead>
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
                    <TableCell>{checklist.checklists?.name || 'Sin nombre'}</TableCell>
                    <TableCell>
                      {checklist.assets?.name || 'Sin activo'}
                      <div className="text-xs text-muted-foreground">
                        {checklist.assets?.asset_id || ''}
                      </div>
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
          Mostrando {filteredChecklists.length} de {schedules.length} checklists
        </div>
      </CardFooter>
    </Card>
  )
}
