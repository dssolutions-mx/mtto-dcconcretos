"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { PurchaseOrderStatus } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Check, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
import { use } from "react"

export default function ApproveOrderPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  
  const handleApprove = async () => {
    setIsLoading(true)
    
    try {
      const supabase = createClient()
      
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Debes iniciar sesión para aprobar órdenes",
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
      
      // Actualizar el estado de la orden a "Aprobada"
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          status: PurchaseOrderStatus.Approved,
          approved_by: user.id,
          approval_date: new Date().toISOString(),
        })
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
              purchaseOrderStatus: PurchaseOrderStatus.Approved
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
        title: "Orden aprobada",
        description: "La orden de compra ha sido aprobada exitosamente",
      })
      
      // Redireccionar a la página de detalles
      router.push(`/compras/${id}`)
      router.refresh()
      
    } catch (error) {
      console.error("Error al aprobar la orden:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo aprobar la orden de compra",
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="container py-4 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Aprobar Orden de Compra</h1>
        <Button variant="outline" size="icon" asChild>
          <Link href={`/compras/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Confirmar Aprobación</CardTitle>
        </CardHeader>
        <CardContent>
          <p>¿Estás seguro de que deseas aprobar esta orden de compra?</p>
          <p className="text-sm text-muted-foreground mt-2">
            Una vez aprobada, se notificará al departamento de compras para que proceda con la adquisición de los materiales.
          </p>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href={`/compras/${id}`}>
              Cancelar
            </Link>
          </Button>
          <Button onClick={handleApprove} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aprobando...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Aprobar Orden
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 