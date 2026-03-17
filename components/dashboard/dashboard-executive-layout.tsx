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
  kpis?: React.ReactNode
}

/**
 * Executive dashboard shell.
 * Hero (greeting) → shortcuts bar → KPIs → modules.
 * Full-width, no max-width cap.
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
    <div className="w-full pb-12">

      {/* ── Hero zone ──────────────────────────────────────────────────────── */}
      <div className="w-full px-4 pt-7 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">{hero}</div>
          {actions && (
            <div className="shrink-0 flex items-center gap-2">{actions}</div>
          )}
        </div>

        {/* ── Shortcuts bar ──────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border/40 pt-4">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="inline-flex items-center gap-1.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground min-h-[44px]"
            >
              {s.icon}
              {s.label}
            </Link>
          ))}

          {/* Auth limit — only show if meaningful (not unlimited / not zero) */}
          {authLimit != null && authLimit > 0 && authLimit < 10_000_000 && (
            <span className="ml-auto text-xs text-muted-foreground tabular-num">
              Límite: ${authLimit.toLocaleString("es-MX")}
            </span>
          )}
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      {kpis && (
        <div className="w-full px-4 mt-8 sm:px-6 lg:px-8">
          {kpis}
        </div>
      )}

      {/* ── Modules ───────────────────────────────────────────────────────── */}
      <div className="w-full px-4 mt-10 pt-8 border-t border-border/40 sm:px-6 lg:px-8">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Módulos
        </p>
        {modules}
      </div>

    </div>
  )
}
