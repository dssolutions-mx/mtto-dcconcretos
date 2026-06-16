"use client"

import { AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  PO_AMOUNT_LABELS,
  type PoAmountContext,
  poInvoiceMismatchWarning,
} from "@/lib/ap/po-amounts"
import { computeInvoiceTotals, formatMxCurrency } from "@/lib/ap/po-invoice-utils"

interface PoAmountBreakdownProps {
  context: PoAmountContext
  variant?: "default" | "compact" | "highlight"
  showMismatchWarning?: boolean
  className?: string
}

export function PoAmountBreakdown({
  context,
  variant = "default",
  showMismatchWarning = true,
  className,
}: PoAmountBreakdownProps) {
  const totals = computeInvoiceTotals({
    subtotal: context.invoice_subtotal ?? 0,
    discount_amount: context.discount_amount,
    vat_rate: context.vat_rate,
    retention_isr_rate: context.retention_isr_rate,
    retention_iva_rate: context.retention_iva_rate,
  })

  const invoicePreTax = totals.taxable_base
  const netPayable = context.invoice_net_payable ?? totals.total
  const retentions = totals.retention_isr_amount + totals.retention_iva_amount
  const mismatch =
    showMismatchWarning && context.po_pre_tax > 0
      ? poInvoiceMismatchWarning(context.po_pre_tax, invoicePreTax)
      : null

  const isCompact = variant === "compact"
  const isHighlight = variant === "highlight"

  return (
    <div
      className={cn(
        "rounded-xl border text-sm",
        isHighlight
          ? "border-primary/30 bg-primary/5 p-4"
          : "border-border/60 bg-muted/20 p-3",
        className,
      )}
    >
      {!isCompact && (
        <div className="flex items-start gap-2 mb-3">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            El monto de la orden de compra se registra <strong>sin IVA</strong>. El pago al
            proveedor corresponde al neto con impuestos y retenciones.
          </p>
        </div>
      )}

      <dl
        className={cn(
          "grid gap-2",
          isCompact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
        )}
      >
        <AmountRow
          label={PO_AMOUNT_LABELS.po_pre_tax}
          value={formatMxCurrency(context.po_pre_tax)}
          muted
        />
        {context.invoice_subtotal != null && context.invoice_subtotal > 0 && (
          <>
            <AmountRow
              label={PO_AMOUNT_LABELS.invoice_pre_tax}
              value={formatMxCurrency(invoicePreTax)}
            />
            <AmountRow label={PO_AMOUNT_LABELS.vat} value={formatMxCurrency(totals.tax)} />
            {retentions > 0 && (
              <AmountRow
                label={PO_AMOUNT_LABELS.retentions}
                value={`−${formatMxCurrency(retentions)}`}
                className="text-amber-700"
              />
            )}
          </>
        )}
        <AmountRow
          label={PO_AMOUNT_LABELS.net_payable}
          value={formatMxCurrency(netPayable)}
          emphasis
        />
        {context.balance != null && context.balance >= 0 && (
          <AmountRow
            label={PO_AMOUNT_LABELS.balance}
            value={formatMxCurrency(context.balance)}
            className={context.balance > 0 ? "text-amber-700" : "text-green-700"}
          />
        )}
      </dl>

      {mismatch && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{mismatch}</span>
        </div>
      )}
    </div>
  )
}

function AmountRow({
  label,
  value,
  emphasis,
  muted,
  className,
}: {
  label: string
  value: string
  emphasis?: boolean
  muted?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <dt
        className={cn(
          "text-[10px] font-semibold uppercase tracking-widest",
          muted ? "text-muted-foreground/70" : "text-muted-foreground",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums font-medium",
          emphasis && "text-base font-bold text-primary",
        )}
      >
        {value}
      </dd>
    </div>
  )
}
