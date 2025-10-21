"use client"

import { useEffect } from "react"
import type { BreadcrumbEntry } from "@/hooks/use-breadcrumbs"
import { useBreadcrumbStore } from "@/hooks/use-breadcrumbs"

interface BreadcrumbSetterProps {
  items: BreadcrumbEntry[]
  active?: boolean
}

export function BreadcrumbSetter({ items, active = true }: BreadcrumbSetterProps) {
  const setBreadcrumbs = useBreadcrumbStore((state) => state.setBreadcrumbs)
  const resetBreadcrumbs = useBreadcrumbStore((state) => state.resetBreadcrumbs)

  useEffect(() => {
    if (active && items.length > 0) {
      setBreadcrumbs(items)
      return () => resetBreadcrumbs()
    }
  }, [active, items, resetBreadcrumbs, setBreadcrumbs])

  return null
}

