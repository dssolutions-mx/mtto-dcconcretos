import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { UpdateSupplierRequest } from '@/types/suppliers'
import { normalizeIndustry, normalizeSpecialty } from '@/lib/suppliers/taxonomy'
import {
  isSupplierNameBusinessUnitUniqueViolation,
  supplierDuplicateNameBuResponse,
} from '@/lib/suppliers/supplier-write-errors'
import { canWriteSupplier } from '@/lib/auth/supplier-padron-permissions'
import { getSupplierActor, getSupplierJunctionBusinessUnitIds } from '@/lib/api/supplier-actor'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .select(`
        *,
        supplier_contacts(*),
        supplier_services(*),
        supplier_performance_history(*),
        supplier_work_history(*),
        supplier_certifications(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Supplier not found' },
          { status: 404 }
        )
      }

      console.error('Error fetching supplier:', error)
      return NextResponse.json(
        { error: 'Error al obtener proveedor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      supplier
    })

  } catch (error) {
    console.error('Error in supplier detail API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body: UpdateSupplierRequest = await request.json()
    const actor = await getSupplierActor(supabase)
    if (!actor.profile) {
      return NextResponse.json({ error: 'Perfil de usuario requerido' }, { status: 403 })
    }

    const { data: fullRow, error: fetchError } = await supabase
      .from('suppliers')
      .select('id, created_by, business_unit_id, serves_all_business_units, name, status, tax_id, alias_of')
      .eq('id', id)
      .single()

    if (fetchError || !fullRow) {
      if (fetchError?.code === 'PGRST116' || !fullRow) {
        return NextResponse.json(
          { error: 'Supplier not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching supplier:', fetchError)
      return NextResponse.json(
        { error: 'Error fetching supplier' },
        { status: 500 }
      )
    }

    const fullSupplier = {
      id: fullRow.id,
      created_by: fullRow.created_by,
      business_unit_id: fullRow.business_unit_id,
      serves_all_business_units: (fullRow as { serves_all_business_units?: boolean | null })
        .serves_all_business_units ?? false,
    }

    const junctionIds = await getSupplierJunctionBusinessUnitIds(supabase, id)

    const canWrite = canWriteSupplier(
      user.id,
      actor.profile.role,
      actor.profile.business_unit_id,
      {
        id: fullSupplier.id,
        created_by: fullSupplier.created_by,
        business_unit_id: fullSupplier.business_unit_id,
        serves_all_business_units: fullSupplier.serves_all_business_units,
      },
      junctionIds
    )

    if (!canWrite) {
      return NextResponse.json(
        { error: 'No tienes permisos para editar este proveedor' },
        { status: 403 }
      )
    }

    const b = { ...body } as UpdateSupplierRequest & { status?: string; alias_of?: string | null; bank_account_info?: unknown; business_hours?: unknown }
    if (b.status === 'active_certified') {
      delete b.status
    }

    // Allowlist
    const allowedFields = [
      'name', 'business_name', 'tax_id', 'contact_person', 'email', 'phone',
      'mobile_phone', 'address', 'city', 'state', 'postal_code', 'country',
      'supplier_type', 'industry', 'specialties', 'payment_terms', 'payment_methods',
      'notes', 'business_unit_id', 'status', 'bank_account_info', 'certifications',
      'business_hours', 'tax_document_url', 'alias_of',
    ] as const

    const updateData: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key === 'alias_of') {
        if (Object.prototype.hasOwnProperty.call(b, 'alias_of')) {
          const v = (b as Record<string, unknown>)['alias_of']
          if (v === null || v === undefined || v === '') {
            updateData.alias_of = null
          } else if (typeof v === 'string' && v === id) {
            return NextResponse.json({ error: 'alias_of no puede ser el mismo registro' }, { status: 400 })
          } else if (typeof v === 'string') {
            updateData.alias_of = v
          }
        }
        continue
      }
      const val = b[key as keyof UpdateSupplierRequest] as unknown
      if (val === undefined) continue
      if (key === 'notes' || key === 'contact_person' || key === 'tax_id' || key === 'email') {
        if (val === null || val === '') {
          updateData[key] = null
        } else {
          updateData[key] = val
        }
        continue
      }
      if (val !== null && val !== '') {
        updateData[key] = val
      }
    }

    if (b.name !== undefined) {
      const trimmed = typeof b.name === 'string' ? b.name.trim() : ''
      if (!trimmed) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      updateData.name = trimmed
    }
    if (
      'business_unit_id' in b &&
      (b.business_unit_id === '' || b.business_unit_id === null)
    ) {
      updateData.business_unit_id = null
    }
    if (Array.isArray(b.specialties)) {
      updateData.specialties = b.specialties.map(s => normalizeSpecialty(String(s)))
    }
    if (typeof b.industry !== 'undefined') {
      const n = normalizeIndustry(b.industry as string)
      updateData.industry = n || b.industry
    }
    if (b.serves_all_business_units !== undefined) {
      updateData.serves_all_business_units = Boolean(b.serves_all_business_units)
    }
    if (b.bank_account_info !== undefined) {
      updateData.bank_account_info = b.bank_account_info
    }
    if (b.business_hours !== undefined) {
      updateData.business_hours = b.business_hours
    }
    if (Array.isArray(b.certifications)) {
      updateData.certifications = b.certifications
    }
    if (b.alias_of === null) {
      updateData.alias_of = null
    }

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .update({
        ...updateData,
        updated_by: user.id
      } as never)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating supplier:', error)
      if (isSupplierNameBusinessUnitUniqueViolation(error)) {
        return supplierDuplicateNameBuResponse()
      }
      return NextResponse.json(
        { error: 'Error al actualizar proveedor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      supplier,
      message: 'Supplier updated successfully'
    })

  } catch (error) {
    console.error('Error in supplier PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const actor = await getSupplierActor(supabase)
    if (!actor.profile) {
      return NextResponse.json({ error: 'Perfil de usuario requerido' }, { status: 403 })
    }

    const { data: fullRow, error: fetchError } = await supabase
      .from('suppliers')
      .select('id, created_by, business_unit_id, serves_all_business_units')
      .eq('id', id)
      .single()

    if (fetchError || !fullRow) {
      if (fetchError?.code === 'PGRST116' || !fullRow) {
        return NextResponse.json(
          { error: 'Supplier not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching supplier:', fetchError)
      return NextResponse.json(
        { error: 'Error fetching supplier' },
        { status: 500 }
      )
    }

    const s = {
      id: fullRow.id,
      created_by: fullRow.created_by,
      business_unit_id: (fullRow as { business_unit_id: string | null }).business_unit_id,
      serves_all_business_units: (fullRow as { serves_all_business_units: boolean | null })
        .serves_all_business_units ?? false,
    }
    const junctionIds = await getSupplierJunctionBusinessUnitIds(supabase, id)
    if (
      !canWriteSupplier(
        user.id,
        actor.profile.role,
        actor.profile.business_unit_id,
        s,
        junctionIds
      )
    ) {
      return NextResponse.json(
        { error: 'No tienes permisos para desactivar este proveedor' },
        { status: 403 }
      )
    }

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .update({
        status: 'inactive',
        updated_by: user.id
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error deactivating supplier:', error)
      return NextResponse.json(
        { error: 'Error al desactivar proveedor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      supplier,
      message: 'Supplier deactivated successfully'
    })

  } catch (error) {
    console.error('Error in supplier DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
