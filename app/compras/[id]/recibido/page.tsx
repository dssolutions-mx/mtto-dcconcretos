"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { PurchaseOrderStatus } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Package, Loader2, Calendar as CalendarIcon } from "lucide-react"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

export default function ReceiveOrderPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date())
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [notes, setNotes] = useState("")
  
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
          description: "Debes iniciar sesión para registrar la recepción",
        })
        return
      }
      
      // Actualizar el estado de la orden a "Recibida"
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status: PurchaseOrderStatus.Received,
          actual_delivery_date: deliveryDate.toISOString(),
          invoice_number: invoiceNumber || null,
          notes: notes ? notes : undefined,
          updated_at: new Date().toISOString()
        })
        .eq("id", params.id)
      
      if (error) throw error
      
      toast({
        title: "Orden recibida",
        description: "La recepción de la orden ha sido registrada con éxito",
      })
      
      // Redireccionar a la página de detalles
      router.push(`/compras/${params.id}`)
      router.refresh()
      
    } catch (error) {
      console.error("Error al registrar la recepción:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo registrar la recepción de la orden",
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="container py-4 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Registrar Recepción</h1>
        <Button variant="outline" size="icon" asChild>
          <Link href={`/compras/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Confirmar Recepción de Materiales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Registra la información de recepción de los materiales solicitados.</p>
          
          <div className="space-y-2">
            <Label>Fecha de Recepción</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal"
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
                  onSelect={(date) => setDeliveryDate(date || new Date())}
                  initialFocus
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="invoiceNumber">Número de Factura</Label>
            <Input 
              id="invoiceNumber" 
              placeholder="Ej: FACT-A1234" 
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Observaciones</Label>
            <Textarea 
              id="notes" 
              placeholder="Alguna observación sobre la condición de los materiales recibidos..." 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href={`/compras/${params.id}`}>
              Cancelar
            </Link>
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <Package className="mr-2 h-4 w-4" />
                Confirmar Recepción
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 