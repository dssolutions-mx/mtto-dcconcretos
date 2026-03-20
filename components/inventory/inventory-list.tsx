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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Eye, FileText, MoreHorizontal, Search, Package } from "lucide-react"
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
      return {
        label: "Sin stock",
        className: "rounded-full text-[10px] font-semibold border border-red-200 bg-red-50 text-red-700",
      }
    }
    if (available < reorder) {
      return {
        label: "Bajo",
        className: "rounded-full text-[10px] font-semibold border border-amber-200 bg-amber-50 text-amber-800",
      }
    }
    if (available < minLevel * 2) {
      return {
        label: "Adecuado",
        className: "rounded-full text-[10px] font-semibold border border-border/60 bg-muted/40 text-muted-foreground",
      }
    }
    return {
      label: "Óptimo",
      className: "rounded-full text-[10px] font-semibold border border-green-200 bg-green-50 text-green-800",
    }
  }

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-border/60 bg-card transition-all hover:border-border/80">
        <CardHeader className="pb-2">
          <div className="h-5 w-48 rounded bg-muted/60 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border/40">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-muted/60" />
                <div className="h-2.5 w-48 rounded bg-muted/40" />
              </div>
              <div className="h-4 w-16 rounded bg-muted/60 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="rounded-2xl border border-border/60 bg-card">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">No se pudo cargar el inventario</p>
              <p className="text-sm text-muted-foreground mt-1">
                Revisa tu conexión e intenta de nuevo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border border-border/60 bg-card transition-all hover:border-border hover:shadow-sm overflow-hidden">
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <CardHeader className="p-5 sm:p-6 pb-3 sm:pb-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">
                Por almacén y parte
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Cantidades disponibles después de reservas. Use el catálogo para altas y edición de partes.
              </p>
            </div>
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Buscar parte, código, almacén…"
                className="pl-9 min-h-[44px] rounded-xl border-border/60 bg-muted/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <TabsList className="h-auto min-h-[40px] flex-wrap gap-1 rounded-xl bg-muted/30 p-1 w-full sm:w-auto justify-start">
            <TabsTrigger value="all" className="rounded-lg min-h-[36px]">
              Todos
            </TabsTrigger>
            <TabsTrigger value="repuestos" className="rounded-lg min-h-[36px]">
              Repuestos
            </TabsTrigger>
            <TabsTrigger value="consumibles" className="rounded-lg min-h-[36px]">
              Consumibles
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="px-0 sm:px-6 pb-0">
          <TabsContent value={selectedCategory} className="mt-0">
            {filteredItems.length === 0 ? (
              <div className="flex items-start gap-3 px-4 sm:px-6 py-6 border-t border-border/40">
                <Package className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Sin resultados con los filtros actuales.
                  </p>
                  <Link href="/inventario/catalogo">
                    <Button variant="outline" size="sm" className="min-h-[44px] rounded-xl cursor-pointer">
                      Ir al catálogo
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-border/40">
                <Table className="min-w-[880px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                        Número de Parte
                      </TableHead>
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
                            <span className="inline-flex rounded-full text-[10px] font-semibold border border-border/60 px-2 py-0.5 text-muted-foreground">
                              {item.category}
                            </span>
                          </TableCell>
                          <TableCell>{item.warehouse_name}</TableCell>
                          <TableCell>{item.current_quantity}</TableCell>
                          <TableCell>
                            {item.reserved_quantity > 0 ? (
                              <span className="inline-flex rounded-full text-[10px] font-semibold border border-border/60 bg-muted/30 tabular-num px-2 py-0.5">
                                {item.reserved_quantity}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{item.available_quantity}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 ${status.className}`}>
                              {status.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.total_value > 0 ? (
                              <span className="text-sm tabular-num">${item.total_value.toFixed(2)}</span>
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
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 border-t border-border/40 bg-muted/10">
          <div className="text-xs sm:text-sm text-muted-foreground tabular-num">
            Mostrando {filteredItems.length} de {stockData?.length || 0} filas
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/inventario/catalogo">
              <Button variant="outline" size="sm" className="min-h-[40px] rounded-xl cursor-pointer">
                <Package className="mr-2 h-4 w-4" />
                Catálogo
              </Button>
            </Link>
            <Link href="/inventario/movimientos">
              <Button variant="outline" size="sm" className="min-h-[40px] rounded-xl cursor-pointer">
                Movimientos
              </Button>
            </Link>
          </div>
        </CardFooter>
      </Tabs>
    </Card>
  )
}
