"use client"

import { create } from "zustand"
import type { ReactNode } from "react"

export type BreadcrumbEntry = {
  label: string
  href?: string
  icon?: ReactNode
}

interface BreadcrumbState {
  items: BreadcrumbEntry[]
  setBreadcrumbs: (items: BreadcrumbEntry[]) => void
  resetBreadcrumbs: () => void
}

export const useBreadcrumbStore = create<BreadcrumbState>((set) => ({
  items: [],
  setBreadcrumbs: (items) => set({ items }),
  resetBreadcrumbs: () => set({ items: [] }),
}))

