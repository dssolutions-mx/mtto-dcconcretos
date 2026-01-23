"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Package, AlertTriangle, TrendingDown } from "lucide-react"
import { toast } from "sonner"
import { StockWithDetails } from "@/types/inventory"
import { StockAdjustmentDialog } from "./stock-adjustment-dialog"
import { TransferInventoryDialog } from "./transfer-inventory-dialog"

export function StockManagement() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [stock, setStock] = useState<StockWithDetails[]>([])
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; plant_id: string }>>([])
  const [plants, setPlants] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")
  const [plantFilter, setPlantFilter] = useState<string>("all")
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [selectedStock, setSelectedStock] = useState<StockWithDetails | null>(null)

  useEffect(() => {
    fetchStock()
    fetchWarehouses()
    fetchPlants()
  }, [warehouseFilter, plantFilter, lowStockOnly])

  const fetchStock = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (warehouseFilter !== 'all') params.append('warehouse_id', warehouseFilter)
      if (plantFilter !== 'all') params.append('plant_id', plantFilter)
      if (lowStockOnly) params.append('low_stock_only', 'true')
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/inventory/stock?${params}`)
      const result = await response.json()
      if (result.success) {
        setStock(result.stock || [])
      }
    } catch (error) {
      console.error('Error fetching stock:', error)
      toast.error('Error al cargar stock')
    } finally {
      setLoading(false)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/inventory/warehouses?is_active=true')
      const result = await response.json()
      if (result.success) {
        setWarehouses(result.warehouses || [])
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  const fetchPlants = async () => {
    try {
      const { data, error } = await supabase
        .from('plants')
        .select('id, name')
        .order('name')
      
      if (error) throw error
      setPlants(data || [])
    } catch (error) {
      console.error('Error fetching plants:', error)
    }
  }

  const getStockStatus = (stock: StockWithDetails): { status: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    const available = stock.current_quantity - stock.reserved_quantity
    if (available <= 0) {
      return { status: "Sin Stock", variant: "destructive" }
    }
    if (stock.reorder_point && available < stock.reorder_point) {
      return { status: "Stock Bajo", variant: "secondary" }
    }
    if (stock.min_stock_level && available < stock.min_stock_level) {
      return { status: "Crítico", variant: "destructive" }
    }
    return { status: "Disponible", variant: "default" }
  }

  const filteredStock = stock.filter(s => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        s.part?.name.toLowerCase().includes(searchLower) ||
        s.part?.part_number.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Gestión de Stock</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar por parte..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={plantFilter} onValueChange={setPlantFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Planta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {plants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id}>
                      {plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Almacén" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {warehouses
                    .filter(w => plantFilter === 'all' || w.plant_id === plantFilter)
                    .map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                variant={lowStockOnly ? "default" : "outline"}
                onClick={() => setLowStockOnly(!lowStockOnly)}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Stock Bajo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-4 text-center">Cargando...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parte</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead>Cantidad Actual</TableHead>
                    <TableHead>Reservado</TableHead>
                    <TableHead>Disponible</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStock.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No hay stock registrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStock.map((s) => {
                      const available = s.current_quantity - s.reserved_quantity
                      const stockStatus = getStockStatus(s)
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{s.part?.name || 'N/A'}</div>
                              <div className="text-sm text-muted-foreground">{s.part?.part_number || ''}</div>
                            </div>
                          </TableCell>
                          <TableCell>{s.warehouse?.name || 'N/A'}</TableCell>
                          <TableCell>{s.current_quantity}</TableCell>
                          <TableCell>{s.reserved_quantity}</TableCell>
                          <TableCell className={available < 0 ? "text-red-600 font-semibold" : ""}>
                            {available}
                          </TableCell>
                          <TableCell>
                            <Badge variant={stockStatus.variant}>
                              {stockStatus.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            ${s.total_value.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedStock(s)
                                  setAdjustDialogOpen(true)
                                }}
                              >
                                Ajustar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedStock(s)
                                  setTransferDialogOpen(true)
                                }}
                              >
                                Transferir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Adjustment Dialog */}
      {selectedStock && (
        <StockAdjustmentDialog
          open={adjustDialogOpen}
          onOpenChange={setAdjustDialogOpen}
          stock={selectedStock}
          onSuccess={() => {
            fetchStock()
            setAdjustDialogOpen(false)
            setSelectedStock(null)
          }}
        />
      )}

      {/* Transfer Dialog */}
      {selectedStock && (
        <TransferInventoryDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          stock={selectedStock}
          warehouses={warehouses.filter(w => w.id !== selectedStock.warehouse_id)}
          onSuccess={() => {
            fetchStock()
            setTransferDialogOpen(false)
            setSelectedStock(null)
          }}
        />
      )}
    </div>
  )
}
