'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import {
  filterReportsForProfile,
  reportEntryMatchesPath,
  type ReportCatalogEntry,
} from '@/lib/reports/reports-catalog'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

function groupLabel(group: ReportCatalogEntry['group']): string {
  switch (group) {
    case 'gerencial':
      return 'Gerencial'
    case 'operativo':
      return 'Operativo'
    case 'legacy':
      return 'General'
    default:
      return ''
  }
}

export function ReportsSubNav({ className }: Props) {
  const pathname = usePathname() ?? ''
  const { profile } = useAuthZustand()
  const entries = profile ? filterReportsForProfile(profile) : []

  if (entries.length === 0) return null

  const groups: ReportCatalogEntry['group'][] = ['gerencial', 'operativo', 'legacy']

  return (
    <nav
      aria-label="Navegación de reportes"
      className={cn(
        'executive-report-no-print border-b border-border/60 bg-muted/30',
        className
      )}
    >
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/reportes"
            className="text-sm font-semibold text-foreground hover:underline"
          >
            Centro de reportes
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-none pb-0.5">
          {groups.map((group) => {
            const items = entries.filter((e) => e.group === group)
            if (items.length === 0) return null
            return (
              <div key={group} className="flex shrink-0 flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
                  {groupLabel(group)}
                </span>
                <div className="flex flex-wrap gap-1.5 sm:flex-nowrap">
                  {items.map((entry) => {
                    const active = reportEntryMatchesPath(entry, pathname)
                    return (
                      <Link
                        key={entry.id}
                        href={entry.href}
                        className={cn(
                          'inline-flex shrink-0 items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                          active
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-background border border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
                        )}
                      >
                        {entry.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
