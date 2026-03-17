"use client"

import { forwardRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { ChevronRight } from "lucide-react"

export interface DashboardActionStripProps {
  icon: LucideIcon
  count: number
  label: string
  href: string
  ctaLabel: string
  className?: string
}

/**
 * Hero action strip: one horizontal band with count + primary CTA.
 * Premium corporate: generous spacing, calm hierarchy.
 */
export const DashboardActionStrip = forwardRef<HTMLDivElement, DashboardActionStripProps>(
  ({ icon: Icon, count, label, href, ctaLabel, className }, ref) => {
    const hasPending = count > 0

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col md:flex-row md:items-center md:justify-between gap-5 md:gap-8",
          "rounded-xl border bg-card px-8 py-6",
          "border-border/50",
          className
        )}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
            hasPending ? "bg-amber-500/10 text-amber-600" : "bg-muted/50 text-muted-foreground"
          )}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">
              {hasPending
                ? `${count} ${label}`
                : `No hay ${label.toLowerCase()}`
              }
            </p>
            <p className="text-sm text-muted-foreground">
              {hasPending ? "Requieren tu atención" : "Todo al día"}
            </p>
          </div>
        </div>
        <Button asChild variant={hasPending ? "default" : "outline"} size="default" className="shrink-0">
          <a href={href} className="inline-flex items-center gap-1">
            {ctaLabel}
            <ChevronRight className="h-4 w-4" />
          </a>
        </Button>
      </div>
    )
  }
)

DashboardActionStrip.displayName = "DashboardActionStrip"
