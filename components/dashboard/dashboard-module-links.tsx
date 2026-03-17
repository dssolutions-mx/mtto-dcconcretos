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
 * Compact module chip row — de-emphasized navigation supplement.
 * Pill-shaped, monochrome. The KPI content above is the hero.
 */
export function DashboardModuleLinks({ modules }: DashboardModuleLinksProps) {
  const accessible = modules.filter((m) => m.hasAccess)
  if (accessible.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {accessible.map((m) => {
        const Icon = m.icon
        return (
          <Link
            key={m.href}
            href={m.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-border/60 bg-background",
              "px-3.5 py-2 text-sm font-medium text-muted-foreground",
              "transition-colors hover:border-border hover:text-foreground hover:bg-muted/30",
              "min-h-[36px]"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {m.title}
          </Link>
        )
      })}
    </div>
  )
}
