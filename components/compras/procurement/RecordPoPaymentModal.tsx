"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PoInvoiceBalance, PoInvoicePayment } from "@/types/po-invoices"
import {
  PO_EXPENSE_CATEGORY_LABELS,
  PO_INVOICE_STATUS_LABELS,
  PO_PAYMENT_METHOD_LABELS,
} from "@/types/po-invoices"
import { formatMxCurrency } from "@/lib/ap/po-invoice-utils"
import { toast } from "sonner"

interface RecordPoPaymentModalProps {
  invoice: PoInvoiceBalance
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function RecordPoPaymentModal({
  invoice,
  open,
  onClose,
  onSaved,
}: RecordPoPaymentModalProps) {
  const [amount, setAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<string>("transfer")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [payments, setPayments] = useState<PoInvoicePayment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)

  useEffect(() => {
    if (!open) return
    setAmount(String(invoice.balance))
    void (async () => {
      setLoadingPayments(true)
      try {
        const res = await fetch(`/api/ap/payments?invoice_id=${invoice.invoice_id}`)
        const json = await res.json()
        if (json.success) setPayments(json.payments ?? [])
      } finally {
        setLoadingPayments(false)
      }
    })()
  }, [open, invoice.invoice_id, invoice.balance])

  const paidToDate = payments.reduce((sum, p) => sum + Number(p.amount), 0)

  const handleSubmit = async () => {
    if (!paymentDate || !amount) {
      toast.error("Fecha y monto son requeridos")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/ap/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoice.invoice_id,
          payment_date: paymentDate,
          amount: Number(amount),
          payment_method: paymentMethod,
          reference: reference || null,
          notes: notes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo registrar el pago")
        return
      }
      toast.success("Pago registrado")
      onSaved()
      onClose()
    } catch {
      toast.error("Error al registrar pago")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pago — {invoice.invoice_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
            <p>
              OC: <strong>{invoice.order_id}</strong> · {invoice.supplier}
            </p>
            <p>
              Total factura: <strong>{formatMxCurrency(invoice.total)}</strong>
            </p>
            <p>
              Pagado: <strong>{formatMxCurrency(paidToDate)}</strong> · Saldo:{" "}
              <strong>{formatMxCurrency(invoice.balance)}</strong>
            </p>
            <p className="text-muted-foreground">
              Categoría: {PO_EXPENSE_CATEGORY_LABELS[invoice.expense_category]}
            </p>
          </div>

          {!loadingPayments && payments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Pagos previos
              </p>
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between text-sm border-b pb-1">
                  <span>{format(new Date(p.payment_date), "dd/MM/yyyy", { locale: es })}</span>
                  <span className="font-medium">{formatMxCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha de pago</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PO_PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Registrar pago"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
