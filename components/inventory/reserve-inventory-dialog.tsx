"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { Package, AlertCircle, CheckCircle2 } from "lucide-react"
import { AvailabilityBadge } from "./availability-badge"

interface ReserveInventoryDialogProps {
  workOrderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface ReservationItem {
  part_id: string
  warehouse_id: string
  quantity: number
}

interface WOItemAvailability {
  part_id?: string
  part_number?: string
  part_name: string
  required_quantity: number
  availability: {
    part_id: string
    part_number: string
    part_name: string
    required_quantity: number
    available_by_warehouse: Array<{
      warehouse_id: string
      warehouse_name: string
      available_quantity: number
      current_quantity: number
      reserved_quantity: number
    }>
    total_available: number
    sufficient: boolean
  }
}

export function ReserveInventoryDialog({
  workOrderId,
  open,
  onOpenChange,
  onSuccess
}: ReserveInventoryDialogProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [wo, setWO] = useState<any>(null)
  const [availability, setAvailability] = useState<WOItemAvailability[]>([])
  const [reservations, setReservations] = useState<ReservationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open) {
      fetchWO()
      fetchAvailability()
    }
  }, [open, workOrderId])

  const fetchWO = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', workOrderId)
        .single()

      if (error) throw error
      setWO(data)
    } catch (error) {
      console.error('Error fetching WO:', error)
      toast.error('Error al cargar orden de trabajo')
    }
  }

  const fetchAvailability = async () => {
    try {
      setLoadingAvailability(true)
      const response = await fetch(`/api/work-orders/${workOrderId}/check-inventory`)
      const result = await response.json()
      if (result.success) {
        setAvailability(result.items || [])
        
        // Initialize reservations for items with sufficient stock
        const initialReservations: ReservationItem[] = []
        result.items.forEach((item: WOItemAvailability) => {
          if (item.availability.sufficient && item.availability.available_by_warehouse.length > 0) {
            // Use warehouse with most stock
            const bestWarehouse = item.availability.available_by_warehouse
              .sort((a, b) => b.available_quantity - a.available_quantity)[0]
            
            initialReservations.push({
              part_id: item.availability.part_id,
              warehouse_id: bestWarehouse.warehouse_id,
              quantity: Math.min(item.required_quantity, bestWarehouse.available_quantity)
            })
          }
        })
        setReservations(initialReservations)
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
      toast.error('Error al verificar disponibilidad')
    } finally {
      setLoadingAvailability(false)
    }
  }

  const updateReservation = (part_id: string, updates: Partial<ReservationItem>) => {
    const existing = reservations.find(r => r.part_id === part_id)
    if (existing) {
      setReservations(reservations.map(r => 
        r.part_id === part_id ? { ...r, ...updates } : r
      ))
    } else {
      setReservations([...reservations, {
        part_id,
        warehouse_id: updates.warehouse_id || "",
        quantity: updates.quantity || 0,
        ...updates
      }])
    }
  }

  const removeReservation = (part_id: string) => {
    setReservations(reservations.filter(r => r.part_id !== part_id))
  }

  const handleSubmit = async () => {
    if (reservations.length === 0) {
      toast.error('Debes seleccionar al menos una parte para reservar')
      return
    }

    // Validate
    for (const reservation of reservations) {
      const item = availability.find(a => a.availability.part_id === reservation.part_id)
      if (!item) continue

      const warehouse = item.availability.available_by_warehouse.find(
        w => w.warehouse_id === reservation.warehouse_id
      )

      if (!warehouse) {
        toast.error(`Almacén no válido para ${item.part_name}`)
        return
      }

      if (reservation.quantity > warehouse.available_quantity) {
        toast.error(`Cantidad excede lo disponible para ${item.part_name}`)
        return
      }

      if (reservation.quantity > item.required_quantity) {
        toast.error(`Cantidad excede lo requerido para ${item.part_name}`)
        return
      }
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/work-orders/${workOrderId}/reserve-parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservations,
          reservation_date: new Date().toISOString(),
          notes: notes || undefined
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(`${result.data.parts_reserved} partes reservadas exitosamente`)
        if (result.data.parts_unavailable > 0) {
          toast.warning(`${result.data.parts_unavailable} partes no disponibles - considera crear orden de compra`)
        }
        onSuccess?.()
        onOpenChange(false)
      } else {
        toast.error(result.error || 'Error al reservar partes')
      }
    } catch (error) {
      console.error('Error reserving parts:', error)
      toast.error('Error al reservar partes')
    } finally {
      setLoading(false)
    }
  }

  if (!wo) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Reservar Partes del Inventario</DialogTitle>
          <DialogDescription>
            Reserva las partes requeridas para esta orden de trabajo
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          {loadingAvailability ? (
            <div className="p-4 text-center">Verificando disponibilidad...</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parte</TableHead>
                      <TableHead>Requerido</TableHead>
                      <TableHead>Disponibilidad</TableHead>
                      <TableHead>Almacén</TableHead>
                      <TableHead>Cantidad Reservar</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availability.map((item) => {
                      const reservation = reservations.find(r => r.part_id === item.availability.part_id)
                      const isReserving = !!reservation
                      return (
                        <TableRow key={item.availability.part_id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.part_name}</div>
                              {item.part_number && (
                                <div className="text-sm text-muted-foreground">{item.part_number}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{item.required_quantity}</TableCell>
                          <TableCell>
                            <AvailabilityBadge
                              part_id={item.availability.part_id}
                              part_name={item.part_name}
                              required_quantity={item.required_quantity}
                              availability={{
                                part_id: item.availability.part_id,
                                part_number: item.availability.part_number,
                                part_name: item.availability.part_name,
                                required_quantity: item.required_quantity,
                                available_by_warehouse: item.availability.available_by_warehouse,
                                total_available: item.availability.total_available,
                                sufficient: item.availability.sufficient
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {isReserving ? (
                              <Select
                                value={reservation.warehouse_id}
                                onValueChange={(value) => updateReservation(item.availability.part_id, { warehouse_id: value })}
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {item.availability.available_by_warehouse.map((w) => (
                                    <SelectItem key={w.warehouse_id} value={w.warehouse_id}>
                                      {w.warehouse_name} ({w.available_quantity} disp.)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isReserving ? (
                              <Input
                                type="number"
                                value={reservation.quantity}
                                onChange={(e) => {
                                  const qty = parseFloat(e.target.value) || 0
                                  const warehouse = item.availability.available_by_warehouse.find(
                                    w => w.warehouse_id === reservation.warehouse_id
                                  )
                                  const maxQty = Math.min(
                                    item.required_quantity,
                                    warehouse?.available_quantity || 0
                                  )
                                  updateReservation(item.availability.part_id, { 
                                    quantity: Math.min(qty, maxQty)
                                  })
                                }}
                                min="0"
                                max={Math.min(
                                  item.required_quantity,
                                  item.availability.available_by_warehouse.find(
                                    w => w.warehouse_id === reservation.warehouse_id
                                  )?.available_quantity || 0
                                )}
                                step="0.01"
                                className="w-[100px]"
                              />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isReserving ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeReservation(item.availability.part_id)}
                              >
                                Quitar
                              </Button>
                            ) : (
                              item.availability.sufficient ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const bestWarehouse = item.availability.available_by_warehouse
                                      .sort((a, b) => b.available_quantity - a.available_quantity)[0]
                                    updateReservation(item.availability.part_id, {
                                      warehouse_id: bestWarehouse.warehouse_id,
                                      quantity: Math.min(item.required_quantity, bestWarehouse.available_quantity)
                                    })
                                  }}
                                >
                                  Reservar
                                </Button>
                              ) : (
                                <Badge variant="secondary">Sin Stock</Badge>
                              )
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {reservations.length > 0 && (
                <Alert>
                  <Package className="h-4 w-4" />
                  <AlertDescription>
                    {reservations.length} parte(s) se reservarán. 
                    Las partes sin stock requerirán orden de compra.
                  </AlertDescription>
                </Alert>
              )}
              {availability.some(item => !item.availability.sufficient) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Algunas partes no tienen suficiente stock. 
                    Considera crear una orden de compra para estas partes.
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionales sobre la reserva..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || reservations.length === 0}>
            {loading ? 'Reservando...' : 'Confirmar Reserva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
