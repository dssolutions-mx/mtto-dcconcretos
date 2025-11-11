import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { EXPENSE_CATEGORIES, getExpenseCategoryById, isValidSubcategory, getValidCategoryIds } from '@/lib/constants/expense-categories'

// GET: Fetch manual costs for a specific month
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // YYYY-MM format
    const plantId = searchParams.get('plantId')
    const businessUnitId = searchParams.get('businessUnitId')

    if (!month) {
      return NextResponse.json({ error: 'Month parameter required' }, { status: 400 })
    }

    const [year, monthNum] = month.split('-').map(Number)
    const periodMonth = `${year}-${String(monthNum).padStart(2, '0')}-01`

    const supabase = await createServerSupabase()

    let query = supabase
      .from('manual_financial_adjustments')
      .select(`
        *,
        plant:plants(id, name, code),
        business_unit:business_units(id, name, code),
        created_by_profile:profiles!manual_financial_adjustments_created_by_fkey(id, nombre, apellido, email),
        distributions:manual_financial_adjustment_distributions(
          id,
          business_unit_id,
          plant_id,
          department,
          percentage,
          amount,
          volume_m3,
          business_unit:business_units(id, name, code),
          plant:plants(id, name, code)
        )
      `)
      .eq('period_month', periodMonth)
      .order('created_at', { ascending: false })

    // Filter by plant or business unit if specified
    // Note: Filtering works for both direct assignments and distributed entries
    // Distributed entries keep business_unit_id for filtering, but allocation is via distributions
    if (plantId) {
      query = query.eq('plant_id', plantId)
    } else if (businessUnitId) {
      query = query.eq('business_unit_id', businessUnitId)
    }
    // If no filter, show all entries for the month

    const { data, error } = await query

    if (error) {
      console.error('Fetch manual costs error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ adjustments: data || [] })
  } catch (e: any) {
    console.error('GET manual costs error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

// POST: Create new manual cost entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      businessUnitId,
      plantId,
      month, // YYYY-MM format
      category,
      department,
      subcategory,
      expenseCategory,
      expenseSubcategory,
      description,
      amount,
      notes,
      isBonus,
      isCashPayment,
      distributionMethod,
      distributions // Array of distribution targets
    } = body

    // Validation
    if (!month || !category || amount == null) {
      return NextResponse.json(
        { error: 'Missing required fields: month, category, amount' },
        { status: 400 }
      )
    }

    if (!['nomina', 'otros_indirectos'].includes(category)) {
      return NextResponse.json(
        { error: 'Category must be either nomina or otros_indirectos' },
        { status: 400 }
      )
    }

    // Validate expense category for otros_indirectos
    if (category === 'otros_indirectos') {
      if (!expenseCategory) {
        return NextResponse.json(
          { error: 'expenseCategory is required when category is otros_indirectos' },
          { status: 400 }
        )
      }
      
      if (!getValidCategoryIds().includes(expenseCategory)) {
        return NextResponse.json(
          { error: `expenseCategory must be one of: ${getValidCategoryIds().join(', ')}` },
          { status: 400 }
        )
      }

      // Validate expense subcategory if provided
      if (expenseSubcategory && !isValidSubcategory(expenseCategory, expenseSubcategory)) {
        return NextResponse.json(
          { error: `expenseSubcategory "${expenseSubcategory}" is not valid for expenseCategory "${expenseCategory}"` },
          { status: 400 }
        )
      }
    } else {
      // For nomina, expense category fields should not be provided
      if (expenseCategory || expenseSubcategory) {
        return NextResponse.json(
          { error: 'expenseCategory and expenseSubcategory are only valid for otros_indirectos category' },
          { status: 400 }
        )
      }
    }

    // Validation logic:
    // - If plantId is set: direct assignment, no distributions needed
    // - If only businessUnitId is set: distributions required to allocate to plants within that BU
    // - If neither is set: distributions required (company-wide distribution)
    if (!plantId) {
      // No plant selected - distributions are required
      if (!distributions || !Array.isArray(distributions) || distributions.length === 0) {
        return NextResponse.json(
          { error: businessUnitId 
            ? 'Distributions must be provided when only business unit is selected. Please distribute the cost among plants.'
            : 'Either plantId or distributions must be provided' },
          { status: 400 }
        )
      }

      // Validate distribution method
      if (!distributionMethod || !['percentage', 'volume'].includes(distributionMethod)) {
        return NextResponse.json(
          { error: 'distributionMethod must be "percentage" or "volume" when using distributions' },
          { status: 400 }
        )
      }

      // Validate percentage method: percentages must sum to 100
      if (distributionMethod === 'percentage') {
        const totalPercentage = distributions.reduce((sum: number, d: any) => sum + (Number(d.percentage) || 0), 0)
        if (Math.abs(totalPercentage - 100) > 0.01) {
          return NextResponse.json(
            { error: `Distribution percentages must sum to 100%. Current sum: ${totalPercentage.toFixed(2)}%` },
            { status: 400 }
          )
        }
      }
    } else {
      // Plant is selected - no distributions allowed (direct assignment)
      if (distributions && distributions.length > 0) {
        return NextResponse.json(
          { error: 'Cannot use distributions when a plant is directly assigned' },
          { status: 400 }
        )
      }
    }

    const [year, monthNum] = month.split('-').map(Number)
    const periodMonth = `${year}-${String(monthNum).padStart(2, '0')}-01`

    const supabase = await createServerSupabase()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isDistributed = !!(distributions && distributions.length > 0)
    const totalAmount = parseFloat(amount)

    // Create the main adjustment record
    // Note: Store business_unit_id even when distributed for filtering/reporting purposes
    // The distribution records handle the actual allocation, but the main record keeps BU for reference
    const adjustmentData: any = {
      business_unit_id: businessUnitId || null, // Keep BU even when distributed for filtering
      plant_id: plantId || null, // Only store plant if directly assigned (not distributed)
      period_month: periodMonth,
      category,
      department: department || null,
      subcategory: subcategory || null,
      expense_category: category === 'otros_indirectos' ? expenseCategory : null,
      expense_subcategory: category === 'otros_indirectos' ? (expenseSubcategory || null) : null,
      description: description || null,
      amount: totalAmount,
      notes: notes || null,
      is_bonus: Boolean(isBonus),
      is_cash_payment: Boolean(isCashPayment),
      is_distributed: isDistributed,
      distribution_method: distributionMethod || null,
      created_by: user.id,
      updated_by: user.id
    }

    const { data: adjustment, error: adjError } = await supabase
      .from('manual_financial_adjustments')
      .insert(adjustmentData)
      .select()
      .single()

    if (adjError) {
      console.error('Insert manual cost error:', adjError)
      return NextResponse.json({ error: adjError.message }, { status: 500 })
    }

    // Create distribution records if applicable
    if (isDistributed && distributions && distributions.length > 0) {
      const distributionRecords = distributions.map((dist: any) => {
        let calculatedAmount = 0
        let calculatedPercentage = 0

        if (distributionMethod === 'percentage') {
          calculatedPercentage = Number(dist.percentage) || 0
          calculatedAmount = (totalAmount * calculatedPercentage) / 100
        } else if (distributionMethod === 'volume') {
          // For volume-based, percentage and amount should already be calculated on frontend
          calculatedPercentage = Number(dist.percentage) || 0
          calculatedAmount = Number(dist.amount) || 0
        }

        return {
          adjustment_id: adjustment.id,
          business_unit_id: dist.businessUnitId || null,
          plant_id: dist.plantId || null,
          department: dist.department || null,
          percentage: calculatedPercentage,
          amount: calculatedAmount,
          volume_m3: dist.volumeM3 || null,
          created_by: user.id
        }
      })

      const { error: distError } = await supabase
        .from('manual_financial_adjustment_distributions')
        .insert(distributionRecords)

      if (distError) {
        console.error('Insert distributions error:', distError)
        // Rollback: delete the adjustment if distributions fail
        await supabase.from('manual_financial_adjustments').delete().eq('id', adjustment.id)
        return NextResponse.json({ error: distError.message }, { status: 500 })
      }
    }

    // Fetch the complete record with distributions
    const { data: completeAdjustment, error: fetchError } = await supabase
      .from('manual_financial_adjustments')
      .select(`
        *,
        plant:plants(id, name, code),
        business_unit:business_units(id, name, code),
        created_by_profile:profiles!manual_financial_adjustments_created_by_fkey(id, nombre, apellido, email),
        distributions:manual_financial_adjustment_distributions(
          id,
          business_unit_id,
          plant_id,
          department,
          percentage,
          amount,
          volume_m3,
          business_unit:business_units(id, name, code),
          plant:plants(id, name, code)
        )
      `)
      .eq('id', adjustment.id)
      .single()

    if (fetchError) {
      console.error('Fetch complete adjustment error:', fetchError)
      return NextResponse.json({ adjustment }, { status: 201 })
    }

    return NextResponse.json({ adjustment: completeAdjustment }, { status: 201 })
  } catch (e: any) {
    console.error('POST manual costs error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

// PUT: Update existing manual cost entry
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      department,
      subcategory,
      expenseCategory,
      expenseSubcategory,
      description,
      amount,
      notes,
      isBonus,
      isCashPayment,
      distributionMethod,
      distributions
    } = body

    if (!id) {
      return NextResponse.json({ error: 'ID required for update' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch current adjustment to check category and if it's distributed
    const { data: currentAdjustment, error: fetchError } = await supabase
      .from('manual_financial_adjustments')
      .select('id, category, is_distributed, amount')
      .eq('id', id)
      .single()

    if (fetchError || !currentAdjustment) {
      return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 })
    }

    const category = currentAdjustment.category

    // Validate expense category fields if category is otros_indirectos
    if (category === 'otros_indirectos') {
      if (expenseCategory !== undefined) {
        if (!expenseCategory) {
          return NextResponse.json(
            { error: 'expenseCategory is required when category is otros_indirectos' },
            { status: 400 }
          )
        }
        
        if (!getValidCategoryIds().includes(expenseCategory)) {
          return NextResponse.json(
            { error: `expenseCategory must be one of: ${getValidCategoryIds().join(', ')}` },
            { status: 400 }
          )
        }
      }

      // Validate expense subcategory if provided
      if (expenseSubcategory !== undefined && expenseSubcategory) {
        const categoryToValidate = expenseCategory || currentAdjustment.expense_category
        if (categoryToValidate && !isValidSubcategory(categoryToValidate, expenseSubcategory)) {
          return NextResponse.json(
            { error: `expenseSubcategory "${expenseSubcategory}" is not valid for expenseCategory "${categoryToValidate}"` },
            { status: 400 }
          )
        }
      }
    } else {
      // For nomina, expense category fields should not be provided
      if (expenseCategory !== undefined || expenseSubcategory !== undefined) {
        return NextResponse.json(
          { error: 'expenseCategory and expenseSubcategory are only valid for otros_indirectos category' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }

    if (department !== undefined) updateData.department = department
    if (subcategory !== undefined) updateData.subcategory = subcategory
    if (description !== undefined) updateData.description = description
    if (amount !== undefined) updateData.amount = parseFloat(amount)
    if (notes !== undefined) updateData.notes = notes
    if (isBonus !== undefined) updateData.is_bonus = Boolean(isBonus)
    if (isCashPayment !== undefined) updateData.is_cash_payment = Boolean(isCashPayment)
    if (distributionMethod !== undefined) updateData.distribution_method = distributionMethod
    
    // Handle expense category fields
    if (category === 'otros_indirectos') {
      if (expenseCategory !== undefined) updateData.expense_category = expenseCategory
      if (expenseSubcategory !== undefined) updateData.expense_subcategory = expenseSubcategory || null
    } else {
      // Clear expense category fields if switching from otros_indirectos to nomina (shouldn't happen, but handle it)
      if (expenseCategory !== undefined) updateData.expense_category = null
      if (expenseSubcategory !== undefined) updateData.expense_subcategory = null
    }

    const totalAmount = amount !== undefined ? parseFloat(amount) : currentAdjustment.amount
    const isDistributed = !!(distributions && distributions.length > 0)
    
    if (distributions !== undefined) {
      updateData.is_distributed = isDistributed

      // Validate distributions if provided
      if (isDistributed) {
        if (!distributionMethod || !['percentage', 'volume'].includes(distributionMethod)) {
          return NextResponse.json(
            { error: 'distributionMethod must be "percentage" or "volume" when using distributions' },
            { status: 400 }
          )
        }

        if (distributionMethod === 'percentage') {
          const totalPercentage = distributions.reduce((sum: number, d: any) => sum + (Number(d.percentage) || 0), 0)
          if (Math.abs(totalPercentage - 100) > 0.01) {
            return NextResponse.json(
              { error: `Distribution percentages must sum to 100%. Current sum: ${totalPercentage.toFixed(2)}%` },
              { status: 400 }
            )
          }
        }
      }
    }

    // Update the main adjustment record
    const { data, error } = await supabase
      .from('manual_financial_adjustments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update manual cost error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update distributions if provided
    if (distributions !== undefined) {
      // Delete existing distributions
      await supabase
        .from('manual_financial_adjustment_distributions')
        .delete()
        .eq('adjustment_id', id)

      // Insert new distributions if any
      if (isDistributed && distributions.length > 0) {
        const distributionRecords = distributions.map((dist: any) => {
          let calculatedAmount = 0
          let calculatedPercentage = 0

          if (distributionMethod === 'percentage') {
            calculatedPercentage = Number(dist.percentage) || 0
            calculatedAmount = (totalAmount * calculatedPercentage) / 100
          } else if (distributionMethod === 'volume') {
            calculatedPercentage = Number(dist.percentage) || 0
            calculatedAmount = Number(dist.amount) || 0
          }

          return {
            adjustment_id: id,
            business_unit_id: dist.businessUnitId || null,
            plant_id: dist.plantId || null,
            department: dist.department || null,
            percentage: calculatedPercentage,
            amount: calculatedAmount,
            volume_m3: dist.volumeM3 || null,
            created_by: user.id
          }
        })

        const { error: distError } = await supabase
          .from('manual_financial_adjustment_distributions')
          .insert(distributionRecords)

        if (distError) {
          console.error('Update distributions error:', distError)
          return NextResponse.json({ error: distError.message }, { status: 500 })
        }
      }
    }

    // Fetch complete record with distributions
    const { data: completeAdjustment, error: fetchCompleteError } = await supabase
      .from('manual_financial_adjustments')
      .select(`
        *,
        plant:plants(id, name, code),
        business_unit:business_units(id, name, code),
        created_by_profile:profiles!manual_financial_adjustments_created_by_fkey(id, nombre, apellido, email),
        distributions:manual_financial_adjustment_distributions(
          id,
          business_unit_id,
          plant_id,
          department,
          percentage,
          amount,
          volume_m3,
          business_unit:business_units(id, name, code),
          plant:plants(id, name, code)
        )
      `)
      .eq('id', id)
      .single()

    if (fetchCompleteError) {
      console.error('Fetch complete adjustment error:', fetchCompleteError)
      return NextResponse.json({ adjustment: data })
    }

    return NextResponse.json({ adjustment: completeAdjustment })
  } catch (e: any) {
    console.error('PUT manual costs error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

// DELETE: Remove manual cost entry
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID required for deletion' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    const { error } = await supabase
      .from('manual_financial_adjustments')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete manual cost error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('DELETE manual costs error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}




