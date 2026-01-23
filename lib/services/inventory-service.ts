import { createClient } from '@/lib/supabase-server'

export interface InventoryPart {
  id: string
  part_number: string
  part_number_normalized?: string
  name: string
  description?: string
  category: 'Repuesto' | 'Consumible' | 'Herramienta' | 'Otro'
  unit_of_measure: string
  manufacturer?: string
  supplier_id?: string
  warranty_period_months?: number
  specifications?: Record<string, any>
  default_unit_cost?: number
  is_active: boolean
  created_by?: string
  updated_by?: string
  created_at?: string
  updated_at?: string
}

export interface CreatePartRequest {
  part_number: string
  name: string
  description?: string
  category: 'Repuesto' | 'Consumible' | 'Herramienta' | 'Otro'
  unit_of_measure?: string
  manufacturer?: string
  supplier_id?: string
  warranty_period_months?: number
  specifications?: Record<string, any>
  default_unit_cost?: number
}

export interface UpdatePartRequest extends Partial<CreatePartRequest> {
  id: string
}

export interface SearchPartsParams {
  search?: string
  category?: string
  supplier_id?: string
  is_active?: boolean
  page?: number
  limit?: number
}

export interface PartsResponse {
  parts: InventoryPart[]
  total: number
  page: number
  limit: number
}

export class InventoryService {
  /**
   * Get all parts with optional filters
   */
  static async getParts(params: SearchPartsParams = {}): Promise<PartsResponse> {
    const supabase = await createClient()
    const { search, category, supplier_id, is_active = true, page = 1, limit = 50 } = params
    
    try {
      let query = supabase
        .from('inventory_parts')
        .select('*', { count: 'exact' })
      
      if (is_active !== undefined) {
        query = query.eq('is_active', is_active)
      }
      
      if (category) {
        query = query.eq('category', category)
      }
      
      if (supplier_id) {
        query = query.eq('supplier_id', supplier_id)
      }
      
      if (search) {
        query = query.or(`part_number.ilike.%${search}%,name.ilike.%${search}%,description.ilike.%${search}%`)
      }
      
      const from = (page - 1) * limit
      const to = from + limit - 1
      
      const { data, error, count } = await query
        .order('name', { ascending: true })
        .range(from, to)
      
      if (error) throw error
      
      return {
        parts: data || [],
        total: count || 0,
        page,
        limit
      }
    } catch (error) {
      console.error('Error fetching parts:', error)
      throw new Error('Failed to fetch parts')
    }
  }
  
  /**
   * Get a single part by ID
   */
  static async getPartById(part_id: string): Promise<InventoryPart | null> {
    const supabase = await createClient()
    
    try {
      const { data, error } = await supabase
        .from('inventory_parts')
        .select('*')
        .eq('id', part_id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
      }
      
      return data
    } catch (error) {
      console.error('Error fetching part:', error)
      throw new Error('Failed to fetch part')
    }
  }
  
  /**
   * Search parts by part number (fuzzy matching)
   */
  static async searchPartsByNumber(part_number: string): Promise<InventoryPart[]> {
    const supabase = await createClient()
    
    try {
      // Normalize part number for fuzzy matching
      const normalized = part_number.toUpperCase().replace(/[^A-Z0-9]/g, '')
      
      const { data, error } = await supabase
        .from('inventory_parts')
        .select('*')
        .eq('is_active', true)
        .or(`part_number.ilike.%${part_number}%,part_number_normalized.eq.${normalized}`)
        .limit(10)
      
      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('Error searching parts:', error)
      throw new Error('Failed to search parts')
    }
  }
  
  /**
   * Create a new part
   */
  static async createPart(request: CreatePartRequest, user_id: string): Promise<InventoryPart> {
    const supabase = await createClient()
    
    try {
      const { data, error } = await supabase
        .from('inventory_parts')
        .insert({
          ...request,
          unit_of_measure: request.unit_of_measure || 'pcs',
          created_by: user_id,
          updated_by: user_id
        })
        .select()
        .single()
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Part number already exists')
        }
        throw error
      }
      
      return data
    } catch (error) {
      console.error('Error creating part:', error)
      if (error instanceof Error) throw error
      throw new Error('Failed to create part')
    }
  }
  
  /**
   * Update an existing part
   */
  static async updatePart(request: UpdatePartRequest, user_id: string): Promise<InventoryPart> {
    const supabase = await createClient()
    const { id, ...updates } = request
    
    try {
      const { data, error } = await supabase
        .from('inventory_parts')
        .update({
          ...updates,
          updated_by: user_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Part number already exists')
        }
        throw error
      }
      
      return data
    } catch (error) {
      console.error('Error updating part:', error)
      if (error instanceof Error) throw error
      throw new Error('Failed to update part')
    }
  }
  
  /**
   * Deactivate a part (soft delete)
   */
  static async deactivatePart(part_id: string, user_id: string): Promise<void> {
    const supabase = await createClient()
    
    try {
      const { error } = await supabase
        .from('inventory_parts')
        .update({
          is_active: false,
          updated_by: user_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', part_id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error deactivating part:', error)
      throw new Error('Failed to deactivate part')
    }
  }
  
  /**
   * Reactivate a part
   */
  static async reactivatePart(part_id: string, user_id: string): Promise<void> {
    const supabase = await createClient()
    
    try {
      const { error } = await supabase
        .from('inventory_parts')
        .update({
          is_active: true,
          updated_by: user_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', part_id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error reactivating part:', error)
      throw new Error('Failed to reactivate part')
    }
  }
}
