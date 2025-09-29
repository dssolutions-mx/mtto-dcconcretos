import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const work_order_id = searchParams.get('work_order_id')
    const asset_id = searchParams.get('asset_id')
    const problem_description = searchParams.get('problem_description')
    const required_services = searchParams.get('required_services')?.split(',').filter(Boolean) || []
    const urgency = searchParams.get('urgency') || 'medium'
    const budget_min = searchParams.get('budget_min')
    const budget_max = searchParams.get('budget_max')
    const limit = parseInt(searchParams.get('limit') || '5')

    // Get work order context
    let workOrderContext = null
    if (work_order_id) {
      const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .select(`
          *,
          asset:assets(*),
          incident:incident_history(*)
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

    // Use work order asset if available
    if (!assetContext && workOrderContext?.asset) {
      assetContext = workOrderContext.asset
    }

    // Build supplier suggestions based on context
    const suggestions = await generateSupplierSuggestions({
      assetContext,
      workOrderContext,
      problemDescription,
      requiredServices,
      urgency,
      budgetMin,
      budgetMax,
      limit
    })

    return NextResponse.json({
      suggestions,
      context_used: {
        work_order_id,
        asset_id,
        problem_description,
        required_services,
        urgency,
        budget_range: budget_min && budget_max ? { min: budget_min, max: budget_max } : null
      }
    })

  } catch (error) {
    console.error('Error in work order supplier suggestions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface SuggestionContext {
  assetContext?: any
  workOrderContext?: any
  problemDescription?: string
  requiredServices?: string[]
  urgency?: string
  budgetMin?: string
  budgetMax?: string
  limit?: number
}

async function generateSupplierSuggestions(context: SuggestionContext) {
  const supabase = createClient()
  const { assetContext, problemDescription, requiredServices, urgency, budgetMin, budgetMax, limit = 5 } = context

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

  // Apply asset-based filtering
  if (assetContext) {
    // Filter by asset category if available
    if (assetContext.model?.category) {
      supplierQuery = supplierQuery.contains('specialties', [assetContext.model.category])
    }

    // Filter by location
    if (assetContext.location) {
      supplierQuery = supplierQuery.or(`city.eq.${assetContext.location},state.eq.${assetContext.location}`)
    }
  }

  // Apply problem description keyword matching
  if (problemDescription) {
    const keywords = problemDescription.toLowerCase().split(' ')
    // Use text search for problem description matching
    supplierQuery = supplierQuery.or(keywords.map(keyword =>
      `specialties.cs.{${keyword}}`
    ).join(','))
  }

  // Apply required services filtering
  if (requiredServices && requiredServices.length > 0) {
    supplierQuery = supplierQuery.overlaps('specialties', requiredServices)
  }

  // Apply budget filtering
  if (budgetMin || budgetMax) {
    const minAmount = budgetMin ? parseFloat(budgetMin) : 0
    const maxAmount = budgetMax ? parseFloat(budgetMax) : Infinity

    supplierQuery = supplierQuery
      .gte('total_orders', 1) // Only suppliers with some history
      .filter('avg_order_amount', 'gte', minAmount)
      .filter('avg_order_amount', 'lte', maxAmount)
  }

  const { data: suppliers, error } = await supplierQuery

  if (error) {
    console.error('Error fetching suppliers for suggestions:', error)
    return []
  }

  // Score and rank suppliers
  const suggestions = (suppliers || []).map(supplier => {
    let score = 0
    let reasoning: string[] = []

    // Performance score (40% weight)
    const performanceScore = calculatePerformanceScore(supplier)
    score += performanceScore * 0.4
    if (performanceScore > 3.5) {
      reasoning.push(`Calificación alta: ${performanceScore.toFixed(1)}/5`)
    }

    // Relevance score (30% weight)
    const relevanceScore = calculateRelevanceScore(supplier, assetContext, requiredServices, problemDescription)
    score += relevanceScore * 0.3
    if (relevanceScore > 0.7) {
      reasoning.push('Fuerte coincidencia con el tipo de activo y servicios requeridos')
    }

    // Urgency compatibility (15% weight)
    const urgencyScore = calculateUrgencyScore(supplier, urgency)
    score += urgencyScore * 0.15
    if (urgencyScore > 0.8) {
      reasoning.push('Experiencia con trabajos urgentes')
    }

    // Cost effectiveness (15% weight)
    const costScore = calculateCostScore(supplier, budgetMin, budgetMax)
    score += costScore * 0.15
    if (costScore > 0.8) {
      reasoning.push('Costo competitivo dentro del presupuesto')
    }

    return {
      supplier,
      score: Math.round(score * 100), // Convert to 0-100 scale
      reasoning,
      estimated_cost: supplier.avg_order_amount || 0,
      estimated_completion_time: calculateEstimatedCompletionTime(supplier, urgency),
      confidence_level: Math.min(score, 1) * 100 // 0-100 confidence percentage
    }
  })

  // Sort by score and return top suggestions
  return suggestions.sort((a, b) => b.score - a.score)
}

// Helper functions for scoring
function calculatePerformanceScore(supplier: any): number {
  const rating = supplier.rating || 0
  const reliability = supplier.reliability_score || 0
  const totalOrders = supplier.total_orders || 0

  // Weighted average with experience multiplier
  const experienceMultiplier = Math.min(totalOrders / 10, 1.5)
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

function calculateUrgencyScore(supplier: any, urgency: string): number {
  // Higher urgency requires faster response times
  const avgDeliveryTime = supplier.avg_delivery_time || 7

  switch (urgency) {
    case 'critical':
      return avgDeliveryTime <= 1 ? 1 : avgDeliveryTime <= 3 ? 0.8 : 0.4
    case 'high':
      return avgDeliveryTime <= 3 ? 1 : avgDeliveryTime <= 7 ? 0.8 : 0.6
    case 'medium':
      return avgDeliveryTime <= 7 ? 1 : avgDeliveryTime <= 14 ? 0.7 : 0.5
    case 'low':
      return 1 // All suppliers acceptable for low urgency
    default:
      return 0.5
  }
}

function calculateCostScore(supplier: any, budgetMin: string | null, budgetMax: string | null): number {
  const avgOrderAmount = supplier.avg_order_amount || 0

  if (!budgetMin && !budgetMax) {
    return 1
  }

  const minAmount = budgetMin ? parseFloat(budgetMin) : 0
  const maxAmount = budgetMax ? parseFloat(budgetMax) : Infinity

  if (avgOrderAmount >= minAmount && avgOrderAmount <= maxAmount) {
    return 1
  } else if (avgOrderAmount < minAmount) {
    return 0.3 // Too cheap might indicate quality issues
  } else {
    return Math.max(0, 1 - ((avgOrderAmount - maxAmount) / maxAmount))
  }
}

function calculateEstimatedCompletionTime(supplier: any, urgency: string): number {
  const baseTime = supplier.avg_delivery_time || 7

  // Adjust based on urgency
  switch (urgency) {
    case 'critical':
      return Math.max(1, baseTime * 0.5) // 50% faster for critical
    case 'high':
      return Math.max(2, baseTime * 0.7) // 30% faster for high
    case 'medium':
      return baseTime
    case 'low':
      return baseTime * 1.2 // 20% slower for low urgency
    default:
      return baseTime
  }
}
