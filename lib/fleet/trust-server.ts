import type { FleetAssetRow } from '@/lib/fleet/organize'
import type { AssetTrustField, TrustFieldState } from '@/types/fleet'

export const TRACKED_TRUST_FIELDS = [
  'model_id',
  'plant_id',
  'status',
  'current_hours',
  'current_kilometers',
  'serial_number',
  'insurance_end_date',
] as const

export type TrustPolicyRow = {
  field: string
  window_days: number | null
  severity: string
}

export function hashFieldValue(field: string, asset: FleetAssetRow): string {
  switch (field) {
    case 'model_id':
      return asset.model_id ?? ''
    case 'plant_id':
      return asset.plant_id ?? ''
    case 'status':
      return asset.status ?? ''
    case 'current_hours':
      return String(asset.current_hours ?? '')
    case 'current_kilometers':
      return String(asset.current_kilometers ?? '')
    case 'serial_number':
      return asset.serial_number ?? ''
    case 'insurance_end_date':
      return asset.insurance_end_date ?? ''
    default:
      return ''
  }
}

function policyWindowDays(
  policies: TrustPolicyRow[],
  field: string
): number | null {
  const p = policies.find((x) => x.field === field)
  if (p) return p.window_days
  const def = policies.find((x) => x.field === 'default')
  return def?.window_days ?? 90
}

export function fieldState(
  field: string,
  asset: FleetAssetRow,
  verifiedAt: Date | null,
  windowDays: number | null,
  conflicted: boolean
): TrustFieldState {
  if (conflicted) return 'conflicted'
  if (!verifiedAt) return 'unverified'
  if (windowDays == null) return 'verified'
  const ms = windowDays * 24 * 60 * 60 * 1000
  if (Date.now() - verifiedAt.getTime() > ms) return 'stale'
  return 'verified'
}

export function computeAssetTrustFields(
  asset: FleetAssetRow,
  verifications: Map<string, Map<string, { verified_at: string }>>,
  policies: TrustPolicyRow[],
  conflictAssetIds: Set<string>
): { trust_pct: number; fields: AssetTrustField[] } {
  const conf = conflictAssetIds.has(asset.id)
  const vmap = verifications.get(asset.id) ?? new Map()
  const fields: AssetTrustField[] = []
  let scoreSum = 0
  const n = TRACKED_TRUST_FIELDS.length

  for (const field of TRACKED_TRUST_FIELDS) {
    const windowDays = policyWindowDays(policies, field)
    const rec = vmap.get(field)
    const verifiedAt = rec?.verified_at ? new Date(rec.verified_at) : null
    const state = fieldState(field, asset, verifiedAt, windowDays, conf)
    fields.push({
      field,
      state,
      verified_at: rec?.verified_at,
    })
    if (state === 'verified') scoreSum += 100
    else if (state === 'stale') scoreSum += 60
    else if (state === 'unverified') scoreSum += 35
    else scoreSum += 0
  }

  let trust_pct = Math.round(scoreSum / n)
  if (conf) trust_pct = Math.round(trust_pct * 0.5)
  return { trust_pct, fields }
}

export function buildVerificationMap(
  rows: { asset_id: string; field: string; verified_at: string }[]
): Map<string, Map<string, { verified_at: string }>> {
  const m = new Map<string, Map<string, { verified_at: string }>>()
  for (const r of rows) {
    if (!m.has(r.asset_id)) m.set(r.asset_id, new Map())
    m.get(r.asset_id)!.set(r.field, { verified_at: r.verified_at })
  }
  return m
}

export function computeTrustByAssetId(
  assets: FleetAssetRow[],
  verifications: Map<string, Map<string, { verified_at: string }>>,
  policies: TrustPolicyRow[],
  conflictAssetIds: Set<string>
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of assets) {
    out[a.id] = computeAssetTrustFields(
      a,
      verifications,
      policies,
      conflictAssetIds
    ).trust_pct
  }
  return out
}
