"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { Profile } from "@/types"
import { PurchaseOrderStatus } from "@/types"
import type { ApprovalContextItem } from "@/types/purchase-orders"

export type { ApprovalContextItem }

export interface PurchaseOrderWithWorkOrder {
  id: string
  order_id: string
  work_order_id?: string | null
  supplier?: string | null
  total_amount?: string | number | null
  status?: string | null
  created_at?: string | null
  requested_by?: string | null
  plant_id?: string | null
  notes?: string | null
  work_orders?: {
    id: string
    order_id: string
    description?: string
    asset_id?: string | null
    priority?: string
    assets?: {
      id: string
      name: string
      asset_id: string
      plant_id?: string | null
      plants?: { id: string; name: string } | null
    } | null
  } | null
  is_adjustment?: boolean | null
  po_type?: string | null
  po_purpose?: string | null
  payment_method?: string | null
  requires_quote?: boolean | null
  store_location?: string | null
  service_provider?: string | null
  actual_amount?: number | null
  purchased_at?: string | null
  purchase_date?: string | null
  items_preview?: string
  quotation_url?: string | null
  quotation_urls?: string[] | null
  [key: string]: unknown
}

function getItemsPreview(items: unknown): string {
  if (!items) return "Sin items especificados"
  try {
    const itemsArray = typeof items === "string" ? JSON.parse(items) : items
    if (!Array.isArray(itemsArray) || itemsArray.length === 0) return "Sin items especificados"
    const preview = itemsArray
      .slice(0, 2)
      .map((item: unknown) => {
        if (typeof item === "string") return item
        const o = item as Record<string, unknown>
        return (o.description ?? o.name ?? o.item ?? "Item") as string
      })
      .join(", ")
    const moreCount = itemsArray.length - 2
    return moreCount > 0 ? `${preview} y ${moreCount} más` : preview
  } catch {
    return "Items no válidos"
  }
}

export function useComprasData() {
  const [orders, setOrders] = useState<PurchaseOrderWithWorkOrder[]>([])
  const [technicians, setTechnicians] = useState<Record<string, Profile>>({})
  const [approvalContext, setApprovalContext] = useState<Record<string, ApprovalContextItem>>({})
  const [isLoading, setIsLoading] = useState(true)

  const loadApprovalContext = useCallback(async (orderIds: string[]) => {
    if (orderIds.length === 0) {
      setApprovalContext({})
      return
    }
    try {
      const res = await fetch(
        `/api/purchase-orders/approval-context?ids=${orderIds.join(",")}`,
        { cache: "no-store", credentials: "include" }
      )
      if (res.ok) {
        const data = await res.json()
        setApprovalContext(data)
      } else {
        setApprovalContext({})
      }
    } catch {
      setApprovalContext({})
    }
  }, [])

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()

      const { data: purchaseOrdersData, error } = await supabase
        .from("purchase_orders")
        .select(`*, plants (id, name)`)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error al cargar órdenes de compra:", error)
        throw error
      }

      const workOrderIds =
        purchaseOrdersData
          ?.filter((po) => po.work_order_id)
          .map((po) => po.work_order_id)
          .filter((id): id is string => id !== null) ?? []
      const requestedByIds = [
        ...new Set(purchaseOrdersData?.map((po) => po.requested_by).filter(Boolean) ?? []),
      ] as string[]

      const [workOrdersResult, profilesResult] = await Promise.all([
        workOrderIds.length > 0
          ? supabase
              .from("work_orders")
              .select(
                `
                id,
                order_id,
                description,
                asset_id,
                priority,
                assets (
                  id,
                  name,
                  asset_id,
                  plant_id,
                  plants (id, name)
                )
              `
              )
              .in("id", workOrderIds)
          : { data: null, error: null },
        requestedByIds.length > 0
          ? supabase.from("profiles").select("*").in("id", requestedByIds)
          : { data: [], error: null },
      ])

      const workOrdersMap: Record<string, Record<string, unknown>> = {}
      if (workOrdersResult.data) {
        workOrdersResult.data.forEach((wo: Record<string, unknown>) => {
          workOrdersMap[wo.id as string] = wo
        })
      }

      const techMap: Record<string, Profile> = {}
      if (profilesResult.data) {
        ;(profilesResult.data as Profile[]).forEach((p) => {
          techMap[p.id] = p
        })
      }
      setTechnicians(techMap)

      const ordersWithWorkOrders = (purchaseOrdersData ?? []).map((po: Record<string, unknown>) => ({
        ...po,
        work_orders: po.work_order_id ? workOrdersMap[po.work_order_id as string] ?? null : null,
        items_preview: getItemsPreview(po.items),
      }))
      setOrders(ordersWithWorkOrders as PurchaseOrderWithWorkOrder[])

      const pendingIds = (ordersWithWorkOrders as PurchaseOrderWithWorkOrder[])
        .filter((o) => o.status === PurchaseOrderStatus.PendingApproval && !o.is_adjustment)
        .map((o) => o.id)
      await loadApprovalContext(pendingIds)
    } catch (error) {
      console.error("Error al cargar órdenes de compra:", error)
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }, [loadApprovalContext])

  return {
    orders,
    setOrders,
    technicians,
    approvalContext,
    isLoading,
    loadOrders,
    loadApprovalContext,
  }
}
