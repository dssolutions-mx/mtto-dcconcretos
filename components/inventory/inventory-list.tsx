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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Check, Edit, Eye, FileText, MoreHorizontal, Search, ShoppingCart, Trash, Package } from "lucide-react"
import Link from "next/link"

interface StockItem {
  id: string
  part_id: string
  part_number: string
  part_name: string
  category: string
  warehouse_id: string
  warehouse_name: string
  current_quantity: number
  reserved_quantity: number
  available_quantity: number
  min_stock_level: number
  max_stock_level?: number
  reorder_point?: number
  average_unit_cost: number
  total_value: number
  last_movement_date?: string
}

export function InventoryList() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [stockData, setStockData] = useState<StockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStock = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await fetch('/api/inventory/stock')
        const result = await response.json()
        if (result.success) {
          setStockData(result.data || [])
        } else {
          setError(result.error || 'Error al cargar inventario')
        }
      } catch (err) {
        setError('Error al cargar inventario')
        console.error('Error fetching stock:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStock()
  }, [])

  const filteredItems = (stockData || []).filter((item) => {
    const matchesSearch = 
      item.part_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.part_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.warehouse_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = 
      selectedCategory === "all" || 
      (selectedCategory === "repuestos" && item.category === "Repuesto") ||
      (selectedCategory === "consumibles" && item.category === "Consumible")
    
    return matchesSearch && matchesCategory
  })

  const getStockStatus = (item: StockItem) => {
    const available = item.available_quantity
    const minLevel = item.min_stock_level || 0
    const reorder = item.reorder_point || minLevel

    if (available <= 0) {
      return { label: "Sin Stock", variant: "destructive" as const }
    }
    if (available < reorder) {
      return { label: "Bajo", variant: "destructive" as const }
    }
    if (available < minLevel * 2) {
      return { label: "Adecuado", variant: "secondary" as const }
    }
    return { label: "Óptimo", variant: "default" as const }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando inventario...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            Error al cargar inventario. Por favor, intenta nuevamente.
          </div>
        </CardContent>
      </Card>
    )
  }

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
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="repuestos">Repuestos</TabsTrigger>
            <TabsTrigger value="consumibles">Consumibles</TabsTrigger>
          </TabsList>
          <TabsContent value={selectedCategory}>
            {filteredItems.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No se encontraron items en el inventario</p>
                <Link href="/inventario/catalogo">
                  <Button className="mt-4" variant="outline">
                    Agregar Parte al Catálogo
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número de Parte</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Almacén</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Reservado</TableHead>
                      <TableHead>Disponible</TableHead>
                      <TableHead>Estado Stock</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const status = getStockStatus(item)
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.part_number}</TableCell>
                          <TableCell>{item.part_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.category}</Badge>
                          </TableCell>
                          <TableCell>{item.warehouse_name}</TableCell>
                          <TableCell>{item.current_quantity}</TableCell>
                          <TableCell>
                            {item.reserved_quantity > 0 ? (
                              <Badge variant="secondary">{item.reserved_quantity}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{item.available_quantity}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {item.total_value > 0 ? (
                              <span className="text-sm">${item.total_value.toFixed(2)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
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
                                  <Link href={`/inventario/catalogo?part=${item.part_id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    <span>Ver detalles</span>
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/inventario/movimientos?part=${item.part_id}`}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span>Ver movimientos</span>
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link href="/inventario/catalogo">
                                    <Package className="mr-2 h-4 w-4" />
                                    <span>Gestionar Catálogo</span>
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          Mostrando {filteredItems.length} de {stockData?.length || 0} ítems
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inventario/catalogo">
            <Button variant="outline" size="sm">
              <Package className="mr-2 h-4 w-4" />
              Gestionar Catálogo
            </Button>
          </Link>
          <Link href="/inventario/movimientos">
            <Button variant="outline" size="sm">
              Ver Movimientos
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}
