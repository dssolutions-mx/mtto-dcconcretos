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
import { ClipboardCheck, Edit, Eye, MoreHorizontal, Search, Trash } from "lucide-react"
import Link from "next/link"

// Datos de ejemplo para checklists semanales
const weeklyChecklists = [
  {
    id: "WCL001",
    name: "Inspección Semanal - Mezcladora CR-15",
    assetId: "A007",
    asset: "Mezcladora de Concreto CR-15 #1",
    modelId: "MOD001",
    model: "CR-15",
    manufacturer: "ConcreMix",
    lastExecution: "2023-06-10",
    nextExecution: "2023-06-17",
    status: "Programado",
    assignedTo: "Carlos Méndez",
    items: 15,
    issues: 0,
  },
  {
    id: "WCL002",
    name: "Inspección Semanal - Grúa Torre GT-200",
    assetId: "A008",
    asset: "Grúa Torre GT-200",
    modelId: "MOD002",
    model: "GT-200",
    manufacturer: "TowerCrane",
    lastExecution: "2023-06-09",
    nextExecution: "2023-06-16",
    status: "Programado",
    assignedTo: "Ana Gómez",
    items: 18,
    issues: 0,
  },
  {
    id: "WCL003",
    name: "Inspección Semanal - Generador PG-5000",
    assetId: "A005",
    asset: "Generador Eléctrico Principal",
    modelId: "MOD003",
    model: "PG-5000",
    manufacturer: "PowerGen",
    lastExecution: "2023-06-08",
    nextExecution: "2023-06-15",
    status: "Atrasado",
    assignedTo: "Roberto Sánchez",
    items: 12,
    issues: 0,
  },
  {
    id: "WCL004",
    name: "Inspección Semanal - Montacargas FM-2000E",
    assetId: "A002",
    asset: "Montacargas Eléctrico #3",
    modelId: "MOD004",
    model: "FM-2000E",
    manufacturer: "ForkMaster",
    lastExecution: "2023-06-11",
    nextExecution: "2023-06-18",
    status: "Programado",
    assignedTo: "María Torres",
    items: 14,
    issues: 0,
  },
]

export function WeeklyChecklistList() {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredChecklists = weeklyChecklists.filter(
    (checklist) =>
      checklist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
      checklist.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completado":
        return <Badge className="bg-green-500">Completado</Badge>
      case "Programado":
        return <Badge variant="outline">Programado</Badge>
      case "Atrasado":
        return <Badge variant="destructive">Atrasado</Badge>
      case "Con Problemas":
        return <Badge variant="destructive">Con Problemas</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Última Ejecución</TableHead>
                <TableHead>Próxima Ejecución</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Asignado a</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChecklists.map((checklist) => (
                <TableRow key={checklist.id}>
                  <TableCell className="font-medium">{checklist.id}</TableCell>
                  <TableCell>{checklist.name}</TableCell>
                  <TableCell>
                    {checklist.asset}
                    <div className="text-xs text-muted-foreground">
                      {checklist.manufacturer} {checklist.model}
                    </div>
                  </TableCell>
                  <TableCell>{checklist.lastExecution}</TableCell>
                  <TableCell>{checklist.nextExecution}</TableCell>
                  <TableCell>{getStatusBadge(checklist.status)}</TableCell>
                  <TableCell>{checklist.assignedTo}</TableCell>
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
                          <Link href={`/checklists/${checklist.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            <span>Ver detalles</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/checklists/${checklist.id}/editar`}>
                            <Edit className="mr-2 h-4 w-4" />
                            <span>Editar</span>
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
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          Mostrando {filteredChecklists.length} de {weeklyChecklists.length} checklists
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Anterior
          </Button>
          <Button variant="outline" size="sm">
            Siguiente
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
