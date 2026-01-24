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

interface ReceiveToInventoryDialogProps {
  purchaseOrderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface POItem {
  id?: string
  name: string
  partNumber?: string
  quantity: number
  unit_price: number
}

interface ReceiptItem {
  po_item_id?: string
  part_id?: string
  part_number?: string
  part_name: string
  warehouse_id: string
  quantity: number
  unit_cost: number
  notes?: string
  matched?: boolean
}

export function ReceiveToInventoryDialog({
  purchaseOrderId,
  open,
  onOpenChange,
  onSuccess
}: ReceiveToInventoryDialogProps) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [po, setPO] = useState<any>(null)
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([])
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([])
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open) {
      fetchPO()
      fetchWarehouses()
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

      // Check if already received
      if (data.received_to_inventory) {
        toast.info('Esta orden ya fue recibida al inventario')
      }

      // Initialize receipt items from PO items
      const items = (data.items as any[]) || []
      const initialItems: ReceiptItem[] = items.map((item, index) => ({
        po_item_id: item.id || `item-${index}`,
        part_name: item.name,
        part_number: item.partNumber,
        warehouse_id: "",
        quantity: item.quantity || 0,
        unit_cost: item.unit_price || 0,
        matched: false
      }))

      // Try to match parts
      for (const item of initialItems) {
        if (item.part_number) {
          const response = await fetch(`/api/inventory/parts/search?part_number=${encodeURIComponent(item.part_number)}`)
          const result = await response.json()
          if (result.success && result.parts.length > 0) {
            item.part_id = result.parts[0].id
            item.matched = true
          }
        }
      }

      setReceiptItems(initialItems)
    } catch (error) {
      console.error('Error fetching PO:', error)
      toast.error('Error al cargar orden de compra')
    }
  }

  const fetchWarehouses = async () => {
    try {
      if (!po) return
      const response = await fetch(`/api/inventory/warehouses?plant_id=${po.plant_id}&is_active=true`)
      const result = await response.json()
      if (result.success) {
        setWarehouses(result.warehouses || [])
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  useEffect(() => {
    if (po) {
      fetchWarehouses()
    }
  }, [po])

  const updateReceiptItem = (index: number, updates: Partial<ReceiptItem>) => {
    const updated = [...receiptItems]
    updated[index] = { ...updated[index], ...updates }
    setReceiptItems(updated)
  }

  const handleSubmit = async () => {
    // Validate
    const invalidItems = receiptItems.filter(item => 
      !item.warehouse_id || item.quantity <= 0
    )

    if (invalidItems.length > 0) {
      toast.error('Todos los items deben tener almacén seleccionado y cantidad mayor a 0')
      return
    }

    // Check quantities don't exceed PO quantities
    const poItems = (po.items as any[]) || []
    for (let i = 0; i < receiptItems.length; i++) {
      const receiptItem = receiptItems[i]
      const poItem = poItems[i]
      if (receiptItem.quantity > (poItem.quantity || 0)) {
        toast.error(`La cantidad recibida no puede exceder la cantidad ordenada para ${receiptItem.part_name}`)
        return
      }
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/receive-to-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: receiptItems.map(item => ({
            po_item_id: item.po_item_id,
            part_id: item.part_id,
            part_number: item.part_number,
            part_name: item.part_name,
            warehouse_id: item.warehouse_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            notes: item.notes
          })),
          receipt_date: new Date().toISOString(),
          notes: notes || undefined
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success(`${result.data.total_items_received} items recibidos al inventario`)
        onSuccess?.()
        onOpenChange(false)
      } else {
        toast.error(result.error || 'Error al recibir al inventario')
      }
    } catch (error) {
      console.error('Error receiving to inventory:', error)
      toast.error('Error al recibir al inventario')
    } finally {
      setLoading(false)
    }
  }

  if (!po) {
    return null
  }

  const totalValue = receiptItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Recibir Orden de Compra al Inventario</DialogTitle>
          <DialogDescription>
            Selecciona el almacén y confirma las cantidades para cada item
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          <div className="space-y-4">
            {po.received_to_inventory && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Esta orden ya fue recibida al inventario el {po.received_to_inventory_date 
                    ? new Date(po.received_to_inventory_date).toLocaleDateString()
                    : ''}
                </AlertDescription>
              </Alert>
            )}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Cantidad PO</TableHead>
                    <TableHead>Almacén</TableHead>
                    <TableHead>Cantidad Recibir</TableHead>
                    <TableHead>Costo Unitario</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.part_name}</div>
                          {item.part_number && (
                            <div className="text-sm text-muted-foreground">{item.part_number}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(po.items as any[])[index]?.quantity || 0}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.warehouse_id}
                          onValueChange={(value) => updateReceiptItem(index, { warehouse_id: value })}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Seleccionar almacén" />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses.map((warehouse) => (
                              <SelectItem key={warehouse.id} value={warehouse.id}>
                                {warehouse.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateReceiptItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                          min="0"
                          max={(po.items as any[])[index]?.quantity || 0}
                          step="0.01"
                          className="w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.unit_cost}
                          onChange={(e) => updateReceiptItem(index, { unit_cost: parseFloat(e.target.value) || 0 })}
                          min="0"
                          step="0.01"
                          className="w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        {item.matched ? (
                          <Badge variant="default">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            En Catálogo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Nuevo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales sobre la recepción..."
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Valor Total</div>
                <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Recibiendo...' : 'Confirmar Recepción'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Export with alias for convenience
export { ReceiveToInventoryDialog as ReceivePODialog }
