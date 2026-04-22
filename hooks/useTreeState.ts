/* eslint-disable react-hooks/set-state-in-effect -- expanded state is synchronized from localStorage */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FleetTreeNode } from '@/types/fleet'

const STORAGE_PREFIX = 'fleet-tree-expanded-v1'

function defaultExpanded(nodes: FleetTreeNode[]): Set<string> {
  const s = new Set<string>()
  for (const n of nodes) {
    if (n.kind !== 'asset' && n.depth <= 4) s.add(n.id)
  }
  return s
}

export function useTreeState(nodes: FleetTreeNode[], lensKey: string) {
  const storageKey = `${STORAGE_PREFIX}:${lensKey}`

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const nodeSignature = nodes.length > 0 ? nodes.map((n) => n.id).join('|') : ''

  useEffect(() => {
    if (nodes.length === 0 || !nodeSignature) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as string[]
        setExpanded(new Set(parsed))
        return
      }
    } catch {
      /* fall through */
    }
    setExpanded(defaultExpanded(nodes))
  }, [storageKey, nodeSignature, nodes])

  const persist = useCallback(
    (next: Set<string>) => {
      setExpanded(next)
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  )

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(expanded)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      persist(next)
    },
    [expanded, persist]
  )

  const expandAll = useCallback(() => {
    const next = new Set<string>()
    for (const n of nodes) {
      if (n.kind !== 'asset') next.add(n.id)
    }
    persist(next)
  }, [nodes, persist])

  const collapseAll = useCallback(() => {
    persist(new Set(['root']))
  }, [persist])

  const visibleNodes = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    return nodes.filter((n) => {
      let p = n.parent_id
      while (p) {
        if (!expanded.has(p)) return false
        p = byId.get(p)?.parent_id ?? null
      }
      return true
    })
  }, [nodes, expanded])

  return {
    expanded,
    toggle,
    expandAll,
    collapseAll,
    visibleNodes,
    hasChildren: (id: string) => nodes.some((n) => n.parent_id === id),
  }
}
