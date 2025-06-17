import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Get purchase order details
    const { data: purchaseOrder, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching purchase order:', error)
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    return NextResponse.json(purchaseOrder)

  } catch (error) {
    console.error('Error in GET /api/purchase-orders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Prepare update object for purchase order
    const updateData: any = {}
    
    if (body.actual_amount !== undefined) {
      updateData.actual_amount = body.actual_amount
      updateData.purchased_at = new Date().toISOString()
    }

    // Handle receipt upload separately
    if (body.receipt_url) {
      const { error: receiptError } = await supabase
        .from('purchase_order_receipts')
        .insert({
          purchase_order_id: id,
          file_url: body.receipt_url,
          expense_type: 'purchase',
          description: 'Comprobante de compra',
          uploaded_by: user.id,
        })

      if (receiptError) {
        console.error('Error inserting receipt:', receiptError)
        return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 })
      }
    }

    // Update purchase order if there are changes
    let updatedOrder = null
    if (Object.keys(updateData).length > 0) {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating purchase order:', error)
        return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 })
      }
      
      updatedOrder = data
    }

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: 'Purchase order updated successfully'
    })

  } catch (error) {
    console.error('Error in PATCH /api/purchase-orders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 