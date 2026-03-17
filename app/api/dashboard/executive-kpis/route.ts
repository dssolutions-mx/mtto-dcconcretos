import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { loadActorContext, checkScopeOverBusinessUnit } from "@/lib/auth/server-authorization"
import {
  resolveWorkflowPath,
  resolveCurrentStage,
  canActorApproveAtStage,
  canActorRecordViabilityAtStage,
  GM_ESCALATION_THRESHOLD_MXN,
} from "@/lib/purchase-orders/workflow-policy"
import { WorkOrderStatus } from "@/types"

export const dynamic = "force-dynamic"

export interface ExecutiveKPIs {
  /** Pending POs ≥$7k for GM approval */
  pendingApprovals: number
  /** Work order counts by status segment */
  workOrders: { pending: number; completed: number; total: number }
  /** Checklist compliance: % of due schedules completed in last 30 days */
  checklistCompliance: { rate: number; due: number; completed: number }
  /** Critical alerts requiring attention */
  criticalAlerts: Array<{
    type: string
    count: number
    label: string
    href: string
    severity: "critical" | "warning"
  }>
  /** Backlog aging (open WOs by days since created) */
  backlogAging: { "0-7": number; "8-14": number; "15-30": number; "31+": number }
  /** Planned (preventive) vs reactive (corrective) work ratio */
  plannedVsReactive: { planned: number; reactive: number; ratio: number }
  /** Maintenance cost this month (from POs + WOs) */
  maintenanceCost: { thisMonth: number; lastMonth?: number }
}

async function buildBusinessUnitLookup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pos: Array<{ plant_id?: string | null; work_order_id?: string | null }>
) {
  const directPlantIds = [...new Set(pos.map((po) => po.plant_id).filter(Boolean))] as string[]
  const workOrderIds = [
    ...new Set(pos.filter((po) => !po.plant_id && po.work_order_id).map((po) => po.work_order_id!)),
  ]
  const woToPlant = new Map<string, string>()
  if (workOrderIds.length > 0) {
    const { data: wos } = await supabase
      .from("work_orders")
      .select("id, asset_id")
      .in("id", workOrderIds)
    const assetIds = [
      ...new Set((wos ?? []).map((w: { asset_id: string | null }) => w.asset_id).filter(Boolean)),
    ] as string[]
    const woMap = new Map((wos ?? []).map((w: { id: string; asset_id: string | null }) => [w.id, w.asset_id]))
    let assetToPlant = new Map<string, string>()
    if (assetIds.length > 0) {
      const { data: assets } = await supabase
        .from("assets")
        .select("id, plant_id")
        .in("id", assetIds)
      assetToPlant = new Map(
        (assets ?? [])
          .filter((a: { plant_id: string | null }) => a.plant_id)
          .map((a: { id: string; plant_id: string }) => [a.id, a.plant_id])
      )
    }
    workOrderIds.forEach((woId) => {
      const assetId = woMap.get(woId)
      const plantId = assetId ? assetToPlant.get(assetId) : undefined
      if (plantId) woToPlant.set(woId, plantId)
    })
  }
  const allPlantIds = [...new Set([...directPlantIds, ...woToPlant.values()])]
  const plantToBu = new Map<string, string | null>()
  if (allPlantIds.length > 0) {
    const { data: plants } = await supabase
      .from("plants")
      .select("id, business_unit_id")
      .in("id", allPlantIds)
    ;(plants ?? []).forEach((p: { id: string; business_unit_id: string | null }) => {
      plantToBu.set(p.id, p.business_unit_id)
    })
  }
  return (po: { plant_id?: string | null; work_order_id?: string | null }) => {
    const plantId =
      po.plant_id ?? (po.work_order_id ? woToPlant.get(po.work_order_id) ?? null : null) ?? null
    return plantId ? plantToBu.get(plantId) ?? null : null
  }
}

