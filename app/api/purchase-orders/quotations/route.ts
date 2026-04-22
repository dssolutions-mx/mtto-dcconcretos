import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext } from '@/lib/auth/server-authorization'
import { coordinatorQuotationMutationAllowed } from '@/lib/purchase-orders/coordinator-quotation-mutations'
import { CreateQuotationRequest } from '@/types/purchase-orders'

/**
 * POST /api/purchase-orders/quotations
 * Create a new quotation for a purchase order
 */
export async function POST(request: NextRequest) {
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
    
    const body: CreateQuotationRequest = await request.json()
    
    // Validate required fields
    if (!body.purchase_order_id || !body.supplier_name || !body.quoted_amount) {
      return NextResponse.json({ 
        error: 'purchase_order_id, supplier_name, and quoted_amount are required' 
      }, { status: 400 })
    }
    
    if (body.quoted_amount <= 0) {
      return NextResponse.json({ 
        error: 'quoted_amount must be greater than 0' 
      }, { status: 400 })
    }
    
    // Create quotation directly using server context (instead of QuotationService with client context)
    // Verify PO exists and check po_purpose
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, po_purpose, requires_quote, plant_id, viability_state, status')
      .eq('id', body.purchase_order_id)
      .single()
    
    if (poError || !po) {
      console.error('PO lookup error:', {
        purchase_order_id: body.purchase_order_id,
        error: poError
      })
      return NextResponse.json({ 
        error: `Purchase order not found: ${poError?.message || 'PO does not exist'}` 
      }, { status: 404 })
    }
    
    // Skip if using inventory (no purchase needed)
    if (po.po_purpose === 'work_order_inventory') {
      return NextResponse.json({ 
        error: 'Quotations not required for inventory-only purchase orders' 
      }, { status: 400 })
    }

    const coordGate = coordinatorQuotationMutationAllowed(actor, {
      plant_id: po.plant_id,
      viability_state: po.viability_state,
      status: po.status,
    })
    if (!coordGate.ok) {
      return NextResponse.json({ error: coordGate.message }, { status: 403 })
    }
    
    // Create quotation
    const { data, error } = await supabase
      .from('purchase_order_quotations')
      .insert({
        purchase_order_id: body.purchase_order_id,
        supplier_id: body.supplier_id,
        supplier_name: body.supplier_name,
        quoted_amount: body.quoted_amount,
        quotation_items: body.quotation_items || null,
        delivery_days: body.delivery_days,
        payment_terms: body.payment_terms,
        validity_date: body.validity_date,
        notes: body.notes,
        file_storage_path: body.file_storage_path ?? null,
        file_url: body.file_url ?? null,
        file_name: body.file_name,
        additional_files: body.additional_files ?? [],
        status: 'pending',
        created_by: user.id
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating quotation:', error)
      return NextResponse.json({ 
        error: `Failed to create quotation: ${error.message}` 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      data: data
    })
    
  } catch (error) {
    console.error('Error creating quotation:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to create quotation'
    }, { status: 500 })
  }
}

/**
 * GET /api/purchase-orders/quotations?purchase_order_id=X
 * Get all quotations for a purchase order
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'User not authenticated' 
      }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const purchase_order_id = searchParams.get('purchase_order_id')
    
    if (!purchase_order_id) {
      return NextResponse.json({ 
        error: 'purchase_order_id is required' 
      }, { status: 400 })
    }
    
    // Query directly without using service to avoid client context issues
    const { data, error } = await supabase
      .from('purchase_order_quotations')
      .select(`
        *,
        supplier:suppliers(*)
      `)
      .eq('purchase_order_id', purchase_order_id)
      .order('status', { ascending: false }) // Selected first
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching quotations:', error)
      return NextResponse.json({ 
        error: `Failed to fetch quotations: ${error.message}` 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      data: data || []
    })
    
  } catch (error) {
    console.error('Error fetching quotations:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch quotations'
    }, { status: 500 })
  }
}
