import { createClient } from '@/lib/supabase'
import {
  PurchaseOrderQuotation,
  CreateQuotationRequest,
  SelectQuotationRequest,
  QuotationComparison,
  QuotationComparisonResponse,
  QuotationStatus,
  QuotationSelectionStatus
} from '@/types/purchase-orders'
import { Supplier } from '@/types/suppliers'

export class QuotationService {
  /**
   * Create a new quotation for a purchase order
   */
  static async createQuotation(
    request: CreateQuotationRequest,
    user_id: string
  ): Promise<PurchaseOrderQuotation> {
    const supabase = createClient()
    
    try {
      // Verify PO exists and check po_purpose
      // Retry logic in case PO was just created (database replication delay)
      let po = null
      let poError = null
      let retries = 3
      
      while (retries > 0 && !po) {
        const result = await supabase
          .from('purchase_orders')
          .select('id, po_purpose, requires_quote')
          .eq('id', request.purchase_order_id)
          .single()
        
        po = result.data
        poError = result.error
        
        if (!po && retries > 1) {
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 500 * (4 - retries)))
        }
        retries--
      }
      
      if (poError || !po) {
        console.error('PO lookup error:', {
          purchase_order_id: request.purchase_order_id,
          error: poError,
          retries_attempted: 3 - retries
        })
        throw new Error(`Purchase order not found: ${poError?.message || 'PO does not exist'}`)
      }
      
      // Skip if using inventory (no purchase needed)
      if (po.po_purpose === 'work_order_inventory') {
        throw new Error('Quotations not required for inventory-only purchase orders')
      }
      
