import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import { getUserDepartmentIds } from "@/lib/departments/department-membership"
import {
  hoursSince,
  isSlaBreached,
  type IncidentPipelineStage,
} from "@/lib/incidents/incident-routing"
import {
  matchDepartmentToCanonical,
  resolveCanonicalRoutingDepartments,
  type CanonicalRoutingDepartmentSlug,
} from "@/lib/incidents/incident-routing-departments"

const OPEN_STATUSES = ["Abierto", "Pendiente", "En progreso", "open", "pending", "in progress"]

const INCIDENT_SELECT = `
  id,
  description,
  type,
  status,
  impact,
  date,
  created_at,
  asset_id,
  routing_department_id,
  assigned_to_id,
  pipeline_stage,
  target_response_hours,
  routed_at,
  assigned_at,
  acknowledged_at,
  assets ( id, name, asset_id ),
  departments:routing_department_id ( id, name, code )
`

async function enrichRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Record<string, unknown>[],
) {
  const assigneeIds = [
    ...new Set(rows.map((row) => row.assigned_to_id).filter(Boolean)),
  ] as string[]

  const assigneeMap = new Map<string, string>()
  if (assigneeIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nombre, apellido")
      .in("id", assigneeIds)

    for (const profile of profiles ?? []) {
      assigneeMap.set(
        profile.id,
        `${profile.nombre ?? ""} ${profile.apellido ?? ""}`.trim() || "Sin nombre",
      )
    }
  }

  return rows.map((row) => {
    const assets = row.assets as { name?: string; asset_id?: string } | null
    const departments = row.departments as { name?: string; code?: string } | null
    const routedAt = row.routed_at as string | null
    const targetHours = row.target_response_hours as number | null
    const status = row.status as string | null
    const slug = departments
      ? matchDepartmentToCanonical({
          name: departments.name ?? "",
          code: departments.code ?? "",
        })
      : null

    return {
      ...row,
      asset_display_name: assets?.name ?? "Activo no encontrado",
      asset_code: assets?.asset_id ?? "N/A",
      department_name: departments?.name ?? null,
      canonical_department_slug: slug,
      assignee_name: row.assigned_to_id
        ? assigneeMap.get(row.assigned_to_id as string) ?? null
        : null,
      hours_since_routed: hoursSince(routedAt),
      sla_breached: isSlaBreached(routedAt, targetHours, status),
    }
  })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const summaryOnly = searchParams.get("summary") === "true"
    const departmentId = searchParams.get("department_id")
    const canonicalSlug = searchParams.get("canonical") as CanonicalRoutingDepartmentSlug | null
    const assigneeIdParam = searchParams.get("assignee_id")
    const inboxMine = searchParams.get("inbox") === "mine"
    const unassignedOnly = searchParams.get("unassigned") === "true"
    const stage = searchParams.get("stage")
    const unroutedOnly = searchParams.get("unrouted") === "true"
    const search = searchParams.get("search")?.trim()
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "50"), 1), 200)
    const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0)

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: allDepartments } = await supabase
      .from("departments")
      .select("id, name, code, plant_id, plants(name, code)")

    const canonicalBuckets = resolveCanonicalRoutingDepartments(allDepartments ?? [])

    let departmentFilterIds: string[] | null = null
    if (canonicalSlug) {
      const bucket = canonicalBuckets.find((b) => b.slug === canonicalSlug)
      departmentFilterIds = bucket?.departmentIds.length ? bucket.departmentIds : ["__none__"]
    } else if (departmentId) {
      departmentFilterIds = [departmentId]
    }

    if (summaryOnly) {
      const { data: openIncidents, error } = await supabase
        .from("incident_history")
        .select("id, routing_department_id, pipeline_stage, routed_at, target_response_hours, status, departments:routing_department_id(name, code)")
        .in("status", OPEN_STATUSES)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const byCanonical: Record<CanonicalRoutingDepartmentSlug, number> = {
        mantenimiento: 0,
        operaciones: 0,
        recursos_humanos: 0,
        calidad: 0,
      }
      const byStage: Record<IncidentPipelineStage, number> = {
        bandeja: 0,
        asignado: 0,
        en_atencion: 0,
        esperando: 0,
        cerrado: 0,
      }

      let unrouted = 0
      let slaBreached = 0

      for (const row of openIncidents ?? []) {
        const stageKey = (row.pipeline_stage ?? "bandeja") as IncidentPipelineStage
        if (byStage[stageKey] !== undefined) byStage[stageKey] += 1

        if (!row.routing_department_id) {
          unrouted += 1
          continue
        }

        const dept = row.departments as { name?: string; code?: string } | null
        const slug = dept
          ? matchDepartmentToCanonical({ name: dept.name ?? "", code: dept.code ?? "" })
          : null
        if (slug) byCanonical[slug] += 1

        if (
          isSlaBreached(
            row.routed_at as string | null,
            row.target_response_hours as number | null,
            row.status as string | null,
          )
        ) {
          slaBreached += 1
        }
      }

      return NextResponse.json({
        total_open: openIncidents?.length ?? 0,
        unrouted,
        sla_breached: slaBreached,
        by_canonical_department: byCanonical,
        by_pipeline_stage: byStage,
        canonical_departments: canonicalBuckets,
      })
    }

    let query = supabase
      .from("incident_history")
      .select(INCIDENT_SELECT, { count: "exact" })
      .in("status", OPEN_STATUSES)
      .order("routed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (unroutedOnly) {
      query = query.is("routing_department_id", null)
    } else if (departmentFilterIds) {
      query = query.in("routing_department_id", departmentFilterIds)
    }

    const assigneeId =
      assigneeIdParam === "me" ? user.id : assigneeIdParam

    if (inboxMine) {
      const myDeptIds = await getUserDepartmentIds(supabase, user.id)
      if (myDeptIds.length > 0) {
        const deptList = myDeptIds.join(",")
        query = query.or(
          `assigned_to_id.eq.${user.id},and(assigned_to_id.is.null,routing_department_id.in.(${deptList}))`,
        )
      } else {
        query = query.eq("assigned_to_id", user.id)
      }
    } else if (assigneeId) {
      query = query.eq("assigned_to_id", assigneeId)
    }

    if (unassignedOnly) query = query.is("assigned_to_id", null)
    if (stage) query = query.eq("pipeline_stage", stage)
    if (search) {
      query = query.or(`description.ilike.%${search}%,type.ilike.%${search}%`)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const enriched = await enrichRows(supabase, (data ?? []) as Record<string, unknown>[])

    return NextResponse.json({
      items: enriched,
      total: count ?? enriched.length,
      limit,
      offset,
      canonical_departments: canonicalBuckets,
    })
  } catch (err) {
    console.error("GET routed incidents error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json()) as { incident_ids?: string[] }
    const incidentIds = body.incident_ids ?? []
    if (incidentIds.length === 0) {
      return NextResponse.json({ error: "incident_ids requerido" }, { status: 400 })
    }

    const results: { id: string; ok: boolean; error?: string }[] = []

    for (const incidentId of incidentIds) {
      const { data: before, error: beforeErr } = await supabase
        .from("incident_history")
        .select("routing_department_id")
        .eq("id", incidentId)
        .maybeSingle()

      if (beforeErr || !before) {
        results.push({
          id: incidentId,
          ok: false,
          error: beforeErr?.message ?? "Incidente no encontrado",
        })
        continue
      }

      const { error } = await supabase.rpc("apply_incident_routing", {
        p_incident_id: incidentId,
      })

      if (error) {
        results.push({ id: incidentId, ok: false, error: error.message })
        continue
      }

      const { data: after, error: afterErr } = await supabase
        .from("incident_history")
        .select("routing_department_id")
        .eq("id", incidentId)
        .maybeSingle()

      if (afterErr) {
        results.push({ id: incidentId, ok: false, error: afterErr.message })
        continue
      }

      if (before.routing_department_id) {
        results.push({
          id: incidentId,
          ok: false,
          error: "El incidente ya estaba clasificado",
        })
      } else if (!after?.routing_department_id) {
        results.push({
          id: incidentId,
          ok: false,
          error: "Sin regla coincidente",
        })
      } else {
        results.push({ id: incidentId, ok: true })
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    console.error("POST route incidents error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
