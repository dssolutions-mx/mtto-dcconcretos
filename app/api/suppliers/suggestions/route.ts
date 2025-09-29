import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { SupplierSuggestionsRequest, SupplierSuggestion } from '@/types/suppliers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const work_order_id = searchParams.get('work_order_id')
    const asset_id = searchParams.get('asset_id')
    const asset_type = searchParams.get('asset_type')
    const problem_description = searchParams.get('problem_description')
    const required_services = searchParams.get('required_services')?.split(',').filter(Boolean) || []
    const location = searchParams.get('location')
    const urgency = searchParams.get('urgency') || 'medium'
    const budget_min = searchParams.get('budget_min')
    const budget_max = searchParams.get('budget_max')
    const limit = parseInt(searchParams.get('limit') || '5')

    // Get work order context if work_order_id is provided
    let workOrderContext = null
    if (work_order_id) {
      const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .select(`
          *,
          asset:assets(*)
        `)
        .eq('id', work_order_id)
        .single()

      if (!woError && workOrder) {
        workOrderContext = workOrder
      }
    }

    // Get asset context if asset_id is provided
    let assetContext = null
    if (asset_id) {
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .select(`
          *,
          model:equipment_models(*)
        `)
        .eq('id', asset_id)
        .single()

      if (!assetError && asset) {
        assetContext = asset
      }
    }

    // Build supplier query with filters
    let supplierQuery = supabase
      .from('suppliers')
      .select(`
        *,
        supplier_contacts(*),
        supplier_services(*),
        supplier_work_history(*),
        supplier_performance_history(*)
      `)
      .eq('status', 'active')
      .limit(limit)

    // Apply filters based on context
    if (assetContext || workOrderContext) {
      const asset = assetContext || workOrderContext?.asset

      if (asset?.model?.category) {
        // Filter by asset category
        supplierQuery = supplierQuery.contains('specialties', [asset.model.category])
      }

      if (asset?.location) {
        // Filter by location proximity
        supplierQuery = supplierQuery.or(`city.eq.${asset.location},state.eq.${asset.location}`)
      }
    }

    // Filter by required services
    if (required_services.length > 0) {
      supplierQuery = supplierQuery.overlaps('specialties', required_services)
    }

    // Filter by budget if provided
    if (budget_min || budget_max) {
      const minAmount = budget_min ? parseFloat(budget_min) : 0
      const maxAmount = budget_max ? parseFloat(budget_max) : Infinity

      supplierQuery = supplierQuery
        .gte('total_orders', 1) // Only suppliers with some history
        .filter('avg_order_amount', 'gte', minAmount)
        .filter('avg_order_amount', 'lte', maxAmount)
    }

    const { data: suppliers, error } = await supplierQuery

    if (error) {
      console.error('Error fetching supplier suggestions:', error)
      return NextResponse.json(
        { error: 'Error fetching supplier suggestions', details: error.message },
        { status: 500 }
      )
    }

    // Score and rank suppliers
    const suggestions: SupplierSuggestion[] = (suppliers || []).map(supplier => {
      let score = 0
      let reasoning: string[] = []

      // Performance score (40% weight)
      const performanceScore = calculatePerformanceScore(supplier)
      score += performanceScore * 0.4
      if (performanceScore > 3.5) {
        reasoning.push(`High performance rating (${performanceScore.toFixed(1)}/5)`)
      }

      // Relevance score (30% weight)
      const relevanceScore = calculateRelevanceScore(supplier, assetContext, required_services, problem_description)
      score += relevanceScore * 0.3
      if (relevanceScore > 0.7) {
        reasoning.push('Strong match for required services and asset type')
      }

      // Availability score (20% weight)
      const availabilityScore = calculateAvailabilityScore(supplier)
      score += availabilityScore * 0.2
      if (availabilityScore > 0.8) {
        reasoning.push('Good availability and response time')
      }

      // Cost score (10% weight)
      const costScore = calculateCostScore(supplier, budget_min, budget_max)
      score += costScore * 0.1
      if (costScore > 0.8) {
        reasoning.push('Competitive pricing within budget')
      }

      return {
        supplier,
        score,
        reasoning,
        estimated_cost: supplier.avg_order_amount || 0,
        estimated_delivery_time: supplier.avg_delivery_time || 7,
        availability_score: availabilityScore,
        quality_score: performanceScore,
        reliability_score: supplier.reliability_score || 0
      }
    })

    // Sort by score and return top suggestions
    suggestions.sort((a, b) => b.score - a.score)

    return NextResponse.json({
      suggestions: suggestions.slice(0, limit),
      context_used: {
        work_order_id,
        asset_id,
        asset_type,
        required_services,
        location,
        urgency,
        budget_range: budget_min && budget_max ? { min: budget_min, max: budget_max } : null
      }
    })

  } catch (error) {
    console.error('Error in supplier suggestions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions for scoring
function calculatePerformanceScore(supplier: any): number {
  const rating = supplier.rating || 0
  const reliability = supplier.reliability_score || 0
  const totalOrders = supplier.total_orders || 0

  // Weighted average of rating and reliability
  // Boost score for suppliers with more orders (more reliable data)
  const experienceMultiplier = Math.min(totalOrders / 10, 1.5) // Max 1.5x multiplier for 10+ orders

  return Math.min((rating * 0.6 + reliability * 0.4) * experienceMultiplier, 5)
}

function calculateRelevanceScore(supplier: any, asset: any, requiredServices: string[], problemDescription: string | null): number {
  let score = 0

  // Asset type matching
  if (asset?.model?.category && supplier.specialties?.includes(asset.model.category)) {
    score += 0.4
  }

  // Required services matching
  const matchingServices = requiredServices.filter(service =>
    supplier.specialties?.some((specialty: string) =>
      specialty.toLowerCase().includes(service.toLowerCase())
    )
  )
  score += (matchingServices.length / Math.max(requiredServices.length, 1)) * 0.3

  // Problem description keyword matching
  if (problemDescription && supplier.specialties) {
    const keywords = problemDescription.toLowerCase().split(' ')
    const matchingKeywords = keywords.filter((keyword: string) =>
      supplier.specialties.some((specialty: string) =>
        specialty.toLowerCase().includes(keyword)
      )
    )
    score += (matchingKeywords.length / Math.max(keywords.length, 1)) * 0.3
  }

  return Math.min(score, 1)
}

function calculateAvailabilityScore(supplier: any): number {
  // Based on response time history and business hours
  const avgDeliveryTime = supplier.avg_delivery_time || 7
  const reliabilityScore = supplier.reliability_score || 0

  // Lower delivery time and higher reliability = higher availability
  const deliveryScore = Math.max(0, 1 - (avgDeliveryTime / 14)) // 14 days = 0 score
  const reliabilityScoreNormalized = reliabilityScore / 100

  return (deliveryScore * 0.6 + reliabilityScoreNormalized * 0.4)
}

function calculateCostScore(supplier: any, budgetMin: string | null, budgetMax: string | null): number {
  const avgOrderAmount = supplier.avg_order_amount || 0

  // If no budget constraints, assume all are acceptable
  if (!budgetMin && !budgetMax) {
    return 1
  }

  const minAmount = budgetMin ? parseFloat(budgetMin) : 0
  const maxAmount = budgetMax ? parseFloat(budgetMax) : Infinity

  // Score based on how well the supplier's average fits within budget
  if (avgOrderAmount >= minAmount && avgOrderAmount <= maxAmount) {
    // Perfect fit
    return 1
  } else if (avgOrderAmount < minAmount) {
    // Too cheap (might indicate quality issues)
    return 0.3
  } else {
    // Too expensive
    return Math.max(0, 1 - ((avgOrderAmount - maxAmount) / maxAmount))
  }
}
