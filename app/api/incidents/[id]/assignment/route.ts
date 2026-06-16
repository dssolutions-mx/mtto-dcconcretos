import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import {
  INCIDENT_PIPELINE_STAGES,
  type IncidentAssignmentInput,
  type IncidentPipelineStage,
} from "@/lib/incidents/incident-routing"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await req.json()) as IncidentAssignmentInput

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: current, error: fetchError } = await supabase
      .from("incident_history")
      .select(
        "id, routing_department_id, assigned_to_id, pipeline_stage, status, routed_at, routing_rule_id, asset_id",
      )
      .eq("id", id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json(
        { error: fetchError?.message || "Incidente no encontrado" },
        { status: 404 },
      )
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const now = new Date().toISOString()

    if (body.routing_department_id !== undefined) {
      updates.routing_department_id = body.routing_department_id || null
      if (body.routing_department_id && !current.routed_at) {
        updates.routed_at = now
      }
      if (body.routing_department_id && current.target_response_hours == null) {
        updates.target_response_hours = 48
      }
    }

    if (body.assigned_to_id !== undefined) {
      updates.assigned_to_id = body.assigned_to_id || null
      updates.assigned_at = body.assigned_to_id ? now : null
    }

    if (body.pipeline_stage !== undefined) {
      if (!INCIDENT_PIPELINE_STAGES.includes(body.pipeline_stage)) {
        return NextResponse.json({ error: "pipeline_stage inválido" }, { status: 400 })
      }
      updates.pipeline_stage = body.pipeline_stage
    } else if (body.assigned_to_id && !body.pipeline_stage) {
      const stage = current.pipeline_stage as IncidentPipelineStage
      if (stage === "bandeja") {
        updates.pipeline_stage = "asignado"
      }
    }

    const { data, error } = await supabase
      .from("incident_history")
      .update(updates)
      .eq("id", id)
      .select(
        `
        id,
        routing_department_id,
        assigned_to_id,
        pipeline_stage,
        routed_at,
        assigned_at,
        target_response_hours
      `,
      )
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const changed =
      (body.routing_department_id !== undefined &&
        body.routing_department_id !== current.routing_department_id) ||
      (body.assigned_to_id !== undefined &&
        body.assigned_to_id !== current.assigned_to_id) ||
      (body.pipeline_stage !== undefined &&
        body.pipeline_stage !== current.pipeline_stage)

    if (changed) {
      await supabase.from("incident_assignment_log").insert({
        incident_id: id,
        from_department_id: current.routing_department_id,
        to_department_id:
          (updates.routing_department_id as string | null | undefined) ??
          current.routing_department_id,
        from_assignee_id: current.assigned_to_id,
        to_assignee_id:
          (updates.assigned_to_id as string | null | undefined) ??
          current.assigned_to_id,
        from_pipeline_stage: current.pipeline_stage,
        to_pipeline_stage:
          (updates.pipeline_stage as string | undefined) ?? current.pipeline_stage,
        reason: body.reason?.trim() || "Reasignación manual",
        changed_by: user?.id ?? null,
      })

      const newDepartmentId =
        (updates.routing_department_id as string | null | undefined) ??
        current.routing_department_id

      if (
        body.routing_department_id !== undefined &&
        newDepartmentId &&
        newDepartmentId !== current.routing_department_id
      ) {
        const { error: learnError } = await supabase.rpc(
          "record_incident_routing_signal",
          {
            p_incident_id: id,
            p_chosen_department_id: newDepartmentId,
            p_chosen_assignee_id:
              (updates.assigned_to_id as string | null | undefined) ??
              current.assigned_to_id,
            p_previous_department_id: current.routing_department_id,
            p_previous_rule_id: current.routing_rule_id,
            p_created_by: user?.id ?? null,
          },
        )

        if (learnError) {
          console.warn("Learning signal not recorded:", learnError.message)
        }
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("PATCH incident assignment error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("incident_assignment_log")
      .select("*")
      .eq("incident_id", id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error("GET assignment log error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
