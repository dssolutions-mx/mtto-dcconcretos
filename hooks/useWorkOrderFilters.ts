"use client"

import { useState, useCallback, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { getStatusesForTab, normalizeTab } from "@/lib/work-order-status-tabs"

/** Sort options: default (created_at desc) | priority | asset | created | orderId */
export type WorkOrderSortBy = "default" | "priority" | "asset" | "created" | "orderId"

export type WorkOrderSortDir = "asc" | "desc"

/** Filter values for work orders list */
export interface WorkOrderFilters {
  tab: string
  searchTerm: string
  assetId: string
  assetName: string
  technicianId: string
  typeFilter: string
  originFilter: string
  recurrentesOnly: boolean
  fromDate: Date | undefined
  toDate: Date | undefined
  groupByAsset: boolean
  sortBy: WorkOrderSortBy
  sortDir: WorkOrderSortDir
}

const DEFAULT_FILTERS: WorkOrderFilters = {
  tab: "all",
  searchTerm: "",
  assetId: "",
  assetName: "",
  technicianId: "",
  typeFilter: "all",
  originFilter: "all",
  recurrentesOnly: false,
  fromDate: undefined,
  toDate: undefined,
  groupByAsset: false,
  sortBy: "default",
  sortDir: "desc",
}

/** Work order shape needed for filtering (extended with origin/recurrence) */
export interface WorkOrderForFilter {
  id: string
  order_id?: string | null
  asset_id: string | null
  status: string | null
  type: string | null
  priority?: string | null
  description?: string | null
  planned_date?: string | null
  created_at?: string | null
  order_id?: string | null
  assigned_to?: string | null
  incident_id?: string | null
  checklist_id?: string | null
  maintenance_plan_id?: string | null
  preventive_checklist_id?: string | null
  escalation_count?: number | null
  related_issues_count?: number | null
  asset?: { id: string; name?: string | null; asset_id?: string | null } | null
}

export type TechnicianOption = { id: string; label: string }
export type AssetOption = { id: string; label: string }

/** Apply all filters (AND logic) - pure function for testability */
export function applyWorkOrderFilters<T extends WorkOrderForFilter>(
  orders: T[],
  filters: WorkOrderFilters,
  technicians: Record<string, { nombre?: string | null; apellido?: string | null }>
): T[] {
  let result = [...orders]

  // Tab (status) — uses WorkOrderStatus enum via work-order-status-tabs
  if (filters.tab !== "all") {
    const statuses = getStatusesForTab(filters.tab)
    if (statuses.length > 0) {
      result = result.filter((o) => o.status && statuses.includes(o.status))
    }
  }

  // Type (treat "" as "all")
  if (filters.typeFilter === "preventive") {
    result = result.filter((o) => o.type === "preventive")
  } else if (filters.typeFilter === "corrective") {
    result = result.filter((o) => o.type === "corrective")
  }

  // Asset
  if (filters.assetId) {
    result = result.filter((o) => o.asset_id === filters.assetId)
  }

  // Technician
  if (filters.technicianId) {
    result = result.filter((o) => o.assigned_to === filters.technicianId)
  }

  // Origin (treat "" as "all")
  if (filters.originFilter && filters.originFilter !== "all") {
    if (filters.originFilter === "incident") {
      result = result.filter((o) => !!o.incident_id)
    } else if (filters.originFilter === "checklist") {
      result = result.filter((o) => !!o.checklist_id && !o.incident_id)
    } else if (filters.originFilter === "preventive") {
      result = result.filter((o) => !!o.maintenance_plan_id || o.type === "preventive")
    } else if (filters.originFilter === "manual") {
      result = result.filter(
        (o) =>
          !o.incident_id &&
          !o.checklist_id &&
          !o.maintenance_plan_id &&
          !(o as { preventive_checklist_id?: string | null }).preventive_checklist_id
      )
    }
  }

  // Recurrentes only
  if (filters.recurrentesOnly) {
    result = result.filter(
      (o) =>
        (o.escalation_count != null && o.escalation_count > 0) ||
        (o.related_issues_count != null && o.related_issues_count > 1)
    )
  }

  // Date range (uses created_at for consistency with Creado column)
  if (filters.fromDate) {
    const from = filters.fromDate.getTime()
    result = result.filter((o) => {
      const d = o.created_at ? new Date(o.created_at).getTime() : 0
      return d >= from
    })
  }
  if (filters.toDate) {
    const to = new Date(filters.toDate)
    to.setHours(23, 59, 59, 999)
    const toTs = to.getTime()
    result = result.filter((o) => {
      const d = o.created_at ? new Date(o.created_at).getTime() : 0
      return d <= toTs
    })
  }

  // Search term
  if (filters.searchTerm.trim()) {
    const term = filters.searchTerm.toLowerCase().trim()
    result = result.filter((o) => {
      const assetName = (o.asset?.name ?? "").toLowerCase()
      const assetId = (o.asset?.asset_id ?? "").toLowerCase()
      const orderId = (o.order_id ?? "").toLowerCase()
      const desc = (o.description ?? "").toLowerCase()
      const tech = technicians[o.assigned_to ?? ""]
      const techName = tech
        ? `${(tech.nombre ?? "").toLowerCase()} ${(tech.apellido ?? "").toLowerCase()}`.trim()
        : ""
      return (
        assetName.includes(term) ||
        assetId.includes(term) ||
        orderId.includes(term) ||
        desc.includes(term) ||
        techName.includes(term)
      )
    })
  }

  // Sort
  const dir = filters.sortDir === "asc" ? 1 : -1
  if (filters.sortBy === "priority") {
    const priorityOrder: Record<string, number> = {
      Crítica: 4,
      Emergencia: 4,
      Alta: 3,
      Media: 2,
      Baja: 1,
    }
    result.sort((a, b) => {
      const aPri = priorityOrder[a.priority ?? ""] ?? 0
      const bPri = priorityOrder[b.priority ?? ""] ?? 0
      return (bPri - aPri) * dir
    })
  } else if (filters.sortBy === "asset") {
    result.sort((a, b) => {
      const aVal = (a.asset?.asset_id ?? a.asset_id ?? "").toLowerCase()
      const bVal = (b.asset?.asset_id ?? b.asset_id ?? "").toLowerCase()
      return aVal.localeCompare(bVal) * dir
    })
  } else if (filters.sortBy === "created") {
    result.sort((a, b) => {
      const aTs = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTs = b.created_at ? new Date(b.created_at).getTime() : 0
      return (aTs - bTs) * dir
    })
  } else if (filters.sortBy === "orderId") {
    result.sort((a, b) => {
      const aVal = (a.order_id ?? "").toLowerCase()
      const bVal = (b.order_id ?? "").toLowerCase()
      return aVal.localeCompare(bVal) * dir
    })
  } else if (filters.sortBy === "default") {
    result.sort((a, b) => {
      const aTs = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTs = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTs - aTs // newest first
    })
  }

  return result
}

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return isNaN(d.getTime()) ? undefined : d
}

