import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { SupplierSearchRequest, CreateSupplierRequest, SUPPLIER_SPECIALTIES } from '@/types/suppliers'
import { normalizeIndustry, normalizeSpecialty } from '@/lib/suppliers/taxonomy'
import {
  isSupplierNameBusinessUnitUniqueViolation,
  supplierDuplicateNameBuResponse,
} from '@/lib/suppliers/supplier-write-errors'
import { canCreateSupplier } from '@/lib/auth/supplier-padron-permissions'
import { getSupplierActor } from '@/lib/api/supplier-actor'

/** PostgREST OR: BU column, junction membership, or global padrón flag */
function businessUnitScopeOr(
  businessUnitId: string,
  junctionSupplierIds: string[]
): string {
  const parts = [
    'serves_all_business_units.eq.true',
    `business_unit_id.eq.${businessUnitId}`,
  ]
  if (junctionSupplierIds.length > 0) {
    parts.push(`id.in.(${junctionSupplierIds.join(',')})`)
  }
  return parts.join(',')
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const status = searchParams.get('status') ?? 'all'
    const issuesOnly = searchParams.get('issues') === '1'
    const supplier_type = searchParams.get('type') || 'all'
    const industry = searchParams.get('industry') || ''
    const business_unit_id = searchParams.get('business_unit_id') || ''
    const min_rating = searchParams.get('min_rating') || ''
    const city = searchParams.get('city') || ''
    const state = searchParams.get('state') || ''
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeStatusCounts = searchParams.get('include_status_counts') === '1'
    const includeAliases = searchParams.get('include_aliases') === '1'

    // Suppliers linked in supplier_business_units (many BU) as well as suppliers.business_unit_id
    let junctionSupplierIds: string[] = []
    if (business_unit_id) {
      const { data: jRows } = await supabase
        .from('supplier_business_units')
        .select('supplier_id')
        .eq('business_unit_id', business_unit_id)
      junctionSupplierIds = [...new Set((jRows ?? []).map((r) => r.supplier_id as string))]
    }

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
    if (issuesOnly) {
      dbQuery = dbQuery.in('status', ['suspended', 'blacklisted'])
    } else if (status !== 'all') {
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
      dbQuery = dbQuery.or(
        businessUnitScopeOr(business_unit_id, junctionSupplierIds)
      )
    }

    if (min_rating) {
      dbQuery = dbQuery.gte('rating', parseFloat(min_rating))
    }

    if (!includeAliases) {
      dbQuery = dbQuery.is('alias_of', null)
    }

    if (query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,business_name.ilike.%${query}%,contact_person.ilike.%${query}%`)
    }

    // Order by rating and name
    dbQuery = dbQuery.order('rating', { ascending: false, nullsFirst: false })
      .order('name', { ascending: true })

    const buildCountQuery = () => {
      let q = supabase
        .from('suppliers')
        .select('id', { count: 'exact', head: true })
      if (issuesOnly) {
        q = q.in('status', ['suspended', 'blacklisted'])
      } else if (status !== 'all') {
        q = q.eq('status', status)
      }
      if (supplier_type !== 'all') {
        q = q.eq('supplier_type', supplier_type)
      }
      if (industry) {
        const normalized = normalizeIndustry(industry)
        if (normalized && normalized !== 'other') {
          q = q.eq('industry', normalized)
        } else {
          q = q.neq('industry', '')
        }
      }
      if (city) q = q.eq('city', city)
      if (state) q = q.eq('state', state)
      if (business_unit_id) {
        q = q.or(
          businessUnitScopeOr(business_unit_id, junctionSupplierIds)
        )
      }
      if (min_rating) q = q.gte('rating', parseFloat(min_rating))
      if (!includeAliases) {
        q = q.is('alias_of', null)
      }
      if (query) {
        q = q.or(`name.ilike.%${query}%,business_name.ilike.%${query}%,contact_person.ilike.%${query}%`)
      }
      return q
    }

    const { count: totalCount, error: countError } = await buildCountQuery()
    if (countError) {
      console.error('Error counting suppliers:', countError)
    }

    const { data: suppliers, error } = await dbQuery

    if (error) {
      console.error('Error fetching suppliers:', error)
      return NextResponse.json(
        { error: 'Error al obtener proveedores' },
        { status: 500 }
      )
    }

    let status_counts:
      | {
          total: number
          certified: number
          active: number
          pending: number
          issues: number
        }
      | undefined

    if (includeStatusCounts) {
      const countFor = async (statusEq: string | null) => {
        let q = supabase.from('suppliers').select('id', { count: 'exact', head: true })
        if (supplier_type !== 'all') q = q.eq('supplier_type', supplier_type)
        if (statusEq) q = q.eq('status', statusEq)
        const { count } = await q
        return count ?? 0
      }
      const [total, certified, active, pending, suspended, blacklisted] = await Promise.all([
        countFor(null),
        countFor('active_certified'),
        countFor('active'),
        countFor('pending'),
        countFor('suspended'),
        countFor('blacklisted'),
      ])
      status_counts = {
        total,
        certified,
        active,
        pending,
        issues: suspended + blacklisted,
      }
    }

    return NextResponse.json({
      suppliers: suppliers || [],
      total: totalCount ?? suppliers?.length ?? 0,
      status_counts,
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
    const actor = await getSupplierActor(supabase)
    if (!actor.profile) {
      return NextResponse.json({ error: 'Perfil de usuario requerido' }, { status: 403 })
    }
    if (
      !canCreateSupplier(actor.profile.role, actor.profile.business_unit_id, {
        business_unit_id: body.business_unit_id,
        serves_all_business_units: body.serves_all_business_units,
      })
    ) {
      return NextResponse.json(
        { error: 'No tienes permisos para dar de alta proveedores en el padrón' },
        { status: 403 }
      )
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || !body.supplier_type) {
      return NextResponse.json(
        { error: 'Name and supplier_type are required' },
        { status: 400 }
      )
    }

    // Allowlist: only insert allowed columns (prevents mass assignment)
    const allowedFields = [
      'name', 'business_name', 'tax_id', 'contact_person', 'email', 'phone',
      'mobile_phone', 'address', 'city', 'state', 'postal_code', 'country',
      'supplier_type', 'industry', 'payment_terms', 'payment_methods', 'notes',
      'business_unit_id', 'business_hours', 'bank_account_info', 'certifications', 'status',
    ] as const
    const insertData: Record<string, unknown> = { name }
    for (const key of allowedFields) {
      if (key === 'name') continue
      const val = body[key as keyof CreateSupplierRequest]
      if (key === 'notes' && val === '') {
        insertData.notes = null
        continue
      }
      if (key === 'notes' && (val === null || val === undefined)) {
        continue
      }
      if (key === 'status' && (val === 'active_certified' || val === 'pending')) {
        if (val === 'active_certified') {
          // Certification must use verification path
          continue
        }
        insertData.status = val
        continue
      }
      if (key === 'status' && typeof val === 'string' && val.length > 0) {
        insertData.status = val
        continue
      }
      if (val !== undefined && val !== null && val !== '') {
        insertData[key] = val
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'bank_account_info') && (body as { bank_account_info?: unknown }).bank_account_info !== undefined) {
      insertData.bank_account_info = (body as { bank_account_info?: unknown }).bank_account_info
    }
    if (Object.prototype.hasOwnProperty.call(body, 'business_hours') && (body as { business_hours?: unknown }).business_hours !== undefined) {
      insertData.business_hours = (body as { business_hours?: unknown }).business_hours
    }
    if (Array.isArray((body as { certifications?: string[] }).certifications)) {
      insertData.certifications = (body as { certifications: string[] }).certifications
    }
    if (body.serves_all_business_units === true) {
      insertData.serves_all_business_units = true
    }
    if (body.business_unit_id === '' || body.business_unit_id === undefined) {
      insertData.business_unit_id = null
    }

    // Normalize specialties and industry
    const normalizedSpecialties = (body.specialties || []).map(s => normalizeSpecialty(String(s)))
    const normalizedIndustry = normalizeIndustry(body.industry) || body.industry
    if (!insertData.status) {
      insertData.status = 'active'
    }

    // Create the supplier
    const { data: supplier, error } = await supabase
      .from('suppliers')
      .insert({
        ...insertData,
        specialties: normalizedSpecialties,
        industry: normalizedIndustry,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating supplier:', error)
      if (isSupplierNameBusinessUnitUniqueViolation(error)) {
        return supplierDuplicateNameBuResponse()
      }
      return NextResponse.json(
        { error: 'Error al crear proveedor' },
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
