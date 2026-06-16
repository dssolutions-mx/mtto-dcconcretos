import type { Metadata } from "next"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { createClient } from "@/lib/supabase-server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import {
  PO_ACCOUNTING_STATUS_LABELS,
  PO_EXPENSE_CATEGORY_LABELS,
  PO_INVOICE_STATUS_LABELS,
  type PoAccountingStatus,
} from "@/types/po-invoices"
import { Eye, FileText } from "lucide-react"

export const metadata: Metadata = {
  title: "Facturas de OC | Sistema de Gestión de Mantenimiento",
  description: "Registro contable de facturas de proveedor vinculadas a órdenes de compra",
}

function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "$0.00"
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(amount))
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—"
  try {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: es })
  } catch {
    return dateString
  }
}

async function FacturasContent() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("po_invoices_accounting_summary")
    .select("*")
    .not("invoice_id", "is", null)
    .order("invoice_registered_at", { ascending: false })

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-red-600">Error al cargar facturas de órdenes de compra</p>
        </CardContent>
      </Card>
    )
  }

  const rows = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="bg-blue-50">
          <FileText className="h-4 w-4 mr-1" />
          {rows.length} facturas registradas
        </Badge>
      </div>

      {rows.map((row) => (
        <Card key={row.invoice_id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Orden de compra</p>
                  <p className="font-semibold">{row.order_id}</p>
                  <p className="text-sm text-muted-foreground">{row.supplier}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Factura</p>
                  <p className="font-semibold">{row.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(row.invoice_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Montos</p>
                  <p className="text-sm">Subtotal: {formatCurrency(row.subtotal)}</p>
                  <p className="font-semibold text-green-700">Total: {formatCurrency(row.invoice_total)}</p>
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  <Badge variant="outline">
                    {PO_INVOICE_STATUS_LABELS[row.invoice_status as keyof typeof PO_INVOICE_STATUS_LABELS] ??
                      row.invoice_status}
                  </Badge>
                  <Badge variant="secondary">
                    {PO_EXPENSE_CATEGORY_LABELS[
                      row.expense_category as keyof typeof PO_EXPENSE_CATEGORY_LABELS
                    ] ?? row.expense_category}
                  </Badge>
                  <Badge variant="outline">
                    {PO_ACCOUNTING_STATUS_LABELS[
                      row.accounting_status as PoAccountingStatus
                    ] ?? row.accounting_status}
                  </Badge>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href={`/compras/${row.purchase_order_id}`}>
                  <Eye className="h-4 w-4 mr-1" />
                  Ver OC
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {rows.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin facturas registradas</h3>
            <p className="text-muted-foreground">
              Las facturas de proveedor aparecerán aquí cuando se registren desde el detalle de una orden de compra.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function FacturasPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Facturas de órdenes de compra"
        text="Registro contable de facturas fiscales de proveedor vinculadas a órdenes de compra de mantenimiento."
      />
      <FacturasContent />
    </DashboardShell>
  )
}
