// Shared types for organizational management

export interface Plant {
  id: string
  name: string
  code: string
  business_unit_id: string
  address?: string
  contact_phone?: string
  contact_email?: string
  status: 'active' | 'inactive'
  created_at?: string
  updated_at?: string
}

export interface BusinessUnit {
  id: string
  name: string
  code: string
  status: 'active' | 'inactive'
  created_at?: string
  updated_at?: string
}

export interface User {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono?: string
  phone_secondary?: string
  role: UserRole
  employee_code?: string
  position?: string
  shift?: 'morning' | 'afternoon' | 'night'
  hire_date?: string
  status: 'active' | 'inactive' | 'suspended'
  can_authorize_up_to?: number
  plant_id?: string
  business_unit_id?: string
  plants?: Plant
  business_units?: BusinessUnit
  emergency_contact?: EmergencyContact
}

export interface Asset {
  id: string
  name: string
  model: string
  plant_id: string
  status: 'operational' | 'maintenance' | 'repair' | string // Allow other status values
  created_at?: string
  updated_at?: string
  plants?: Plant
}

export interface AssetOperator {
  id: string
  asset_id: string
  operator_id: string
  assignment_type: 'primary' | 'secondary'
  start_date: string
  end_date?: string
  status: 'active' | 'inactive'
  notes?: string
  assigned_by?: string
  assets?: Asset
  operators?: User
}

export interface Permission {
  id: string
  name: string
  description: string
  category: string
}

export interface RolePermission {
  role: UserRole
  permissions: string[]
}

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
  email?: string
}

// Enums
export type UserRole = 
  | 'GERENCIA_GENERAL'
  | 'JEFE_UNIDAD_NEGOCIO'
  | 'ENCARGADO_MANTENIMIENTO'
  | 'JEFE_PLANTA'
  | 'DOSIFICADOR'
  | 'OPERADOR'
  | 'AUXILIAR_COMPRAS'
  | 'AREA_ADMINISTRATIVA'
  | 'EJECUTIVO'
  | 'VISUALIZADOR'

export type AssignmentType = 'primary' | 'secondary'

export type EmployeeStatus = 'active' | 'inactive' | 'suspended'

export type ShiftType = 'morning' | 'afternoon' | 'night'

// Utility types for drag and drop
export interface DragDropItem {
  id: string
  type: 'user' | 'asset' | 'plant'
  data: User | Asset | Plant
}

export interface DragDropZone {
  id: string
  type: 'role' | 'plant' | 'asset'
  accepts: string[]
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Form types
export interface CreateUserRequest {
  nombre: string
  apellido: string
  email: string
  telefono?: string
  role: UserRole
  employee_code?: string
  position?: string
  shift?: ShiftType
  plant_id?: string
  business_unit_id?: string
  can_authorize_up_to?: number
  emergency_contact?: EmergencyContact
}

export interface UpdateUserRequest extends Partial<CreateUserRequest> {
  id: string
}

export interface CreateAssetOperatorRequest {
  asset_id: string
  operator_id: string
  assignment_type: AssignmentType
  start_date: string
  notes?: string
}

export interface UpdateAssetOperatorRequest extends Partial<CreateAssetOperatorRequest> {
  id: string
  end_date?: string
  status?: 'active' | 'inactive'
}

// Component props types
export interface UserCardProps {
  user: User
  onClick?: (user: User) => void
  showDetails?: boolean
  draggable?: boolean
}

export interface AssetCardProps {
  asset: Asset
  assignments?: AssetOperator[]
  onClick?: (asset: Asset) => void
  showAssignments?: boolean
}

export interface PlantCardProps {
  plant: Plant
  userCount?: number
  assetCount?: number
  onClick?: (plant: Plant) => void
  showStats?: boolean
} 