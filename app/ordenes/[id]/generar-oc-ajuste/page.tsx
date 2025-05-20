"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, ShoppingCart, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Define a simplified AdditionalExpense interface for this component
interface AdditionalExpenseData {
  id: string;
  description: string;
  amount: string | number;
  justification: string;
}

interface WorkOrderData {
  id: string;
  order_id: string;
  description: string;
  purchase_order_id: string | null;
}

export default function GenerateAdjustmentPOPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [workOrder, setWorkOrder] = useState<WorkOrderData | null>(null)
  const [expenses, setExpenses] = useState<AdditionalExpenseData[]>([])
  const [supplier, setSupplier] = useState("Gastos Adicionales")
  
  // Load work order and approved expenses
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        const supabase = createClient()
        
        // Get work order
        const { data: workOrderData, error: workOrderError } = await supabase
          .from("work_orders")
          .select("id, order_id, description, purchase_order_id")
          .eq("id", params.id)
          .single()
          
        if (workOrderError) {
          throw new Error("Error al cargar la orden de trabajo")
        }
        
        if (!workOrderData) {
          throw new Error("Orden de trabajo no encontrada")
        }
        
        setWorkOrder(workOrderData)
        
        // Get approved expenses without an adjustment PO
        try {
          // Use our API endpoint to get approved expenses
          const response = await fetch(`/api/maintenance/work-orders/${params.id}/additional-expenses?status=aprobado`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          })
          
          if (!response.ok) {
            throw new Error("Error al cargar los gastos adicionales")
          }
          
          const expensesData = await response.json()
          
          if (Array.isArray(expensesData)) {
            setExpenses(expensesData.map(exp => ({
              id: exp.id,
              description: exp.description,
              amount: exp.amount,
              justification: exp.justification
            })))
          } else {
            setExpenses([])
          }
        } catch (err) {
          console.error("Error fetching additional expenses:", err)
          
          // If the API endpoint is not available, use mock data as fallback
          // This can be removed once the API endpoint is deployed
          setExpenses([
            {
              id: "mock-1",
              description: "Componente adicional no previsto",
              amount: 1250.00,
              justification: "Se requirió un componente adicional para completar la reparación"
            },
            {
              id: "mock-2",
              description: "Transporte de emergencia",
              amount: 350.50,
              justification: "Traslado de emergencia para piezas especiales"
            }
          ])
          
          // Show info toast about using test data
          toast({
            title: "Modo de prueba",
            description: "Usando datos de prueba. El endpoint de API aún no está disponible.",
            variant: "default"
          })
        }
        
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Error al cargar los datos"
        })
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [params.id])
  
  // Calculate total amount
  const totalAmount = expenses.reduce((sum, expense) => {
    const expenseAmount = typeof expense.amount === 'string' 
      ? parseFloat(expense.amount) || 0 
      : expense.amount || 0
    return sum + expenseAmount
  }, 0)
  
  const handleGeneratePO = async () => {
    try {
      setIsSubmitting(true)
      
      if (!workOrder) {
        throw new Error("Información de orden de trabajo no disponible")
      }
      
      if (expenses.length === 0) {
        throw new Error("No hay gastos adicionales aprobados para generar orden de compra")
      }
      
      // Call the API to generate the adjustment purchase order
      const response = await fetch('/api/maintenance/generate-adjustment-po', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          workOrderId: workOrder.id,
          originalPurchaseOrderId: workOrder.purchase_order_id,
          additionalExpenses: expenses,
          supplier: supplier
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al generar orden de compra de ajuste")
      }
      
      const responseData = await response.json()
      
      toast({
        title: "Orden de compra generada",
        description: `Se ha generado la orden de compra de ajuste ${responseData.orderId} para los gastos adicionales`
      })
      
      // Redirect to the new purchase order
      router.push(`/compras/${responseData.purchaseOrderId}`)
      
    } catch (error) {
      console.error("Error generating adjustment PO:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error al generar la orden de compra"
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  if (isLoading) {
    return (
      <div className="container py-4 md:py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3">Cargando información de la orden...</span>
        </div>
      </div>
    )
  }
  
  if (!workOrder) {
    return (
      <div className="container py-4 md:py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive mb-4">No se pudo encontrar la orden de trabajo</p>
              <Button variant="outline" asChild>
                <Link href="/ordenes">Volver a Órdenes</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  if (expenses.length === 0) {
    return (
      <div className="container py-4 md:py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generar Orden de Compra de Ajuste</CardTitle>
                <CardDescription>Para la orden de trabajo {workOrder.order_id}</CardDescription>
              </div>
              <Button variant="outline" size="icon" asChild>
                <Link href={`/ordenes/${params.id}`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-center">
              <p className="text-yellow-800">No hay gastos adicionales aprobados pendientes de orden de compra</p>
              <p className="text-sm text-muted-foreground mt-2">
                Todos los gastos adicionales ya han sido procesados o están pendientes de aprobación
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button variant="outline" asChild>
              <Link href={`/ordenes/${params.id}`}>Volver a la orden</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }
  
  return (
    <div className="container py-4 md:py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Generar Orden de Compra de Ajuste</CardTitle>
              <CardDescription>Para la orden de trabajo {workOrder.order_id}</CardDescription>
            </div>
            <Button variant="outline" size="icon" asChild>
              <Link href={`/ordenes/${params.id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/20 p-4 rounded-md">
            <h3 className="font-medium mb-2">Información de la Orden</h3>
            <p><span className="text-muted-foreground">Orden de Trabajo:</span> {workOrder.order_id}</p>
            <p><span className="text-muted-foreground">Descripción:</span> {workOrder.description}</p>
            {workOrder.purchase_order_id && (
              <p><span className="text-muted-foreground">Orden de Compra Original:</span> <Link href={`/compras/${workOrder.purchase_order_id}`} className="underline">Ver OC original</Link></p>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Gastos Adicionales Aprobados</h3>
              <p>Total: <span className="font-bold">${totalAmount.toFixed(2)}</span></p>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Justificación</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{expense.justification}</TableCell>
                    <TableCell className="text-right">${typeof expense.amount === 'string' 
                      ? parseFloat(expense.amount).toFixed(2) 
                      : expense.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} className="text-right font-medium">Total:</TableCell>
                  <TableCell className="text-right font-bold">${totalAmount.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor</Label>
              <Input 
                id="supplier" 
                value={supplier} 
                onChange={(e) => setSupplier(e.target.value)} 
                placeholder="Nombre del proveedor"
              />
              <p className="text-xs text-muted-foreground">
                El proveedor por defecto para gastos adicionales es "Gastos Adicionales"
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href={`/ordenes/${params.id}`}>Cancelar</Link>
          </Button>
          <Button 
            onClick={handleGeneratePO}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Generar Orden de Compra
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 