"use client"

import { cn } from "@/lib/utils"

type Props = {
  children: React.ReactNode
  className?: string
}

/**
 * Sticky bottom bar for primary/cancel actions on long PO creation forms.
 */
export function PurchaseOrderCreationActionRail({ children, className }: Props) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 mt-6 border-t bg-background/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>
    </div>
  )
}
