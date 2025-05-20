import { createClient } from "@/lib/supabase-server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, Clock, ExternalLink, ArrowUpDown } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ReactNode } from "react"

export const metadata = {
  title: "Gastos Adicionales",
  description: "Gestión de gastos adicionales pendientes de aprobación",
}

interface AdditionalExpense {
  id: string
  description: string
  amount: number
  justification: string
  status: string
  created_at: string
  work_order_id: string
  work_order_number: string
  asset_name: string
  requester_name: string
}

// Define columns for data table
const columns: ColumnDef<AdditionalExpense>[] = [
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Fecha
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("created_at"))
      return <div>{format(date, 'dd/MM/yyyy', { locale: es })}</div>
    },
  },
  {
    accessorKey: "description",
    header: "Descripción",
    cell: ({ row }) => <div className="font-medium">{row.getValue("description")}</div>,
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="text-right"
      >
        Monto
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"))
      return <div className="text-right font-medium">{formatCurrency(amount)}</div>
    },
  },
  {
    accessorKey: "work_order_number",
    header: "Orden de Trabajo",
    cell: ({ row }) => {
      const workOrderId = row.original.work_order_id
      const workOrderNumber = row.getValue("work_order_number")
      return (
        <Link 
          href={`/ordenes/${workOrderId}`}
          className="text-blue-600 hover:underline flex items-center"
        >
          {workOrderNumber}
          <ExternalLink className="ml-1 h-3 w-3" />
        </Link>
      )
    },
  },
  {
    accessorKey: "asset_name",
    header: "Activo",
  },
  {
    accessorKey: "requester_name",
    header: "Solicitante",
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge 
          variant={
            status === "Pendiente" ? "outline" :
            status === "Aprobado" ? "secondary" :
            status === "Rechazado" ? "destructive" :
            "secondary"
          }
        >
          {status}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const expense = row.original
      const isPending = expense.status === "Pendiente"
      
      return (
        <div className="flex items-center justify-end gap-2">
          {isPending ? (
            <>
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={`/compras/gastos-adicionales/${expense.id}/aprobar`}>
                  <Check className="mr-1 h-4 w-4 text-green-600" />
                  Aprobar
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href={`/compras/gastos-adicionales/${expense.id}/rechazar`}>
                  <X className="mr-1 h-4 w-4 text-red-600" />
                  Rechazar
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild size="sm" variant="outline" className="h-8">
              <Link href={`/ordenes/${expense.work_order_id}`}>
                Ver Orden
              </Link>
            </Button>
          )}
        </div>
      )
    },
  }
]

export default async function AdditionalExpensesPage() {
  const supabase = await createClient()
  
  // Get additional expenses with details
  const { data: expenses, error } = await (supabase as any)
    .from('additional_expenses')
    .select(`
      *,
      work_order:work_orders (
        id, 
        order_id,
        asset:assets (
          name
        )
      ),
      requester:profiles (
        nombre,
        apellido
      )
    `)
    .order('created_at', { ascending: false })
  
  // Format data for table
  const formattedExpenses = expenses?.map((expense: any) => ({
    id: expense.id,
    description: expense.description,
    amount: expense.amount,
    justification: expense.justification,
    status: expense.status || 'Pendiente',
    created_at: expense.created_at,
    work_order_id: expense.work_order?.id,
    work_order_number: expense.work_order?.order_id || 'N/A',
    asset_name: expense.work_order?.asset?.name || 'N/A',
    requester_name: expense.requester 
      ? `${expense.requester.nombre || ''} ${expense.requester.apellido || ''}`.trim()
      : 'N/A',
  })) || []
  
  // Count pending expenses
  const pendingCount = formattedExpenses.filter((e: AdditionalExpense) => e.status === 'Pendiente').length
  
  return (
    <div className="container py-4 md:py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gastos Adicionales</h1>
          <p className="text-muted-foreground">Gestión de gastos adicionales generados por órdenes de trabajo</p>
        </div>
        <Button asChild>
          <Link href="/compras">
            Ver Órdenes de Compra
          </Link>
        </Button>
      </div>
      
      {pendingCount > 0 && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <p className="font-medium text-yellow-800">
                Hay {pendingCount} gasto{pendingCount !== 1 ? 's' : ''} adicional{pendingCount !== 1 ? 'es' : ''} pendiente{pendingCount !== 1 ? 's' : ''} de aprobación
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-2">
            <Check className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">
                Proceso simplificado para gastos adicionales
              </p>
              <p className="text-blue-700 text-sm mt-1">
                Los gastos adicionales registrados durante la finalización de una orden de trabajo son aprobados automáticamente y generan órdenes de compra de ajuste sin necesidad de aprobación manual.
                Esta página muestra únicamente los gastos adicionales que requieren aprobación manual.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Todos los Gastos Adicionales</CardTitle>
          <CardDescription>
            Lista de gastos adicionales registrados por órdenes de trabajo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="p-4 border border-red-200 rounded bg-red-50 text-red-700">
              Error al cargar los gastos adicionales: {error.message?.toString() || "Error desconocido"}
            </div>
          ) : formattedExpenses.length > 0 ? (
            <DataTable columns={columns} data={formattedExpenses} />
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No hay gastos adicionales registrados
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 