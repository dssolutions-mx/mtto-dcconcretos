import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { cotizadorPlantFinancialUnifiedViewName } from '@/lib/reports/cotizador-financial-unified-view'

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
        department,
        expense_category,
        expense_subcategory,
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
        needsUpdate: [],
      })
    }

    // Use cotizador to get current volumes
    const cotizadorSupabase = createClient(
      process.env.COTIZADOR_SUPABASE_URL!,
      process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const financialView = cotizadorPlantFinancialUnifiedViewName(periodMonth)
    const { data: viewData, error: viewError } = await cotizadorSupabase
      .from(financialView)
      .select('plant_code, volumen_concreto_m3')
      .eq('period_start', periodMonth)

    if (viewError) {
      console.error('Fetch volumes error:', viewError)
    }

    const currentVolumesByCode = new Map<string, number>()
    if (viewData) {
      viewData.forEach((row: { plant_code?: string; volumen_concreto_m3?: number | string }) => {
        const code = row.plant_code
        const volume = Number(row.volumen_concreto_m3 || 0)
        if (code) {
          const existing = currentVolumesByCode.get(code) || 0
          currentVolumesByCode.set(code, existing + volume)
        }
      })
    }

    const plantIds = new Set<string>()
    adjustments.forEach(adj => {
      adj.distributions?.forEach((dist: { plant_id?: string | null }) => {
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

    type ChangeRow = {
      plantId: string
      plantCode: string
      plantName: string
      originalVolume: number
      currentVolume: number
      volumeDiff: number
      originalAmount: number
      newAmount: number
      amountDiff: number
      neverSyncedRow: boolean
    }

    const needsUpdate: Array<{
      adjustmentId: string
      neverSynced: boolean
      adjustment: {
        id: string
        amount: number
        category: string
        description: string | null
        department: string | null
        expense_category: string | null
        expense_subcategory: string | null
        period_month: string
      }
      changes: ChangeRow[]
      totalVolumeDiff: number
      totalAmountDiff: number
    }> = []

    adjustments.forEach(adj => {
      if (!adj.distributions || adj.distributions.length === 0) return

      const changes: ChangeRow[] = []
      let totalOriginalVolume = 0
      let totalCurrentVolume = 0
      let totalOriginalAmountChanged = 0
      let neverSynced = false

      adj.distributions.forEach((dist: {
        plant_id?: string | null
        volume_m3?: number | string | null
        amount?: number | string | null
        plant?: { name?: string; code?: string } | null
      }) => {
        if (!dist.plant_id) return

        const plantCode = plantIdToCode.get(dist.plant_id)
        if (!plantCode) return

        const storedVol = dist.volume_m3
        const hasStoredVolume = storedVol !== null && storedVol !== undefined
        const originalVolume = hasStoredVolume ? Number(storedVol) : 0
        const currentVolume = currentVolumesByCode.get(plantCode) || 0
        const volumeDiff = currentVolume - originalVolume

        let needsRowUpdate = false
        if (!hasStoredVolume) {
          neverSynced = true
          needsRowUpdate = true
        } else {
          const percentDiff =
            originalVolume > 0 ? Math.abs((volumeDiff / originalVolume) * 100) : 0
          needsRowUpdate = Math.abs(volumeDiff) > 0.01 || percentDiff > 1
        }

        totalOriginalVolume += originalVolume
        totalCurrentVolume += currentVolume

        const originalAmount = Number(dist.amount || 0)

        if (needsRowUpdate) {
          totalOriginalAmountChanged += originalAmount
          changes.push({
            plantId: dist.plant_id,
            plantCode,
            plantName: dist.plant?.name || plantCode,
            originalVolume,
            currentVolume,
            volumeDiff,
            originalAmount,
            newAmount: 0,
            amountDiff: 0,
            neverSyncedRow: !hasStoredVolume,
          })
        }
      })

      if (changes.length > 0 && totalCurrentVolume > 0) {
        const totalAmount = Number(adj.amount || 0)
        let totalNewAmount = 0

        changes.forEach(change => {
          const newPercentage = (change.currentVolume / totalCurrentVolume) * 100
          change.newAmount = (totalAmount * newPercentage) / 100
          change.amountDiff = change.newAmount - change.originalAmount
          totalNewAmount += change.newAmount
        })

        const totalAmountDiff = totalNewAmount - totalOriginalAmountChanged

        needsUpdate.push({
          adjustmentId: adj.id,
          neverSynced,
          adjustment: {
            id: adj.id,
            amount: adj.amount,
            category: adj.category,
            description: adj.description,
            department: adj.department ?? null,
            expense_category: adj.expense_category ?? null,
            expense_subcategory: adj.expense_subcategory ?? null,
            period_month: adj.period_month,
          },
          changes,
          totalVolumeDiff: totalCurrentVolume - totalOriginalVolume,
          totalAmountDiff,
        })
      }
    })

    return NextResponse.json({
      adjustments: adjustments.map(adj => ({
        id: adj.id,
        amount: adj.amount,
        category: adj.category,
        description: adj.description,
        department: adj.department,
        expense_category: adj.expense_category,
        expense_subcategory: adj.expense_subcategory,
        distribution_method: adj.distribution_method,
        distributions: adj.distributions,
      })),
      needsUpdate,
    })
  } catch (e: unknown) {
    console.error('Check updates error:', e)
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
