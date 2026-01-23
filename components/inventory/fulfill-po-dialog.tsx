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
import { Package, CheckCircle2, AlertCircle } from "lucide-react"
import { AvailabilityBadge } from "./availability-badge"

interface FulfillFromInventoryDialogProps {
  purchaseOrderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface FulfillmentItem {
  po_item_id: string
  part_id: string
  warehouse_id: string
  quantity: number
  unit_cost?: number
}

interface POItemAvailability {
  po_item_id: string
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

export function FulfillFromInventoryDialog({
  purchaseOrderId,
  open,
  onOpenChange,
  onSuccess
}: FulfillFromInventoryDialogProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [po, setPO] = useState<any>(null)
  const [availability, setAvailability] = useState<POItemAvailability[]>([])
  const [fulfillments, setFulfillments] = useState<FulfillmentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open) {
      fetchPO()
      fetchAvailability()
    }
  }, [open, purchaseOrderId])

  const fetchPO = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', purchaseOrderId)
        .single()

      if (error) throw error
      setPO(data)
    } catch (error) {
      console.error('Error fetching PO:', error)
      toast.error('Error al cargar orden de compra')
    }
  }

  const fetchAvailability = async () => {
    try {
      setLoadingAvailability(true)
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/inventory-availability`)
      const result = await response.json()
      if (result.success) {
        setAvailability(result.items || [])
        
        // Initialize fulfillments for items with sufficient stock
        const initialFulfillments: FulfillmentItem[] = []
        result.items.forEach((item: POItemAvailability) => {
          if (item.availability.sufficient && item.availability.available_by_warehouse.length > 0) {
            // Use warehouse with most stock
            const bestWarehouse = item.availability.available_by_warehouse
              .sort((a, b) => b.available_quantity - a.available_quantity)[0]
            
            initialFulfillments.push({
              po_item_id: item.po_item_id,
              part_id: item.availability.part_id,
              warehouse_id: bestWarehouse.warehouse_id,
              quantity: Math.min(item.required_quantity, bestWarehouse.available_quantity),
              unit_cost: undefined // Use inventory cost
            })
          }
        })
        setFulfillments(initialFulfillments)
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
      toast.error('Error al verificar disponibilidad')
    } finally {
      setLoadingAvailability(false)
    }
  }

  const updateFulfillment = (po_item_id: string, updates: Partial<FulfillmentItem>) => {
    const existing = fulfillments.find(f => f.po_item_id === po_item_id)
    if (existing) {
      setFulfillments(fulfillments.map(f => 
        f.po_item_id === po_item_id ? { ...f, ...updates } : f
      ))
    } else {
      const item = availability.find(a => a.po_item_id === po_item_id)
      if (item && item.availability.part_id) {
        setFulfillments([...fulfillments, {
          po_item_id,
          part_id: item.availability.part_id,
          warehouse_id: updates.warehouse_id || "",
          quantity: updates.quantity || 0,
          ...updates
        }])
      }
    }
  }

  const removeFulfillment = (po_item_id: string) => {
    setFulfillments(fulfillments.filter(f => f.po_item_id !== po_item_id))
  }

  const handleSubmit = async () => {
    if (fulfillments.length === 0) {
      toast.error('Debes seleccionar al menos un item para cumplir desde inventario')
      return
    }

    // Validate
    for (const fulfillment of fulfillments) {
      const item = availability.find(a => a.po_item_id === fulfillment.po_item_id)
      if (!item) continue

      const warehouse = item.availability.available_by_warehouse.find(
        w => w.warehouse_id === fulfillment.warehouse_id
      )

      if (!warehouse) {
        toast.error(`Almacén no válido para ${item.part_name}`)
        return
      }

      if (fulfillment.quantity > warehouse.available_quantity) {
        toast.error(`Cantidad excede lo disponible para ${item.part_name}`)
        return
      }

      if (fulfillment.quantity > item.required_quantity) {
        toast.error(`Cantidad excede lo requerido para ${item.part_name}`)
        return
      }
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/fulfill-from-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fulfillments,
          fulfillment_date: new Date().toISOString(),
          notes: notes || undefined
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(`${result.data.items_fulfilled} items cumplidos desde inventario`)
        if (result.data.remaining_items > 0) {
          toast.info(`${result.data.remaining_items} items aún requieren compra`)
        }
        onSuccess?.()
        onOpenChange(false)
      } else {
        toast.error(result.error || 'Error al cumplir desde inventario')
      }
    } catch (error) {
      console.error('Error fulfilling from inventory:', error)
      toast.error('Error al cumplir desde inventario')
    } finally {
      setLoading(false)
    }
  }

  if (!po) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Cumplir Orden de Compra desde Inventario</DialogTitle>
          <DialogDescription>
            Selecciona los items que se cumplirán desde el inventario disponible
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
                      <TableHead>Item</TableHead>
                      <TableHead>Requerido</TableHead>
                      <TableHead>Disponibilidad</TableHead>
                      <TableHead>Almacén</TableHead>
                      <TableHead>Cantidad Cumplir</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availability.map((item) => {
                      const fulfillment = fulfillments.find(f => f.po_item_id === item.po_item_id)
                      const isFulfilling = !!fulfillment
                      return (
                        <TableRow key={item.po_item_id}>
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
                            {isFulfilling ? (
                              <Select
                                value={fulfillment.warehouse_id}
                                onValueChange={(value) => updateFulfillment(item.po_item_id, { warehouse_id: value })}
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
                            {isFulfilling ? (
                              <Input
                                type="number"
                                value={fulfillment.quantity}
                                onChange={(e) => {
                                  const qty = parseFloat(e.target.value) || 0
                                  const warehouse = item.availability.available_by_warehouse.find(
                                    w => w.warehouse_id === fulfillment.warehouse_id
                                  )
                                  const maxQty = Math.min(
                                    item.required_quantity,
                                    warehouse?.available_quantity || 0
                                  )
                                  updateFulfillment(item.po_item_id, { 
                                    quantity: Math.min(qty, maxQty)
                                  })
                                }}
                                min="0"
                                max={Math.min(
                                  item.required_quantity,
                                  item.availability.available_by_warehouse.find(
                                    w => w.warehouse_id === fulfillment.warehouse_id
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
                            {isFulfilling ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeFulfillment(item.po_item_id)}
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
                                    updateFulfillment(item.po_item_id, {
                                      warehouse_id: bestWarehouse.warehouse_id,
                                      quantity: Math.min(item.required_quantity, bestWarehouse.available_quantity)
                                    })
                                  }}
                                >
                                  Cumplir
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
              {fulfillments.length > 0 && (
                <Alert>
                  <Package className="h-4 w-4" />
                  <AlertDescription>
                    {fulfillments.length} item(s) se cumplirán desde inventario. 
                    Los items restantes requerirán compra.
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionales sobre el cumplimiento..."
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
          <Button onClick={handleSubmit} disabled={loading || fulfillments.length === 0}>
            {loading ? 'Cumpliendo...' : 'Confirmar Cumplimiento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
