import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { MarkAsPaidRequest } from '@/types/purchase-orders'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'User not authenticated'
      }, { status: 401 })
    }

    // Parse request body
    const body: MarkAsPaidRequest = await request.json()
    
    // Validate required fields
    if (!body.purchase_order_id || !body.payment_date) {
      return NextResponse.json({
        success: false,
        error: 'purchase_order_id and payment_date are required'
      }, { status: 400 })
    }
    
    // Validate payment date is not in the future
    const paymentDate = new Date(body.payment_date)
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today
    
    if (paymentDate > today) {
      return NextResponse.json({
        success: false,
        error: 'Payment date cannot be in the future'
      }, { status: 400 })
    }
    
    // Get the purchase order to verify it exists and can be marked as paid
    const { data: purchaseOrder, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, order_id, supplier, payment_status, status')
      .eq('id', body.purchase_order_id)
      .single()
    
    if (poError || !purchaseOrder) {
      return NextResponse.json({
        success: false,
        error: 'Purchase order not found'
      }, { status: 404 })
    }
    
    // Check if already paid
    if (purchaseOrder.payment_status === 'paid') {
      return NextResponse.json({
        success: false,
        error: 'This purchase order is already marked as paid'
      }, { status: 400 })
    }
    
    // Update purchase order with payment information
    const { data: updatedOrder, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        payment_date: body.payment_date,
        payment_reference: body.payment_reference,
        payment_notes: body.payment_notes,
        paid_by: user.id,
        payment_status: 'paid', // This will be set automatically by the trigger, but we set it explicitly
        updated_at: new Date().toISOString()
      })
      .eq('id', body.purchase_order_id)
      .select()
      .single()
    
    if (updateError) {
      console.error('Error updating purchase order:', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to mark purchase order as paid',
        details: updateError.message
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: `Orden ${purchaseOrder.order_id} marcada como pagada exitosamente`,
      data: updatedOrder
    })
    
  } catch (error) {
    console.error('Error in mark-as-paid API:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to mark purchase order as paid',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 