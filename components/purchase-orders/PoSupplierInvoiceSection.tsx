"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { FileText, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  PO_EXPENSE_CATEGORY_LABELS,
  PO_INVOICE_STATUS_LABELS,
  type CreatePoSupplierInvoiceInput,
  type PoExpenseCategory,
  type PoSupplierInvoice,
} from "@/types/po-invoices"
import { computeInvoiceTax } from "@/lib/ap/po-invoice-utils"

interface ReceiptOption {
  id: string
  file_url: string
  expense_type: string
  description?: string | null
}

interface PoSupplierInvoiceSectionProps {
  purchaseOrderId: string
  canRegister: boolean
  defaultExpenseCategory?: PoExpenseCategory
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return format(new Date(value), "dd/MM/yyyy", { locale: es })
  } catch {
    return value
  }
}

export function PoSupplierInvoiceSection({
  purchaseOrderId,
  canRegister,
  defaultExpenseCategory = "otros",
}: PoSupplierInvoiceSectionProps) {
  const [invoices, setInvoices] = useState<PoSupplierInvoice[]>([])
  const [receipts, setReceipts] = useState<ReceiptOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreatePoSupplierInvoiceInput>({
    invoice_number: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    subtotal: 0,
    vat_rate: 0.16,
    expense_category: defaultExpenseCategory,
    receipt_id: null,
    notes: "",
  })

  const totals = useMemo(
    () => computeInvoiceTax(Number(form.subtotal) || 0, form.vat_rate ?? 0.16),
    [form.subtotal, form.vat_rate],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [invoiceRes, receiptRes] = await Promise.all([
        fetch(`/api/purchase-orders/${purchaseOrderId}/invoices`),
        fetch(`/api/purchase-orders/${purchaseOrderId}/receipts`),
      ])
      const invoiceJson = await invoiceRes.json()
      const receiptJson = await receiptRes.json()
      if (invoiceJson.success) {
        setInvoices(invoiceJson.invoices ?? [])
      }
      if (receiptJson.success) {
        setReceipts(receiptJson.receipts ?? [])
      }
    } catch {
      toast.error("No se pudieron cargar las facturas de proveedor")
    } finally {
      setLoading(false)
    }
  }, [purchaseOrderId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.invoice_number.trim()) {
      toast.error("Captura el folio de la factura")
      return
    }
    if (!form.subtotal || Number(form.subtotal) <= 0) {
      toast.error("Captura un subtotal válido")
      return
    }

    setSubmitting(true)
    try {
      const selectedReceipt = receipts.find((r) => r.id === form.receipt_id)
      const response = await fetch(`/api/purchase-orders/${purchaseOrderId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          document_url: selectedReceipt?.file_url ?? null,
          due_date: form.due_date || null,
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        toast.error(json.error ?? "No se pudo registrar la factura")
        return
      }
      toast.success("Factura de proveedor registrada")
      setShowForm(false)
      setForm((prev) => ({
        ...prev,
        invoice_number: "",
        subtotal: 0,
        notes: "",
        receipt_id: null,
      }))
      await loadData()
    } catch {
      toast.error("Error al registrar la factura")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="rounded-2xl border border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Factura de proveedor
            </CardTitle>
            <CardDescription>
              Registro contable de la factura fiscal vinculada a esta orden de compra.
            </CardDescription>
          </div>
          {canRegister && !showForm && (
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Registrar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando facturas...
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay factura fiscal registrada para esta orden.
          </p>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-xl border border-border/60 p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{invoice.invoice_number}</p>
                  <Badge variant="outline">
                    {PO_INVOICE_STATUS_LABELS[invoice.status]}
                  </Badge>
                  <Badge variant="secondary">
                    {PO_EXPENSE_CATEGORY_LABELS[invoice.expense_category]}
                  </Badge>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Fecha: </span>
                    {formatDate(invoice.invoice_date)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-semibold">{formatCurrency(invoice.total)}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Subtotal: </span>
                    {formatCurrency(invoice.subtotal)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">IVA: </span>
                    {formatCurrency(invoice.tax)}
                  </p>
                </div>
                {invoice.document_url && (
                  <a
                    href={invoice.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Ver comprobante vinculado
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {canRegister && showForm && (
          <form onSubmit={handleSubmit} className="rounded-xl border border-dashed p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Folio de factura</Label>
                <Input
                  id="invoice_number"
                  value={form.invoice_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, invoice_number: e.target.value }))}
                  placeholder="Ej. A-12345"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Fecha de factura</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, invoice_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Fecha de vencimiento</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={form.due_date ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtotal">Subtotal (antes de IVA)</Label>
                <Input
                  id="subtotal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.subtotal || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, subtotal: Number(e.target.value) }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría contable</Label>
                <Select
                  value={form.expense_category}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      expense_category: value as PoExpenseCategory,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PO_EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Comprobante vinculado</Label>
                <Select
                  value={form.receipt_id ?? "none"}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      receipt_id: value === "none" ? null : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin comprobante</SelectItem>
                    {receipts.map((receipt) => (
                      <SelectItem key={receipt.id} value={receipt.id}>
                        {receipt.expense_type} — {receipt.description || receipt.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p>
                IVA estimado: <strong>{formatCurrency(totals.tax)}</strong>
              </p>
              <p>
                Total estimado: <strong>{formatCurrency(totals.total)}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={form.notes ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Registrar factura"
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
