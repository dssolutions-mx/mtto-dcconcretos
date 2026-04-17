import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * File comprobantes uploaded for a PO (purchase_order_receipts).
 * Inventory warehouse receipts use a different table (po_inventory_receipts) and are not listed here.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'User not authenticated',
      }, { status: 401 })
    }

    const resolvedParams = await params
    const poId = resolvedParams.id

    const { data: receipts, error } = await supabase
      .from('purchase_order_receipts')
      .select('id, file_url, expense_type, description, receipt_date, created_at, uploaded_by')
      .eq('purchase_order_id', poId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching purchase_order_receipts:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch receipt history',
        details: error.message,
      }, { status: 500 })
    }

    const list = receipts ?? []

    return NextResponse.json({
      success: true,
      receipts: list,
      total: list.length,
    })
  } catch (error) {
    console.error('Error fetching receipt history:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch receipt history',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
