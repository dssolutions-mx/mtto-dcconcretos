"use client"

import { useState, useCallback, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
  filterIncidentsForIncidentesPage,
  type IncidentesPageFilters,
  type LifecycleFilter,
  type PlanningClassFilter,
  type ThreadDateMode,
  type WorkOrderFilter,
  resolveFilterDateBounds,
} from "@/lib/incidents/incident-list-filters"
import {
  parseDateParam,
  dateToParam,
  type IncidentDateField,
  type IncidentDatePreset,
} from "@/lib/incidents/incident-date-filter"
import type { InspectionCohortId } from "@/lib/incidents/inspection-cohort"

export type { IncidentesPageFilters }

export const DEFAULT_INCIDENT_FILTERS: IncidentesPageFilters = {
  assetIdFromUrl: null,
  plantFilter: "all",
  lifecycleFilter: "all",
  statusFilter: "all",
  typeFilter: "all",
  searchTerm: "",
  dateField: "event",
  datePreset: "all",
  fromDate: undefined,
  toDate: undefined,
  cohortId: null,
  threadDateMode: "thread_in_period",
  workOrderFilter: "all",
  planningClassFilter: "all",
  priorityFilter: "all",
}

function parseCohort(value: string | null): InspectionCohortId | null {
  if (value === "june_2026_inspection") return "june_2026_inspection"
  if (value === "custom") return "custom"
  return null
}

function parsePreset(value: string | null): IncidentDatePreset {
  const valid: IncidentDatePreset[] = [
    "all",
    "this_week",
    "this_month",
    "last_month",
    "june_2026_inspection",
    "custom",
  ]
  if (value && valid.includes(value as IncidentDatePreset)) {
    return value as IncidentDatePreset
  }
  return "all"
}

function filtersFromSearchParams(searchParams: URLSearchParams): IncidentesPageFilters {
  const cohortId = parseCohort(searchParams.get("cohort"))
  const presetParam = searchParams.get("preset")
  const datePreset =
    cohortId === "june_2026_inspection"
      ? "june_2026_inspection"
      : parsePreset(presetParam)

  const lifecycle = searchParams.get("lifecycle")
  const lifecycleFilter: LifecycleFilter =
    lifecycle === "open" || lifecycle === "resolved" ? lifecycle : "all"

  const threadMode = searchParams.get("threadMode")
  const threadDateMode: ThreadDateMode =
    threadMode === "occurrences_only" ? "occurrences_only" : "thread_in_period"

  const ot = searchParams.get("ot")
  const workOrderFilter: WorkOrderFilter =
    ot === "with" || ot === "without" ? ot : "all"

  const pc = searchParams.get("planningClass")
  const planningClassFilter: PlanningClassFilter =
    pc === "nuevo" || pc === "reincidente" || pc === "mixto" ? pc : "all"

  const dateFieldParam = searchParams.get("dateField")
  const dateField: IncidentDateField =
    dateFieldParam === "registered" ? "registered" : "event"

  return {
    ...DEFAULT_INCIDENT_FILTERS,
    assetIdFromUrl: searchParams.get("assetId"),
    plantFilter: searchParams.get("plantId") ?? "all",
    lifecycleFilter,
    statusFilter: searchParams.get("status") ?? "all",
    typeFilter: searchParams.get("type") ?? "all",
    dateField,
    datePreset,
    fromDate: parseDateParam(searchParams.get("from")),
    toDate: parseDateParam(searchParams.get("to")),
    cohortId,
    threadDateMode,
    workOrderFilter,
    planningClassFilter,
    priorityFilter: searchParams.get("priority") ?? "all",
  }
}

