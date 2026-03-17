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
 * Muted module links - no rainbow colors. Premium corporate.
 */
export function DashboardModuleLinks({ modules }: DashboardModuleLinksProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {modules.map((m) => {
        const Icon = m.icon
        return (
          <Link
            key={m.href}
            href={m.hasAccess ? m.href : "#"}
            className={cn(
              "flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3 transition-colors",
              m.hasAccess
                ? "hover:bg-muted/50 hover:border-border"
                : "opacity-50 pointer-events-none"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium truncate">{m.title}</span>
          </Link>
        )
      })}
    </div>
  )
}
