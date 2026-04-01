import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getUTCToday } from "@/lib/utils/date-utils"
import type { PlantAssetOption, PlantDailyReadinessPayload, PlantDailyReadinessRow } from "@/types/plant-daily-readiness"

function formatUTCDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

function normalizeChecklist(row: { checklists?: unknown }) {
  const c = row.checklists
  if (Array.isArray(c)) return c[0] ?? null
  return c as { id?: string; name?: string | null; frequency?: string | null } | null
}

function isCompletedStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase()
  return s === "completado" || s === "completed"
}

/**
 * Plant-scoped daily checklist readiness (UTC dates).
 * DOSIFICADOR: operational loading decisions; JEFE_PLANTA: same plant supervision view.
 */
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, plant_id, nombre, apellido")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (profile.role !== "DOSIFICADOR" && profile.role !== "JEFE_PLANTA") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!profile.plant_id) {
      return NextResponse.json(
        { error: "Tu perfil no tiene planta asignada. Contacta a tu supervisor." },
        { status: 403 }
      )
    }

    const plantId = profile.plant_id
    const todayKey = formatUTCDateKey(getUTCToday())

    const { data: plantAssets, error: assetsError } = await supabase
      .from("assets")
      .select("id, name, asset_id")
      .eq("plant_id", plantId)
      .eq("status", "operational")

    if (assetsError) {
      console.error("[plant-daily-readiness] assets", assetsError)
      return NextResponse.json({ error: assetsError.message }, { status: 500 })
    }

    const assetsList = plantAssets ?? []
    const assetIds = assetsList.map((a) => a.id)
    const assetById = new Map(assetsList.map((a) => [a.id, a]))

    const assetsForIncidents: PlantAssetOption[] = assetsList.map((a) => ({
      id: a.id,
      name: a.name,
      asset_id: a.asset_id,
    }))

    if (assetIds.length === 0) {
      const empty: PlantDailyReadinessPayload = {
        todayKey,
        plantId,
        rows: [],
        pendingCount: 0,
        readyCount: 0,
        assetsForIncidents,
      }
      return NextResponse.json({ data: empty })
    }

    const { data: rawSchedules, error: schedError } = await supabase
      .from("checklist_schedules")
      .select(
        `
        id,
        asset_id,
        status,
        scheduled_day,
        scheduled_date,
        template_id,
        checklists!template_id ( id, name, frequency )
      `
      )
      .in("asset_id", assetIds)
      .lte("scheduled_day", todayKey)

    if (schedError) {
      console.error("[plant-daily-readiness] schedules", schedError)
      return NextResponse.json({ error: schedError.message }, { status: 500 })
    }

    const schedules = (rawSchedules ?? []).filter((row) => {
      const cl = normalizeChecklist(row)
      if (!cl || cl.frequency !== "diario") return false
      const day = row.scheduled_day || (row.scheduled_date ? String(row.scheduled_date).split("T")[0] : "")
      if (!day) return false
      if (day === todayKey) return true
      if (day < todayKey && !isCompletedStatus(row.status)) return true
      return false
    })

    const byAsset = new Map<string, typeof schedules>()
    for (const s of schedules) {
      const aid = s.asset_id
      if (!aid) continue
      if (!byAsset.has(aid)) byAsset.set(aid, [])
      byAsset.get(aid)!.push(s)
    }

    const { data: operatorRows, error: opErr } = await supabase
      .from("asset_operators_full")
      .select("asset_uuid, assignment_type, operator_nombre, operator_apellido")
      .eq("status", "active")
      .eq("asset_plant_id", plantId)

    if (opErr) {
      console.error("[plant-daily-readiness] asset_operators_full", opErr)
    }

    const operatorByAsset = new Map<string, string>()
    const rows = operatorRows ?? []
    const byAssetOp = new Map<string, typeof rows>()
    for (const r of rows) {
      const uuid = r.asset_uuid
      if (!uuid) continue
      if (!byAssetOp.has(uuid)) byAssetOp.set(uuid, [])
      byAssetOp.get(uuid)!.push(r)
    }
    for (const [aid, list] of byAssetOp) {
      const primary = list.find((x) => (x.assignment_type ?? "").toLowerCase() === "primary")
      const pick = primary ?? list[0]
      if (pick) {
        const name = `${pick.operator_nombre ?? ""} ${pick.operator_apellido ?? ""}`.trim()
        operatorByAsset.set(aid, name || "—")
      }
    }

    const resultRows: PlantDailyReadinessRow[] = []

    for (const [assetId, list] of byAsset) {
      const asset = assetById.get(assetId)
      if (!asset) continue
      const allDone = list.length > 0 && list.every((r) => isCompletedStatus(r.status))
      const firstPending = list.find((r) => !isCompletedStatus(r.status))
      const checklistName = normalizeChecklist(list[0] ?? {})?.name ?? null

      resultRows.push({
        assetId,
        assetCode: asset.asset_id,
        assetName: asset.name,
        operatorName: operatorByAsset.get(assetId) ?? null,
        readiness: allDone ? "listo" : "pendiente",
        pendingScheduleId: firstPending?.id ?? null,
        checklistName,
      })
    }

    resultRows.sort((a, b) => (a.assetCode ?? "").localeCompare(b.assetCode ?? "", "es"))

    const pendingCount = resultRows.filter((r) => r.readiness === "pendiente").length
    const readyCount = resultRows.filter((r) => r.readiness === "listo").length

    return NextResponse.json({
      data: {
        todayKey,
        plantId,
        rows: resultRows,
        pendingCount,
        readyCount,
        assetsForIncidents,
      },
    })
  } catch (e) {
    console.error("[plant-daily-readiness]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
