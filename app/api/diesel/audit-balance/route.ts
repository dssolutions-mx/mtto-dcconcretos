import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * POST /api/diesel/audit-balance
 * 
 * Audits diesel warehouse inventory balance by comparing:
 * 1. Stored warehouse.current_inventory
 * 2. Latest transaction.current_balance
 * 3. Calculated SUM(all transactions)
 * 
 * Body: { warehouse_id: string }
 * 
 * Returns audit report with discrepancies and recommendations
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { warehouse_id } = body

    if (!warehouse_id) {
      return NextResponse.json(
        { error: 'warehouse_id is required' },
        { status: 400 }
      )
    }

    // Call the audit function
    const { data: auditResult, error: auditError } = await supabase
      .rpc('audit_warehouse_balance', {
        p_warehouse_id: warehouse_id
      })

    if (auditError) {
      console.error('[Diesel Audit] Error:', auditError)
      return NextResponse.json(
        { error: 'Failed to audit warehouse', details: auditError.message },
        { status: 500 }
      )
    }

    // Parse the JSON result (RPC returns JSON as string)
    const audit = typeof auditResult === 'string' 
      ? JSON.parse(auditResult) 
      : auditResult

    // Generate recommendations based on status
    const recommendations: string[] = []
    
    if (audit.status === 'CRITICAL' || audit.status === 'MAJOR') {
      recommendations.push('⚠️ Immediate recalculation recommended')
      
      if (Math.abs(audit.discrepancy_stored_vs_calculated) > 100) {
        recommendations.push('🔴 Large discrepancy detected (>100L)')
      }
      
      if (audit.chain_breaks > 10) {
        recommendations.push('🔗 Multiple balance chain breaks detected')
      }
      
      recommendations.push('📊 Review recent transactions for backdating or edits')
      recommendations.push('🔄 Run recalculation to fix balances')
    } else if (audit.status === 'MINOR') {
      recommendations.push('⚠️ Minor discrepancy - consider recalculation')
    } else {
      recommendations.push('✅ Balance is healthy')
    }

    return NextResponse.json({
      success: true,
      audit,
      recommendations
    })

  } catch (error: any) {
    console.error('[Diesel Audit] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/diesel/audit-balance?warehouse_id=xxx
 * 
 * Same as POST but uses query params
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const warehouse_id = searchParams.get('warehouse_id')

    if (!warehouse_id) {
      return NextResponse.json(
        { error: 'warehouse_id query parameter is required' },
        { status: 400 }
      )
    }

    // Call the audit function
    const { data: auditResult, error: auditError } = await supabase
      .rpc('audit_warehouse_balance', {
        p_warehouse_id: warehouse_id
      })

    if (auditError) {
      console.error('[Diesel Audit] Error:', auditError)
      return NextResponse.json(
        { error: 'Failed to audit warehouse', details: auditError.message },
        { status: 500 }
      )
    }

    // Parse the JSON result
    const audit = typeof auditResult === 'string' 
      ? JSON.parse(auditResult) 
      : auditResult

    return NextResponse.json({
      success: true,
      audit
    })

  } catch (error: any) {
    console.error('[Diesel Audit] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
