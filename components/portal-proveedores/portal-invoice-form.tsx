"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CfdiXmlUploadField,
  type CfdiPrefill,
} from "@/components/compras/procurement/CfdiXmlUploadField"
import { PoAmountBreakdown } from "@/components/ap/PoAmountBreakdown"
import { buildInvoiceAmountContext } from "@/lib/ap/po-amounts"
import type { CreatePoSupplierInvoiceInput } from "@/types/po-invoices"

interface PortalInvoiceFormProps {
  purchaseOrderId: string
  orderLabel: string
  poPreTaxAmount?: number
}

export function PortalInvoiceForm({
  purchaseOrderId,
  orderLabel,
  poPreTaxAmount = 0,
}: PortalInvoiceFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<CreatePoSupplierInvoiceInput>({
    invoice_number: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    subtotal: 0,
    discount_amount: 0,
    vat_rate: 0.16,
    retention_isr_rate: 0,
    retention_iva_rate: 0,
    notes: "",
    cfdi_capture_mode: "manual",
  })

  const amountContext = buildInvoiceAmountContext({
    po_pre_tax: poPreTaxAmount,
    subtotal: Number(form.subtotal) || 0,
    discount_amount: Number(form.discount_amount) || 0,
    vat_rate: Number(form.vat_rate) || 0,
    retention_isr_rate: Number(form.retention_isr_rate) || 0,
    retention_iva_rate: Number(form.retention_iva_rate) || 0,
  })

  const applyCfdi = (prefill: CfdiPrefill) => {
    setForm((prev) => ({
      ...prev,
      ...prefill,
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.invoice_number.trim()) {
      toast.error("Capture el folio de la factura")
      return
    }
    if (!form.subtotal || Number(form.subtotal) <= 0) {
      toast.error("Capture un subtotal válido")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/portal-proveedores/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          purchase_order_id: purchaseOrderId,
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        toast.error(json.error ?? "No se pudo registrar la factura")
        return
      }

      const warningCount = Array.isArray(json.validation_warnings)
        ? json.validation_warnings.length
        : 0
      if (warningCount > 0) {
        toast.warning(
          `Factura registrada con ${warningCount} advertencia(s) de validación. Compras revisará el documento.`
        )
      } else {
        toast.success("Factura enviada correctamente")
      }

      router.refresh()
      router.push("/portal-proveedores/facturas")
    } catch {
      toast.error("Error al enviar la factura")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Subir factura (CFDI)</h3>
        <p className="text-sm text-muted-foreground">
          OC {orderLabel} — cargue el XML para autocompletar montos o capture manualmente.
        </p>
      </div>

      <CfdiXmlUploadField
        onParsed={applyCfdi}
        disabled={submitting}
        parseUrl="/api/portal-proveedores/cfdi/parse"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invoice_number">Folio de factura</Label>
          <Input
            id="invoice_number"
            value={form.invoice_number}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, invoice_number: e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoice_date">Fecha</Label>
          <Input
            id="invoice_date"
            type="date"
            value={form.invoice_date}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, invoice_date: e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subtotal">Subtotal (sin IVA)</Label>
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
          <Label htmlFor="discount_amount">Descuento</Label>
          <Input
            id="discount_amount"
            type="number"
            min="0"
            step="0.01"
            value={form.discount_amount || ""}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                discount_amount: Number(e.target.value),
              }))
            }
          />
        </div>
      </div>

      <PoAmountBreakdown context={amountContext} />

      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes"
          rows={3}
          value={form.notes ?? ""}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="Comentarios para el área de compras"
        />
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando…
          </>
        ) : (
          "Enviar factura"
        )}
      </Button>
    </form>
  )
}
