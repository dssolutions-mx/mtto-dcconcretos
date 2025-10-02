import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { SupplierSearchRequest, CreateSupplierRequest, SUPPLIER_SPECIALTIES } from '@/types/suppliers'
import { normalizeIndustry, normalizeSpecialty } from '@/lib/suppliers/taxonomy'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const status = searchParams.get('status') || 'active'
    const supplier_type = searchParams.get('type') || 'all'
    const industry = searchParams.get('industry') || ''
    const business_unit_id = searchParams.get('business_unit_id') || ''
    const min_rating = searchParams.get('min_rating') || ''
    const city = searchParams.get('city') || ''
    const state = searchParams.get('state') || ''
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build the query
    let dbQuery = supabase
      .from('suppliers')
      .select(`
        *,
        supplier_contacts(*),
        supplier_services(*)
      `)
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status !== 'all') {
      dbQuery = dbQuery.eq('status', status)
    }

    if (supplier_type !== 'all') {
      dbQuery = dbQuery.eq('supplier_type', supplier_type)
    }

    if (industry) {
      const normalized = normalizeIndustry(industry)
      if (normalized && normalized !== 'other') {
        dbQuery = dbQuery.eq('industry', normalized)
      } else {
        dbQuery = dbQuery.neq('industry', '')
      }
    }

    if (city) {
      dbQuery = dbQuery.eq('city', city)
    }

    if (state) {
      dbQuery = dbQuery.eq('state', state)
    }

    if (business_unit_id) {
      dbQuery = dbQuery.eq('business_unit_id', business_unit_id)
    }

    if (min_rating) {
      dbQuery = dbQuery.gte('rating', parseFloat(min_rating))
    }

    if (query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,business_name.ilike.%${query}%,contact_person.ilike.%${query}%`)
    }

    // Order by rating and name
    dbQuery = dbQuery.order('rating', { ascending: false, nullsFirst: false })
      .order('name', { ascending: true })

    const { data: suppliers, error } = await dbQuery

    if (error) {
      console.error('Error fetching suppliers:', error)
      return NextResponse.json(
        { error: 'Error fetching suppliers', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      suppliers: suppliers || [],
      total: suppliers?.length || 0,
      filters_applied: {
        query,
        status,
        supplier_type,
        industry,
        min_rating,
        city,
        state,
        limit,
        offset,
        business_unit_id
      }
    })

  } catch (error) {
    console.error('Error in suppliers API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body: CreateSupplierRequest = await request.json()

    // Validate required fields
    if (!body.name || !body.supplier_type) {
      return NextResponse.json(
        { error: 'Name and supplier_type are required' },
        { status: 400 }
      )
    }

    // Normalize specialties and industry
    const normalizedSpecialties = (body.specialties || []).map(s => normalizeSpecialty(String(s)))
    const normalizedIndustry = normalizeIndustry(body.industry) || body.industry

    // Create the supplier
    const { data: supplier, error } = await supabase
      .from('suppliers')
      .insert({
        ...body,
        specialties: normalizedSpecialties,
        industry: normalizedIndustry,
        created_by: user.id,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating supplier:', error)
      return NextResponse.json(
        { error: 'Error creating supplier', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      supplier,
      message: 'Supplier created successfully'
    })

  } catch (error) {
    console.error('Error in suppliers POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