export function useIncidentFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filters, setFiltersState] = useState<IncidentesPageFilters>(() =>
    filtersFromSearchParams(searchParams),
  )

  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const next = filtersFromSearchParams(searchParams)
    setFiltersState((prev) => ({ ...prev, ...next }))
  }, [searchParams])

  const updateUrl = useCallback(
    (next: IncidentesPageFilters) => {
      const params = new URLSearchParams(searchParams.toString())

      const set = (key: string, value: string) => {
        if (value && value !== "all") params.set(key, value)
        else params.delete(key)
      }

      if (next.cohortId) set("cohort", next.cohortId)
      else params.delete("cohort")

      if (next.datePreset !== "all" && !next.cohortId) {
        set("preset", next.datePreset)
      } else if (!next.cohortId) {
        params.delete("preset")
      }

      if (next.cohortId === "june_2026_inspection") {
        params.set("preset", "june_2026_inspection")
      }

      set("from", dateToParam(next.fromDate))
      set("to", dateToParam(next.toDate))
      set("dateField", next.dateField === "registered" ? "registered" : "")
      set("threadMode", next.threadDateMode === "occurrences_only" ? "occurrences_only" : "")
      set("lifecycle", next.lifecycleFilter !== "all" ? next.lifecycleFilter : "")
      set("status", next.statusFilter)
      set("type", next.typeFilter)
      set("plantId", next.plantFilter !== "all" ? next.plantFilter : "")
      set("ot", next.workOrderFilter !== "all" ? next.workOrderFilter : "")
      set(
        "planningClass",
        next.planningClassFilter !== "all" ? next.planningClassFilter : "",
      )
      set("priority", next.priorityFilter)

      if (next.assetIdFromUrl) params.set("assetId", next.assetIdFromUrl)
      else params.delete("assetId")

      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname, router, searchParams],
  )

  const setFilters = useCallback(
    (patch: Partial<IncidentesPageFilters>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...patch }
        const urlKeys: (keyof IncidentesPageFilters)[] = [
          "assetIdFromUrl",
          "plantFilter",
          "lifecycleFilter",
          "statusFilter",
          "typeFilter",
          "dateField",
          "datePreset",
          "fromDate",
          "toDate",
          "cohortId",
          "threadDateMode",
          "workOrderFilter",
          "planningClassFilter",
          "priorityFilter",
        ]
        const hasUrlChange = Object.keys(patch).some((k) =>
          urlKeys.includes(k as keyof IncidentesPageFilters),
        )
        if (hasUrlChange) updateUrl(next)
        return next
      })
    },
    [updateUrl],
  )

  const clearAllFilters = useCallback(() => {
    setSearchTerm("")
    setFiltersState({ ...DEFAULT_INCIDENT_FILTERS })
    router.replace(pathname)
  }, [pathname, router])

  const dateBounds = resolveFilterDateBounds(filters)

  const hasActiveFilters =
    filters.lifecycleFilter !== "all" ||
    filters.statusFilter !== "all" ||
    filters.typeFilter !== "all" ||
    filters.plantFilter !== "all" ||
    filters.workOrderFilter !== "all" ||
    filters.planningClassFilter !== "all" ||
    filters.priorityFilter !== "all" ||
    filters.datePreset !== "all" ||
    !!filters.cohortId ||
    !!filters.fromDate ||
    !!filters.toDate ||
    !!filters.assetIdFromUrl ||
    !!searchTerm.trim()

  const activeFilterCount = [
    filters.lifecycleFilter !== "all",
    filters.statusFilter !== "all",
    filters.typeFilter !== "all",
    filters.plantFilter !== "all",
    filters.workOrderFilter !== "all",
    filters.planningClassFilter !== "all",
    filters.priorityFilter !== "all",
    filters.datePreset !== "all" || !!filters.cohortId || filters.fromDate || filters.toDate,
    filters.assetIdFromUrl,
    searchTerm.trim(),
  ].filter(Boolean).length

  return {
    filters,
    searchTerm,
    setSearchTerm,
    setFilters,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
    dateBounds,
    filterIncidentsForIncidentesPage,
  }
}
