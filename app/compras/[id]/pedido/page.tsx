"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { PurchaseOrderStatus } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, ShoppingCart, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { use } from "react"

export default function OrderPlacedPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>()
  const [orderNumber, setOrderNumber] = useState("")
  
  const handleSubmit = async () => {
    setIsLoading(true)
    
    try {
      const supabase = createClient()
      
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Debes iniciar sesión para actualizar el estado de la orden",
        })
        return
      }
      
      // Primero obtener la orden de compra para conseguir la work_order_id
      const { data: purchaseOrder, error: getError } = await supabase
        .from("purchase_orders")
        .select("work_order_id")
        .eq("id", id)
        .single()
      
      if (getError) throw getError
      
      const updateData: any = {
        status: PurchaseOrderStatus.Ordered,
      }
      
      // Agregar datos opcionales si existen
      if (deliveryDate) {
        updateData.expected_delivery_date = deliveryDate.toISOString()
      }
      
      if (orderNumber) {
        updateData.notes = `Número de orden con proveedor: ${orderNumber}`
      }
      
      // Actualizar el estado de la orden a "Pedida"
      const { error } = await supabase
        .from("purchase_orders")
        .update(updateData)
        .eq("id", id)
      
      if (error) throw error
      
      // Si hay una orden de trabajo asociada, actualizar su estado
      if (purchaseOrder?.work_order_id) {
        try {
          // Llamar al endpoint para actualizar el estado de la orden de trabajo
          const response = await fetch(`/api/maintenance/work-orders/${purchaseOrder.work_order_id}/update-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              purchaseOrderStatus: PurchaseOrderStatus.Ordered
            }),
          })
          
          if (!response.ok) {
            console.error('Error updating work order status', await response.text())
          }
        } catch (workOrderError) {
          console.error('Error updating work order status:', workOrderError)
          // No interrumpimos el flujo principal si falla la actualización de la OT
        }
      }
      
      toast({
        title: "Orden actualizada",
        description: "La orden ha sido marcada como pedida",
      })
      
      // Redireccionar a la página de detalles
      router.push(`/compras/${id}`)
      router.refresh()
      
    } catch (error) {
      console.error("Error al actualizar la orden:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el estado de la orden",
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="container py-4 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Marcar Orden como Pedida</h1>
        <Button variant="outline" size="icon" asChild>
          <Link href={`/compras/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Confirmar Pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Indica que la orden ha sido enviada al proveedor y proporciona los detalles del pedido.</p>
          
          <div className="space-y-2">
            <Label htmlFor="orderNumber">Número de Orden con Proveedor (opcional)</Label>
            <Input 
              id="orderNumber" 
              placeholder="Ej: PO-12345" 
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Fecha de Entrega Estimada</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !deliveryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deliveryDate ? format(deliveryDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={deliveryDate}
                  onSelect={setDeliveryDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href={`/compras/${id}`}>
              Cancelar
            </Link>
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Confirmar Pedido
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 