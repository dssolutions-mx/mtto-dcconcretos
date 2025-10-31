import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'

// GET: Fetch manual cost details grouped by department
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // YYYY-MM format
    const plantId = searchParams.get('plantId')
    const category = searchParams.get('category') // 'nomina' | 'otros_indirectos'

    if (!month || !plantId || !category) {
      return NextResponse.json(
        { error: 'Missing required parameters: month, plantId, category' },
        { status: 400 }
      )
    }

    if (!['nomina', 'otros_indirectos'].includes(category)) {
      return NextResponse.json(
        { error: 'Category must be either nomina or otros_indirectos' },
        { status: 400 }
      )
    }

    const [year, monthNum] = month.split('-').map(Number)
    const periodMonth = `${year}-${String(monthNum).padStart(2, '0')}-01`

    const supabase = await createServerSupabase()

    // Get plant code for matching
    const { data: plant } = await supabase
      .from('plants')
      .select('id, code')
      .eq('id', plantId)
      .single()

    if (!plant) {
      return NextResponse.json({ error: 'Plant not found' }, { status: 404 })
    }

    // Fetch manual adjustments for this plant/month/category
    // Need to handle both direct assignments and distributions
    const { data: adjustments } = await supabase
      .from('manual_financial_adjustments')
      .select(`
        *,
        distributions:manual_financial_adjustment_distributions(
          id,
          plant_id,
          amount,
          department
        )
      `)
      .eq('period_month', periodMonth)
      .eq('category', category)

    // Get department to plant mapping for distributed entries
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('departamento, plant_id')
      .not('departamento', 'is', null)
      .not('plant_id', 'is', null)
    
    const departmentToPlants = new Map<string, string[]>()
    ;(profilesData || []).forEach(profile => {
      if (profile.departamento && profile.plant_id) {
        if (!departmentToPlants.has(profile.departamento)) {
          departmentToPlants.set(profile.departamento, [])
        }
        if (!departmentToPlants.get(profile.departamento)!.includes(profile.plant_id)) {
          departmentToPlants.get(profile.departamento)!.push(profile.plant_id)
        }
      }
    })

    // Collect all entries for this plant
    const entries: Array<{
      id: string
      description: string | null
      subcategory: string | null
      amount: number
      department: string | null
      is_distributed: boolean
      distribution_method: string | null
    }> = []

    ;(adjustments || []).forEach(adj => {
      // Direct plant assignment
      if (adj.plant_id === plantId) {
        entries.push({
          id: adj.id,
          description: adj.description,
          subcategory: adj.subcategory,
          amount: Number(adj.amount || 0),
          department: adj.department,
          is_distributed: Boolean(adj.is_distributed),
          distribution_method: adj.distribution_method
        })
      }

      // Distributed entries - check if this plant is included
      if (adj.is_distributed && adj.distributions && Array.isArray(adj.distributions)) {
        adj.distributions.forEach((dist: any) => {
          // Direct plant distribution
          if (dist.plant_id === plantId) {
            entries.push({
              id: `${adj.id}-${dist.id}`,
              description: adj.description,
              subcategory: adj.subcategory,
              amount: Number(dist.amount || 0),
              department: dist.department || adj.department,
              is_distributed: true,
              distribution_method: adj.distribution_method
            })
          }

          // Department distribution - check if plant has this department
          if (dist.department) {
            const departmentPlants = departmentToPlants.get(dist.department) || []
            if (departmentPlants.includes(plantId)) {
              // Distribute equally among plants with this department
              const amountPerPlant = Number(dist.amount || 0) / departmentPlants.length
              entries.push({
                id: `${adj.id}-${dist.id}-dept`,
                description: adj.description,
                subcategory: adj.subcategory,
                amount: amountPerPlant,
                department: dist.department,
                is_distributed: true,
                distribution_method: adj.distribution_method
              })
            }
          }
        })
      }
    })

    // Group by department
    const departmentMap = new Map<string | null, typeof entries>()
    entries.forEach(entry => {
      const dept = entry.department || null
      if (!departmentMap.has(dept)) {
        departmentMap.set(dept, [])
      }
      departmentMap.get(dept)!.push(entry)
    })

    // Convert to array format with totals
    const departments = Array.from(departmentMap.entries()).map(([department, deptEntries]) => ({
      department: department || 'Sin Departamento',
      total: deptEntries.reduce((sum, e) => sum + e.amount, 0),
      entries: deptEntries.map(e => ({
        id: e.id,
        description: e.description,
        subcategory: e.subcategory,
        amount: e.amount,
        is_distributed: e.is_distributed,
        distribution_method: e.distribution_method
      }))
    }))

    // Sort departments alphabetically, with "Sin Departamento" last
    departments.sort((a, b) => {
      if (a.department === 'Sin Departamento') return 1
      if (b.department === 'Sin Departamento') return -1
      return a.department.localeCompare(b.department)
    })

    return NextResponse.json({ departments })
  } catch (e: any) {
    console.error('GET cost details error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

