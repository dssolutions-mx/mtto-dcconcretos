import type { SupabaseClient } from "@supabase/supabase-js"
import {
  filterIncidentsToThread,
  type IncidentThreadRow,
  normalizeIssueCoreItem,
  resolveThreadKey,
} from "@/lib/incidents/incident-thread-utils"

export type { IncidentThreadRow } from "@/lib/incidents/incident-thread-utils"
export { pickThreadFromIncidentList } from "@/lib/incidents/incident-thread-utils"

const THREAD_SELECT =
  "id, asset_id, description, status, date, created_at, work_order_id, type, canonical_issue_key"

/** All incident_history rows for the same asset + checklist core item. */
export async function fetchIncidentThread(
  supabase: SupabaseClient,
  assetId: string,
  description: string,
  storedKey?: string | null,
): Promise<IncidentThreadRow[]> {
  const threadKey = resolveThreadKey(assetId, description, storedKey)

  const { data: byKey, error: keyError } = await supabase
    .from("incident_history")
    .select(THREAD_SELECT)
    .eq("asset_id", assetId)
    .eq("canonical_issue_key", threadKey)
    .neq("status", "Consolidado")
    .order("created_at", { ascending: false })

  if (!keyError && byKey && byKey.length > 0) {
    return byKey as IncidentThreadRow[]
  }

  const { data: allForAsset, error } = await supabase
    .from("incident_history")
    .select(THREAD_SELECT)
    .eq("asset_id", assetId)
    .neq("status", "Consolidado")
    .order("created_at", { ascending: false })

  if (error || !allForAsset) return []
  return filterIncidentsToThread(allForAsset as IncidentThreadRow[], assetId, description, storedKey)
}

export async function fetchIncidentThreadById(
  supabase: SupabaseClient,
  incidentId: string,
): Promise<{ anchor: IncidentThreadRow | null; thread: IncidentThreadRow[] }> {
  const { data: anchor, error } = await supabase
    .from("incident_history")
    .select(THREAD_SELECT)
    .eq("id", incidentId)
    .maybeSingle()

  if (error || !anchor?.asset_id) {
    return { anchor: null, thread: [] }
  }

  const thread = await fetchIncidentThread(
    supabase,
    anchor.asset_id,
    anchor.description ?? "",
    anchor.canonical_issue_key,
  )
  return { anchor: anchor as IncidentThreadRow, thread }
}

export async function attachWorkOrderLabels(
  supabase: SupabaseClient,
  thread: IncidentThreadRow[],
): Promise<IncidentThreadRow[]> {
  const woIds = [
    ...new Set(
      thread.map((t) => t.work_order_id).filter((w): w is string => typeof w === "string"),
    ),
  ]
  const woOrderMap = new Map<string, string>()
  if (woIds.length > 0) {
    const { data: wos } = await supabase
      .from("work_orders")
      .select("id, order_id")
      .in("id", woIds)
    for (const wo of wos ?? []) {
      if (wo.order_id) woOrderMap.set(wo.id, wo.order_id)
    }
  }
  return thread.map((row) => ({
    ...row,
    work_order_order_id: row.work_order_id
      ? woOrderMap.get(row.work_order_id) ?? row.work_order_order_id ?? null
      : null,
    core_item: normalizeIssueCoreItem(row.description),
  }))
}

/** Incidents on the same canonical thread as a work order's linked incident. */
export async function fetchIncidentThreadForWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string,
  incidentId: string | null,
): Promise<IncidentThreadRow[]> {
  if (incidentId) {
    const { thread } = await fetchIncidentThreadById(supabase, incidentId)
    if (thread.length > 0) return thread
  }

  const { data: linked } = await supabase
    .from("incident_history")
    .select(THREAD_SELECT)
    .eq("work_order_id", workOrderId)
    .neq("status", "Consolidado")
    .order("created_at", { ascending: false })

  if (!linked?.length) return []
  const first = linked[0] as IncidentThreadRow
  if (!first.asset_id) return linked as IncidentThreadRow[]
  return fetchIncidentThread(
    supabase,
    first.asset_id,
    first.description ?? "",
    first.canonical_issue_key,
  )
}
