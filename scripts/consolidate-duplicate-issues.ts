/**
 * Merge duplicate open incidents / work orders sharing the same canonical issue key.
 * Only consolidates groups with Pendiente work orders — never reopens Completada WOs.
 *
 * Run:
 *   npx tsx scripts/consolidate-duplicate-issues.ts
 *   npx tsx scripts/consolidate-duplicate-issues.ts --apply
 */

import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const apply = process.argv.includes("--apply")

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

type DuplicateGroup = {
  asset_id: string
  canonical_issue_key: string
  incident_ids: string[]
  work_order_ids: string[]
  canonical_wo_id: string
  canonical_incident_id: string
}

async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
  const { data: openIncidents, error: incError } = await supabase
    .from("incident_history")
    .select("id, asset_id, canonical_issue_key, work_order_id, status, created_at")
    .in("status", ["Abierto", "Pendiente", "En progreso"])
    .not("canonical_issue_key", "is", null)

  if (incError) throw incError

  const { data: pendingWos, error: woError } = await supabase
    .from("work_orders")
    .select("id, status")
    .eq("status", "Pendiente")

  if (woError) throw woError

  const pendingWoSet = new Set((pendingWos ?? []).map((w) => w.id))
  const groups = new Map<string, typeof openIncidents>()

  for (const inc of openIncidents ?? []) {
    if (!inc.asset_id || !inc.canonical_issue_key) continue
    if (inc.work_order_id && !pendingWoSet.has(inc.work_order_id)) continue
    const key = `${inc.asset_id}::${inc.canonical_issue_key}`
    const list = groups.get(key) ?? []
    list.push(inc)
    groups.set(key, list)
  }

  const duplicates: DuplicateGroup[] = []

  for (const [, incidents] of groups) {
    if (incidents.length < 2) continue

    const withWo = incidents.filter((i) => i.work_order_id)
    const uniqueWos = [...new Set(withWo.map((i) => i.work_order_id!))]
    if (uniqueWos.length < 2 && incidents.length < 2) continue

    const sorted = [...incidents].sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
    )
    const canonical = sorted.find((i) => i.work_order_id && pendingWoSet.has(i.work_order_id)) ?? sorted[0]

    duplicates.push({
      asset_id: canonical.asset_id!,
      canonical_issue_key: canonical.canonical_issue_key!,
      incident_ids: incidents.map((i) => i.id),
      work_order_ids: uniqueWos,
      canonical_wo_id: canonical.work_order_id ?? uniqueWos[0] ?? "",
      canonical_incident_id: canonical.id,
    })
  }

  return duplicates
}

async function mergeGroup(group: DuplicateGroup): Promise<void> {
  const extras = group.incident_ids.filter((id) => id !== group.canonical_incident_id)
  const extraWos = group.work_order_ids.filter((id) => id !== group.canonical_wo_id)

  if (extras.length === 0 && extraWos.length === 0) return

  if (extras.length > 0) {
    const { error } = await supabase
      .from("incident_history")
      .update({
        status: "Consolidado",
        merged_into_id: group.canonical_incident_id,
        work_order_id: group.canonical_wo_id || null,
        updated_at: new Date().toISOString(),
      })
      .in("id", extras)

    if (error) throw error
  }

  if (group.canonical_wo_id) {
    const { error: ciError } = await supabase
      .from("checklist_issues")
      .update({ work_order_id: group.canonical_wo_id })
      .in(
        "incident_id",
        group.incident_ids,
      )

    if (ciError) console.warn("checklist_issues relink:", ciError.message)
  }

  for (const woId of extraWos) {
    const { error } = await supabase
      .from("work_orders")
      .update({
        status: "Cancelada",
        description: `[CONSOLIDADA] Duplicado absorbido en OT canónica`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", woId)
      .eq("status", "Pendiente")

    if (error) console.warn(`WO ${woId} cancel:`, error.message)
  }
}

async function main() {
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}\n`)

  const groups = await findDuplicateGroups()
  console.log(`Found ${groups.length} duplicate open issue groups\n`)

  let mergedIncidents = 0
  let cancelledWos = 0

  for (const group of groups) {
    const extraIncidents = group.incident_ids.length - 1
    const extraWos = group.work_order_ids.length - (group.canonical_wo_id ? 1 : 0)
    mergedIncidents += extraIncidents
    cancelledWos += extraWos

    console.log(`• ${group.canonical_issue_key.split("_").slice(1).join("_")}`)
    console.log(`  incidents: ${group.incident_ids.length}, WOs: ${group.work_order_ids.length}`)
    console.log(`  keep incident ${group.canonical_incident_id}, WO ${group.canonical_wo_id || "—"}`)

    if (apply) {
      await mergeGroup(group)
      console.log("  ✓ merged")
    }
  }

  console.log(`\nSummary: ${mergedIncidents} incidents to consolidate, ${cancelledWos} redundant Pendiente WOs`)
  if (!apply) console.log("\nRe-run with --apply to execute merges.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
