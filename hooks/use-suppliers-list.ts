"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Supplier } from "@/types/suppliers"

export interface UseSuppliersListOptions {
  typeFilter: string
  statusFilter: string
  searchDebounceMs?: number
  limit?: number
}

export interface StatusCounts {
  total: number
  certified: number
  active: number
  pending: number
  issues: number
}

export interface UseSuppliersListResult {
  suppliers: Supplier[]
  loading: boolean
  error: string | null
  total: number
  offset: number
  hasMore: boolean
  setOffset: (n: number | ((prev: number) => number)) => void
  searchTerm: string
  setSearchTerm: (s: string) => void
  reload: () => void
  statusCounts: StatusCounts | null
}

function buildQuery(params: {
  query: string
  status: string
  type: string
  limit: number
  offset: number
  includeStatusCounts: boolean
}) {
  const sp = new URLSearchParams()
  if (params.query.trim()) sp.set("query", params.query.trim())
  if (params.status === "issues") {
    sp.set("issues", "1")
  } else if (params.status !== "all") {
    sp.set("status", params.status)
  }
  if (params.type !== "all") sp.set("type", params.type)
  sp.set("limit", String(params.limit))
  sp.set("offset", String(params.offset))
  sp.set("include_aliases", "0")
  if (params.includeStatusCounts) sp.set("include_status_counts", "1")
  return sp.toString()
}

export function useSuppliersList(options: UseSuppliersListOptions): UseSuppliersListResult {
  const { typeFilter, statusFilter, searchDebounceMs = 300, limit = 50 } = options
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm), searchDebounceMs)
    return () => window.clearTimeout(t)
  }, [searchTerm, searchDebounceMs])

  useEffect(() => {
    setOffset(0)
  }, [debouncedSearch, statusFilter, typeFilter])

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = buildQuery({
        query: debouncedSearch,
        status: statusFilter,
        type: typeFilter,
        limit,
        offset,
        includeStatusCounts: offset === 0,
      })
      const res = await fetch(`/api/suppliers?${qs}`)
      const data = await res.json()
      if (!res.ok) {
        setSuppliers([])
        setError(data.error || "Error al cargar proveedores")
        return
      }
      const batch = data.suppliers || []
      if (offset === 0) {
        setSuppliers(batch)
        if (data.status_counts) {
          setStatusCounts(data.status_counts)
        }
      } else {
        setSuppliers((prev) => [...prev, ...batch])
      }
      setTotal(typeof data.total === "number" ? data.total : batch.length)
    } catch {
      setSuppliers([])
      setError("Error de red")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter, typeFilter, limit, offset, reloadKey])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const reload = useCallback(() => {
    setOffset(0)
    setReloadKey((k) => k + 1)
  }, [])

  const hasMore = useMemo(() => suppliers.length < total, [suppliers.length, total])

  return {
    suppliers,
    loading,
    error,
    total,
    offset,
    hasMore,
    setOffset,
    searchTerm,
    setSearchTerm,
    reload,
    statusCounts,
  }
}
