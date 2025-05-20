"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, X, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { formatCurrency } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { use } from "react"

// Form schema for rejection
const rejectionSchema = z.object({
  reason: z.string().min(5, {
    message: "La razón de rechazo debe tener al menos 5 caracteres.",
  }),
});

type RejectionFormValues = z.infer<typeof rejectionSchema>;

export default function RejectAdditionalExpensePage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [expense, setExpense] = useState<any>(null)
  
  // Setup form with default values
  const form = useForm<RejectionFormValues>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: {
      reason: "",
    },
  });

  // Load expense details
  useEffect(() => {
    async function loadExpense() {
      const supabase = createClient()
      
      // Use type assertion to work with new table not yet in types
      const anyDb = supabase as any
      
      const { data, error } = await anyDb
        .from('additional_expenses')
        .select(`
          *,
          work_order:work_orders(
            *,
            asset:assets(*),
            purchase_order:purchase_orders(*)
          ),
          requester:profiles(*)
        `)
        .eq('id', id)
        .single()
      
      if (error) {
        console.error("Error loading expense:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar el gasto adicional",
        })
        return
      }
      
      setExpense(data)
      setIsLoading(false)
    }
    
    loadExpense()
  }, [id])
  
  async function onSubmit(values: RejectionFormValues) {
    try {
      const supabase = createClient()
      
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Debes iniciar sesión para rechazar gastos adicionales",
        })
        return
      }
      
      // Call the reject function
      const { data, error } = await (supabase.rpc as any)('reject_additional_expense', {
        p_expense_id: id,
        p_rejected_by: user.id,
        p_rejection_reason: values.reason
      })
      
      if (error) throw error
      
      toast({
        title: "Gasto rechazado",
        description: "El gasto adicional ha sido rechazado exitosamente",
      })
      
      // Redirect to work order page
      if (expense?.work_order?.id) {
        router.push(`/ordenes/${expense.work_order.id}`)
      } else {
        router.push(`/compras`)
      }
      router.refresh()
      
    } catch (error) {
      console.error("Error al rechazar el gasto:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo rechazar el gasto adicional",
      })
    }
  }
  
  if (isLoading) {
    return (
      <div className="container py-4 md:py-8">
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p className="text-muted-foreground">Cargando información del gasto adicional...</p>
        </div>
      </div>
    )
  }
  
  if (!expense) {
    return (
      <div className="container py-4 md:py-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No se encontró información del gasto adicional solicitado.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/compras">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="container py-4 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rechazar Gasto Adicional</h1>
        <Button variant="outline" size="icon" asChild>
          <Link href={expense?.work_order?.id ? `/ordenes/${expense.work_order.id}` : "/compras"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Detalles del Gasto</CardTitle>
            <CardDescription>
              Información sobre el gasto adicional solicitado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Descripción</p>
              <p className="text-lg">{expense.description}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium">Monto</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(expense.amount)}</p>
            </div>
            
            <Separator />
            
            <div>
              <p className="text-sm font-medium">Justificación</p>
              <p className="text-sm mt-1">{expense.justification}</p>
            </div>
            
            <Separator />
            
            <div>
              <p className="text-sm font-medium">Activo relacionado</p>
              <p>{expense.work_order?.asset?.name || "No especificado"}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium">Orden de trabajo</p>
              <p>{expense.work_order?.order_id || "No especificada"}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium">Solicitado por</p>
              <p>{expense.requester ? `${expense.requester.nombre} ${expense.requester.apellido}` : "Usuario desconocido"}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium">Fecha de solicitud</p>
              <p>{new Date(expense.created_at).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Razón de Rechazo</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Razón de rechazo</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Explique por qué se rechaza este gasto adicional" 
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Proporcione detalles sobre por qué este gasto adicional no puede ser aprobado.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Alert variant="destructive">
                  <AlertTitle>Importante</AlertTitle>
                  <AlertDescription>
                    Está a punto de rechazar un gasto adicional de <span className="font-bold">{formatCurrency(expense.amount)}</span>. Esta acción no se puede deshacer.
                  </AlertDescription>
                </Alert>
                
                <div className="flex justify-between pt-4">
                  <Button variant="outline" asChild>
                    <Link href={expense?.work_order?.id ? `/ordenes/${expense.work_order.id}` : "/compras"}>
                      Cancelar
                    </Link>
                  </Button>
                  <Button type="submit" variant="destructive">
                    <X className="mr-2 h-4 w-4" />
                    Rechazar Gasto
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 