'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useMemo } from 'react'
import { ChevronRight, ChevronDown, Factory, Building2, Box, Truck, CircleDot } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FleetTreeNode } from '@/types/fleet'
import { Checkbox } from '@/components/ui/checkbox'

const kindIcon = (kind: FleetTreeNode['kind']) => {
  switch (kind) {
    case 'root':
      return CircleDot
    case 'bu':
      return Building2
    case 'plant':
      return Factory
    case 'model':
    case 'category':
    case 'manufacturer':
    case 'year':
    case 'status':
      return Box
    default:
      return Truck
  }
}

export function FleetTree({
  allNodes,
  visibleNodes,
  expanded,
  toggle,
  density,
  filter,
  selectedAssetId,
  onSelectNode,
  multiSelected,
  onToggleMulti,
  rowOperationalSignal,
}: {
  allNodes: FleetTreeNode[]
  visibleNodes: FleetTreeNode[]
  expanded: Set<string>
  toggle: (id: string) => void
  density: 'compact' | 'normal' | 'roomy'
  filter: string
  selectedAssetId: string | null
  onSelectNode: (node: FleetTreeNode) => void
  multiSelected: Set<string>
  onToggleMulti: (assetId: string, checked: boolean) => void
  rowOperationalSignal?: { assetId: string; alert: boolean; warn: boolean } | null
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const py = density === 'compact' ? 'py-0.5' : density === 'roomy' ? 'py-2' : 'py-1'
  const text = density === 'compact' ? 'text-xs' : density === 'roomy' ? 'text-sm' : 'text-[13px]'

  const dimmed = useMemo(() => {
    if (!filter.trim()) return new Set<string>()
    let re: RegExp | null = null
    try {
      re = new RegExp(filter, 'i')
    } catch {
      re = null
    }
    const low = filter.toLowerCase()
    const s = new Set<string>()
    for (const n of visibleNodes) {
      const match =
        re != null
          ? re.test(n.label) ||
            (n.asset_ids?.some((id) => re!.test(id)) ?? false)
          : n.label.toLowerCase().includes(low)
      if (!match) s.add(n.id)
    }
    return s
  }, [visibleNodes, filter])

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual row measurement
  const rowVirtualizer = useVirtualizer({
    count: visibleNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (density === 'compact' ? 26 : density === 'roomy' ? 40 : 32),
    overscan: 12,
  })

  return (
    <div ref={parentRef} className="h-[min(70vh,720px)] overflow-auto rounded-md border border-border bg-background">
      <div
        style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}
      >
        {rowVirtualizer.getVirtualItems().map((vi) => {
          const n = visibleNodes[vi.index]
          if (!n) return null
          const Icon = kindIcon(n.kind)
          const hasChildren =
            allNodes.some((x) => x.parent_id === n.id) && n.kind !== 'asset'
          const isOpen = expanded.has(n.id)
          const isAsset = n.kind === 'asset'
          const aid = n.payload?.assetId as string | undefined
          const dim = dimmed.has(n.id) && filter.trim()

          return (
            <div
              key={n.id}
              ref={rowVirtualizer.measureElement}
              data-index={vi.index}
              className={cn(
                'absolute left-0 top-0 flex w-full items-center gap-1 border-b border-border/40',
                py,
                text,
                dim && 'opacity-40',
                selectedAssetId && aid === selectedAssetId && 'bg-muted/80'
              )}
              style={{ transform: `translateY(${vi.start}px)` }}
            >
              <div
                className="flex shrink-0 border-l border-border/60"
                style={{ width: n.depth * 14 }}
              />
              {!isAsset ? (
                <button
                  type="button"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted"
                  onClick={() => toggle(n.id)}
                  aria-expanded={isOpen}
                >
                  {hasChildren && !isAsset ? (
                    isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )
                  ) : (
                    <span className="inline-block w-4" />
                  )}
                </button>
              ) : (
                <div className="w-6 shrink-0" />
              )}
              {isAsset && (
                <Checkbox
                  className="shrink-0"
                  checked={aid ? multiSelected.has(aid) : false}
                  onCheckedChange={(c) =>
                    aid && onToggleMulti(aid, c === true)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <button
                type="button"
                className={cn(
                  'min-w-0 flex-1 text-left font-medium leading-tight',
                  n.kind === 'asset' && 'font-mono tabular-nums',
                  !isAsset && 'font-normal'
                )}
                onClick={() => onSelectNode(n)}
              >
                <span className="mr-2">{n.label}</span>
                {n.kind !== 'asset' && (
                  <span className="text-muted-foreground">
                    · {n.count} · {n.trust_pct}% conf.
                  </span>
                )}
              </button>
              {isAsset && (
                <span className="flex shrink-0 items-center gap-1.5 rounded border-l-4 border-primary pl-1 text-muted-foreground">
                  {aid && rowOperationalSignal?.assetId === aid ? (
                    <>
                      {rowOperationalSignal.alert ? (
                        <span
                          className="h-2 w-2 rounded-full bg-destructive"
                          title="Incidentes o checklists atrasados"
                          aria-hidden
                        />
                      ) : null}
                      {rowOperationalSignal.warn && !rowOperationalSignal.alert ? (
                        <span
                          className="h-2 w-2 rounded-full bg-amber-500"
                          title="Preventivo próximo"
                          aria-hidden
                        />
                      ) : null}
                    </>
                  ) : null}
                  <span className="tabular-nums">{n.trust_pct}%</span>
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
