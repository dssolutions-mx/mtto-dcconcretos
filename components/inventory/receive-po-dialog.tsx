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
import { Package, AlertCircle, CheckCircle2, Loader2, ArrowRightLeft, Plus } from "lucide-react"

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
  quoted_unit_cost?: number  // Price from selected quotation
  notes?: string
  matched?: boolean
  transfer_to_warehouse_id?: string  // Optional: transfer to another warehouse after receiving
  transfer_quantity?: number  // Optional: quantity to transfer (if less than received quantity)
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
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; plant_id: string; plant?: { id: string; name: string }; is_active?: boolean }>>([])
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([])
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState("")
  const [createWarehouseDialogOpen, setCreateWarehouseDialogOpen] = useState(false)
  const [warehouseFormData, setWarehouseFormData] = useState({
    warehouse_code: "",
    name: "",
    location_notes: "",
    is_primary: false
  })

  useEffect(() => {
    if (open) {
      fetchPO()
    }
  }, [open, purchaseOrderId])

  useEffect(() => {
    if (po) {
      fetchWarehouses()
    }
  }, [po])

  const fetchPO = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, plant:plants(id, name)')
        .eq('id', purchaseOrderId)
        .single()

      if (error) throw error

      setPO(data)

      // Check if already received
      if (data.received_to_inventory) {
        toast.info('Esta orden ya fue recibida al inventario')
      }

      // Fetch selected quotation for price auto-population
      let selectedQuotation: any = null
      if (data.selected_quotation_id) {
        const { data: quotation } = await supabase
          .from('purchase_order_quotations')
          .select('*, quotation_items')
          .eq('id', data.selected_quotation_id)
          .eq('status', 'selected')
          .single()
        
        selectedQuotation = quotation
      }

      // Initialize receipt items from PO items
      const items = (data.items as any[]) || []
      // quotation_items is JSONB - Supabase returns it as an object/array, not a string
      const quotationItems = selectedQuotation?.quotation_items 
        ? (Array.isArray(selectedQuotation.quotation_items) 
            ? selectedQuotation.quotation_items 
            : (typeof selectedQuotation.quotation_items === 'string' 
                ? JSON.parse(selectedQuotation.quotation_items) 
                : null))
        : null
      
      const initialItems: ReceiptItem[] = items.map((item, index) => {
        // Default to PO item price (which should already be updated from selected quotation)
        let unitCost = item.unit_price || item.quoted_unit_price || 0
        let quotedUnitCost: number | undefined = undefined
        
        // If we have item-level pricing from quotation, use it
        if (quotationItems && Array.isArray(quotationItems)) {
          // Try to find matching quotation item by index or part number
          const quotationItem = quotationItems.find((qi: any) => 
            qi.item_index === index || 
            (qi.part_number && qi.part_number === item.partNumber)
          )
          
          if (quotationItem && quotationItem.unit_price) {
            quotedUnitCost = quotationItem.unit_price
            unitCost = quotationItem.unit_price // Use quoted price as default
          }
        } else if (selectedQuotation && selectedQuotation.quoted_amount) {
          // Fallback: distribute quoted amount proportionally if no item-level pricing
          const totalPOAmount = items.reduce((sum, i) => sum + (i.unit_price || 0) * (i.quantity || 1), 0)
          if (totalPOAmount > 0 && item.unit_price) {
            const proportion = (item.unit_price * (item.quantity || 1)) / totalPOAmount
            quotedUnitCost = (selectedQuotation.quoted_amount * proportion) / (item.quantity || 1)
            unitCost = quotedUnitCost
          }
        }
        
        // If PO item has quoted_unit_price (set when quotation was selected), use it
        if (item.quoted_unit_price) {
          quotedUnitCost = item.quoted_unit_price
          if (!unitCost || unitCost === 0) {
            unitCost = item.quoted_unit_price
          }
        }
        
        return {
          po_item_id: item.id || `item-${index}`,
          part_name: item.name,
          part_number: item.partNumber,
          warehouse_id: "",
          quantity: item.quantity || 0,
          unit_cost: unitCost,
          quoted_unit_cost: quotedUnitCost,
          matched: false
        }
      })

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
      if (!po) {
        console.warn('Cannot fetch warehouses: PO not loaded')
        return
      }
      
      console.log('Fetching all active warehouses (cross-plant allowed)')
      
      // Fetch ALL active warehouses, not just for the PO's plant
      // This allows receiving inventory to warehouses in different plants
      let response = await fetch(`/api/inventory/warehouses?is_active=true`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Warehouse API error:', response.status, errorText)
        toast.error(`Error al cargar almacenes: ${response.status}`)
        return
      }
      
      let result = await response.json()
      console.log('Warehouses response (all active):', result)
      
      if (result.success) {
        const warehousesList = result.warehouses || []
        console.log('Loaded active warehouses:', warehousesList.length)
        
        // If no active warehouses, try fetching all warehouses (including inactive)
        if (warehousesList.length === 0) {
          console.log('No active warehouses found, trying to fetch all warehouses...')
          response = await fetch(`/api/inventory/warehouses`)
          
          if (response.ok) {
            result = await response.json()
            if (result.success) {
              const allWarehouses = result.warehouses || []
              console.log('Loaded all warehouses:', allWarehouses.length)
              
              if (allWarehouses.length === 0) {
                toast.warning('No hay almacenes disponibles. Por favor, crea un almacén primero.')
              } else {
                toast.warning(`${allWarehouses.length} almacén(es) encontrado(s) pero están inactivos. Actívalos o crea uno nuevo.`)
                setWarehouses(allWarehouses)
              }
            }
          }
        } else {
          setWarehouses(warehousesList)
        }
      } else {
        console.error('Warehouse API returned success=false:', result)
        toast.error(result.error || 'Error al cargar almacenes')
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
      toast.error('Error al cargar almacenes: ' + (error instanceof Error ? error.message : 'Error desconocido'))
    }
  }

  useEffect(() => {
    if (po) {
      fetchWarehouses()
    }
  }, [po])

  const handleCreateWarehouse = async () => {
    if (!po?.plant_id) {
      toast.error('No se puede crear almacén: la orden no tiene planta asignada')
      return
    }

    if (!warehouseFormData.warehouse_code || !warehouseFormData.name) {
      toast.error('Código y nombre del almacén son requeridos')
      return
    }

    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Debes estar autenticado')
        return
      }

      const response = await fetch('/api/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant_id: po.plant_id,
          warehouse_code: warehouseFormData.warehouse_code,
          name: warehouseFormData.name,
          location_notes: warehouseFormData.location_notes || undefined,
          is_primary: warehouseFormData.is_primary
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Almacén creado exitosamente')
        setCreateWarehouseDialogOpen(false)
        setWarehouseFormData({
          warehouse_code: "",
          name: "",
          location_notes: "",
          is_primary: false
        })
        // Refresh warehouses list
        await fetchWarehouses()
      } else {
        toast.error(result.error || 'Error al crear almacén')
      }
    } catch (error) {
      console.error('Error creating warehouse:', error)
      toast.error('Error al crear almacén')
    } finally {
      setLoading(false)
    }
  }

  const updateReceiptItem = (index: number, updates: Partial<ReceiptItem>) => {
    const updated = [...receiptItems]
    updated[index] = { ...updated[index], ...updates }
    setReceiptItems(updated)
  }

  const handleSubmit = async () => {
    console.log('handleSubmit called', { receiptItems, po })
    
    // Validate
    if (!receiptItems || receiptItems.length === 0) {
      toast.error('No hay items para recibir')
      return
    }

    const invalidItems = receiptItems.filter(item => 
      !item.warehouse_id || item.quantity <= 0
    )

    if (invalidItems.length > 0) {
      console.error('Invalid items:', invalidItems)
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
      
      // Validate transfer quantities
      if (receiptItem.transfer_to_warehouse_id) {
        const transferQty = receiptItem.transfer_quantity || receiptItem.quantity
        if (transferQty > receiptItem.quantity) {
          toast.error(`La cantidad a transferir no puede exceder la cantidad recibida para ${receiptItem.part_name}`)
          return
        }
        if (transferQty <= 0) {
          toast.error(`La cantidad a transferir debe ser mayor a 0 para ${receiptItem.part_name}`)
          return
        }
        if (receiptItem.transfer_to_warehouse_id === receiptItem.warehouse_id) {
          toast.error(`No puedes transferir al mismo almacén para ${receiptItem.part_name}`)
          return
        }
      }
    }

    try {
      setLoading(true)
      
      const payload = {
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
      }
      
      console.log('Sending request to receive inventory:', {
        url: `/api/purchase-orders/${purchaseOrderId}/receive-to-inventory`,
        payload
      })
      
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/receive-to-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      console.log('Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` }
        }
        console.error('API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
        toast.error(errorData.error || errorData.details || `Error ${response.status}: ${response.statusText}`)
        return
      }

      const result = await response.json()
      if (result.success) {
        toast.success(`${result.data?.total_items_received || receiptItems.length} items recibidos al inventario`)
        
        // Process transfers if any
        // Map receipt items to results to get part_id from created parts
        const receiptResults = result.data?.results || []
        const itemsToTransfer: Array<ReceiptItem & { resolved_part_id: string }> = []
        
        receiptItems.forEach((item, index) => {
          if (item.transfer_to_warehouse_id && item.transfer_quantity && item.transfer_quantity > 0) {
            // Get part_id from result if not already in item
            const resultItem = receiptResults[index]
            const resolvedPartId = item.part_id || resultItem?.part_id
            
            if (resolvedPartId) {
              itemsToTransfer.push({
                ...item,
                resolved_part_id: resolvedPartId
              })
            } else {
              console.warn('Cannot transfer item without part_id:', item.part_name)
            }
          }
        })
        
        if (itemsToTransfer.length > 0) {
          console.log('Processing transfers for', itemsToTransfer.length, 'items')
          let transferSuccessCount = 0
          let transferErrorCount = 0
          
          // Wait a bit to ensure stock is updated after receipt
          await new Promise(resolve => setTimeout(resolve, 500))
          
          for (const item of itemsToTransfer) {
            try {
              const transferResponse = await fetch('/api/inventory/stock/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  part_id: item.resolved_part_id,
                  from_warehouse_id: item.warehouse_id,
                  to_warehouse_id: item.transfer_to_warehouse_id,
                  quantity: item.transfer_quantity || item.quantity,
                  transfer_date: new Date().toISOString(),
                  unit_cost: item.unit_cost,
                  notes: `Transferencia automática desde recepción de OC ${purchaseOrderId}. ${notes || ''}`
                })
              })
              
              if (!transferResponse.ok) {
                const errorText = await transferResponse.text()
                console.error('Transfer API error:', transferResponse.status, errorText)
                transferErrorCount++
                continue
              }
              
              const transferResult = await transferResponse.json()
              if (transferResult.success) {
                transferSuccessCount++
              } else {
                console.error('Transfer failed for item:', item.part_name, transferResult)
                transferErrorCount++
              }
            } catch (error) {
              console.error('Error transferring item:', item.part_name, error)
              transferErrorCount++
            }
          }
          
          if (transferSuccessCount > 0) {
            toast.success(`${transferSuccessCount} transferencia(s) completada(s)`)
          }
          if (transferErrorCount > 0) {
            toast.warning(`${transferErrorCount} transferencia(s) fallaron. Puedes transferirlas manualmente más tarde.`)
          }
        }
        
        onSuccess?.()
        onOpenChange(false)
        // Reset form
        setReceiptItems([])
        setNotes("")
      } else {
        console.error('API returned success=false:', result)
        toast.error(result.error || result.details || 'Error al recibir al inventario')
      }
    } catch (error) {
      console.error('Error receiving to inventory:', error)
      toast.error(error instanceof Error ? error.message : 'Error al recibir al inventario')
    } finally {
      setLoading(false)
    }
  }

  if (!po) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Cargando orden de compra...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
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
            {warehouses.length === 0 && po && po.plant_id && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    No hay almacenes disponibles para esta planta. Crea un almacén para continuar.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateWarehouseDialogOpen(true)}
                    className="ml-4"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Crear Almacén
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Cantidad PO</TableHead>
                    <TableHead>Almacén Recepción</TableHead>
                    <TableHead>Cantidad Recibir</TableHead>
                    <TableHead>Costo Unitario</TableHead>
                    <TableHead>Transferir a</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No hay items en esta orden de compra para recibir
                      </TableCell>
                    </TableRow>
                  ) : (
                    receiptItems.map((item, index) => (
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
                        {warehouses.length === 0 ? (
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Sin almacenes disponibles
                          </div>
                        ) : (
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
                                  <div className="flex items-center gap-2">
                                    <span>{warehouse.name}</span>
                                    {warehouse.plant && (
                                      <Badge variant="outline" className="text-xs">
                                        {warehouse.plant.name}
                                      </Badge>
                                    )}
                                    {!warehouse.is_active && (
                                      <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
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
                        <div className="space-y-1">
                          <Input
                            type="number"
                            value={item.unit_cost}
                            onChange={(e) => updateReceiptItem(index, { unit_cost: parseFloat(e.target.value) || 0 })}
                            min="0"
                            step="0.01"
                            className="w-[100px]"
                          />
                          {item.quoted_unit_cost !== undefined && item.quoted_unit_cost !== item.unit_cost && (
                            <div className="text-xs text-muted-foreground">
                              Cotizado: ${item.quoted_unit_cost.toFixed(2)}
                              {item.unit_cost > item.quoted_unit_cost && (
                                <span className="text-red-600 ml-1">
                                  (+${(item.unit_cost - item.quoted_unit_cost).toFixed(2)})
                                </span>
                              )}
                              {item.unit_cost < item.quoted_unit_cost && (
                                <span className="text-green-600 ml-1">
                                  (-${(item.quoted_unit_cost - item.unit_cost).toFixed(2)})
                                </span>
                              )}
                            </div>
                          )}
                          {item.quoted_unit_cost !== undefined && item.quoted_unit_cost === item.unit_cost && (
                            <div className="text-xs text-green-600">
                              ✓ Coincide con cotización
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2 min-w-[200px]">
                          <Select
                            value={item.transfer_to_warehouse_id || "__none__"}
                            onValueChange={(value) => {
                              if (value === "__none__") {
                                updateReceiptItem(index, { 
                                  transfer_to_warehouse_id: undefined,
                                  transfer_quantity: undefined
                                })
                              } else {
                                updateReceiptItem(index, { 
                                  transfer_to_warehouse_id: value,
                                  transfer_quantity: item.transfer_quantity || item.quantity
                                })
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="No transferir" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">No transferir</SelectItem>
                              {warehouses
                                .filter(w => w.id !== item.warehouse_id)
                                .map((warehouse) => (
                                <SelectItem key={warehouse.id} value={warehouse.id}>
                                  <div className="flex items-center gap-2">
                                    <ArrowRightLeft className="h-3 w-3" />
                                    <span>{warehouse.name}</span>
                                    {warehouse.plant && (
                                      <Badge variant="outline" className="text-xs">
                                        {warehouse.plant.name}
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {item.transfer_to_warehouse_id && (
                            <div className="space-y-1">
                              <Input
                                type="number"
                                value={item.transfer_quantity || item.quantity}
                                onChange={(e) => {
                                  const transferQty = parseFloat(e.target.value) || 0
                                  const maxQty = item.quantity
                                  updateReceiptItem(index, { 
                                    transfer_quantity: Math.min(transferQty, maxQty)
                                  })
                                }}
                                min="0"
                                max={item.quantity}
                                step="0.01"
                                className="w-full text-xs"
                                placeholder={`Máx: ${item.quantity}`}
                              />
                              <p className="text-xs text-muted-foreground">
                                Máx: {item.quantity}
                              </p>
                            </div>
                          )}
                        </div>
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
                  ))
                  )}
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
          <Button 
            type="button"
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            type="button"
            onClick={(e) => {
              e.preventDefault()
              handleSubmit()
            }} 
            disabled={loading}
          >
            {loading ? 'Recibiendo...' : 'Confirmar Recepción'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Create Warehouse Dialog */}
      <Dialog open={createWarehouseDialogOpen} onOpenChange={setCreateWarehouseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Almacén</DialogTitle>
            <DialogDescription>
              Crea un almacén para la planta: {po?.plant?.name || po?.plant_id || 'Planta actual'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="warehouse_code">Código del Almacén *</Label>
              <Input
                id="warehouse_code"
                value={warehouseFormData.warehouse_code}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, warehouse_code: e.target.value })}
                placeholder="Ej: ALM-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouse_name">Nombre del Almacén *</Label>
              <Input
                id="warehouse_name"
                value={warehouseFormData.name}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, name: e.target.value })}
                placeholder="Ej: Almacén Principal"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_notes">Notas de Ubicación</Label>
              <Textarea
                id="location_notes"
                value={warehouseFormData.location_notes}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, location_notes: e.target.value })}
                placeholder="Información adicional sobre la ubicación..."
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_primary"
                checked={warehouseFormData.is_primary}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, is_primary: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_primary" className="cursor-pointer">
                Marcar como almacén principal
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateWarehouseDialogOpen(false)
                setWarehouseFormData({
                  warehouse_code: "",
                  name: "",
                  location_notes: "",
                  is_primary: false
                })
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateWarehouse}
              disabled={loading || !warehouseFormData.warehouse_code || !warehouseFormData.name}
            >
              {loading ? 'Creando...' : 'Crear Almacén'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

// Export with alias for convenience
export { ReceiveToInventoryDialog as ReceivePODialog }
