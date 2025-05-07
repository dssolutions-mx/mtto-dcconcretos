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
import { Copy, Edit, Eye, FileText, MoreHorizontal, Search, Trash } from "lucide-react"
import Link from "next/link"

// Datos de ejemplo para plantillas de checklist
const checklistTemplates = [
  {
    id: "CL001",
    name: "Mantenimiento Preventivo 1000h - Mezcladora CR-15",
    modelId: "MOD001",
    model: "CR-15",
    manufacturer: "ConcreMix",
    category: "Mezcladora de Concreto",
    maintenanceType: "Completo",
    maintenanceHours: 1000,
    sections: 5,
    items: 25,
    lastUpdated: "2023-05-15",
    createdBy: "Carlos Méndez",
  },
  {
    id: "CL002",
    name: "Mantenimiento Preventivo 500h - Grúa Torre GT-200",
    modelId: "MOD002",
    model: "GT-200",
    manufacturer: "TowerCrane",
    category: "Grúa Torre",
    maintenanceType: "Intermedio",
    maintenanceHours: 500,
    sections: 4,
    items: 20,
    lastUpdated: "2023-04-20",
    createdBy: "Ana Gómez",
  },
  {
    id: "CL003",
    name: "Mantenimiento Preventivo 2000h - Generador PG-5000",
    modelId: "MOD003",
    model: "PG-5000",
    manufacturer: "PowerGen",
    category: "Generador Eléctrico",
    maintenanceType: "Completo",
    maintenanceHours: 2000,
    sections: 6,
    items: 30,
    lastUpdated: "2023-06-05",
    createdBy: "Roberto Sánchez",
  },
  {
    id: "CL004",
    name: "Mantenimiento Preventivo 800h - Montacargas FM-2000E",
    modelId: "MOD004",
    model: "FM-2000E",
    manufacturer: "ForkMaster",
    category: "Montacargas Eléctrico",
    maintenanceType: "Completo",
    maintenanceHours: 800,
    sections: 5,
    items: 22,
    lastUpdated: "2023-03-30",
    createdBy: "María Torres",
  },
  {
    id: "CL005",
    name: "Mantenimiento Preventivo 1500h - Compresor AP-1200",
    modelId: "MOD005",
    model: "AP-1200",
    manufacturer: "AirPro",
    category: "Compresor Industrial",
    maintenanceType: "Completo",
    maintenanceHours: 1500,
    sections: 4,
    items: 18,
    lastUpdated: "2023-06-01",
    createdBy: "Javier López",
  },
]

export function ChecklistTemplateList() {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredTemplates = checklistTemplates.filter(
    (template) =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.model.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Plantillas de Checklist</CardTitle>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar plantillas..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="mixers">Mezcladoras</TabsTrigger>
            <TabsTrigger value="generators">Generadores</TabsTrigger>
            <TabsTrigger value="others">Otros</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Secciones/Items</TableHead>
                    <TableHead>Última Actualización</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.id}</TableCell>
                      <TableCell>{template.name}</TableCell>
                      <TableCell>
                        {template.manufacturer} {template.model}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.maintenanceType}</Badge>
                      </TableCell>
                      <TableCell>{template.maintenanceHours}h</TableCell>
                      <TableCell>
                        {template.sections} / {template.items}
                      </TableCell>
                      <TableCell>{template.lastUpdated}</TableCell>
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
                              <Link href={`/checklists/${template.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                <span>Ver detalles</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/checklists/${template.id}/editar`}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Editar</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="mr-2 h-4 w-4" />
                              <span>Exportar a PDF</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              <span>Duplicar</span>
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
          </TabsContent>
          <TabsContent value="mixers">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Secciones/Items</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates
                    .filter((template) => template.category.includes("Mezcladora"))
                    .map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.id}</TableCell>
                        <TableCell>{template.name}</TableCell>
                        <TableCell>
                          {template.manufacturer} {template.model}
                        </TableCell>
                        <TableCell>{template.maintenanceHours}h</TableCell>
                        <TableCell>
                          {template.sections} / {template.items}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/checklists/${template.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="generators">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Secciones/Items</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates
                    .filter((template) => template.category.includes("Generador"))
                    .map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.id}</TableCell>
                        <TableCell>{template.name}</TableCell>
                        <TableCell>
                          {template.manufacturer} {template.model}
                        </TableCell>
                        <TableCell>{template.maintenanceHours}h</TableCell>
                        <TableCell>
                          {template.sections} / {template.items}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/checklists/${template.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="others">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates
                    .filter(
                      (template) =>
                        !template.category.includes("Mezcladora") && !template.category.includes("Generador"),
                    )
                    .map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.id}</TableCell>
                        <TableCell>{template.name}</TableCell>
                        <TableCell>
                          {template.manufacturer} {template.model}
                        </TableCell>
                        <TableCell>{template.category}</TableCell>
                        <TableCell>{template.maintenanceHours}h</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/checklists/${template.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          Mostrando {filteredTemplates.length} de {checklistTemplates.length} plantillas
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
