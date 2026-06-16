"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Eye,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { PoInvoiceBalance } from "@/types/po-invoices"
import {
  PO_EXPENSE_CATEGORY_LABELS,
  PO_INVOICE_STATUS_LABELS,
} from "@/types/po-invoices"
import { formatMxCurrency } from "@/lib/ap/po-invoice-utils"
import { RecordPoPaymentModal } from "./RecordPoPaymentModal"

interface PoInvoicesPayablesTabProps {
  plantId?: string
  canRecordPayments?: boolean
}

function statusTone(status: string, isOverdue: boolean) {
  if (isOverdue) return "bg-red-100 text-red-800"
  if (status === "paid") return "bg-green-100 text-green-800"
  if (status === "partially_paid") return "bg-blue-100 text-blue-800"
  return "bg-amber-100 text-amber-800"
}

export function PoInvoicesPayablesTab({
  plantId,
  canRecordPayments = false,
}: PoInvoicesPayablesTabProps) {
  const [invoices, setInvoices] = useState<PoInvoiceBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [includePaid, setIncludePaid] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [paymentInvoice, setPaymentInvoice] = useState<PoInvoiceBalance | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (plantId) params.set("plant_id", plantId)
      if (includePaid) params.set("include_paid", "true")
      const res = await fetch(`/api/ap/invoices?${params}`)
      const json = await res.json()
      if (json.success) setInvoices(json.invoices ?? [])
    } finally {
      setLoading(false)
    }
  }, [plantId, includePaid])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = invoices.reduce<Record<string, PoInvoiceBalance[]>>((acc, inv) => {
    const key = inv.supplier || "Sin proveedor"
    if (!acc[key]) acc[key] = []
    acc[key].push(inv)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Facturas y cuentas por pagar</h2>
          <p className="text-sm text-muted-foreground">
            Facturas de proveedor registradas con saldo, vencimiento y pagos parciales.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="include-paid" checked={includePaid} onCheckedChange={setIncludePaid} />
            <Label htmlFor="include-paid" className="text-sm">
              Incluir pagadas
            </Label>
          </div>
          <Badge variant="outline">{invoices.length} facturas</Badge>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando facturas...
        </div>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No hay facturas registradas con los filtros actuales.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([supplier, rows]) => {
            const isOpen = expanded[supplier] ?? true
            const supplierBalance = rows.reduce((s, r) => s + Number(r.balance ?? 0), 0)
            return (
              <Card key={supplier} className="overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/30"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [supplier]: !isOpen }))
                  }
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-semibold">{supplier}</p>
                      <p className="text-xs text-muted-foreground">
                        {rows.length} factura(s) · Saldo {formatMxCurrency(supplierBalance)}
                      </p>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <CardContent className="space-y-3 border-t pt-4">
                    {rows.map((inv) => (
                      <div
                        key={inv.invoice_id}
                        className="rounded-xl border border-border/60 p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{inv.invoice_number}</p>
                              <Badge
                                variant="outline"
                                className={statusTone(inv.invoice_status, inv.is_overdue)}
                              >
                                {inv.is_overdue && (
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                )}
                                {PO_INVOICE_STATUS_LABELS[inv.invoice_status]}
                              </Badge>
                              <Badge variant="secondary">
                                {PO_EXPENSE_CATEGORY_LABELS[inv.expense_category]}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              OC {inv.order_id} ·{" "}
                              {format(new Date(inv.invoice_date), "dd/MM/yyyy", { locale: es })}
                              {inv.due_date &&
                                ` · Vence ${format(new Date(inv.due_date), "dd/MM/yyyy", { locale: es })}`}
                            </p>
                            <div className="grid gap-1 text-sm sm:grid-cols-3">
                              <p>
                                Total: <strong>{formatMxCurrency(inv.total)}</strong>
                              </p>
                              <p>
                                Pagado: <strong>{formatMxCurrency(inv.paid_to_date)}</strong>
                              </p>
                              <p>
                                Saldo:{" "}
                                <strong className={inv.balance > 0 ? "text-amber-700" : ""}>
                                  {formatMxCurrency(inv.balance)}
                                </strong>
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/compras/${inv.purchase_order_id}`}>
                                <Eye className="h-4 w-4 mr-1" />
                                Ver OC
                              </Link>
                            </Button>
                            {canRecordPayments &&
                              ["open", "partially_paid"].includes(inv.invoice_status) && (
                                <Button
                                  size="sm"
                                  onClick={() => setPaymentInvoice(inv)}
                                >
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  Registrar pago
                                </Button>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {paymentInvoice && (
        <RecordPoPaymentModal
          invoice={paymentInvoice}
          open={!!paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
