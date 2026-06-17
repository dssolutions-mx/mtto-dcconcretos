import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import { isDepartmentMember } from "@/lib/departments/department-membership"
import type { IncidentPipelineStage } from "@/lib/incidents/incident-routing"
import {
  resolveCanonicalRoutingDepartments,
  type CanonicalRoutingDepartmentSlug,
  type DbDepartmentRow,
  type ResolvedCanonicalDepartment,
} from "@/lib/incidents/incident-routing-departments"

const MAX_BATCH = 100

type BulkAssignBody = {
  incident_ids?: string[]
  canonical?: CanonicalRoutingDepartmentSlug
  routing_department_id?: string
  assigned_to_id?: string | null
  pipeline_stage?: IncidentPipelineStage
  reason?: string
}

function resolveDepartmentForPlant(
  bucket: ResolvedCanonicalDepartment,
  departments: DbDepartmentRow[],
  plantId: string | null,
): string | null {
  if (!plantId) return bucket.primaryDepartmentId
  const match = departments.find(
    (d) => bucket.departmentIds.includes(d.id) && d.plant_id === plantId,
  )
  return match?.id ?? bucket.primaryDepartmentId
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BulkAssignBody
    const incidentIds = [...new Set(body.incident_ids ?? [])].slice(0, MAX_BATCH)

    if (incidentIds.length === 0) {
      return NextResponse.json({ error: "incident_ids requerido" }, { status: 400 })
    }

    if (!body.canonical && !body.routing_department_id && body.assigned_to_id === undefined) {
      return NextResponse.json(
        { error: "canonical, routing_department_id o assigned_to_id requerido" },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: departments, error: deptError } = await supabase
      .from("departments")
      .select("id, name, code, plant_id")

    if (deptError) {
      return NextResponse.json({ error: deptError.message }, { status: 500 })
    }

    const canonicalBuckets = resolveCanonicalRoutingDepartments(departments ?? [])
    let targetBucket: ResolvedCanonicalDepartment | undefined
    let fixedDepartmentId: string | null = body.routing_department_id ?? null

    if (body.canonical) {
      targetBucket = canonicalBuckets.find((b) => b.slug === body.canonical)
      if (!targetBucket?.departmentIds.length) {
        return NextResponse.json(
          { error: `Departamento canónico "${body.canonical}" no está mapeado en la BD` },
          { status: 400 },
        )
      }
    }

    const { data: incidents, error: incError } = await supabase
      .from("incident_history")
      .select(
        "id, routing_department_id, assigned_to_id, pipeline_stage, routing_rule_id, asset_id, target_response_hours",
      )
      .in("id", incidentIds)

    if (incError) {
      return NextResponse.json({ error: incError.message }, { status: 500 })
    }

    const assetIds = [
      ...new Set((incidents ?? []).map((i) => i.asset_id).filter(Boolean)),
    ] as string[]

    const plantByAsset = new Map<string, string>()
    if (assetIds.length > 0) {
      const { data: assets } = await supabase
        .from("assets")
        .select("id, plant_id")
        .in("id", assetIds)
      for (const asset of assets ?? []) {
        if (asset.plant_id) plantByAsset.set(asset.id, asset.plant_id)
      }
    }

    const now = new Date().toISOString()
    const results: { id: string; ok: boolean; department_id?: string; error?: string }[] = []
    let learningRecorded = 0

    for (const incident of incidents ?? []) {
      const plantId = incident.asset_id
        ? plantByAsset.get(incident.asset_id) ?? null
        : null

      const departmentId =
        fixedDepartmentId ??
        (targetBucket
          ? resolveDepartmentForPlant(targetBucket, departments ?? [], plantId)
          : null) ??
        incident.routing_department_id

      if (!departmentId && body.assigned_to_id === undefined) {
        results.push({ id: incident.id, ok: false, error: "Sin departamento destino" })
        continue
      }

      const resolvedDeptId = departmentId ?? incident.routing_department_id

      if (body.assigned_to_id && resolvedDeptId && plantId) {
        const ok = await isDepartmentMember(supabase, {
          userId: body.assigned_to_id,
          plantId,
          departmentId: resolvedDeptId,
        })
        if (!ok) {
          results.push({
            id: incident.id,
            ok: false,
            error: "El responsable no pertenece al departamento",
          })
          continue
        }
      }

      const updates: Record<string, unknown> = {
        updated_at: now,
      }

      if (resolvedDeptId && (body.canonical || body.routing_department_id)) {
        updates.routing_department_id = resolvedDeptId
        updates.pipeline_stage = body.pipeline_stage ?? "bandeja"
        if (!incident.routing_department_id) {
          updates.routed_at = now
        }
      } else if (body.pipeline_stage) {
        updates.pipeline_stage = body.pipeline_stage
      }

      if (body.assigned_to_id !== undefined) {
        updates.assigned_to_id = body.assigned_to_id || null
        updates.assigned_at = body.assigned_to_id ? now : null
        if (body.assigned_to_id && !body.pipeline_stage) {
          const stage = incident.pipeline_stage as IncidentPipelineStage
          if (stage === "bandeja") updates.pipeline_stage = "asignado"
        }
      }

      if (resolvedDeptId && incident.target_response_hours == null) {
        updates.target_response_hours = 48
      }

      const { error: updateError } = await supabase
        .from("incident_history")
        .update(updates)
        .eq("id", incident.id)

      if (updateError) {
        results.push({ id: incident.id, ok: false, error: updateError.message })
        continue
      }

      await supabase.from("incident_assignment_log").insert({
        incident_id: incident.id,
        from_department_id: incident.routing_department_id,
        to_department_id: resolvedDeptId ?? incident.routing_department_id,
        from_assignee_id: incident.assigned_to_id,
        to_assignee_id:
          body.assigned_to_id !== undefined
            ? body.assigned_to_id
            : incident.assigned_to_id,
        from_pipeline_stage: incident.pipeline_stage,
        to_pipeline_stage:
          (updates.pipeline_stage as string | undefined) ?? incident.pipeline_stage,
        reason: body.reason?.trim() || "Clasificación masiva",
        changed_by: user?.id ?? null,
      })

      if (
        resolvedDeptId &&
        resolvedDeptId !== incident.routing_department_id
      ) {
        const { error: learnError } = await supabase.rpc("record_incident_routing_signal", {
          p_incident_id: incident.id,
          p_chosen_department_id: resolvedDeptId,
          p_chosen_assignee_id:
            body.assigned_to_id !== undefined
              ? body.assigned_to_id
              : incident.assigned_to_id,
          p_previous_department_id: incident.routing_department_id,
          p_previous_rule_id: incident.routing_rule_id,
          p_created_by: user?.id ?? null,
        })
        if (!learnError) learningRecorded += 1
      }

      results.push({
        id: incident.id,
        ok: true,
        department_id: resolvedDeptId ?? undefined,
      })
    }

    const processedIds = new Set(results.map((r) => r.id))
    for (const id of incidentIds) {
      if (!processedIds.has(id)) {
        results.push({ id, ok: false, error: "Incidente no encontrado" })
      }
    }

    const succeeded = results.filter((r) => r.ok).length
    const failed = results.length - succeeded

    return NextResponse.json({
      succeeded,
      failed,
      learning_recorded: learningRecorded,
      results,
    })
  } catch (err) {
    console.error("POST bulk assign error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