const PENDING_STATUSES = [
  WorkOrderStatus.Pending,
  WorkOrderStatus.Programmed,
  WorkOrderStatus.WaitingParts,
  "Cotizada",
  "Aprobada",
  "En ejecución",
  "En Progreso",
  "Esperando Partes",
  "pendiente",
  "en_progreso",
]

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor?.profile?.role) {
      return NextResponse.json(buildEmptyKPIs())
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Parallel fetches
    const [
      workOrdersResult,
      checklistSchedulesResult,
      incidentsResult,
      assetsResult,
      pendingPOsResult,
      purchaseOrdersResult,
      purchaseOrdersLastMonthResult,
    ] = await Promise.all([
      supabase
        .from("work_orders")
        .select("id, status, type, created_at, incident_id, maintenance_plan_id")
        .not("status", "is", null),
      supabase
        .from("checklist_schedules")
        .select("id, status, scheduled_date, updated_at")
        .gte("scheduled_date", thirtyDaysAgo.toISOString().split("T")[0])
        .lte("scheduled_date", now.toISOString().split("T")[0]),
      supabase
        .from("incident_history")
        .select("id, status")
        .eq("status", "Pendiente"),
      supabase
        .from("assets")
        .select("id, status")
        .in("status", ["maintenance", "repair"]),
      supabase
        .from("purchase_orders")
        .select("id, authorized_by, viability_state, po_purpose, work_order_type, approval_amount, total_amount, plant_id, work_order_id, is_adjustment")
        .eq("status", "pending_approval")
        .limit(200),
      supabase
        .from("purchase_orders")
        .select("id, total_amount, actual_amount, purchase_date")
        .in("status", ["received", "partial", "paid", "authorized"])
        .gte("purchase_date", startOfMonth.toISOString().split("T")[0])
        .lte("purchase_date", endOfMonth.toISOString().split("T")[0]),
      supabase
        .from("purchase_orders")
        .select("id, total_amount, actual_amount, purchase_date")
        .in("status", ["received", "partial", "paid", "authorized"])
        .gte("purchase_date", startOfLastMonth.toISOString().split("T")[0])
        .lte("purchase_date", endOfLastMonth.toISOString().split("T")[0]),
    ])

    const workOrders = workOrdersResult.data ?? []
    const checklistSchedules = checklistSchedulesResult.data ?? []
    const incidents = incidentsResult.data ?? []
    const assetsDown = assetsResult.data ?? []
    const pendingPOs = pendingPOsResult.data ?? []
    const posThisMonth = purchaseOrdersResult.data ?? []
    const posLastMonth = purchaseOrdersLastMonthResult.data ?? []

    // Pending GM approvals (≥$7k)
    let pendingApprovals = 0
    if (["GERENCIA_GENERAL", "JEFE_UNIDAD_NEGOCIO", "AREA_ADMINISTRATIVA"].includes(actor.profile.role)) {
      const resolveBuId = await buildBusinessUnitLookup(supabase, pendingPOs.filter((p: { is_adjustment?: boolean }) => !p.is_adjustment))
      for (const po of pendingPOs.filter((p: { is_adjustment?: boolean }) => !p.is_adjustment)) {
        const amount = Number(po.approval_amount ?? po.total_amount ?? 0)
        if (amount < GM_ESCALATION_THRESHOLD_MXN) continue
        const buId = resolveBuId(po)
        const hasScope = checkScopeOverBusinessUnit(actor, buId)
        const policy = resolveWorkflowPath({
          poPurpose: po.po_purpose ?? null,
          workOrderType: po.work_order_type ?? null,
          approvalAmount: amount,
        })
        const needsGMEscalation = policy.requiresGMIfAboveThreshold && amount >= GM_ESCALATION_THRESHOLD_MXN
        const stage = resolveCurrentStage({
          authorizedBy: po.authorized_by ?? null,
          viabilityState: po.viability_state ?? null,
          policy,
          amount,
        })
        const canApprove = canActorApproveAtStage({
          stage,
          actorRole: actor.profile.role,
          policy,
          needsGMEscalation,
          hasScope,
          hasAuthLimit: actor.authorizationLimit > 0,
          amountWithinLimit: amount <= actor.authorizationLimit,
        })
        if (canApprove && stage === "final") pendingApprovals++
      }
    }

    // Work order stats
    const woPending = workOrders.filter((w: { status: string | null }) =>
      PENDING_STATUSES.includes(w.status ?? "")
    ).length
    const woCompleted = workOrders.filter(
      (w: { status: string | null }) => w.status === WorkOrderStatus.Completed
    ).length

    // Checklist compliance (due in last 30 days)
    const dueSchedules = checklistSchedules.filter(
      (s: { scheduled_date: string }) => new Date(s.scheduled_date) <= now
    )
    const completedSchedules = dueSchedules.filter(
      (s: { status: string }) => s.status === "completado"
    )
    const complianceRate =
      dueSchedules.length > 0 ? (completedSchedules.length / dueSchedules.length) * 100 : 100

    // Critical alerts
    const criticalAlerts: ExecutiveKPIs["criticalAlerts"] = []
    if (incidents.length > 0) {
      criticalAlerts.push({
        type: "incidents",
        count: incidents.length,
        label: "incidentes pendientes",
        href: "/incidentes",
        severity: incidents.length >= 5 ? "critical" : "warning",
      })
    }
    if (assetsDown.length > 0) {
      criticalAlerts.push({
        type: "assets_down",
        count: assetsDown.length,
        label: "activos en mantenimiento/reparación",
        href: "/activos",
        severity: assetsDown.length >= 3 ? "critical" : "warning",
      })
    }
    const overdueSchedules = checklistSchedules.filter(
      (s: { status: string; scheduled_date: string }) =>
        s.status === "pendiente" && new Date(s.scheduled_date) < now
    )
    if (overdueSchedules.length > 0) {
      criticalAlerts.push({
        type: "overdue_pm",
        count: overdueSchedules.length,
        label: "checklists preventivos vencidos",
        href: "/checklists",
        severity: overdueSchedules.length >= 10 ? "critical" : "warning",
      })
    }

    // Backlog aging (open WOs)
    const openWOs = workOrders.filter((w: { status: string | null }) =>
      PENDING_STATUSES.includes(w.status ?? "")
    )
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const backlogAging = { "0-7": 0, "8-14": 0, "15-30": 0, "31+": 0 }
    for (const wo of openWOs) {
      const created = wo.created_at ? new Date(wo.created_at).getTime() : todayStart
      const daysOld = Math.floor((todayStart - created) / (24 * 60 * 60 * 1000))
      if (daysOld <= 7) backlogAging["0-7"]++
      else if (daysOld <= 14) backlogAging["8-14"]++
      else if (daysOld <= 30) backlogAging["15-30"]++
      else backlogAging["31+"]++
    }

    // Planned vs reactive (preventive vs corrective) - each WO counts once
    const typeLower = (t: string | null | undefined) => String(t ?? "").toLowerCase()
    let planned = 0
    let reactive = 0
    for (const w of workOrders) {
      const t = typeLower(w.type)
      const hasPlan = w.maintenance_plan_id != null && String(w.maintenance_plan_id) !== ""
      const hasIncident = w.incident_id != null && String(w.incident_id) !== ""
      if (t === "preventive" || t === "preventivo" || (hasPlan && !hasIncident)) {
        planned++
      } else if (t === "corrective" || t === "correctivo" || hasIncident) {
        reactive++
      }
    }
    const totalWithType = planned + reactive
    const plannedRatio = totalWithType > 0 ? (planned / totalWithType) * 100 : 0

    // Maintenance cost this month (from POs)
    const costThisMonth = posThisMonth.reduce(
      (sum: number, po: { actual_amount?: number | null; total_amount?: number | null }) =>
        sum + Number(po.actual_amount ?? po.total_amount ?? 0),
      0
    )
    const costLastMonth = posLastMonth.reduce(
      (sum: number, po: { actual_amount?: number | null; total_amount?: number | null }) =>
        sum + Number(po.actual_amount ?? po.total_amount ?? 0),
      0
    )

    return NextResponse.json({
      pendingApprovals,
      workOrders: {
        pending: woPending,
        completed: woCompleted,
        total: workOrders.length,
      },
      checklistCompliance: {
        rate: Math.round(complianceRate * 10) / 10,
        due: dueSchedules.length,
        completed: completedSchedules.length,
      },
      criticalAlerts,
      backlogAging,
      plannedVsReactive: {
        planned,
        reactive,
        ratio: Math.round(plannedRatio * 10) / 10,
      },
      maintenanceCost: {
        thisMonth: costThisMonth,
        lastMonth: costLastMonth,
      },
    } satisfies ExecutiveKPIs)
  } catch (err) {
    console.error("executive-kpis error:", err)
    return NextResponse.json(buildEmptyKPIs())
  }
}

function buildEmptyKPIs(): ExecutiveKPIs {
  return {
    pendingApprovals: 0,
    workOrders: { pending: 0, completed: 0, total: 0 },
    checklistCompliance: { rate: 100, due: 0, completed: 0 },
    criticalAlerts: [],
    backlogAging: { "0-7": 0, "8-14": 0, "15-30": 0, "31+": 0 },
    plannedVsReactive: { planned: 0, reactive: 0, ratio: 0 },
    maintenanceCost: { thisMonth: 0 },
  }
}
