import { createClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import { WorkOrderPrintDocument } from "@/components/work-orders/work-order-print-document"
import { buildOriginData } from "@/lib/work-orders/build-origin-data"
import type { WorkOrderComplete, Profile } from "@/types"
import { WorkOrderStatus } from "@/types"

interface PrintPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function WorkOrderPrintPage({
  params,
}: PrintPageProps) {
  const { id } = await params

  const supabase = await createClient()

  // Fetch work order with related data (includes escalation_count, issue_history via *)
  const { data: workOrder, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      asset:assets (*)
    `)
    .eq("id", id)
    .single()

  // Fetch ALL purchase orders related to this work order (including adjustments)
  const { data: allPurchaseOrders } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("work_order_id", id)
    .order("created_at", { ascending: true })

  if (error || !workOrder) {
    notFound()
  }

  const extendedWorkOrder = workOrder as unknown as WorkOrderComplete
  const isCompleted = extendedWorkOrder.status === WorkOrderStatus.Completed

  // Fetch technician and requester details
  const profiles: Record<string, Profile> = {}

  if (extendedWorkOrder.requested_by) {
    const { data: requester } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", extendedWorkOrder.requested_by)
      .single()

    if (requester) {
      profiles[extendedWorkOrder.requested_by] = requester
    }
  }

  if (extendedWorkOrder.assigned_to) {
    const { data: technician } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", extendedWorkOrder.assigned_to)
      .single()

    if (technician) {
      profiles[extendedWorkOrder.assigned_to] = technician
    }
  }

  // ORIGIN: Fetch incident (if incident_id)
  let incidentCreatedAt: string | null = null
  if (extendedWorkOrder.incident_id) {
    const { data: incident } = await supabase
      .from("incident_history")
      .select("created_at")
      .eq("id", extendedWorkOrder.incident_id)
      .single()
    incidentCreatedAt = incident?.created_at ?? null
  }

  // ORIGIN: Fetch checklist name (corrective) or maintenance plan (preventive)
  let checklistName: string | null = null
  let maintenancePlanName: string | null = null
  let maintenancePlanNextDue: string | null = null
  let maintenancePlanInterval: string | null = null
  let firstIssueDate: string | null = incidentCreatedAt

  if (extendedWorkOrder.checklist_id) {
    const { data: completed } = await supabase
      .from("completed_checklists")
      .select("checklist_id, completion_date")
      .eq("id", extendedWorkOrder.checklist_id)
      .maybeSingle()
    if (completed?.checklist_id) {
      const { data: checklist } = await supabase
        .from("checklists")
        .select("name")
        .eq("id", completed.checklist_id)
        .maybeSingle()
      checklistName = checklist?.name ?? null
      if (!firstIssueDate) firstIssueDate = completed.completion_date ?? null
    }
  }

  if (extendedWorkOrder.maintenance_plan_id) {
    const { data: plan } = await supabase
      .from("maintenance_plans")
      .select("name, next_due, interval_id")
      .eq("id", extendedWorkOrder.maintenance_plan_id)
      .maybeSingle()
    if (plan) {
      maintenancePlanName = plan.name ?? null
      maintenancePlanNextDue = plan.next_due ?? null
      if (plan.interval_id) {
        const { data: interval } = await supabase
          .from("maintenance_intervals")
          .select("interval_value, name")
          .eq("id", plan.interval_id)
          .maybeSingle()
        if (interval) {
          maintenancePlanInterval = `Intervalo ${interval.interval_value ?? interval.name ?? ""}h`
        }
      }
    }
  }

  if (extendedWorkOrder.incident_id && !firstIssueDate) {
    firstIssueDate = incidentCreatedAt
  }

  const originData = buildOriginData({
    workOrder: extendedWorkOrder,
    checklistName,
    maintenancePlanName,
    maintenancePlanNextDue,
    maintenancePlanInterval,
    firstIssueDate,
  })

  // Fetch maintenance history when completed
  let maintenanceHistory: { completed_tasks?: unknown } | null = null
  if (isCompleted && extendedWorkOrder.asset?.id) {
    const { data: historyData } = await supabase
      .from("maintenance_history")
      .select("*")
      .eq("work_order_id", extendedWorkOrder.id)
      .eq("asset_id", extendedWorkOrder.asset.id)
      .single()
    if (historyData) {
      maintenanceHistory = historyData
    }
  }

  // Fetch additional expenses when completed
  let additionalExpenses: any[] = []
  if (isCompleted) {
    const { data: expensesData } = await supabase
      .from("additional_expenses")
      .select("*, adjustment_po:purchase_orders(*)")
      .eq("work_order_id", id)
    if (expensesData && expensesData.length > 0) {
      additionalExpenses = expensesData
    }
  }

  // Parse required parts
  const originalRequiredParts = extendedWorkOrder.required_parts
    ? typeof extendedWorkOrder.required_parts === "string"
      ? JSON.parse(extendedWorkOrder.required_parts)
      : extendedWorkOrder.required_parts
    : []

  const sanitizedRequiredParts = originalRequiredParts.map((part: any) => ({
    ...part,
    quantity: Number(part.quantity) || 1,
    unit_price: Number(part.unit_price) || 0,
    total_price:
      Number(part.total_price) ||
      (Number(part.quantity) || 1) * (Number(part.unit_price) || 0),
  }))

  // Use PO items if available, otherwise required parts
  let displayParts = sanitizedRequiredParts
  if (allPurchaseOrders && allPurchaseOrders.length > 0) {
    const mainPO = allPurchaseOrders.find((po: any) => !po.is_adjustment)
    if (mainPO?.items) {
      const poItems =
        typeof mainPO.items === "string" ? JSON.parse(mainPO.items) : mainPO.items
      if (Array.isArray(poItems) && poItems.length > 0) {
        displayParts = poItems.map((item: any) => {
          const quantity = Number(item.quantity) || 1
          const unitPrice = Number(item.unit_price || item.price || 0)
          const totalPrice = Number(item.total_price) || quantity * unitPrice
          return {
            name: item.name || item.description || item.item,
            partNumber: item.part_number || item.code || "N/A",
            quantity,
            unit_price: unitPrice,
            total_price: totalPrice,
          }
        })
      }
    }
  }

  const totalPartsCost =
    displayParts.length > 0
      ? displayParts.reduce(
          (total: number, part: any) => total + (Number(part.total_price) || 0),
          0
        )
      : 0

  // Parse required tasks
  const requiredTasks = extendedWorkOrder.required_tasks
    ? typeof extendedWorkOrder.required_tasks === "string"
      ? JSON.parse(extendedWorkOrder.required_tasks)
      : extendedWorkOrder.required_tasks
    : []

  // Parse evidence photos
  type EvidenceItem = { url: string; caption?: string }
  const creationPhotos: EvidenceItem[] = extendedWorkOrder.creation_photos
    ? typeof extendedWorkOrder.creation_photos === "string"
      ? JSON.parse(extendedWorkOrder.creation_photos)
      : extendedWorkOrder.creation_photos
    : []
  const completionPhotos: EvidenceItem[] = extendedWorkOrder.completion_photos
    ? typeof extendedWorkOrder.completion_photos === "string"
      ? JSON.parse(extendedWorkOrder.completion_photos)
      : extendedWorkOrder.completion_photos
    : []
  const progressPhotos: EvidenceItem[] = extendedWorkOrder.progress_photos
    ? typeof extendedWorkOrder.progress_photos === "string"
      ? JSON.parse(extendedWorkOrder.progress_photos)
      : extendedWorkOrder.progress_photos
    : []
  const allEvidence: Array<{ url: string; caption?: string; phase: string }> = [
    ...creationPhotos.map((p) => ({ ...p, phase: "Inicio" })),
    ...progressPhotos.map((p) => ({ ...p, phase: "Progreso" })),
    ...completionPhotos.map((p) => ({ ...p, phase: "Cierre" })),
  ]

  // Parse issue_history for recurrence
  const issueHistory = extendedWorkOrder.issue_history
    ? typeof extendedWorkOrder.issue_history === "string"
      ? JSON.parse(extendedWorkOrder.issue_history)
      : extendedWorkOrder.issue_history
    : []

  return (
    <WorkOrderPrintDocument
      workOrder={extendedWorkOrder}
      asset={extendedWorkOrder.asset}
      purchaseOrders={allPurchaseOrders || []}
      profiles={profiles}
      requiredParts={displayParts}
      totalPartsCost={totalPartsCost}
      requiredTasks={requiredTasks}
      originData={originData}
      evidence={allEvidence}
      issueHistory={Array.isArray(issueHistory) ? issueHistory : []}
      maintenanceHistory={maintenanceHistory}
      additionalExpenses={additionalExpenses}
      schedule={{
        plannedDate: extendedWorkOrder.planned_date,
        nextDue: maintenancePlanNextDue,
        isPreventive:
          extendedWorkOrder.type === "Preventivo" ||
          extendedWorkOrder.type === "preventive" ||
          extendedWorkOrder.type === "Preventive",
      }}
    />
  )
}

