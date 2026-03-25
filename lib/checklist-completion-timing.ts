/**
 * Last completion instant per asset for compliance-style KPIs (snapshot, staleness).
 * Prefer max(completion_date, created_at) per row so legacy/null completion_date does not hide recent work.
 */

export type CompletedChecklistTimingRow = {
  asset_id: string | null
  completion_date: string | null
  created_at: string | null
}

export function effectiveChecklistCompletionMs(
  r: Pick<CompletedChecklistTimingRow, 'completion_date' | 'created_at'>,
): number | null {
  let maxT = 0
  let any = false
  for (const raw of [r.completion_date, r.created_at]) {
    if (!raw) continue
    const t = new Date(raw).getTime()
    if (!Number.isFinite(t)) continue
    any = true
    if (t > maxT) maxT = t
  }
  return any ? maxT : null
}

export function buildLastCompletionByAssetMap(rows: CompletedChecklistTimingRow[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) {
    if (!r.asset_id) continue
    const t = effectiveChecklistCompletionMs(r)
    if (t === null) continue
    const prev = m.get(r.asset_id) || 0
    if (t > prev) m.set(r.asset_id, t)
  }
  return m
}
