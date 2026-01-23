"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Calendar, Package, ArrowRightLeft } from "lucide-react"
import { toast } from "sonner"
import { MovementWithDetails, MovementType } from "@/types/inventory"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export function MovementHistory() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [movements, setMovements] = useState<MovementWithDetails[]>([])
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 50
  const [filters, setFilters] = useState({
    warehouse_id: "all",
    movement_type: "all" as MovementType | "all",
    start_date: "",
    end_date: ""
  })

  useEffect(() => {
    fetchMovements()
    fetchWarehouses()
  }, [page, filters])

  const fetchMovements = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      if (filters.warehouse_id !== 'all') params.append('warehouse_id', filters.warehouse_id)
      if (filters.movement_type !== 'all') params.append('movement_type', filters.movement_type)
      if (filters.start_date) params.append('start_date', filters.start_date)
      if (filters.end_date) params.append('end_date', filters.end_date)

      const response = await fetch(`/api/inventory/movements?${params}`)
      const result = await response.json()
      if (result.success) {
        setMovements(result.movements || [])
        setTotal(result.total || 0)
      }
    } catch (error) {
      console.error('Error fetching movements:', error)
      toast.error('Error al cargar movimientos')
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

  const getMovementTypeLabel = (type: MovementType): string => {
    const labels: Record<MovementType, string> = {
      receipt: "Recepción",
      issue: "Emisión",
      adjustment: "Ajuste",
      transfer_out: "Transferencia Salida",
      transfer_in: "Transferencia Entrada",
      return: "Devolución",
      reservation: "Reserva",
      unreserve: "Liberar Reserva",
      return_to_supplier: "Devolución a Proveedor"
    }
    return labels[type] || type
  }

  const getMovementTypeVariant = (type: MovementType): "default" | "secondary" | "destructive" | "outline" => {
    if (type === 'receipt' || type === 'transfer_in' || type === 'return') return "default"
    if (type === 'issue' || type === 'transfer_out' || type === 'return_to_supplier') return "destructive"
    if (type === 'reservation') return "secondary"
    return "outline"
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Historial de Movimientos</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={filters.warehouse_id}
                onValueChange={(value) => { setFilters({ ...filters, warehouse_id: value }); setPage(1) }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Almacén" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.movement_type}
                onValueChange={(value) => { setFilters({ ...filters, movement_type: value as MovementType | "all" }); setPage(1) }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="receipt">Recepciones</SelectItem>
                  <SelectItem value="issue">Emisiones</SelectItem>
                  <SelectItem value="adjustment">Ajustes</SelectItem>
                  <SelectItem value="transfer_out">Transferencias Salida</SelectItem>
                  <SelectItem value="transfer_in">Transferencias Entrada</SelectItem>
                  <SelectItem value="return">Devoluciones</SelectItem>
                  <SelectItem value="reservation">Reservas</SelectItem>
                  <SelectItem value="unreserve">Liberaciones</SelectItem>
                  <SelectItem value="return_to_supplier">Devoluciones a Proveedor</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => { setFilters({ ...filters, start_date: e.target.value }); setPage(1) }}
                placeholder="Fecha inicio"
                className="w-[150px]"
              />
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => { setFilters({ ...filters, end_date: e.target.value }); setPage(1) }}
                placeholder="Fecha fin"
                className="w-[150px]"
              />
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
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Parte</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Costo Unitario</TableHead>
                    <TableHead>Costo Total</TableHead>
                    <TableHead>Realizado por</TableHead>
                    <TableHead>Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No hay movimientos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>
                          {movement.movement_date
                            ? format(new Date(movement.movement_date), "dd/MM/yyyy HH:mm", { locale: es })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getMovementTypeVariant(movement.movement_type)}>
                            {getMovementTypeLabel(movement.movement_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{movement.part?.name || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">{movement.part?.part_number || ''}</div>
                          </div>
                        </TableCell>
                        <TableCell>{movement.warehouse?.name || 'N/A'}</TableCell>
                        <TableCell className={movement.quantity < 0 ? "text-red-600" : "text-green-600"}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </TableCell>
                        <TableCell>
                          {movement.unit_cost ? `$${movement.unit_cost.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell>
                          {movement.total_cost ? `$${movement.total_cost.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell>
                          {movement.performed_by_user
                            ? `${movement.performed_by_user.nombre || ''} ${movement.performed_by_user.apellido || ''}`.trim()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {movement.work_order_id && (
                            <Badge variant="outline">WO</Badge>
                          )}
                          {movement.purchase_order_id && (
                            <Badge variant="outline">PO</Badge>
                          )}
                          {movement.reference_type && (
                            <span className="text-xs text-muted-foreground ml-1">
                              {movement.reference_type}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= total}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
