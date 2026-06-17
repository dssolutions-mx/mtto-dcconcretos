import type { EfficiencyRow } from './types'

export type DieselAlertKind =
  | 'efficiency_severe'
  | 'efficiency_watch'
  | 'breakpoint_mom'
  | 'consumption_pattern'
  | 'data_quality'

export type DieselAlertFollowup = {
  id: string
  asset_id: string
  year_month: string
  alert_kind: DieselAlertKind
  status: 'open' | 'acknowledged' | 'resolved'
  assigned_to: string | null
  notes: string | null
  updated_at: string
}

/** Derive alert kinds for a row that should appear in the anomalies panel. */
export function deriveAlertKinds(row: EfficiencyRow): DieselAlertKind[] {
  const kinds: DieselAlertKind[] = []
  const a = row.anomaly_flags

  if (a.efficiency_tier === 'severe') kinds.push('efficiency_severe')
  else if (a.efficiency_tier === 'watch') kinds.push('efficiency_watch')

  if (a.breakpoint_mom_lph) kinds.push('breakpoint_mom')
  if (a.review_consumption_pattern) kinds.push('consumption_pattern')
  if (a.data_quality_tier !== 'ok') kinds.push('data_quality')

  return kinds
}

export function followupKey(assetId: string, kind: DieselAlertKind): string {
  return `${assetId}:${kind}`
}

export function worstOpenStatus(
  assetId: string,
  kinds: DieselAlertKind[],
  followups: Map<string, DieselAlertFollowup>
): 'open' | 'acknowledged' | 'resolved' | null {
  if (kinds.length === 0) return null

  let hasOpen = false
  let hasAck = false
  let allResolved = true

  for (const kind of kinds) {
    const f = followups.get(followupKey(assetId, kind))
    if (!f || f.status === 'open') {
      hasOpen = true
      allResolved = false
    } else if (f.status === 'acknowledged') {
      hasAck = true
      allResolved = false
    }
  }

  if (allResolved && kinds.every((k) => followups.get(followupKey(assetId, k))?.status === 'resolved')) {
    return 'resolved'
  }
  if (hasOpen) return 'open'
  if (hasAck) return 'acknowledged'
  return 'open'
}
