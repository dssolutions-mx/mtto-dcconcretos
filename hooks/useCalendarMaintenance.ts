"use client"

import { useState, useEffect, useCallback } from "react"
import type {
  UpcomingMaintenance,
  MaintenanceSummary,
  StatusFilter,
  WarrantyEvent,
  WorkOrderEvent
} from "@/types/calendar"

const ITEMS_PER_PAGE = 50

export interface UseCalendarMaintenanceOptions {
  month?: string // YYYY-MM
  dateFrom?: string
  dateTo?: string
  includeWarranties?: boolean
  includeWorkOrders?: boolean
}

export interface UseCalendarMaintenanceReturn {
  items: UpcomingMaintenance[]
  warrantyEvents: WarrantyEvent[]
  workOrderEvents: WorkOrderEvent[]
  summary: MaintenanceSummary
  loading: boolean
  error: string | null
  refetch: () => void
  page: number
  setPage: (p: number) => void
  totalPages: number
  totalCount: number
  statusFilter: StatusFilter
  setStatusFilter: (s: StatusFilter) => void
  sortBy: 'default' | 'urgency' | 'date' | 'asset'
  setSortBy: (s: 'default' | 'urgency' | 'date' | 'asset') => void
}

export function useCalendarMaintenance(
  options: UseCalendarMaintenanceOptions = {}
): UseCalendarMaintenanceReturn {
  const {
    month,
    dateFrom,
    dateTo,
    includeWarranties = false,
    includeWorkOrders = true
  } = options

  const [items, setItems] = useState<UpcomingMaintenance[]>([])
  const [warrantyEvents, setWarrantyEvents] = useState<WarrantyEvent[]>([])
  const [workOrderEvents, setWorkOrderEvents] = useState<WorkOrderEvent[]>([])
  const [summary, setSummary] = useState<MaintenanceSummary>({
    overdue: 0,
    upcoming: 0,
    covered: 0,
    scheduled: 0,
    highUrgency: 0,
    mediumUrgency: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null)
  const [sortBy, setSortBy] = useState<'default' | 'urgency' | 'date' | 'asset'>('default')

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE))

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(ITEMS_PER_PAGE))
      if (statusFilter && statusFilter !== 'urgent') {
        params.set('status', statusFilter)
      } else if (statusFilter === 'urgent') {
        params.set('status', 'urgent')
      }
      if (sortBy && sortBy !== 'default') {
        params.set('sortBy', sortBy)
      }
      if (month) params.set('month', month)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (includeWarranties) params.set('includeWarranties', 'true')
      if (!includeWorkOrders) params.set('includeWorkOrders', 'false')

      const res = await fetch(`/api/calendar/upcoming-maintenance?${params}`)
      if (!res.ok) throw new Error('Error al cargar los mantenimientos')
      const data = await res.json()
      setItems(data.upcomingMaintenances || [])
      setSummary(data.summary || { overdue: 0, upcoming: 0, covered: 0, scheduled: 0, highUrgency: 0, mediumUrgency: 0 })
      setTotalCount(data.totalCount || 0)
      setWarrantyEvents(data.warrantyEvents || [])
      setWorkOrderEvents(data.workOrderEvents || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, sortBy, month, dateFrom, dateTo, includeWarranties, includeWorkOrders])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const refetch = useCallback(() => {
    fetchData()
  }, [fetchData])

  return {
    items,
    warrantyEvents,
    workOrderEvents,
    summary,
    loading,
    error,
    refetch,
    page,
    setPage,
    totalPages,
    totalCount,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy
  }
}
