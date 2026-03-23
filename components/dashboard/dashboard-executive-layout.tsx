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
 * Executive dashboard shell — full-width, mobile-first.
 *
 * Mobile layout:
 *   Hero (compact) + actions (icon-only) side-by-side
 *   → horizontally scrollable shortcuts strip (edge-to-edge, fade hint)
 *   → cost KPIs (1-col stacked)
 *   → approval queue
 *   → modules chip row
 *
 * Desktop layout:
 *   Same structure, more breathing room + 2-col KPI grid
 */
export function DashboardExecutiveLayout({
  hero,
  authLimit,
  shortcuts,
  modules,
  actions,
  kpis,
}: DashboardExecutiveLayoutProps) {
  const showAuthLimit = authLimit != null && authLimit > 0 && authLimit < 10_000_000

  return (
    <div className="w-full pb-16 sm:pb-12">

      {/* ── Hero zone ────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-6 sm:px-6 sm:pt-7 lg:px-8">
        <div className="flex items-center justify-between gap-3 min-w-0">
          {/* Hero grows, never shrinks below 0 */}
          <div className="flex-1 min-w-0">{hero}</div>

          {/* Actions: always compact — caller should render icon-only on mobile */}
          {actions && (
            <div className="shrink-0 flex items-center gap-1.5">{actions}</div>
          )}
        </div>
      </div>

      {/* ── Shortcuts strip ──────────────────────────────────────────────────── */}
      {/*
        Edge-to-edge horizontal scroll on mobile so content snaps to phone edges.
        Fade gradient at the right signals more items.
        Desktop: wraps naturally.
      */}
      <div className="relative mt-5 border-t border-border/40">
        {/* Fade-right hint on mobile only */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden z-10" />

        <div className="flex items-center gap-0 overflow-x-auto scrollbar-none sm:flex-wrap sm:overflow-visible sm:gap-x-6 sm:gap-y-0 px-4 sm:px-6 lg:px-8">
          {shortcuts.map((s) => (
            <Link
              key={`${s.href}::${s.label}`}
              href={s.href}
              className="inline-flex shrink-0 items-center gap-1.5 py-3 pr-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground active:text-foreground min-h-[44px] sm:pr-0"
            >
              {s.icon && (
                <span className="text-muted-foreground/60">{s.icon}</span>
              )}
              {s.label}
            </Link>
          ))}

          {/* Auth limit — trailing end, desktop only */}
          {showAuthLimit && (
            <span className="hidden sm:inline-block ml-auto text-xs text-muted-foreground tabular-num py-3">
              Límite: ${authLimit!.toLocaleString("es-MX")}
            </span>
          )}
        </div>

        {/* Auth limit — mobile: own row below strip */}
        {showAuthLimit && (
          <div className="sm:hidden px-4 pb-1 text-[11px] text-muted-foreground tabular-num">
            Límite de autorización: ${authLimit!.toLocaleString("es-MX")}
          </div>
        )}
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      {kpis && (
        <div className="mt-6 px-4 sm:px-6 lg:px-8">
          {kpis}
        </div>
      )}

      {/* ── Modules ──────────────────────────────────────────────────────────── */}
      <div className="mt-10 border-t border-border/40 px-4 pt-6 sm:px-6 lg:px-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Módulos
        </p>
        {modules}
      </div>

    </div>
  )
}
