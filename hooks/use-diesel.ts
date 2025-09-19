"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import type { DieselResolution, DieselTransaction, DieselWarehouseBalance } from "@/types/diesel"

export function useWarehouseBalance(warehouseId: string | null) {
  const [data, setData] = useState<DieselWarehouseBalance | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!warehouseId) return
    const fetchBalance = async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc('get_warehouse_balance', { p_warehouse_id: warehouseId })
        if (error) throw error
        setData({ warehouse_id: warehouseId, balance_liters: Number(data) || 0 })
      } catch (e: any) {
        setError(e?.message || 'Error obteniendo balance')
      } finally {
        setLoading(false)
      }
    }
    fetchBalance()
  }, [warehouseId])

  return { data, loading, error }
}

export function useResolveAssetName() {
  const resolve = useCallback(async (inputName: string, autoCreate = true): Promise<DieselResolution> => {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('resolve_asset_name', {
      input_name: inputName,
      auto_create_exception: autoCreate
    })
    if (error) throw error
    return data as DieselResolution
  }, [])

  return { resolve }
}

export function useRecordDieselTransaction() {
  const record = useCallback(async (tx: DieselTransaction) => {
    const supabase = createClient()
    const { error } = await supabase.from('diesel_transactions').insert(tx)
    if (error) throw error
  }, [])

  return { record }
}

export function useReconcileDieselInventory() {
  const reconcile = useCallback(async (payload: { warehouseId: string; physicalCount: number; countDate?: string; reason: string; createdBy: string }) => {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('reconcile_diesel_inventory', {
      p_warehouse_id: payload.warehouseId,
      p_physical_count: payload.physicalCount,
      p_count_date: payload.countDate || new Date().toISOString(),
      p_reason: payload.reason,
      p_created_by: payload.createdBy
    })
    if (error) throw error
    return data as string
  }, [])

  return { reconcile }
}


