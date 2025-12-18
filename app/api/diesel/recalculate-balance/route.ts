import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * POST /api/diesel/recalculate-balance
 * 
 * Recalculates all transaction balances for a warehouse.
 * This fixes:
 * - Broken balance chains
 * - Incorrect previous_balance and current_balance values
 * - Warehouse inventory drift
 * 
 * Body: { 
 *   warehouse_id: string,
 *   initial_balance?: number (default: 0)
 * }
 * 
 * WARNING: This operation updates many rows and acquires a lock.
 * Do not run concurrently on the same warehouse.
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
    const { warehouse_id, initial_balance = 0 } = body

    if (!warehouse_id) {
      return NextResponse.json(
        { error: 'warehouse_id is required' },
        { status: 400 }
      )
    }

    console.log('[Diesel Recalculate] Starting recalculation for warehouse:', warehouse_id)

    // Get warehouse info for logging
    const { data: warehouse } = await supabase
      .from('diesel_warehouses')
      .select('warehouse_code, name, current_inventory')
      .eq('id', warehouse_id)
      .single()

    if (!warehouse) {
      return NextResponse.json(
        { error: 'Warehouse not found' },
        { status: 404 }
      )
    }

    const oldBalance = warehouse.current_inventory

    console.log('[Diesel Recalculate] Warehouse:', warehouse.warehouse_code, warehouse.name)
    console.log('[Diesel Recalculate] Current inventory:', oldBalance)

    // Create pre-recalculation snapshot
    const { error: snapshotError } = await supabase
      .from('diesel_inventory_snapshots')
      .insert({
        warehouse_id: warehouse_id,
        snapshot_date: new Date().toISOString(),
        inventory_balance: oldBalance,
        notes: `Pre-recalculation backup by ${user.email}`,
        created_by: user.id
      })

    if (snapshotError) {
      console.warn('[Diesel Recalculate] Failed to create snapshot:', snapshotError)
      // Continue anyway - snapshot is not critical
    }

    // Call the recalculation function
    const { data: result, error: recalcError } = await supabase
      .rpc('recalculate_warehouse_balances_v3', {
        p_warehouse_id: warehouse_id,
        p_initial_balance: initial_balance
      })

    if (recalcError) {
      console.error('[Diesel Recalculate] Error:', recalcError)
      return NextResponse.json(
        { error: 'Recalculation failed', details: recalcError.message },
        { status: 500 }
      )
    }

    // Parse result (RPC returns JSON as string)
    const recalcResult = typeof result === 'string' ? JSON.parse(result) : result

    if (!recalcResult.success) {
      return NextResponse.json(
        { error: 'Recalculation failed', details: recalcResult.error },
        { status: 500 }
      )
    }

    console.log('[Diesel Recalculate] Success!')
    console.log('  Transactions processed:', recalcResult.transactions_processed)
    console.log('  Corrections made:', recalcResult.corrections_made)
    console.log('  Final balance:', recalcResult.final_balance)
    console.log('  Change:', (recalcResult.final_balance - oldBalance).toFixed(2), 'L')

    // Log to audit trail
    const { error: auditError } = await supabase
      .from('diesel_balance_audit_log')
      .insert({
        warehouse_id: warehouse_id,
        action: 'recalculation',
        old_balance: oldBalance,
        new_balance: recalcResult.final_balance,
        corrections_made: recalcResult.corrections_made,
        triggered_by: user.id,
        notes: `API recalculation by ${user.email}`
      })

    if (auditError) {
      console.warn('[Diesel Recalculate] Failed to log audit:', auditError)
      // Not critical, continue
    }

    return NextResponse.json({
      success: true,
      warehouse_code: warehouse.warehouse_code,
      warehouse_name: warehouse.name,
      old_balance: Number(oldBalance),
      new_balance: recalcResult.final_balance,
      change: recalcResult.final_balance - Number(oldBalance),
      transactions_processed: recalcResult.transactions_processed,
      corrections_made: recalcResult.corrections_made
    })

  } catch (error: any) {
    console.error('[Diesel Recalculate] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
