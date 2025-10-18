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

    // Editable fields
    const editableFields = [
      'supplier',
      'total_amount',
      'payment_method',
      'notes',
      'store_location',
      'service_provider',
      'quotation_url',
      'quotation_urls',
      'purchase_date',
      'max_payment_date',
      'items'
    ] as const

    editableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        // Ensure quotation_urls remains a JSONB array (do NOT stringify)
        if (field === 'quotation_urls') {
          const value = body[field]
          if (value === null) {
            updateData[field] = null
          } else if (Array.isArray(value)) {
            updateData[field] = value
          } else if (typeof value === 'string' && value.trim().length > 0) {
            updateData[field] = [value]
          } else {
            // fallback to empty array for invalid types
            updateData[field] = []
          }
        } else {
          updateData[field] = body[field]
        }
      }
    })

    // Handle receipt upload separately - prevent duplicates
    if (body.receipt_url) {
      // Check if a receipt with this URL already exists
      const { data: existingReceipt, error: checkError } = await supabase
        .from('purchase_order_receipts')
        .select('id')
        .eq('purchase_order_id', id)
        .eq('file_url', body.receipt_url)
        .single()

      // Only insert if receipt doesn't exist
      if (!existingReceipt && !checkError) {
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
      // If receipt already exists, we just continue without error
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
        // Map specific validation related to payment date when method is transfer
        if (
          typeof error.message === 'string' &&
          error.message.includes('max_payment_date cannot be in the past')
        ) {
          return NextResponse.json({
            success: false,
            error: 'Error de validación de fecha de pago',
            details: 'La fecha máxima de pago no puede estar en el pasado cuando el método de pago es transferencia.',
            requires_fix: true,
            fix_type: 'payment_date'
          }, { status: 400 })
        }
        return NextResponse.json({ error: 'Failed to update purchase order', details: error.message }, { status: 500 })
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