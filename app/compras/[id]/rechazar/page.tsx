"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { PurchaseOrderStatus } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, X, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export default function RejectOrderPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [reason, setReason] = useState("")
  
  const handleReject = async () => {
    setIsLoading(true)
    
    try {
      const supabase = createClient()
      
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Debes iniciar sesión para rechazar órdenes",
        })
        return
      }
      
      // Actualizar el estado de la orden a "Rechazada"
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status: PurchaseOrderStatus.Rejected,
          approved_by: user.id,
          approval_date: new Date().toISOString(),
          notes: reason ? `RECHAZADA: ${reason}` : "RECHAZADA sin motivo especificado"
        })
        .eq("id", params.id)
      
      if (error) throw error
      
      toast({
        title: "Orden rechazada",
        description: "La orden de compra ha sido rechazada",
      })
      
      // Redireccionar a la página de detalles
      router.push(`/compras/${params.id}`)
      router.refresh()
      
    } catch (error) {
      console.error("Error al rechazar la orden:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo rechazar la orden de compra",
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="container py-4 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rechazar Orden de Compra</h1>
        <Button variant="outline" size="icon" asChild>
          <Link href={`/compras/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Confirmar Rechazo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>¿Estás seguro de que deseas rechazar esta orden de compra?</p>
          <div>
            <Label htmlFor="reason">Motivo del rechazo</Label>
            <Textarea 
              id="reason" 
              placeholder="Indica el motivo del rechazo..." 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href={`/compras/${params.id}`}>
              Cancelar
            </Link>
          </Button>
          <Button variant="destructive" onClick={handleReject} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rechazando...
              </>
            ) : (
              <>
                <X className="mr-2 h-4 w-4" />
                Rechazar Orden
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 