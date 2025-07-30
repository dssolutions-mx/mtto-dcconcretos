import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Resolve params using await
    const resolvedParams = await params
    const id = resolvedParams.id
    
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { action, new_payment_method, new_max_payment_date } = body
    
    if (!action) {
      return NextResponse.json({ 
        error: 'action is required' 
      }, { status: 400 })
    }
    
    // Get current purchase order
    const { data: purchaseOrder, error: poError } = await supabase
      .from('purchase_orders')
      .select('payment_method, max_payment_date, status')
      .eq('id', id)
      .single()
    
    if (poError || !purchaseOrder) {
      return NextResponse.json({ 
        error: 'Purchase order not found' 
      }, { status: 404 })
    }
    
    // Only allow fixes for pending_approval status
    if (purchaseOrder.status !== 'pending_approval') {
      return NextResponse.json({ 
        error: 'Only pending approval orders can be modified' 
      }, { status: 400 })
    }
    
    let updateData: any = {}
    
    if (action === 'update_payment_date') {
      if (!new_max_payment_date) {
        return NextResponse.json({ 
          error: 'new_max_payment_date is required for this action' 
        }, { status: 400 })
      }
      
      // Validate that the new date is in the future
      const newDate = new Date(new_max_payment_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (newDate < today) {
        return NextResponse.json({ 
          error: 'La nueva fecha de pago debe estar en el futuro' 
        }, { status: 400 })
      }
      
      updateData.max_payment_date = new_max_payment_date
      
    } else if (action === 'change_payment_method') {
      if (!new_payment_method) {
        return NextResponse.json({ 
          error: 'new_payment_method is required for this action' 
        }, { status: 400 })
      }
      
      // Validate payment method
      const validPaymentMethods = ['cash', 'card', 'transfer']
      if (!validPaymentMethods.includes(new_payment_method)) {
        return NextResponse.json({ 
          error: 'Método de pago inválido' 
        }, { status: 400 })
      }
      
      updateData.payment_method = new_payment_method
      
      // Clear max_payment_date if not transfer
      if (new_payment_method !== 'transfer') {
        updateData.max_payment_date = null
      } else {
        // If changing to transfer, set a default future date
        const defaultDate = new Date()
        defaultDate.setDate(defaultDate.getDate() + 30) // 30 days from now
        updateData.max_payment_date = defaultDate.toISOString()
      }
      
    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Use "update_payment_date" or "change_payment_method"' 
      }, { status: 400 })
    }
    
    // Update the purchase order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      console.error('Error updating purchase order:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update purchase order',
        details: updateError.message
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Purchase order updated successfully',
      data: updatedOrder
    })
    
  } catch (error) {
    console.error('Error fixing payment date:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fix payment date',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 