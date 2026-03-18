"use client"

import Link from "next/link"
import { Plus, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CalendarShortcutsProps {
  urgentCount?: number
  todayCount?: number
  onRefresh?: () => void
  isRefreshing?: boolean
  onGoToToday?: () => void
}

export function CalendarShortcuts({
  urgentCount = 0,
  todayCount = 0,
  onRefresh,
  isRefreshing = false,
  onGoToToday
}: CalendarShortcutsProps) {
  return (
    <div className="relative border-t border-border/40">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden z-10" />
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none sm:flex-wrap py-3">
        <Button asChild size="sm" className="shrink-0 min-h-[44px]">
          <Link href="/checklists/programar">
            <Plus className="h-4 w-4 mr-2" />
            Programar
          </Link>
        </Button>
        {todayCount > 0 && onGoToToday && (
          <button
            type="button"
            onClick={onGoToToday}
            className="inline-flex shrink-0 items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-lg border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
          >
            Hoy ({todayCount})
          </button>
        )}
        {urgentCount > 0 && (
          <a
            href="#urgentes"
            className="inline-flex shrink-0 items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
          >
            <AlertCircle className="h-4 w-4" />
            {urgentCount} urgentes
          </a>
        )}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 min-h-[44px]"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Actualizar
          </Button>
        )}
      </div>
    </div>
  )
}