      // Create quotation
      const { data, error } = await supabase
        .from('purchase_order_quotations')
        .insert({
          purchase_order_id: request.purchase_order_id,
          supplier_id: request.supplier_id,
          supplier_name: request.supplier_name,
          quoted_amount: request.quoted_amount,
          quotation_items: request.quotation_items || null, // Store as JSONB (Supabase handles conversion)
          delivery_days: request.delivery_days,
          payment_terms: request.payment_terms,
          validity_date: request.validity_date,
          notes: request.notes,
          file_url: request.file_url,
          file_name: request.file_name,
          status: QuotationStatus.PENDING,
          created_by: user_id
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error creating quotation:', error)
        throw new Error(`Failed to create quotation: ${error.message}`)
      }
      
      return data as PurchaseOrderQuotation
    } catch (error) {
      console.error('Error in createQuotation:', error)
      throw error
    }
  }
  
  /**
   * Get all quotations for a purchase order
   */
  static async getQuotations(purchase_order_id: string): Promise<PurchaseOrderQuotation[]> {
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .from('purchase_order_quotations')
        .select(`
          *,
          supplier:suppliers(*)
        `)
        .eq('purchase_order_id', purchase_order_id)
        .order('status', { ascending: false }) // Selected first
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching quotations:', error)
        throw new Error('Failed to fetch quotations')
      }
      
      return (data || []) as PurchaseOrderQuotation[]
    } catch (error) {
      console.error('Error in getQuotations:', error)
      throw error
    }
  }
  
  /**
   * Select a quotation as the winning supplier
   * Includes authorization checks based on PO amount
   */
  static async selectQuotation(
    request: SelectQuotationRequest,
    user_id: string
  ): Promise<{ success: boolean; message: string }> {
    const supabase = createClient()
    
    try {
      // Get quotation and PO details for authorization check
      const { data: quotation, error: quotationError } = await supabase
        .from('purchase_order_quotations')
        .select('purchase_order_id, quoted_amount')
        .eq('id', request.quotation_id)
        .single()
      
      if (quotationError || !quotation) {
        throw new Error('Quotation not found')
      }
      
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('total_amount, requested_by')
        .eq('id', quotation.purchase_order_id)
        .single()
      
      if (poError || !po) {
        throw new Error('Purchase order not found')
      }
      
      // Authorization check based on amount
      // Note: This is a basic check. Full role-based authorization should be implemented
      // based on your organization's role system (Plant Manager, Unit Head, General Manager)
      const amount = parseFloat(po.total_amount || '0')
      
      // For now, allow selection if user is the requester or if amount is reasonable
      // TODO: Implement full role-based authorization:
      // - Amount <= $50,000: Plant Manager or above
      // - Amount > $50,000: Unit Head or above  
      // - Amount > $100,000: General Manager approval required
      
      // Basic check: user must be authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user || user.id !== user_id) {
        throw new Error('Unauthorized: User authentication required')
      }
      
      // Use database function to handle selection logic
      const { data, error } = await supabase
        .rpc('select_quotation', {
          p_quotation_id: request.quotation_id,
          p_user_id: user_id,
          p_selection_reason: request.selection_reason
        })
      
      if (error) {
        console.error('Error selecting quotation:', error)
        throw new Error(`Failed to select quotation: ${error.message}`)
      }
      
      return {
        success: data?.success || false,
        message: data?.message || 'Quotation selected successfully'
      }
    } catch (error) {
      console.error('Error in selectQuotation:', error)
      throw error
    }
  }
  
  /**
   * Reject a quotation with reason
   */
  static async rejectQuotation(
    quotation_id: string,
    rejection_reason: string,
    user_id: string
  ): Promise<void> {
    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from('purchase_order_quotations')
        .update({
          status: QuotationStatus.REJECTED,
          rejection_reason: rejection_reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', quotation_id)
      
      if (error) {
        console.error('Error rejecting quotation:', error)
        throw new Error('Failed to reject quotation')
      }
    } catch (error) {
      console.error('Error in rejectQuotation:', error)
      throw error
    }
  }
  
  /**
   * Get quotation comparison data with recommendations
   */
  static async getComparison(
    purchase_order_id: string
  ): Promise<QuotationComparisonResponse> {
    const supabase = await createClient()
    
    try {
      // Get PO details
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select('id, quotation_selection_required, quotation_selection_status, po_purpose, requires_quote')
        .eq('id', purchase_order_id)
        .single()
      
      if (poError || !po) {
        throw new Error('Purchase order not found')
      }
      
      // Get all quotations
      const quotations = await this.getQuotations(purchase_order_id)
      
      const selected_quotation = quotations.find(q => q.status === QuotationStatus.SELECTED)
      
      // Calculate summary
      const prices = quotations.map(q => q.quoted_amount)
      const deliveryDays = quotations
        .filter(q => q.delivery_days !== null && q.delivery_days !== undefined)
        .map(q => q.delivery_days!)
      
      const summary = {
        total_quotations: quotations.length,
        lowest_price: prices.length > 0 ? Math.min(...prices) : 0,
        fastest_delivery: deliveryDays.length > 0 ? Math.min(...deliveryDays) : 0,
        average_price: prices.length > 0 
          ? prices.reduce((sum, price) => sum + price, 0) / prices.length 
          : 0
      }
      
      // Generate recommendation
      let recommendation: QuotationComparison['recommendation'] | undefined
      if (quotations.length >= 2 && !selected_quotation) {
        recommendation = this.calculateRecommendation(quotations)
      }
      
      const comparison: QuotationComparison = {
        quotations,
        selected_quotation,
        recommendation,
        summary
      }
      
      // Check requirements
      const min_quotations_met = quotations.length >= 2
      const selection_required = po.quotation_selection_required || false
      const can_select = selection_required && min_quotations_met && !selected_quotation
      
      return {
        comparison,
        can_select,
        selection_required,
        min_quotations_met
      }
    } catch (error) {
      console.error('Error in getComparison:', error)
      throw error
    }
  }
  
  /**
   * Calculate recommendation score for quotations
   */
  private static calculateRecommendation(
    quotations: PurchaseOrderQuotation[]
  ): QuotationComparison['recommendation'] {
    if (quotations.length === 0) return undefined
    
    const scores = quotations.map(quotation => {
      let score = 0
      const reasoning: string[] = []
      
      // Price score (40% weight) - lower is better
      const prices = quotations.map(q => q.quoted_amount)
      const minPrice = Math.min(...prices)
      const maxPrice = Math.max(...prices)
      const priceRange = maxPrice - minPrice
      
      if (priceRange > 0) {
        const priceScore = 1 - ((quotation.quoted_amount - minPrice) / priceRange)
        score += priceScore * 0.4
        if (quotation.quoted_amount === minPrice) {
          reasoning.push('Mejor precio')
        }
      } else {
        score += 0.4 // All same price
      }
      
      // Delivery time score (30% weight) - faster is better
      if (quotation.delivery_days !== null && quotation.delivery_days !== undefined) {
        const deliveryDays = quotations
          .filter(q => q.delivery_days !== null && q.delivery_days !== undefined)
          .map(q => q.delivery_days!)
        
        if (deliveryDays.length > 0) {
          const minDelivery = Math.min(...deliveryDays)
          const maxDelivery = Math.max(...deliveryDays)
          const deliveryRange = maxDelivery - minDelivery
          
          if (deliveryRange > 0) {
            const deliveryScore = 1 - ((quotation.delivery_days! - minDelivery) / deliveryRange)
            score += deliveryScore * 0.3
            if (quotation.delivery_days === minDelivery) {
              reasoning.push('Entrega más rápida')
            }
          } else {
            score += 0.3
          }
        }
      }
      
      // Supplier rating score (20% weight)
      if (quotation.supplier?.rating) {
        const ratingScore = quotation.supplier.rating / 5
        score += ratingScore * 0.2
        if (quotation.supplier.rating >= 4.5) {
          reasoning.push('Proveedor con excelente calificación')
        }
      } else {
        score += 0.1 // Neutral if no rating
      }
      
      // Supplier reliability score (10% weight)
      if (quotation.supplier?.reliability_score) {
        const reliabilityScore = quotation.supplier.reliability_score / 100
        score += reliabilityScore * 0.1
        if (quotation.supplier.reliability_score >= 90) {
          reasoning.push('Alta confiabilidad')
        }
      } else {
        score += 0.05 // Neutral if no reliability data
      }
      
      return {
        quotation_id: quotation.id,
        score: Math.round(score * 100), // Convert to 0-100 scale
        reasoning: reasoning.length > 0 ? reasoning : ['Cotización competitiva']
      }
    })
    
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score)
    
    return scores[0]
  }
  
  /**
   * Check if quotation selection is required for a PO
   */
  static async checkSelectionRequired(purchase_order_id: string): Promise<boolean> {
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .rpc('check_quotation_selection_required', {
          p_po_id: purchase_order_id
        })
      
      if (error) {
        console.error('Error checking selection requirement:', error)
        return false
      }
      
      return data || false
    } catch (error) {
      console.error('Error in checkSelectionRequired:', error)
      return false
    }
  }
  
  /**
   * Delete a quotation
   */
  static async deleteQuotation(quotation_id: string): Promise<void> {
    const supabase = createClient()
    
    try {
      const { error } = await supabase
        .from('purchase_order_quotations')
        .delete()
        .eq('id', quotation_id)
      
      if (error) {
        console.error('Error deleting quotation:', error)
        throw new Error('Failed to delete quotation')
      }
    } catch (error) {
      console.error('Error in deleteQuotation:', error)
      throw error
    }
  }
}
