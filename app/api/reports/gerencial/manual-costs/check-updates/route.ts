import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

// GET: Check which distributed adjustments need volume updates
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // YYYY-MM format

    if (!month) {
      return NextResponse.json({ error: 'Month parameter required' }, { status: 400 })
    }

    const [year, monthNum] = month.split('-').map(Number)
    const periodMonth = `${year}-${String(monthNum).padStart(2, '0')}-01`

    const supabase = await createServerSupabase()

    // Fetch all distributed adjustments with volume-based distribution for this month
    const { data: adjustments, error: adjError } = await supabase
      .from('manual_financial_adjustments')
      .select(`
        id,
        amount,
        category,
        description,
        distribution_method,
        period_month,
        distributions:manual_financial_adjustment_distributions(
          id,
          plant_id,
          volume_m3,
          percentage,
          amount,
          plant:plants(id, name, code)
        )
      `)
      .eq('period_month', periodMonth)
      .eq('is_distributed', true)
      .eq('distribution_method', 'volume')

    if (adjError) {
      console.error('Fetch adjustments error:', adjError)
      return NextResponse.json({ error: adjError.message }, { status: 500 })
    }

    if (!adjustments || adjustments.length === 0) {
      return NextResponse.json({ 
        adjustments: [],
        needsUpdate: []
      })
    }

    // Use cotizador to get current volumes
    const cotizadorSupabase = createClient(
      process.env.COTIZADOR_SUPABASE_URL!,
      process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Fetch current volumes from view (use period_start like ingresos-gastos endpoint)
    const { data: viewData, error: viewError } = await cotizadorSupabase
      .from('vw_plant_financial_analysis_unified')
      .select('plant_code, volumen_concreto_m3')
      .eq('period_start', periodMonth)

    if (viewError) {
      console.error('Fetch volumes error:', viewError)
      // Continue anyway - we'll mark as needs update if we can't verify
    }

    // Create map of current volumes by plant code
    const currentVolumesByCode = new Map<string, number>()
    if (viewData) {
      viewData.forEach((row: any) => {
        const code = row.plant_code
        const volume = Number(row.volumen_concreto_m3 || 0)
        if (code) {
          const existing = currentVolumesByCode.get(code) || 0
          currentVolumesByCode.set(code, existing + volume)
        }
      })
    }

    // Get plant code mapping
    const plantIds = new Set<string>()
    adjustments.forEach(adj => {
      adj.distributions?.forEach((dist: any) => {
        if (dist.plant_id) plantIds.add(dist.plant_id)
      })
    })

    const { data: plants } = await supabase
      .from('plants')
      .select('id, code')
      .in('id', Array.from(plantIds))

    const plantIdToCode = new Map<string, string>()
    plants?.forEach(p => {
      plantIdToCode.set(p.id, p.code)
    })

    // Check each adjustment for volume changes
    const needsUpdate: Array<{
      adjustmentId: string
      adjustment: any
      changes: Array<{
        plantId: string
        plantCode: string
        plantName: string
        originalVolume: number
        currentVolume: number
        volumeDiff: number
        originalAmount: number
        newAmount: number
        amountDiff: number
      }>
      totalVolumeDiff: number
      totalAmountDiff: number
    }> = []

    adjustments.forEach(adj => {
      if (!adj.distributions || adj.distributions.length === 0) return

      const changes: Array<{
        plantId: string
        plantCode: string
        plantName: string
        originalVolume: number
        currentVolume: number
        volumeDiff: number
        originalAmount: number
        newAmount: number
        amountDiff: number
      }> = []

      let totalOriginalVolume = 0
      let totalCurrentVolume = 0
      let totalOriginalAmount = 0
      let totalNewAmount = 0

      adj.distributions.forEach((dist: any) => {
        if (!dist.plant_id || dist.volume_m3 === null || dist.volume_m3 === undefined) return

        const plantCode = plantIdToCode.get(dist.plant_id)
        if (!plantCode) return

        const originalVolume = Number(dist.volume_m3 || 0)
        const currentVolume = currentVolumesByCode.get(plantCode) || 0
        const volumeDiff = currentVolume - originalVolume

        // Only flag as changed if difference is significant (> 0.01 m³ or > 1%)
        const percentDiff = originalVolume > 0 ? Math.abs((volumeDiff / originalVolume) * 100) : 0
        const hasSignificantChange = Math.abs(volumeDiff) > 0.01 || percentDiff > 1

        if (hasSignificantChange) {
          totalOriginalVolume += originalVolume
          totalCurrentVolume += currentVolume

          const originalAmount = Number(dist.amount || 0)
          totalOriginalAmount += originalAmount

          // Calculate new amount based on current volume
          // We need total volume to calculate percentage
          // For now, we'll calculate it later when we have all volumes
          changes.push({
            plantId: dist.plant_id,
            plantCode: plantCode,
            plantName: dist.plant?.name || plantCode,
            originalVolume,
            currentVolume,
            volumeDiff,
            originalAmount,
            newAmount: 0, // Will calculate below
            amountDiff: 0
          })
        } else {
          totalOriginalVolume += originalVolume
          totalCurrentVolume += currentVolume
          totalOriginalAmount += Number(dist.amount || 0)
        }
      })

      // Calculate new amounts for changed plants
      if (changes.length > 0 && totalCurrentVolume > 0) {
        const totalAmount = Number(adj.amount || 0)
        
        changes.forEach(change => {
          const newPercentage = (change.currentVolume / totalCurrentVolume) * 100
          change.newAmount = (totalAmount * newPercentage) / 100
          change.amountDiff = change.newAmount - change.originalAmount
          totalNewAmount += change.newAmount
        })

        // Calculate total amount diff
        const totalAmountDiff = totalNewAmount - totalOriginalAmount

        needsUpdate.push({
          adjustmentId: adj.id,
          adjustment: {
            id: adj.id,
            amount: adj.amount,
            category: adj.category,
            description: adj.description,
            period_month: adj.period_month
          },
          changes,
          totalVolumeDiff: totalCurrentVolume - totalOriginalVolume,
          totalAmountDiff
        })
      }
    })

    return NextResponse.json({
      adjustments: adjustments.map(adj => ({
        id: adj.id,
        amount: adj.amount,
        category: adj.category,
        description: adj.description,
        distribution_method: adj.distribution_method,
        distributions: adj.distributions
      })),
      needsUpdate
    })
  } catch (e: any) {
    console.error('Check updates error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

