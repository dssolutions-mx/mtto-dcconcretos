import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { getExpenseCategoryById, getExpenseCategoryDisplayName } from '@/lib/constants/expense-categories'

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
      expense_category: string | null
      expense_subcategory: string | null
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
          expense_category: adj.expense_category || null,
          expense_subcategory: adj.expense_subcategory || null,
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
              expense_category: adj.expense_category || null,
              expense_subcategory: adj.expense_subcategory || null,
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
                expense_category: adj.expense_category || null,
                expense_subcategory: adj.expense_subcategory || null,
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

    // Group by expense_category for otros_indirectos, by department for nomina
    if (category === 'otros_indirectos') {
      // Group primarily by expense_category, then by department, then by expense_subcategory
      // Structure: Map<expense_category, Map<department, Map<expense_subcategory, entries[]>>>
      const expenseCategoryMap = new Map<string, Map<string | null, Map<string | null, typeof entries>>>()
      
      entries.forEach(entry => {
        const expenseCat = entry.expense_category || 'Sin Categoría'
        const dept = entry.department || null
        const expenseSubcat = entry.expense_subcategory || null
        
        if (!expenseCategoryMap.has(expenseCat)) {
          expenseCategoryMap.set(expenseCat, new Map())
        }
        
        const departmentMap = expenseCategoryMap.get(expenseCat)!
        if (!departmentMap.has(dept)) {
          departmentMap.set(dept, new Map())
        }
        
        const subcategoryMap = departmentMap.get(dept)!
        if (!subcategoryMap.has(expenseSubcat)) {
          subcategoryMap.set(expenseSubcat, [])
        }
        
        subcategoryMap.get(expenseSubcat)!.push(entry)
      })

      // Convert to array format - group by expense category, then department, then subcategory
      const departments: Array<{
        department: string
        expense_category: string | null
        expense_subcategory: string | null
        total: number
        entries: Array<{
          id: string
          description: string | null
          subcategory: string | null
          expense_category: string | null
          expense_subcategory: string | null
          amount: number
          is_distributed: boolean
          distribution_method: string | null
        }>
      }> = []

      // Sort expense categories by ID (1-14)
      const sortedCategories = Array.from(expenseCategoryMap.entries()).sort((a, b) => {
        const aId = a[0] === 'Sin Categoría' ? '999' : a[0]
        const bId = b[0] === 'Sin Categoría' ? '999' : b[0]
        return aId.localeCompare(bId, undefined, { numeric: true })
      })

      sortedCategories.forEach(([expenseCat, departmentMap]) => {
        // Get category display name
        const categoryObj = expenseCat !== 'Sin Categoría' ? getExpenseCategoryById(expenseCat) : null
        const categoryDisplayName = categoryObj 
          ? getExpenseCategoryDisplayName(categoryObj)
          : 'Sin Categoría'

        // Sort departments (null/General last)
        const sortedDepartments = Array.from(departmentMap.entries()).sort((a, b) => {
          if (a[0] === null) return 1
          if (b[0] === null) return -1
          return (a[0] || '').localeCompare(b[0] || '')
        })

        sortedDepartments.forEach(([dept, subcategoryMap]) => {
          const deptDisplayName = dept || 'General'
          
          // Group by subcategory within this department
          const subcategoryEntries = Array.from(subcategoryMap.entries())
          
          if (subcategoryEntries.length === 0) {
            // No subcategories, just group all entries under the category + department
            const allEntries = Array.from(subcategoryMap.values()).flat()
            departments.push({
              department: `${categoryDisplayName} - ${deptDisplayName}`,
              expense_category: expenseCat !== 'Sin Categoría' ? expenseCat : null,
              expense_subcategory: null,
              total: allEntries.reduce((sum, e) => sum + e.amount, 0),
              entries: allEntries.map(e => ({
                id: e.id,
                description: e.description,
                subcategory: e.subcategory,
                expense_category: e.expense_category,
                expense_subcategory: e.expense_subcategory,
                amount: e.amount,
                is_distributed: e.is_distributed,
                distribution_method: e.distribution_method
              }))
            })
          } else {
            // Group by subcategory
            subcategoryEntries.forEach(([expenseSubcat, subcatEntries]) => {
              const subcatDisplayName = expenseSubcat || 'Sin Subcategoría'
              departments.push({
                department: `${categoryDisplayName} - ${deptDisplayName}${expenseSubcat ? ` - ${subcatDisplayName}` : ''}`,
                expense_category: expenseCat !== 'Sin Categoría' ? expenseCat : null,
                expense_subcategory: expenseSubcat,
                total: subcatEntries.reduce((sum, e) => sum + e.amount, 0),
                entries: subcatEntries.map(e => ({
                  id: e.id,
                  description: e.description,
                  subcategory: e.subcategory,
                  expense_category: e.expense_category,
                  expense_subcategory: e.expense_subcategory,
                  amount: e.amount,
                  is_distributed: e.is_distributed,
                  distribution_method: e.distribution_method
                }))
              })
            })
          }
        })
      })

      // Add autoconsumo (Instalación / Autoconsumo) from plant_indirect_material_costs - appears when expanded
      if (plant.code && process.env.COTIZADOR_SUPABASE_URL && process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const cotizadorSupabase = createClient(
            process.env.COTIZADOR_SUPABASE_URL,
            process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY,
            { auth: { persistSession: false } }
          )
          const { data: indirectRows } = await cotizadorSupabase
            .from('plant_indirect_material_costs')
            .select('amount')
            .eq('period_start', periodMonth)
            .eq('plant_code', plant.code)

          const autoconsumoTotal = (indirectRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
          if (autoconsumoTotal > 0) {
            const autoconsumoDept = {
              department: '1. OPERACIÓN DE PLANTA - General - Instalación / Autoconsumo',
              expense_category: '1',
              expense_subcategory: 'Instalación / Autoconsumo',
              total: autoconsumoTotal,
              entries: [{
                id: 'autoconsumo-plant_indirect_material_costs',
                description: 'Concreto sin ingresos (autoconsumo, pruebas industriales, consumo interno)',
                subcategory: 'Instalación / Autoconsumo',
                expense_category: '1',
                expense_subcategory: 'Instalación / Autoconsumo',
                amount: autoconsumoTotal,
                is_distributed: false,
                distribution_method: null
              }]
            }
            departments.unshift(autoconsumoDept)
          }
        } catch (err) {
          console.error('Error fetching autoconsumo for details:', err)
        }
      }

      return NextResponse.json({ departments })
    } else {
      // For nomina, keep existing department grouping
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
        expense_category: null,
        expense_subcategory: null,
        total: deptEntries.reduce((sum, e) => sum + e.amount, 0),
        entries: deptEntries.map(e => ({
          id: e.id,
          description: e.description,
          subcategory: e.subcategory,
          expense_category: e.expense_category,
          expense_subcategory: e.expense_subcategory,
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
    }
  } catch (e: any) {
    console.error('GET cost details error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

