import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'

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
        created_by_profile:profiles!manual_financial_adjustments_created_by_fkey(id, full_name, email)
      `)
      .eq('period_month', periodMonth)
      .order('created_at', { ascending: false })

    if (plantId) {
      query = query.eq('plant_id', plantId)
    } else if (businessUnitId) {
      query = query.eq('business_unit_id', businessUnitId)
    }

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
      description,
      amount,
      notes
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

    if (!plantId && !businessUnitId) {
      return NextResponse.json(
        { error: 'Either plantId or businessUnitId must be provided' },
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

    const { data, error } = await supabase
      .from('manual_financial_adjustments')
      .insert({
        business_unit_id: businessUnitId || null,
        plant_id: plantId || null,
        period_month: periodMonth,
        category,
        department: department || null,
        subcategory: subcategory || null,
        description: description || null,
        amount: parseFloat(amount),
        notes: notes || null,
        created_by: user.id,
        updated_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Insert manual cost error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ adjustment: data }, { status: 201 })
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
      description,
      amount,
      notes
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

    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString()
    }

    if (department !== undefined) updateData.department = department
    if (subcategory !== undefined) updateData.subcategory = subcategory
    if (description !== undefined) updateData.description = description
    if (amount !== undefined) updateData.amount = parseFloat(amount)
    if (notes !== undefined) updateData.notes = notes

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

    return NextResponse.json({ adjustment: data })
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


