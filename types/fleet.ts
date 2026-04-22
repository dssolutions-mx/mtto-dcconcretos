/** Fleet flota tree lenses (Organizar por). */
export type FleetOrganizeLens =
  | 'bu-plant-model'
  | 'bu-plant-categoria'
  | 'fabricante-modelo-planta'
  | 'ano-modelo-planta'
  | 'categoria-modelo-planta'
  | 'estado-planta-modelo'

export type FleetNodeKind =
  | 'root'
  | 'bu'
  | 'plant'
  | 'category'
  | 'manufacturer'
  | 'year'
  | 'status'
  | 'model'
  | 'asset'

/** Flat node for virtualized outline tree (DFS order). */
export interface FleetTreeNode {
  id: string
  parent_id: string | null
  depth: number
  kind: FleetNodeKind
  label: string
  count: number
  /** Rollup / leaf trust 0-100 */
  trust_pct: number
  asset_ids: string[]
  payload?: {
    assetId?: string
    [key: string]: unknown
  }
}

export type TrustFieldState = 'verified' | 'unverified' | 'stale' | 'conflicted'

export interface AssetTrustField {
  field: string
  state: TrustFieldState
  verified_at?: string | null
}

export interface AssetTrustRow {
  asset_id: string
  trust_pct: number
  fields: AssetTrustField[]
  has_conflict: boolean
}

export interface FleetConflictRow {
  conflict_type: string
  severity: string
  asset_id: string | null
  equipment_model_id: string | null
  payload: Record<string, unknown>
  detail: string
}

export interface SavedViewConfig {
  lens: FleetOrganizeLens
  filters?: Record<string, unknown>
  density?: 'compact' | 'normal' | 'roomy'
  expandedNodeIds?: string[]
}

export interface UserSavedView {
  id: string
  user_id: string
  name: string
  scope: string
  config: SavedViewConfig
  is_shared: boolean
  created_at: string
  updated_at: string
}
