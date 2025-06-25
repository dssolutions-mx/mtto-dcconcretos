import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { AccountsPayableResponse, PaymentStatus } from '@/types/purchase-orders'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    // Get filter parameters
    const statusFilter = searchParams.get('status') as PaymentStatus | null
    const paymentMethodFilter = searchParams.get('payment_method')
    const daysFilter = searchParams.get('days_filter') // 'overdue', 'today', 'week', 'month'
    const limit = parseInt(searchParams.get('limit') || '50')
    
    // Build query for accounts payable view
    let query = supabase
      .from('accounts_payable_summary')
      .select('*')
    
    // Apply filters
    if (statusFilter) {
      query = query.eq('payment_status', statusFilter)
    }
    
    if (paymentMethodFilter) {
      query = query.eq('payment_method', paymentMethodFilter)
    }
    
    // Apply days filter
    if (daysFilter) {
      switch (daysFilter) {
        case 'overdue':
          query = query.lt('days_until_due', 0)
          break
        case 'today':
          query = query.eq('days_until_due', 0)
          break
        case 'week':
          query = query.gte('days_until_due', 0).lte('days_until_due', 7)
          break
        case 'month':
          query = query.gte('days_until_due', 0).lte('days_until_due', 30)
          break
      }
    }
    
    // Execute query with limit
    const { data: items, error } = await query
      .limit(limit)
    
    if (error) {
      console.error('Error fetching accounts payable:', error)
      throw error
    }
    
    // Get summary statistics
    const { data: summaryData, error: summaryError } = await supabase
      .from('accounts_payable_summary')
      .select('payment_status_display, total_amount, actual_amount, days_until_due')
    
    if (summaryError) {
      console.error('Error fetching summary:', summaryError)
      throw summaryError
    }
    
    // Calculate summary
    const summary = {
      total_pending: summaryData?.filter(item => 
        item.payment_status_display === 'Pendiente'
      ).length || 0,
      total_overdue: summaryData?.filter(item => 
        item.payment_status_display === 'Vencido'
      ).length || 0,
      total_amount_pending: summaryData
        ?.filter(item => item.payment_status_display === 'Pendiente')
        .reduce((sum, item) => sum + (parseFloat(item.actual_amount || item.total_amount) || 0), 0) || 0,
      total_amount_overdue: summaryData
        ?.filter(item => item.payment_status_display === 'Vencido')
        .reduce((sum, item) => sum + (parseFloat(item.actual_amount || item.total_amount) || 0), 0) || 0,
      items_due_this_week: summaryData?.filter(item => 
        item.days_until_due !== null && item.days_until_due >= 0 && item.days_until_due <= 7
      ).length || 0,
      items_due_today: summaryData?.filter(item => 
        item.days_until_due === 0
      ).length || 0
    }
    
    const response: AccountsPayableResponse = {
      summary,
      items: items || [],
      filters_applied: {
        status: statusFilter || undefined,
        payment_method: paymentMethodFilter as any || undefined,
        days_filter: daysFilter as any || undefined
      }
    }
    
    return NextResponse.json({
      success: true,
      data: response
    })
    
  } catch (error) {
    console.error('Error in accounts payable API:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch accounts payable data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 