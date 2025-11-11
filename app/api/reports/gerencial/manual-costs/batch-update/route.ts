import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

// POST: Batch update multiple distributed adjustments with new volumes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { adjustmentIds, month } = body

    if (!adjustmentIds || !Array.isArray(adjustmentIds) || adjustmentIds.length === 0) {
      return NextResponse.json(
        { error: 'adjustmentIds array required' },
        { status: 400 }
      )
    }

    if (!month) {
      return NextResponse.json(
        { error: 'month parameter required' },
        { status: 400 }
      )
    }

    const [year, monthNum] = month.split('-').map(Number)
    const periodMonth = `${year}-${String(monthNum).padStart(2, '0')}-01`

    const supabase = await createServerSupabase()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch adjustments to update
    const { data: adjustments, error: fetchError } = await supabase
      .from('manual_financial_adjustments')
      .select(`
        id,
        amount,
        distributions:manual_financial_adjustment_distributions(
          id,
          plant_id,
          volume_m3,
          percentage,
          amount,
          plant:plants(id, name, code)
        )
      `)
      .in('id', adjustmentIds)
      .eq('period_month', periodMonth)
      .eq('is_distributed', true)
      .eq('distribution_method', 'volume')

    if (fetchError) {
      console.error('Fetch adjustments error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!adjustments || adjustments.length === 0) {
      return NextResponse.json({ error: 'No adjustments found to update' }, { status: 404 })
    }

    const cotizadorSupabase = createClient(
      process.env.COTIZADOR_SUPABASE_URL!,
      process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Fetch current volumes from view (use period_start like ingresos-gastos endpoint)
    const { data: viewData } = await cotizadorSupabase
      .from('vw_plant_financial_analysis_unified')
      .select('plant_code, volumen_concreto_m3')
      .eq('period_start', periodMonth)

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

    // Update each adjustment
    const results: Array<{
      adjustmentId: string
      success: boolean
      error?: string
      updatedDistributions: number
    }> = []

    for (const adj of adjustments) {
      try {
        if (!adj.distributions || adj.distributions.length === 0) {
          results.push({
            adjustmentId: adj.id,
            success: false,
            error: 'No distributions found',
            updatedDistributions: 0
          })
          continue
        }

        // Calculate total current volume for this adjustment
        let totalCurrentVolume = 0
        const distributionUpdates: Array<{
          id: string
          volumeM3: number
          percentage: number
          amount: number
        }> = []

        adj.distributions.forEach((dist: any) => {
          if (!dist.plant_id) return
          const plantCode = plantIdToCode.get(dist.plant_id)
          if (!plantCode) return

          const currentVolume = currentVolumesByCode.get(plantCode) || 0
          totalCurrentVolume += currentVolume

          distributionUpdates.push({
            id: dist.id,
            volumeM3: currentVolume,
            percentage: 0, // Will calculate below
            amount: 0 // Will calculate below
          })
        })

        if (totalCurrentVolume === 0) {
          results.push({
            adjustmentId: adj.id,
            success: false,
            error: 'No current volume data available',
            updatedDistributions: 0
          })
          continue
        }

        // Calculate new percentages and amounts
        const totalAmount = Number(adj.amount || 0)
        distributionUpdates.forEach(update => {
          update.percentage = (update.volumeM3 / totalCurrentVolume) * 100
          update.amount = (totalAmount * update.percentage) / 100
        })

        // Delete existing distributions
        await supabase
          .from('manual_financial_adjustment_distributions')
          .delete()
          .eq('adjustment_id', adj.id)

        // Insert updated distributions
        const newDistributions = distributionUpdates.map(update => {
          const dist = adj.distributions?.find((d: any) => d.id === update.id)
          return {
            adjustment_id: adj.id,
            plant_id: dist?.plant_id || null,
            business_unit_id: dist?.business_unit_id || null,
            department: dist?.department || null,
            percentage: update.percentage,
            amount: update.amount,
            volume_m3: update.volumeM3,
            created_by: user.id
          }
        })

        const { error: insertError } = await supabase
          .from('manual_financial_adjustment_distributions')
          .insert(newDistributions)

        if (insertError) {
          throw insertError
        }

        // Update adjustment timestamp
        await supabase
          .from('manual_financial_adjustments')
          .update({
            updated_at: new Date().toISOString(),
            updated_by: user.id
          })
          .eq('id', adj.id)

        results.push({
          adjustmentId: adj.id,
          success: true,
          updatedDistributions: distributionUpdates.length
        })
      } catch (error: any) {
        results.push({
          adjustmentId: adj.id,
          success: false,
          error: error.message || 'Update failed',
          updatedDistributions: 0
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failCount
      }
    })
  } catch (e: any) {
    console.error('Batch update error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

