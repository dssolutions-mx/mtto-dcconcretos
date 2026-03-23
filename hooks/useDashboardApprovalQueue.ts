"use client"

import { useState, useCallback, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { shareInFlight } from "@/lib/in-flight"
import type { ApprovalContextItem } from "@/types/purchase-orders"
import type { PurchaseOrderWithWorkOrder } from "@/components/compras/useComprasData"

export type ApprovalStage = "technical" | "viability" | "final" | null

export interface DashboardApprovalQueueResult {
  items: PurchaseOrderWithWorkOrder[]
  totalCount: number
  isLoading: boolean
  myStage: ApprovalStage
  approvalContext: Record<string, ApprovalContextItem>
  refetch: () => void
}

/**
 * Fetches the pending purchase orders the current user needs to act on.
 * Reuses the same Supabase + approval-context pattern as useComprasData.ts.
 * Max 8 items shown; totalCount reflects full matching count.
 */
export function useDashboardApprovalQueue(): DashboardApprovalQueueResult {
  const [items, setItems] = useState<PurchaseOrderWithWorkOrder[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [myStage, setMyStage] = useState<ApprovalStage>(null)
  const [approvalContext, setApprovalContext] = useState<Record<string, ApprovalContextItem>>({})

  const load = useCallback(async () => {
    await shareInFlight("dashboard-approval-queue", async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()

      // Fetch pending_approval POs, oldest first so most urgent surface first
      const { data: pendingPOsRaw, error } = await supabase
        .from("purchase_orders")
        .select(
          `
          id, order_id, work_order_id, supplier, total_amount, status,
          created_at, requested_by, plant_id, notes, is_adjustment,
          po_type, po_purpose, payment_method, items,
          plants (id, name)
        `
        )
        .eq("status", "pending_approval")
        .eq("is_adjustment", false)
        .order("created_at", { ascending: true })
        .limit(50) // fetch more than 8 to get accurate totalCount after context filtering

      // Cast to known type to avoid supabase schema type narrowing issues
      const pendingPOs = (pendingPOsRaw ?? []) as PurchaseOrderWithWorkOrder[]

      if (error) {
        console.error("[useDashboardApprovalQueue] Error loading POs:", error)
        setItems([])
        setTotalCount(0)
        return
      }

      if (pendingPOs.length === 0) {
        setItems([])
        setTotalCount(0)
        setMyStage(null)
        return
      }

      // Get approval context to determine which ones the current user can act on
      const ids = pendingPOs.map((po) => po.id).join(",")
      let context: Record<string, ApprovalContextItem> = {}
      try {
        const res = await fetch(
          `/api/purchase-orders/approval-context?ids=${ids}`,
          { cache: "no-store", credentials: "include" }
        )
        if (res.ok) {
          context = await res.json()
        }
      } catch {
        // non-fatal: show no items rather than crashing
      }

      setApprovalContext(context)

      // Filter to items the current user can act on
      const actionable = pendingPOs.filter(
        (po) => context[po.id]?.canApprove || context[po.id]?.canRecordViability
      )

      setTotalCount(actionable.length)
      setItems(actionable.slice(0, 8))

      // Determine stage from first actionable item
      if (actionable.length > 0) {
        const firstCtx = context[actionable[0].id]
        const stage = firstCtx?.workflowStage
        if (stage === "technical" || stage === "viability" || stage === "final") {
          setMyStage(stage)
        } else {
          setMyStage(null)
        }
      } else {
        setMyStage(null)
      }
    } catch (err) {
      console.error("[useDashboardApprovalQueue] Unexpected error:", err)
      setItems([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { items, totalCount, isLoading, myStage, approvalContext, refetch: load }
}