function dateToParam(d: Date | undefined): string {
  return d ? d.toISOString().split("T")[0] : ""
}

/** Hook for work order filters with URL sync */
export function useWorkOrderFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filters, setFiltersState] = useState<WorkOrderFilters>(() => {
    const tab = normalizeTab(searchParams.get("tab"))
    const assetId = searchParams.get("assetId") ?? ""
    const assetName = searchParams.get("asset") ?? ""
    const technicianId = searchParams.get("tech") ?? ""
    const typeFilter = searchParams.get("type") ?? DEFAULT_FILTERS.typeFilter
    const originFilter = searchParams.get("origin") ?? DEFAULT_FILTERS.originFilter
    const recurrentes = searchParams.get("recurrentes")
    const recurrentesOnly = recurrentes === "1" || recurrentes === "true"
    const fromDate = parseDateParam(searchParams.get("from"))
    const toDate = parseDateParam(searchParams.get("to"))
    const group = searchParams.get("group")
    const groupByAsset = group === "1" || group === "true"
    const sortParam = searchParams.get("sort")
    const sortBy = ["priority", "asset", "created", "orderId"].includes(sortParam ?? "")
      ? (sortParam as WorkOrderSortBy)
      : "default"
    const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc"

    return {
      ...DEFAULT_FILTERS,
      tab,
      searchTerm: "", // Never from URL
      assetId,
      assetName,
      technicianId,
      typeFilter,
      originFilter,
      recurrentesOnly,
      fromDate,
      toDate,
      groupByAsset,
      sortBy,
      sortDir,
    }
  })

  // Sync from URL on mount / external navigation (e.g. from asset page)
  useEffect(() => {
    const tab = normalizeTab(searchParams.get("tab"))
    const assetId = searchParams.get("assetId") ?? ""
    const assetName = searchParams.get("asset") ?? ""
    const technicianId = searchParams.get("tech") ?? ""
    const typeFilter = searchParams.get("type") ?? DEFAULT_FILTERS.typeFilter
    const originFilter = searchParams.get("origin") ?? DEFAULT_FILTERS.originFilter
    const recurrentes = searchParams.get("recurrentes")
    const recurrentesOnly = recurrentes === "1" || recurrentes === "true"
    const fromDate = parseDateParam(searchParams.get("from"))
    const toDate = parseDateParam(searchParams.get("to"))
    const group = searchParams.get("group")
    const groupByAsset = group === "1" || group === "true"
    const sortParam = searchParams.get("sort")
    const sortBy = ["priority", "asset", "created", "orderId"].includes(sortParam ?? "")
      ? (sortParam as WorkOrderSortBy)
      : "default"
    const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc"

    setFiltersState((prev) => ({
      ...prev,
      tab,
      assetId,
      assetName,
      technicianId,
      typeFilter,
      originFilter,
      recurrentesOnly,
      fromDate,
      toDate,
      groupByAsset,
      sortBy,
      sortDir,
    }))
  }, [searchParams])

  const updateUrl = useCallback(
    (next: Partial<WorkOrderFilters>) => {
      const params = new URLSearchParams(searchParams.toString())

      const set = (key: string, value: string) => {
        if (value && value !== "all") params.set(key, value)
        else params.delete(key)
      }

      if (next.tab !== undefined) set("tab", next.tab)
      if (next.assetId !== undefined) set("assetId", next.assetId)
      if (next.assetName !== undefined) set("asset", next.assetName)
      if (next.technicianId !== undefined) set("tech", next.technicianId)
      if (next.typeFilter !== undefined) set("type", next.typeFilter)
      if (next.originFilter !== undefined) set("origin", next.originFilter)
      if (next.recurrentesOnly !== undefined)
        set("recurrentes", next.recurrentesOnly ? "1" : "")
      if (next.fromDate !== undefined) set("from", dateToParam(next.fromDate))
      if (next.toDate !== undefined) set("to", dateToParam(next.toDate))
      if (next.groupByAsset !== undefined)
        set("group", next.groupByAsset ? "1" : "")
      if (next.sortBy !== undefined) {
        set("sort", next.sortBy !== "default" ? next.sortBy : "")
        if (next.sortBy === "default") params.delete("sortDir")
      }
      if (next.sortDir !== undefined && next.sortBy !== "default")
        set("sortDir", next.sortDir === "asc" ? "asc" : "")

      const qs = params.toString()
      const url = qs ? `${pathname}?${qs}` : pathname
      router.replace(url)
    },
    [pathname, router, searchParams]
  )

  const URL_KEYS = [
    "tab",
    "assetId",
    "assetName",
    "technicianId",
    "typeFilter",
    "originFilter",
    "recurrentesOnly",
    "fromDate",
    "toDate",
    "groupByAsset",
    "sortBy",
    "sortDir",
  ] as const

  const setFilters = useCallback(
    (patch: Partial<WorkOrderFilters>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...patch }
        // Only update URL when URL-relevant keys change — avoids router.replace on every search keystroke
        const hasUrlRelevantChange = (Object.keys(patch) as (keyof WorkOrderFilters)[]).some((k) =>
          URL_KEYS.includes(k)
        )
        if (hasUrlRelevantChange) {
          updateUrl(next)
        }
        return next
      })
    },
    [updateUrl]
  )

  const clearAllFilters = useCallback(() => {
    setFiltersState({
      ...DEFAULT_FILTERS,
      searchTerm: "",
    })
    router.replace(pathname)
  }, [pathname, router])

  const isTypeAll = !filters.typeFilter || filters.typeFilter === "all"
  const isOriginAll = !filters.originFilter || filters.originFilter === "all"

  // Sort is a view preference, not a filter — exclude from hasActiveFilters
  const hasActiveFilters =
    !!filters.assetId ||
    !!filters.technicianId ||
    !isTypeAll ||
    !isOriginAll ||
    filters.recurrentesOnly ||
    !!filters.fromDate ||
    !!filters.toDate ||
    filters.groupByAsset

  const activeFilterCount = [
    filters.assetId,
    filters.technicianId,
    !isTypeAll,
    !isOriginAll,
    filters.recurrentesOnly,
    filters.fromDate || filters.toDate,
    filters.groupByAsset,
  ].filter(Boolean).length

  return {
    filters,
    setFilters,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
    applyWorkOrderFilters,
  }
}
