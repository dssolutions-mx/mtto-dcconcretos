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

    // Get receipts for this purchase order
    const { data: receipts, error } = await supabase
      .from('purchase_order_receipts')
      .select('*')
      .eq('purchase_order_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching receipts:', error)
      return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 })
    }

    return NextResponse.json(receipts || [])

  } catch (error) {
    console.error('Error in GET /api/purchase-orders/[id]/receipts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 