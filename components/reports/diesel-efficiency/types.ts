export type QualityTier = 'ok' | 'watch' | 'severe'
export type EfficiencyTier = 'ok' | 'watch' | 'severe' | 'unknown'

export type QualityFlags = {
  tx_count: number
  null_previous_horometer_count: number
  negative_hours_consumed_count: number
  merge_fork: boolean
  null_previous_kilometer_count?: number
  negative_kilometers_consumed_count?: number
  merge_fork_km?: boolean
}

export type AnomalyFlags = {
  data_quality_tier: QualityTier
  efficiency_tier: EfficiencyTier
  breakpoint_mom_lph: boolean
  review_consumption_pattern: boolean
}

export type EfficiencyRow = {
  id: string
  year_month: string
  plant_id: string | null
  total_liters: number
  hours_merged: number
  hours_sum_raw: number
  hours_trusted: number
  kilometers_sum_raw: number
  kilometers_merged: number
  kilometers_trusted: number
  liters_per_hour_trusted: number | null
  liters_per_km: number | null
  concrete_m3: number | null
  /** Total Cotizador m³ for the asset's home plant in this month (all units). */
  plant_concrete_m3: number | null
  liters_per_m3: number | null
  equipment_category: string | null
  quality_flags: QualityFlags
  anomaly_flags: AnomalyFlags
  computed_at?: string | null
  assets?: {
    id: string
    asset_id: string | null
    name: string | null
  } | null
}

export type MeterEvent = {
  source_kind: string | null
  source_id: string
  event_at: string
  hours_reading: number | null
  hours_consumed: number | null
  previous_hours: number | null
  quantity_liters: number | null
  km_reading?: number | null
  previous_km?: number | null
  km_consumed?: number | null
}

export type SortKey =
  | 'total_liters'
  | 'liters_per_hour_trusted'
  | 'liters_per_km'
  | 'liters_per_m3'
  | 'hours_trusted'
  | 'data_quality'
  | 'efficiency'

export type ViewMode = 'fleet' | 'anomalies' | 'quality'
