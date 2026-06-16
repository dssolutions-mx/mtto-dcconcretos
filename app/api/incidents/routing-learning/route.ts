import { createClient } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import {
  aggregateRoutingSignals,
  type IncidentRoutingSignal,
  type RoutingLearningStats,
} from "@/lib/incidents/incident-routing-learning"

export async function GET() {
  try {
    const supabase = await createClient()

    const since = new Date()
    since.setDate(since.getDate() - 180)

    const { data: signals, error: signalsError } = await supabase
      .from("incident_routing_signals")
      .select("*")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(500)

    if (signalsError) {
      return NextResponse.json({ error: signalsError.message }, { status: 500 })
    }

    const { data: rules, error: rulesError } = await supabase
      .from("incident_routing_rules")
      .select("id, source, pattern_key, is_active")

    if (rulesError) {
      return NextResponse.json({ error: rulesError.message }, { status: 500 })
    }

    const learnedPatternKeys = new Set(
      (rules ?? [])
        .filter((r) => r.source === "learned" && r.pattern_key)
        .map((r) => r.pattern_key as string),
    )

    const suggestions = aggregateRoutingSignals(
      (signals ?? []) as IncidentRoutingSignal[],
    ).map((suggestion) => ({
      ...suggestion,
      already_promoted: learnedPatternKeys.has(suggestion.pattern_key),
    }))

    const departmentIds = [
      ...new Set(suggestions.map((s) => s.chosen_department_id)),
    ]
    let departmentNames = new Map<string, string>()
    if (departmentIds.length > 0) {
      const { data: departments } = await supabase
        .from("departments")
        .select("id, name")
        .in("id", departmentIds)
      for (const dept of departments ?? []) {
        departmentNames.set(dept.id, dept.name)
      }
    }

    const enrichedSuggestions = suggestions.map((s) => ({
      ...s,
      department_name: departmentNames.get(s.chosen_department_id) ?? null,
    }))

    const stats: RoutingLearningStats = {
      total_signals: signals?.length ?? 0,
      corrections:
        signals?.filter((s) => s.signal_kind === "correction").length ?? 0,
      confirms: signals?.filter((s) => s.signal_kind === "confirm").length ?? 0,
      learned_rules: rules?.filter((r) => r.source === "learned").length ?? 0,
      manual_rules: rules?.filter((r) => r.source !== "learned").length ?? 0,
      auto_routed_last_30d: null,
      manual_routed_last_30d: null,
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { count: autoCount } = await supabase
      .from("incident_assignment_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString())
      .ilike("reason", "Ruteo automático:%")

    const { count: manualCount } = await supabase
      .from("incident_assignment_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString())
      .or("reason.eq.Reasignación manual,reason.ilike.Actualización desde detalle%")

    stats.auto_routed_last_30d = autoCount ?? 0
    stats.manual_routed_last_30d = manualCount ?? 0

    return NextResponse.json({
      stats,
      suggestions: enrichedSuggestions,
      pending_promotion: enrichedSuggestions.filter(
        (s) => s.ready_to_promote && !s.already_promoted,
      ),
    })
  } catch (err) {
    console.error("GET routing learning error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      min_samples?: number
      min_confidence?: number
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc("refresh_learned_incident_routing_rules", {
      p_min_samples: body.min_samples ?? 3,
      p_min_confidence: body.min_confidence ?? 0.75,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ promoted: data ?? 0 })
  } catch (err) {
    console.error("POST routing learning refresh error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
