import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { UpdateSupplierRequest } from '@/types/suppliers'
import { normalizeIndustry, normalizeSpecialty } from '@/lib/suppliers/taxonomy'
import {
  isSupplierNameBusinessUnitUniqueViolation,
  supplierDuplicateNameBuResponse,
} from '@/lib/suppliers/supplier-write-errors'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()
    const { id } = params

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
    const { id } = params

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body: UpdateSupplierRequest = await request.json()

    // Allowlist: only update allowed columns (prevents mass assignment)
    const allowedFields = [
      'name', 'business_name', 'tax_id', 'contact_person', 'email', 'phone',
      'mobile_phone', 'address', 'city', 'state', 'postal_code', 'country',
      'supplier_type', 'industry', 'specialties', 'payment_terms', 'payment_methods',
      'notes', 'business_unit_id', 'status'
    ] as const
    const updateData: Record<string, unknown> = {}
    for (const key of allowedFields) {
      const val = body[key as keyof UpdateSupplierRequest]
      if (val !== undefined && val !== null && val !== '') {
        updateData[key] = val
      }
    }
    if (body.name !== undefined) {
      const trimmed = typeof body.name === 'string' ? body.name.trim() : ''
      if (!trimmed) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      updateData.name = trimmed
    }
    if (
      'business_unit_id' in body &&
      (body.business_unit_id === '' || body.business_unit_id === null)
    ) {
      updateData.business_unit_id = null
    }
    // Normalize specialties and industry if provided
    if (Array.isArray(body.specialties)) {
      updateData.specialties = body.specialties.map(s => normalizeSpecialty(String(s)))
    }
    if (typeof body.industry !== 'undefined') {
      const n = normalizeIndustry(body.industry as string)
      updateData.industry = n || body.industry
    }

    // Check if supplier exists and user has permission
    const { data: existingSupplier, error: fetchError } = await supabase
      .from('suppliers')
      .select('id, created_by')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
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

    // Check permissions (user can only update suppliers they created)
    if (existingSupplier.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Update the supplier
    const { data: supplier, error } = await supabase
      .from('suppliers')
      .update({
        ...updateData,
        updated_by: user.id
      })
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
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()
    const { id } = params

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if supplier exists and user has permission
    const { data: existingSupplier, error: fetchError } = await supabase
      .from('suppliers')
      .select('id, created_by, status')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
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

    // Check permissions (user can only update suppliers they created)
    if (existingSupplier.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      )
    }

    // Instead of deleting, set status to 'inactive' for audit purposes
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
