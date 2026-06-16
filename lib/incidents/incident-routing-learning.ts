import { normalizeIssueCoreItem } from "./normalize-issue-core-item"

export const LEARNED_RULE_MIN_SAMPLES = 3
export const LEARNED_RULE_MIN_CONFIDENCE = 0.75

export type RoutingSignalKind = "manual_assign" | "correction" | "confirm"

export type IncidentRoutingSignal = {
  id: string
  incident_id: string
  plant_id: string | null
  incident_type: string
  incident_impact: string | null
  description_keyword: string | null
  chosen_department_id: string
  chosen_assignee_id: string | null
  previous_department_id: string | null
  previous_rule_id: string | null
  signal_kind: RoutingSignalKind
  created_at: string
}

export type LearnedRoutingSuggestion = {
  pattern_key: string
  plant_id: string | null
  incident_type: string
  incident_impact: string | null
  description_keyword: string | null
  chosen_department_id: string
  suggested_assignee_id: string | null
  sample_count: number
  correction_count: number
  confirm_count: number
  confidence: number
  ready_to_promote: boolean
  department_name?: string | null
}

export type RoutingLearningStats = {
  total_signals: number
  corrections: number
  confirms: number
  learned_rules: number
  manual_rules: number
  auto_routed_last_30d: number | null
  manual_routed_last_30d: number | null
}

/** Mirrors SQL `extract_incident_routing_keyword`. */
export function extractRoutingKeyword(description: string | null | undefined): string | null {
  const normalized = normalizeIssueCoreItem(description)
  if (!normalized || normalized.length < 4) return null
  return normalized.toLowerCase().slice(0, 120)
}

export function buildRoutingPatternKey(input: {
  plant_id: string | null
  incident_type: string
  incident_impact?: string | null
  description_keyword?: string | null
  chosen_department_id: string
}): string {
  const impact = input.incident_impact?.trim() || "*"
  const keyword = input.description_keyword?.trim() || "*"
  return [
    input.plant_id ?? "*",
    input.incident_type.toLowerCase(),
    impact.toLowerCase(),
    keyword.toLowerCase(),
    input.chosen_department_id,
  ].join("|")
}

export function inferSignalKind(
  previousDepartmentId: string | null | undefined,
  chosenDepartmentId: string | null | undefined,
): RoutingSignalKind {
  if (!chosenDepartmentId) return "manual_assign"
  if (!previousDepartmentId) return "manual_assign"
  if (previousDepartmentId === chosenDepartmentId) return "confirm"
  return "correction"
}

export function computePatternConfidence(input: {
  sample_count: number
  correction_count: number
  confirm_count: number
}): number {
  const denominator = input.sample_count + Math.max(input.correction_count, 1)
  const base = input.sample_count / denominator
  const boosted = Math.min(1, base + input.confirm_count * 0.05)
  return Math.round(boosted * 10000) / 10000
}

export function scoreLearnedRulePriority(confidence: number, sampleCount: number): number {
  return Math.max(10, 80 - Math.floor(confidence * 40) - Math.min(sampleCount, 20))
}

export function aggregateRoutingSignals(
  signals: IncidentRoutingSignal[],
  options?: { minSamples?: number; minConfidence?: number },
): LearnedRoutingSuggestion[] {
  const minSamples = options?.minSamples ?? LEARNED_RULE_MIN_SAMPLES
  const minConfidence = options?.minConfidence ?? LEARNED_RULE_MIN_CONFIDENCE

  const buckets = new Map<
    string,
    {
      plant_id: string | null
      incident_type: string
      incident_impact: string | null
      description_keyword: string | null
      chosen_department_id: string
      assigneeVotes: Map<string, number>
      sample_count: number
      correction_count: number
      confirm_count: number
    }
  >()

  for (const signal of signals) {
    const key = buildRoutingPatternKey({
      plant_id: signal.plant_id,
      incident_type: signal.incident_type,
      incident_impact: signal.incident_impact,
      description_keyword: signal.description_keyword,
      chosen_department_id: signal.chosen_department_id,
    })

    const bucket = buckets.get(key) ?? {
      plant_id: signal.plant_id,
      incident_type: signal.incident_type,
      incident_impact: signal.incident_impact,
      description_keyword: signal.description_keyword,
      chosen_department_id: signal.chosen_department_id,
      assigneeVotes: new Map<string, number>(),
      sample_count: 0,
      correction_count: 0,
      confirm_count: 0,
    }

    bucket.sample_count += 1
    if (signal.signal_kind === "correction") bucket.correction_count += 1
    if (signal.signal_kind === "confirm") bucket.confirm_count += 1
    if (signal.chosen_assignee_id) {
      bucket.assigneeVotes.set(
        signal.chosen_assignee_id,
        (bucket.assigneeVotes.get(signal.chosen_assignee_id) ?? 0) + 1,
      )
    }

    buckets.set(key, bucket)
  }

  return Array.from(buckets.entries())
    .map(([pattern_key, bucket]) => {
      const confidence = computePatternConfidence(bucket)
      let suggested_assignee_id: string | null = null
      let topVotes = 0
      for (const [assigneeId, votes] of bucket.assigneeVotes) {
        if (votes > topVotes) {
          topVotes = votes
          suggested_assignee_id = assigneeId
        }
      }

      return {
        pattern_key,
        plant_id: bucket.plant_id,
        incident_type: bucket.incident_type,
        incident_impact: bucket.incident_impact,
        description_keyword: bucket.description_keyword,
        chosen_department_id: bucket.chosen_department_id,
        suggested_assignee_id,
        sample_count: bucket.sample_count,
        correction_count: bucket.correction_count,
        confirm_count: bucket.confirm_count,
        confidence,
        ready_to_promote: bucket.sample_count >= minSamples && confidence >= minConfidence,
      }
    })
    .sort((a, b) => b.confidence - a.confidence || b.sample_count - a.sample_count)
}

export function routingRuleSpecificity(rule: {
  plant_id?: string | null
  match_incident_type?: string | null
  match_impact?: string | null
  match_description_contains?: string | null
}): number {
  return (
    (rule.plant_id ? 1 : 0) +
    (rule.match_incident_type ? 1 : 0) +
    (rule.match_impact ? 1 : 0) +
    (rule.match_description_contains ? 2 : 0)
  )
}
