import type { AssetTireInstallation, TireEvent, TireReading } from '@/types/tires'

/** Minimal row shape for reading aggregation (DB or test fixtures). */
export type TireReadingRow = Pick<
  TireReading,
  | 'id'
  | 'installation_id'
  | 'tire_id'
  | 'asset_id'
  | 'read_at'
  | 'tread_depth_mm'
  | 'pressure_psi'
  | 'checklist_id'
  | 'position_code'
  | 'notes'
  | 'odometer_km'
  | 'horometer_hours'
  | 'recorded_by'
  | 'created_at'
>

export interface ComposedInstallationReading {
  latest_reading: TireReading | null
  needs_pressure_reading: boolean
}

/** When a tire was last placed at its current position (mount or last rotation). */
export function getPositionEffectiveSince(
  installation: Pick<AssetTireInstallation, 'id' | 'installed_at'>,
  lastRotationAtByInstallation: Map<string, string>
): string {
  return lastRotationAtByInstallation.get(installation.id) ?? installation.installed_at
}

export function buildLastRotationAtByInstallation(
  events: Pick<TireEvent, 'installation_id' | 'event_type' | 'event_at'>[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const event of events) {
    if (event.event_type !== 'rotacion' || !event.installation_id) continue
    const existing = map.get(event.installation_id)
    if (!existing || event.event_at > existing) {
      map.set(event.installation_id, event.event_at)
    }
  }
  return map
}

function isOnOrAfter(readAt: string, since: string): boolean {
  return new Date(readAt).getTime() >= new Date(since).getTime()
}

/** Latest tread depth for a tire across warehouse + all mount contexts. */
export function latestTreadForTire(
  readings: TireReadingRow[],
  tireId: string
): TireReadingRow | null {
  let latest: TireReadingRow | null = null
  for (const row of readings) {
    if (row.tire_id !== tireId || row.tread_depth_mm == null) continue
    if (!latest || row.read_at > latest.read_at) latest = row
  }
  return latest
}

/** Latest PSI scoped to the current position context of an installation. */
export function latestPressureForInstallation(
  readings: TireReadingRow[],
  installationId: string,
  positionEffectiveSince: string
): TireReadingRow | null {
  let latest: TireReadingRow | null = null
  for (const row of readings) {
    if (row.installation_id !== installationId || row.pressure_psi == null) continue
    if (!isOnOrAfter(row.read_at, positionEffectiveSince)) continue
    if (!latest || row.read_at > latest.read_at) latest = row
  }
  return latest
}

function mergeReadingRows(
  installation: Pick<AssetTireInstallation, 'id' | 'tire_id' | 'asset_id'>,
  tread: TireReadingRow | null,
  pressure: TireReadingRow | null
): TireReading | null {
  if (!tread && !pressure) return null

  const readAt =
    [tread?.read_at, pressure?.read_at]
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? tread?.read_at ?? pressure?.read_at ?? new Date().toISOString()

  const base = tread ?? pressure!
  return {
    id: base.id,
    installation_id: installation.id,
    tire_id: installation.tire_id,
    asset_id: installation.asset_id,
    read_at: readAt,
    tread_depth_mm: tread?.tread_depth_mm ?? null,
    pressure_psi: pressure?.pressure_psi ?? null,
    odometer_km: pressure?.odometer_km ?? tread?.odometer_km ?? null,
    horometer_hours: pressure?.horometer_hours ?? tread?.horometer_hours ?? null,
    recorded_by: pressure?.recorded_by ?? tread?.recorded_by ?? null,
    checklist_id: pressure?.checklist_id ?? tread?.checklist_id ?? null,
    position_code: pressure?.position_code ?? tread?.position_code ?? null,
    notes: pressure?.notes ?? tread?.notes ?? null,
    created_at: base.created_at,
  }
}

/** Compose display reading: tread follows the tire; PSI follows the current mount context. */
export function composeInstallationReading(
  installation: Pick<AssetTireInstallation, 'id' | 'tire_id' | 'asset_id' | 'installed_at' | 'removed_at'>,
  readings: TireReadingRow[],
  lastRotationAtByInstallation: Map<string, string>
): ComposedInstallationReading {
  const positionSince = getPositionEffectiveSince(installation, lastRotationAtByInstallation)
  const tread = latestTreadForTire(readings, installation.tire_id)
  const pressure = latestPressureForInstallation(readings, installation.id, positionSince)
  const needs_pressure_reading = !installation.removed_at && pressure == null

  return {
    latest_reading: mergeReadingRows(installation, tread, pressure),
    needs_pressure_reading,
  }
}

export function enrichInstallationsWithReadings(
  installations: AssetTireInstallation[],
  readings: TireReadingRow[],
  rotationEvents: Pick<TireEvent, 'installation_id' | 'event_type' | 'event_at'>[]
): AssetTireInstallation[] {
  const lastRotationAt = buildLastRotationAtByInstallation(rotationEvents)
  return installations.map((inst) => {
    const { latest_reading, needs_pressure_reading } = composeInstallationReading(
      inst,
      readings,
      lastRotationAt
    )
    return { ...inst, latest_reading, needs_pressure_reading }
  })
}

/** Spanish label for a reading row in history tables. */
export function formatReadingContextLabel(
  reading: Pick<TireReading, 'installation_id' | 'checklist_id' | 'position_code' | 'notes'>,
  positionLabelByCode?: Map<string, string>
): string {
  if (reading.checklist_id) {
    const pos = reading.position_code
      ? positionLabelByCode?.get(reading.position_code) ?? reading.position_code
      : null
    return pos ? `Checklist · ${pos}` : 'Checklist'
  }
  if (reading.installation_id == null) return 'Almacén'
  if (reading.notes?.includes('importación')) return 'Almacén (importación)'
  if (reading.position_code) {
    return positionLabelByCode?.get(reading.position_code) ?? reading.position_code
  }
  return 'Activo'
}
