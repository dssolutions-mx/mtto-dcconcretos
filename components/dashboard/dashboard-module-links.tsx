"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export interface ModuleLink {
  title: string
  href: string
  icon: LucideIcon
  hasAccess: boolean
}

interface DashboardModuleLinksProps {
  modules: ModuleLink[]
}

/**
 * Module chip row.
 * Mobile: horizontal scroll (edge-to-edge) with right-fade hint.
 * Desktop: wraps freely.
 */
export function DashboardModuleLinks({ modules }: DashboardModuleLinksProps) {
  const accessible = modules.filter((m) => m.hasAccess)
  if (accessible.length === 0) return null

  return (
    <div className="relative">
      {/* Fade-right on mobile to hint at scroll */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden z-10" />

      {/* Scrollable on mobile, wrap on desktop */}
      <div className="flex overflow-x-auto scrollbar-none sm:flex-wrap gap-2 pb-1">
        {accessible.map((m) => {
          const Icon = m.icon
          return (
            <Link
              key={m.href}
              href={m.href}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-background",
                "px-3 py-2 text-sm font-medium text-muted-foreground",
                "transition-colors hover:border-border hover:text-foreground hover:bg-muted/30",
                "min-h-[36px] active:bg-muted/50"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {m.title}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
