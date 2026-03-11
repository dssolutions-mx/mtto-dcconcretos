"use client"

/**
 * Single entry point for quotation quick access in Compras.
 * Wraps QuotationQuickAccessPopover; will unify with QuotationManager fetch logic in Phase E.
 */
import { QuotationQuickAccessPopover } from "./QuotationQuickAccessPopover"

export interface ComprasQuotationAccessProps {
  purchaseOrderId: string
  workOrderId?: string | null
  legacyUrl?: string | null
  quotationUrls?: string[] | unknown[] | null
  requiresQuote?: boolean
  children: React.ReactNode
  onOpenChange?: (open: boolean) => void
}

export function ComprasQuotationAccess({
  purchaseOrderId,
  workOrderId,
  legacyUrl,
  quotationUrls,
  requiresQuote,
  children,
  onOpenChange,
}: ComprasQuotationAccessProps) {
  return (
    <QuotationQuickAccessPopover
      purchaseOrderId={purchaseOrderId}
      workOrderId={workOrderId}
      legacyUrl={legacyUrl}
      quotationUrls={quotationUrls}
      requiresQuote={requiresQuote}
      onOpenChange={onOpenChange}
    >
      {children}
    </QuotationQuickAccessPopover>
  )
}
