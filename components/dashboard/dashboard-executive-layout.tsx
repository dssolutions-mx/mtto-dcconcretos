"use client"

import Link from "next/link"

interface DashboardExecutiveLayoutProps {
  hero: React.ReactNode
  userName: string
  userRole: string
  authLimit?: number
  shortcuts: { label: string; href: string; icon?: React.ReactNode }[]
  modules: React.ReactNode
  actions?: React.ReactNode
  /** KPI section (cost, WO status, compliance, alerts, etc.) - shown between shortcuts and modules */
  kpis?: React.ReactNode
}

/**
 * Premium corporate layout: hero above fold, KPIs, shortcuts, modules.
 * Generous space. Calm authority. Real executive content.
 */
export function DashboardExecutiveLayout({
  hero,
  userName,
  userRole,
  authLimit,
  shortcuts,
  modules,
  actions,
  kpis,
}: DashboardExecutiveLayoutProps) {
  return (
    <div className="w-full">
      {/* Above the fold: hero + minimal context + shortcuts */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-8 md:px-6 md:pt-12 md:pb-10">
        {hero}

        <div className="mt-10 flex flex-col gap-6">
          {/* One-line context */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {userName} · {userRole}
              {authLimit != null && authLimit > 0 && (
                <span className="ml-2 text-foreground">· ${authLimit.toLocaleString()} autorización</span>
              )}
            </p>
            {actions}
          </div>

          {/* Shortcuts: minimal text links */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border/50 pt-6">
            {shortcuts.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
              >
                {s.icon}
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs: role-specific content */}
      {kpis && (
        <div className="mx-auto w-full max-w-6xl px-4 mt-8 md:px-6">
          {kpis}
        </div>
      )}

      {/* Below: modules - de-emphasized, generous spacing */}
      <div className="mx-auto w-full max-w-6xl px-4 mt-12 pt-10 border-t border-border/40 md:px-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-6">
          Módulos
        </p>
        {modules}
      </div>
    </div>
  )
}
