import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { loadActorContext, canAccessRHReporting } from "@/lib/auth/server-authorization"
import { getUTCToday } from "@/lib/utils/date-utils"
import type {
  ChecklistDosificadorViewPayload,
  ChecklistDosificadorViewPlant,
  ChecklistDosificadorViewRow,
} from "@/types/checklist-dosificador-view"

const MAX_RANGE_DAYS = 90
const ASSET_CHUNK = 200

function formatUTCDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

function parseUTCDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null
  return dt
}

function addUTCDays(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days))
}

function utcDayKeyFromIso(iso: string): string {
  return formatUTCDateKey(new Date(iso))
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
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

function buildCompletedByLabel(technician: string, registrarName: string | null): string {
  const t = (technician ?? "").trim()
  const r = (registrarName ?? "").trim()
  if (!t && !r) return "—"
  if (!t) return r
  if (!r || r.toLowerCase() === t.toLowerCase()) return t
  return `${t} · Registro: ${r}`
}

export async function GET(request: NextRequest) {
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
    if (!actor || !canAccessRHReporting(actor)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const businessUnit = searchParams.get("business_unit")
    const plant = searchParams.get("plant")

    let fromKey = searchParams.get("from")?.trim() ?? ""
    let toKey = searchParams.get("to")?.trim() ?? ""

    const today = getUTCToday()
    if (!toKey) toKey = formatUTCDateKey(today)
    if (!fromKey) fromKey = formatUTCDateKey(addUTCDays(today, -13))

    const fromDate = parseUTCDateKey(fromKey)
    const toDate = parseUTCDateKey(toKey)
    if (!fromDate || !toDate) {
      return NextResponse.json({ error: "Invalid from or to (use YYYY-MM-DD UTC)" }, { status: 400 })
    }
    if (fromDate.getTime() > toDate.getTime()) {
      return NextResponse.json({ error: "from must be on or before to" }, { status: 400 })
    }
    const spanDays = Math.floor((toDate.getTime() - fromDate.getTime()) / (86400000)) + 1
    if (spanDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Date range must be at most ${MAX_RANGE_DAYS} days` },
        { status: 400 }
      )
    }

    let assetsQuery = supabase
      .from("assets")
      .select(
        `
        id,
        name,
        asset_id,
        plant_id,
        plants (
          id,
          name,
          business_unit_id,
          business_units (
            id,
            name
          )
        )
      `
      )
      .eq("status", "operational")

    if (businessUnit && businessUnit !== "all") {
      assetsQuery = assetsQuery.eq("plants.business_unit_id", businessUnit)
    }
    if (plant && plant !== "all") {
      assetsQuery = assetsQuery.eq("plant_id", plant)
    }

    const { data: allAssets, error: assetsError } = await assetsQuery
    if (assetsError) {
      console.error("[checklist-dosificador-view] assets", assetsError)
      return NextResponse.json({ error: "Error fetching assets" }, { status: 500 })
    }

    const assetsList = allAssets ?? []
    if (assetsList.length === 0) {
      const empty: ChecklistDosificadorViewPayload = { fromKey, toKey, plants: [] }
      return NextResponse.json(empty)
    }

    const assetIds = assetsList.map((a) => a.id)
    const assetById = new Map(
      assetsList.map((a) => {
        const pl = Array.isArray(a.plants) ? a.plants[0] : a.plants
        const bu = pl?.business_units
          ? Array.isArray(pl.business_units)
            ? pl.business_units[0]
            : pl.business_units
          : null
        return [
          a.id,
          {
            plantId: pl?.id ?? "",
            plantName: pl?.name ?? "—",
            businessUnitName: bu?.name ?? "—",
            assetCode: a.asset_id,
            assetName: a.name,
          },
        ] as const
      })
    )

    const plantIds = [...new Set(assetsList.map((a) => a.plant_id).filter(Boolean))] as string[]

    type ScheduleRow = {
      id: string
      asset_id: string | null
      template_id: string | null
      scheduled_day: string
      status: string | null
      checklists?: unknown
    }

    const schedulesAccum: ScheduleRow[] = []
    for (const idChunk of chunkArray(assetIds, ASSET_CHUNK)) {
      const { data: raw, error: schedError } = await supabase
        .from("checklist_schedules")
        .select(
          `
          id,
          asset_id,
          template_id,
          scheduled_day,
          status,
          checklists!template_id ( id, name, frequency )
        `
        )
        .in("asset_id", idChunk)
        .gte("scheduled_day", fromKey)
        .lte("scheduled_day", toKey)

      if (schedError) {
        console.error("[checklist-dosificador-view] schedules", schedError)
        return NextResponse.json({ error: "Error fetching schedules" }, { status: 500 })
      }
      for (const row of raw ?? []) {
        const cl = normalizeChecklist(row as ScheduleRow)
        if (!cl || (cl.frequency ?? "").toLowerCase() !== "diario") continue
        schedulesAccum.push(row as ScheduleRow)
      }
    }

    if (schedulesAccum.length === 0) {
      const empty: ChecklistDosificadorViewPayload = { fromKey, toKey, plants: [] }
      return NextResponse.json(empty)
    }

    const completionStart = `${fromKey}T00:00:00.000Z`
    const toExclusive = formatUTCDateKey(addUTCDays(toDate, 1))
    const completionEndExclusive = `${toExclusive}T00:00:00.000Z`

    const { data: completionsRaw, error: compErr } = await supabase
      .from("completed_checklists")
      .select("id, asset_id, checklist_id, completion_date, technician, created_by")
      .in("asset_id", assetIds)
      .gte("completion_date", completionStart)
      .lt("completion_date", completionEndExclusive)

    if (compErr) {
      console.error("[checklist-dosificador-view] completed_checklists", compErr)
      return NextResponse.json({ error: "Error fetching completions" }, { status: 500 })
    }

    type CompletionRow = {
      id: string
      asset_id: string | null
      checklist_id: string | null
      completion_date: string
      technician: string
      created_by: string | null
    }

    const completionMap = new Map<string, CompletionRow>()
    for (const c of completionsRaw ?? []) {
      const row = c as CompletionRow
      if (!row.asset_id || !row.checklist_id) continue
      const dayKey = utcDayKeyFromIso(row.completion_date)
      const mapKey = `${row.asset_id}|${row.checklist_id}|${dayKey}`
      const prev = completionMap.get(mapKey)
      if (!prev || new Date(row.completion_date).getTime() > new Date(prev.completion_date).getTime()) {
        completionMap.set(mapKey, row)
      }
    }

    const registrarIds = [...new Set([...completionMap.values()].map((v) => v.created_by).filter(Boolean))] as string[]
    const registrarById = new Map<string, string>()
    if (registrarIds.length > 0) {
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, nombre, apellido")
        .in("id", registrarIds)
      if (!pErr && profs) {
        for (const p of profs) {
          registrarById.set(p.id, `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim())
        }
      }
    }

    const operatorByAsset = new Map<string, string>()
    if (plantIds.length > 0) {
      const { data: operatorRows, error: opErr } = await supabase
        .from("asset_operators_full")
        .select("asset_uuid, assignment_type, operator_nombre, operator_apellido, asset_plant_id")
        .eq("status", "active")
        .in("asset_plant_id", plantIds)

      if (opErr) {
        console.error("[checklist-dosificador-view] asset_operators_full", opErr)
      } else {
        const byAssetOp = new Map<string, typeof operatorRows>()
        for (const r of operatorRows ?? []) {
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
      }
    }

    type BuiltRow = ChecklistDosificadorViewRow & {
      _plantId: string
      _plantName: string
      _businessUnitName: string
      _dayKey: string
      _sortCode: string
    }

    const built: BuiltRow[] = []

    for (const s of schedulesAccum) {
      const aid = s.asset_id
      if (!aid || !s.template_id) continue
      const meta = assetById.get(aid)
      if (!meta) continue

      const cl = normalizeChecklist(s)
      const checklistName = cl?.name ?? null
      const dayKey = s.scheduled_day?.split("T")[0] ?? ""
      if (!dayKey) continue

      const done = isCompletedStatus(s.status)
      const mapKey = `${aid}|${s.template_id}|${dayKey}`
      const comp = done ? completionMap.get(mapKey) : undefined

      let completedByLabel: string | null = null
      let completionTime: string | null = null
      if (done) {
        if (comp) {
          completionTime = comp.completion_date
          const regName = comp.created_by ? registrarById.get(comp.created_by) ?? null : null
          completedByLabel = buildCompletedByLabel(comp.technician, regName)
        } else {
          completedByLabel = "Completado (sin registro coincidente)"
        }
      }

      built.push({
        scheduleId: s.id,
        assetId: aid,
        assetCode: meta.assetCode,
        assetName: meta.assetName,
        operatorName: operatorByAsset.get(aid) ?? null,
        checklistName,
        readiness: done ? "listo" : "pendiente",
        completedByLabel,
        completionTime,
        _plantId: meta.plantId,
        _plantName: meta.plantName,
        _businessUnitName: meta.businessUnitName,
        _dayKey: dayKey,
        _sortCode: (meta.assetCode ?? "").toString(),
      })
    }

    const plantMap = new Map<
      string,
      { plantId: string; plantName: string; businessUnitName: string; dayMap: Map<string, BuiltRow[]> }
    >()

    for (const row of built) {
      if (!plantMap.has(row._plantId)) {
        plantMap.set(row._plantId, {
          plantId: row._plantId,
          plantName: row._plantName,
          businessUnitName: row._businessUnitName,
          dayMap: new Map(),
        })
      }
      const pEntry = plantMap.get(row._plantId)!
      if (!pEntry.dayMap.has(row._dayKey)) pEntry.dayMap.set(row._dayKey, [])
      pEntry.dayMap.get(row._dayKey)!.push(row)
    }

    const plantsOut: ChecklistDosificadorViewPlant[] = []

    for (const p of plantMap.values()) {
      const days = [...p.dayMap.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
        .map(([dayKey, rows]) => {
          const sorted = [...rows].sort((a, b) => a._sortCode.localeCompare(b._sortCode, "es"))
          const stripped = sorted.map(
            ({
              scheduleId,
              assetId,
              assetCode,
              assetName,
              operatorName,
              checklistName,
              readiness,
              completedByLabel,
              completionTime,
            }) => ({
              scheduleId,
              assetId,
              assetCode,
              assetName,
              operatorName,
              checklistName,
              readiness,
              completedByLabel,
              completionTime,
            })
          )
          const completed = stripped.filter((r) => r.readiness === "listo").length
          const pending = stripped.filter((r) => r.readiness === "pendiente").length
          return {
            dayKey,
            summary: { total: stripped.length, completed, pending },
            rows: stripped,
          }
        })

      plantsOut.push({
        plantId: p.plantId,
        plantName: p.plantName,
        businessUnitName: p.businessUnitName,
        days,
      })
    }

    plantsOut.sort((a, b) => a.plantName.localeCompare(b.plantName, "es"))

    const payload: ChecklistDosificadorViewPayload = { fromKey, toKey, plants: plantsOut }
    return NextResponse.json(payload)
  } catch (e) {
    console.error("[checklist-dosificador-view]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
