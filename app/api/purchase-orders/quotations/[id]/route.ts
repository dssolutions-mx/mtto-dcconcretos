import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext } from '@/lib/auth/server-authorization'
import { coordinatorQuotationMutationAllowed } from '@/lib/purchase-orders/coordinator-quotation-mutations'
import { QuotationService } from '@/lib/services/quotation-service'
import { QuotationStatus } from '@/types/purchase-orders'

const PATCHABLE_FIELDS = [
  'supplier_id',
  'supplier_name',
  'quoted_amount',
  'quotation_items',
  'delivery_days',
  'payment_terms',
  'validity_date',
  'notes',
  'file_url',
  'file_storage_path',
  'file_name',
  'additional_files',
] as const

/**
 * DELETE /api/purchase-orders/quotations/[id]
 * Delete a pending/rejected quotation (not selected)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 403 })
    }
    
    const resolvedParams = await params
    const quotation_id = resolvedParams.id

    const { data: quotation, error: qError } = await supabase
      .from('purchase_order_quotations')
      .select('id, purchase_order_id, status')
      .eq('id', quotation_id)
      .single()

    if (qError || !quotation) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (quotation.status === QuotationStatus.SELECTED) {
      return NextResponse.json(
        { error: 'No se puede eliminar la cotización seleccionada' },
        { status: 409 }
      )
    }

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, plant_id, viability_state, status')
      .eq('id', quotation.purchase_order_id)
      .single()

    if (poError || !po) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 })
    }

    const coordGate = coordinatorQuotationMutationAllowed(actor, {
      plant_id: po.plant_id,
      viability_state: po.viability_state,
      status: po.status,
    })
    if (!coordGate.ok) {
      return NextResponse.json({ error: coordGate.message }, { status: 403 })
    }
    
    await QuotationService.deleteQuotation(quotation_id)
    
    return NextResponse.json({
      success: true,
      message: 'Quotation deleted successfully'
    })
    
  } catch (error) {
    console.error('Error deleting quotation:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete quotation'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/purchase-orders/quotations/[id]
 * Update quotation fields (incl. selected row when policy allows, e.g. pre-viability)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor) {
      return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 403 })
    }

    const { id: quotation_id } = await params
    const body = (await request.json()) as Record<string, unknown>

    const { data: quotation, error: qError } = await supabase
      .from('purchase_order_quotations')
      .select('id, purchase_order_id, status')
      .eq('id', quotation_id)
      .single()

    if (qError || !quotation) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, plant_id, viability_state, status')
      .eq('id', quotation.purchase_order_id)
      .single()

    if (poError || !po) {
      return NextResponse.json({ error: 'Orden de compra no encontrada' }, { status: 404 })
    }

    const coordGate = coordinatorQuotationMutationAllowed(actor, {
      plant_id: po.plant_id,
      viability_state: po.viability_state,
      status: po.status,
    })
    if (!coordGate.ok) {
      return NextResponse.json({ error: coordGate.message }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    for (const key of PATCHABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        updateData[key] = body[key]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Ningún campo actualizable en el cuerpo' },
        { status: 400 }
      )
    }

    if (
      updateData.quoted_amount !== undefined &&
      typeof updateData.quoted_amount === 'number' &&
      updateData.quoted_amount <= 0
    ) {
      return NextResponse.json(
        { error: 'quoted_amount must be greater than 0' },
        { status: 400 }
      )
    }

    const { data: updated, error: updError } = await supabase
      .from('purchase_order_quotations')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quotation_id)
      .select()
      .single()

    if (updError) {
      console.error('Error updating quotation:', updError)
      return NextResponse.json(
        { error: updError.message || 'Failed to update quotation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error in PATCH quotation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update quotation' },
      { status: 500 }
    )
  }
}
