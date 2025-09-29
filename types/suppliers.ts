// Supplier System Types
// Comprehensive type definitions for the suppliers management system

export interface Supplier {
  id: string
  name: string
  business_name?: string
  tax_id?: string
  contact_person?: string
  email?: string
  phone?: string
  mobile_phone?: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string

  // Business information
  supplier_type: SupplierType
  industry?: string
  specialties?: string[]
  certifications?: string[]
  business_hours?: BusinessHours

  // Financial information
  payment_terms?: PaymentTerms
  payment_methods?: PaymentMethod[]
  bank_account_info?: BankAccountInfo
  tax_exempt?: boolean

  // Performance tracking
  rating?: number
  total_orders?: number
  total_amount?: number
  avg_order_amount?: number
  avg_delivery_time?: number
  reliability_score?: number
  business_unit_id?: string

  // System fields
  status: SupplierStatus
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface SupplierContact {
  id: string
  supplier_id: string
  contact_type: ContactType
  name: string
  position?: string
  email?: string
  phone?: string
  mobile_phone?: string
  notes?: string
  is_primary: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SupplierService {
  id: string
  supplier_id: string
  service_name: string
  // Keep broad category for backward compatibility, allow normalized keys
  service_category: ServiceCategory | NormalizedServiceCategory | string
  description?: string
  unit_cost?: number
  unit_of_measure?: string
  lead_time_days?: number
  warranty_period?: string
  is_active: boolean
  stock_available?: number
  min_order_quantity?: number
  max_order_quantity?: number
  created_at: string
  updated_at: string
}

export interface SupplierPerformanceHistory {
  id: string
  supplier_id: string
  purchase_order_id?: string
  work_order_id?: string
  order_date: string
  delivery_date?: string
  promised_delivery_date?: string
  actual_cost?: number
  quoted_cost?: number
  quality_rating?: number
  delivery_rating?: number
  service_rating?: number
  issues?: string[]
  notes?: string
  resolution_time_hours?: number
  created_at: string
  updated_at: string
}

export interface SupplierWorkHistory {
  id: string
  supplier_id: string
  work_order_id?: string
  asset_id?: string
  work_type: WorkType
  problem_description?: string
  solution_description?: string
  parts_used?: any[]
  labor_hours?: number
  total_cost?: number
  completed_on_time?: boolean
  quality_satisfaction?: number
  would_recommend?: boolean
  warranty_expiration?: string
  follow_up_required?: boolean
  follow_up_date?: string
  created_at: string
  updated_at: string
}

export interface SupplierCertification {
  id: string
  supplier_id: string
  certification_name: string
  issuing_body?: string
  certification_number?: string
  issue_date?: string
  expiration_date?: string
  certificate_url?: string
  is_active: boolean
  created_at: string
}

// Enums and supporting types
export type SupplierType =
  | 'individual'
  | 'company'
  | 'distributor'
  | 'manufacturer'
  | 'service_provider'

export type SupplierStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'blacklisted'

export type ContactType =
  | 'general'
  | 'technical'
  | 'billing'
  | 'emergency'

export type ServiceCategory =
  | 'maintenance'
  | 'repair'
  | 'parts'
  | 'tools'
  | 'equipment'
  | 'installation'
  | 'inspection'
  | 'consulting'

// Controlled catalogs (normalized) derived from production data analysis
export const SUPPLIER_INDUSTRIES = [
  'vehiculos_pesados',
  'automotriz',
  'industrial',
  'metal_mecanica',
  'electrico_automotriz',
  'neumaticos',
  'hvac',
  'bombeo_proceso',
  'refacciones_consumibles',
  'servicios_multioficio'
] as const
export type SupplierIndustry = typeof SUPPLIER_INDUSTRIES[number] | 'other'

export const SUPPLIER_SPECIALTIES = [
  'mecanica',
  'electrica',
  'electronica_instrumentacion',
  'hidraulica',
  'neumatica',
  'climatizacion',
  'frenos_seguridad',
  'llantas',
  'iluminacion',
  'combustible_filtracion',
  'lubricacion_fluids',
  'soldadura_fabricacion',
  'carroceria',
  'bombas_flujos',
  'refacciones_consumibles',
  'mantenimiento_general'
] as const
export type SupplierSpecialty = typeof SUPPLIER_SPECIALTIES[number] | `otra_${string}`

export const NORMALIZED_SERVICE_CATEGORIES = SUPPLIER_SPECIALTIES
export type NormalizedServiceCategory = SupplierSpecialty

export type WorkType =
  | 'repair'
  | 'maintenance'
  | 'installation'
  | 'inspection'
  | 'emergency'
  | 'preventive'
  | 'corrective'

export type PaymentTerms =
  | '30_days'
  | '15_days'
  | 'cash'
  | 'immediate'
  | '45_days'
  | '60_days'

export type PaymentMethod =
  | 'cash'
  | 'transfer'
  | 'card'
  | 'check'
  | 'wire'

export interface BusinessHours {
  monday?: { open: string; close: string }
  tuesday?: { open: string; close: string }
  wednesday?: { open: string; close: string }
  thursday?: { open: string; close: string }
  friday?: { open: string; close: string }
  saturday?: { open: string; close: string }
  sunday?: { open: string; close: string }
}

export interface BankAccountInfo {
  bank_name?: string
  account_number?: string
  routing_number?: string
  account_holder?: string
  account_type?: 'checking' | 'savings'
}

// API Request/Response Types
export interface CreateSupplierRequest {
  name: string
  business_name?: string
  tax_id?: string
  contact_person?: string
  email?: string
  phone?: string
  mobile_phone?: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  supplier_type: SupplierType
  industry?: string
  specialties?: string[]
  payment_terms?: PaymentTerms
  payment_methods?: PaymentMethod[]
  notes?: string
  business_unit_id?: string
}

export interface UpdateSupplierRequest extends Partial<CreateSupplierRequest> {
  status?: SupplierStatus
}

export interface SupplierSearchRequest {
  query?: string
  supplier_type?: SupplierType
  status?: SupplierStatus
  industry?: string
  specialties?: string[]
  min_rating?: number
  max_avg_order_amount?: number
  city?: string
  state?: string
  business_unit_id?: string
  limit?: number
  offset?: number
}

export interface SupplierSuggestionsRequest {
  work_order_id?: string
  asset_id?: string
  asset_type?: string
  problem_description?: string
  required_services?: string[]
  location?: string
  urgency?: 'low' | 'medium' | 'high' | 'critical'
  budget_range?: {
    min?: number
    max?: number
  }
}

export interface SupplierSuggestion {
  supplier: Supplier
  score: number
  reasoning: string[]
  estimated_cost?: number
  estimated_delivery_time?: number
  availability_score: number
  quality_score: number
  reliability_score: number
}

export interface SupplierAnalytics {
  summary: {
    total_suppliers: number
    active_suppliers: number
    total_orders_this_year: number
    total_amount_this_year: number
    average_rating: number
    average_reliability: number
  }
  by_type: Record<SupplierType, {
    count: number
    total_orders: number
    total_amount: number
    average_rating: number
  }>
  by_performance: {
    excellent: number    // rating >= 4.5
    good: number        // 3.5 <= rating < 4.5
    average: number     // 2.5 <= rating < 3.5
    poor: number        // rating < 2.5
  }
  top_performers: Supplier[]
  cost_analysis: {
    average_cost_per_supplier: number
    cost_variance_by_type: Record<SupplierType, number>
    most_economical_suppliers: Supplier[]
  }
  reliability_trends: {
    monthly_reliability_scores: Array<{
      month: string
      average_score: number
      order_count: number
    }>
  }
}

// Form Types
export interface SupplierFormData {
  // Basic Information
  name: string
  business_name?: string
  tax_id?: string
  supplier_type: SupplierType

  // Contact Information
  contact_person?: string
  email?: string
  phone?: string
  mobile_phone?: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string

  // Business Details
  industry?: SupplierIndustry | string
  specialties?: (SupplierSpecialty | string)[]
  certifications?: string[]
  payment_terms?: PaymentTerms
  payment_methods?: PaymentMethod[]
  business_hours?: BusinessHours

  // Additional Information
  notes?: string
}

// Component Props Types
export interface SupplierRegistryProps {
  onSupplierSelect?: (supplier: Supplier) => void
  selectedSupplierId?: string
  showSelection?: boolean
  filterByType?: SupplierType
  showInactive?: boolean
}

export interface SupplierDetailsProps {
  supplier: Supplier
  onClose?: () => void
  onEdit?: (supplier: Supplier) => void
  showWorkHistory?: boolean
  showPerformanceHistory?: boolean
}

export interface SupplierFormProps {
  supplier?: Supplier
  onSuccess?: (supplier: Supplier) => void
  onCancel?: () => void
}

export interface SupplierPerformanceChartProps {
  supplierId: string
  timeRange?: '30d' | '90d' | '1y' | 'all'
  metrics?: ('rating' | 'reliability' | 'delivery_time' | 'cost_accuracy')[]
}

// Error Types
export interface SupplierError {
  code: string
  message: string
  field?: string
}

export interface SupplierValidationError {
  errors: SupplierError[]
  isValid: boolean
}
