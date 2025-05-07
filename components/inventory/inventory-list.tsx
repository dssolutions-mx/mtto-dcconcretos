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
import { AlertCircle, Check, Edit, Eye, FileText, MoreHorizontal, Search, ShoppingCart, Trash } from "lucide-react"

const inventoryItems = [
  {
    id: "INV001",
    name: "Motor Eléctrico 5HP",
    category: "Repuesto",
    location: "Almacén Central - Estante A3",
    quantity: 5,
    minStock: 2,
    warranty: {
      status: "Vigente",
      provider: "ElectroMotores S.A.",
      expiryDate: "2023-12-15",
    },
    lastMovement: "2023-05-20",
  },
  {
    id: "INV002",
    name: "Filtro de Aire Industrial",
    category: "Consumible",
    location: "Almacén Central - Estante B2",
    quantity: 12,
    minStock: 5,
    warranty: {
      status: "No aplica",
      provider: "FiltroPro",
      expiryDate: "-",
    },
    lastMovement: "2023-06-02",
  },
  {
    id: "INV003",
    name: "Bomba Hidráulica 2000PSI",
    category: "Repuesto",
    location: "Almacén Central - Estante A1",
    quantity: 2,
    minStock: 1,
    warranty: {
      status: "Vigente",
      provider: "HidroSistemas",
      expiryDate: "2024-01-10",
    },
    lastMovement: "2023-04-15",
  },
  {
    id: "INV004",
    name: "Aceite Hidráulico 20L",
    category: "Consumible",
    location: "Almacén Central - Zona C",
    quantity: 8,
    minStock: 3,
    warranty: {
      status: "No aplica",
      provider: "LubriTech",
      expiryDate: "-",
    },
    lastMovement: "2023-05-30",
  },
  {
    id: "INV005",
    name: "Tarjeta Electrónica PLC",
    category: "Repuesto",
    location: "Almacén Electrónico - Gabinete 2",
    quantity: 3,
    minStock: 2,
    warranty: {
      status: "Por vencer",
      provider: "AutoControl",
      expiryDate: "2023-07-22",
    },
    lastMovement: "2023-03-18",
  },
  {
    id: "INV006",
    name: "Rodamiento Industrial 5000",
    category: "Repuesto",
    location: "Almacén Central - Estante D4",
    quantity: 15,
    minStock: 5,
    warranty: {
      status: "Vigente",
      provider: "RodaTech",
      expiryDate: "2023-11-05",
    },
    lastMovement: "2023-06-10",
  },
]

export function InventoryList() {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredItems = inventoryItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Inventario de Repuestos y Consumibles</CardTitle>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar en inventario..."
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
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="repuestos">Repuestos</TabsTrigger>
            <TabsTrigger value="consumibles">Consumibles</TabsTrigger>
            <TabsTrigger value="warranty">Con Garantía</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Estado Stock</TableHead>
                    <TableHead>Garantía</TableHead>
                    <TableHead>Último Mov.</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.id}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.quantity > item.minStock * 2
                              ? "default"
                              : item.quantity > item.minStock
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {item.quantity > item.minStock * 2
                            ? "Óptimo"
                            : item.quantity > item.minStock
                              ? "Adecuado"
                              : "Bajo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.warranty.status === "Por vencer" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                          {item.warranty.status === "Vigente" && <Check className="h-4 w-4 text-green-500" />}
                          <span>{item.warranty.expiryDate}</span>
                        </div>
                      </TableCell>
                      <TableCell>{item.lastMovement}</TableCell>
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
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              <span>Ver detalles</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Editar</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="mr-2 h-4 w-4" />
                              <span>Ver garantía</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              <span>Registrar movimiento</span>
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
          <TabsContent value="repuestos">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Estado Stock</TableHead>
                    <TableHead>Garantía</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems
                    .filter((item) => item.category === "Repuesto")
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.id}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.quantity > item.minStock * 2
                                ? "default"
                                : item.quantity > item.minStock
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {item.quantity > item.minStock * 2
                              ? "Óptimo"
                              : item.quantity > item.minStock
                                ? "Adecuado"
                                : "Bajo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.warranty.status === "Por vencer" && (
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                            {item.warranty.status === "Vigente" && <Check className="h-4 w-4 text-green-500" />}
                            <span>{item.warranty.expiryDate}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="consumibles">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Estado Stock</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems
                    .filter((item) => item.category === "Consumible")
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.id}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.quantity > item.minStock * 2
                                ? "default"
                                : item.quantity > item.minStock
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {item.quantity > item.minStock * 2
                              ? "Óptimo"
                              : item.quantity > item.minStock
                                ? "Adecuado"
                                : "Bajo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="warranty">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Estado Garantía</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems
                    .filter((item) => item.warranty.status !== "No aplica")
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.id}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.warranty.provider}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.warranty.status === "Vigente"
                                ? "default"
                                : item.warranty.status === "Por vencer"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {item.warranty.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.warranty.expiryDate}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <FileText className="h-4 w-4" />
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
          Mostrando {filteredItems.length} de {inventoryItems.length} ítems
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
