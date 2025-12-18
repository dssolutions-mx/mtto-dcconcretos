/**
 * Diesel Inventory Balance Recalculation Script
 * 
 * This script fixes ALL balance calculations by:
 * 1. Processing transactions in strict chronological order
 * 2. Recalculating previous_balance and current_balance for each transaction
 * 3. Updating warehouse.current_inventory to match final balance
 * 4. Validating the chain is unbroken
 * 
 * SAFETY FEATURES:
 * - Dry-run mode by default (use --execute to actually update)
 * - Creates backup snapshots before changes
 * - Validates results after recalculation
 * - Detailed logging of all changes
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface RecalcResult {
  warehouse_id: string
  warehouse_code: string
  warehouse_name: string
  transactions_updated: number
  old_stored_inventory: number
  new_stored_inventory: number
  old_latest_balance: number
  new_latest_balance: number
  corrections_made: number
  success: boolean
  error?: string
}

const DRY_RUN = !process.argv.includes('--execute')
const SPECIFIC_WAREHOUSE = process.argv.find(arg => arg.startsWith('--warehouse='))?.split('=')[1]

async function recalculateWarehouseBalances(warehouseId: string, warehouseCode: string): Promise<RecalcResult> {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`📦 Processing: ${warehouseCode}`)
  console.log('='.repeat(80))

  const result: RecalcResult = {
    warehouse_id: warehouseId,
    warehouse_code: warehouseCode,
    warehouse_name: '',
    transactions_updated: 0,
    old_stored_inventory: 0,
    new_stored_inventory: 0,
    old_latest_balance: 0,
    new_latest_balance: 0,
    corrections_made: 0,
    success: false
  }

  try {
    // Get warehouse info
    const { data: warehouse, error: whError } = await supabase
      .from('diesel_warehouses')
      .select('id, warehouse_code, name, current_inventory')
      .eq('id', warehouseId)
      .single()

    if (whError || !warehouse) {
      throw new Error(`Warehouse not found: ${whError?.message}`)
    }

    result.warehouse_name = warehouse.name
    result.old_stored_inventory = Number(warehouse.current_inventory) || 0

    console.log(`📊 Current stored inventory: ${result.old_stored_inventory.toFixed(2)}L`)

    // Get ALL transactions in chronological order
    const { data: transactions, error: txError } = await supabase
      .from('diesel_transactions')
      .select('id, transaction_id, transaction_type, quantity_liters, previous_balance, current_balance, transaction_date, created_at')
      .eq('warehouse_id', warehouseId)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    if (txError) {
      throw new Error(`Failed to load transactions: ${txError.message}`)
    }

    if (!transactions || transactions.length === 0) {
      console.log('⚠️  No transactions found for this warehouse')
      result.success = true
      return result
    }

    console.log(`📋 Found ${transactions.length} transactions`)

    // Get latest transaction balance before changes
    result.old_latest_balance = Number(transactions[transactions.length - 1].current_balance) || 0

    // Recalculate balances
    console.log('\n🔄 Recalculating balances...')
    
    let runningBalance = 0
    const updates: Array<{ id: string; prev: number; curr: number; txId: string }> = []

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i]
      const oldPrevious = Number(tx.previous_balance) || 0
      const oldCurrent = Number(tx.current_balance) || 0

      // Calculate new balances
      const newPrevious = runningBalance
      let newCurrent = runningBalance

      if (tx.transaction_type === 'entry') {
        newCurrent = runningBalance + Number(tx.quantity_liters)
      } else if (tx.transaction_type === 'consumption') {
        newCurrent = runningBalance - Number(tx.quantity_liters)
      } else {
        // Unknown type, keep running balance unchanged
        console.warn(`⚠️  Unknown transaction type: ${tx.transaction_type} for ${tx.transaction_id}`)
      }

      // Check if correction is needed
      const prevChanged = Math.abs(oldPrevious - newPrevious) > 0.01
      const currChanged = Math.abs(oldCurrent - newCurrent) > 0.01

      if (prevChanged || currChanged) {
        result.corrections_made++
        updates.push({
          id: tx.id,
          prev: newPrevious,
          curr: newCurrent,
          txId: tx.transaction_id
        })

        if (result.corrections_made <= 10) { // Only log first 10
          console.log(`  🔧 ${tx.transaction_id}: prev ${oldPrevious.toFixed(2)} → ${newPrevious.toFixed(2)}, curr ${oldCurrent.toFixed(2)} → ${newCurrent.toFixed(2)}`)
        }
      }

      // Update running balance for next iteration
      runningBalance = newCurrent
    }

    result.new_latest_balance = runningBalance
    result.new_stored_inventory = runningBalance
    result.transactions_updated = updates.length

    console.log(`\n📊 Summary:`)
    console.log(`   Transactions needing correction: ${result.corrections_made}`)
    console.log(`   Final calculated balance: ${result.new_latest_balance.toFixed(2)}L`)
    console.log(`   Change from stored: ${(result.new_stored_inventory - result.old_stored_inventory).toFixed(2)}L`)

    if (DRY_RUN) {
      console.log(`\n⚠️  DRY RUN - No changes made`)
      console.log(`   Run with --execute flag to apply changes`)
      result.success = true
      return result
    }

    // EXECUTE MODE - Apply changes
    console.log(`\n🔨 EXECUTING UPDATES...`)

    // Create backup snapshot first
    const { error: snapshotError } = await supabase
      .from('diesel_inventory_snapshots')
      .insert({
        warehouse_id: warehouseId,
        snapshot_date: new Date().toISOString(),
        inventory_balance: result.old_stored_inventory,
        transaction_count: transactions.length,
        notes: `Pre-recalculation backup - ${result.corrections_made} corrections needed`,
        created_by: null // System-generated
      })

    if (snapshotError) {
      console.warn(`⚠️  Failed to create backup snapshot: ${snapshotError.message}`)
    } else {
      console.log(`✅ Backup snapshot created`)
    }

    // Update transactions in batches
    const BATCH_SIZE = 50
    let updated = 0

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE)
      
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('diesel_transactions')
          .update({
            previous_balance: update.prev,
            current_balance: update.curr,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id)

        if (updateError) {
          console.error(`❌ Failed to update ${update.txId}: ${updateError.message}`)
        } else {
          updated++
        }
      }

      console.log(`   Progress: ${updated}/${updates.length} transactions updated`)
    }

    // Update warehouse inventory
    const { error: whUpdateError } = await supabase
      .from('diesel_warehouses')
      .update({
        current_inventory: result.new_stored_inventory,
        last_updated: new Date().toISOString()
      })
      .eq('id', warehouseId)

    if (whUpdateError) {
      console.error(`❌ Failed to update warehouse inventory: ${whUpdateError.message}`)
      result.success = false
      result.error = whUpdateError.message
      return result
    }

    console.log(`✅ Warehouse inventory updated to ${result.new_stored_inventory.toFixed(2)}L`)

    // Validate the chain is now unbroken
    console.log(`\n🔍 Validating balance chain...`)
    
    const { data: validationTxs } = await supabase
      .from('diesel_transactions')
      .select('id, transaction_id, previous_balance, current_balance')
      .eq('warehouse_id', warehouseId)
      .order('transaction_date')
      .order('created_at')
      .order('id')

    let chainBreaks = 0
    if (validationTxs && validationTxs.length > 1) {
      for (let i = 1; i < validationTxs.length; i++) {
        const prevCurrent = Number(validationTxs[i - 1].current_balance)
        const currPrevious = Number(validationTxs[i].previous_balance)
        
        if (Math.abs(prevCurrent - currPrevious) > 0.01) {
          chainBreaks++
          if (chainBreaks <= 3) {
            console.warn(`⚠️  Chain break at ${validationTxs[i].transaction_id}`)
          }
        }
      }
    }

    if (chainBreaks === 0) {
      console.log(`✅ Balance chain is valid (no breaks)`)
      result.success = true
    } else {
      console.error(`❌ ${chainBreaks} balance chain breaks still exist!`)
      result.success = false
      result.error = `${chainBreaks} chain breaks remain`
    }

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`)
    result.success = false
    result.error = error.message
  }

  return result
}

async function recalculateAll(): Promise<void> {
  console.log('🚀 Diesel Balance Recalculation Script')
  console.log('='.repeat(80))
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made')
    console.log('   Use --execute flag to apply changes\n')
  } else {
    console.log('🔨 EXECUTE MODE - Changes will be applied!\n')
  }

  // Get warehouses to process
  let warehouseQuery = supabase
    .from('diesel_warehouses')
    .select('id, warehouse_code, name')
    .order('warehouse_code')

  if (SPECIFIC_WAREHOUSE) {
    console.log(`🎯 Processing specific warehouse: ${SPECIFIC_WAREHOUSE}\n`)
    warehouseQuery = warehouseQuery.eq('warehouse_code', SPECIFIC_WAREHOUSE)
  }

  const { data: warehouses, error: whError } = await warehouseQuery

  if (whError) {
    console.error('❌ Failed to load warehouses:', whError)
    return
  }

  if (!warehouses || warehouses.length === 0) {
    console.log('⚠️  No warehouses found')
    return
  }

  console.log(`Found ${warehouses.length} warehouse(s) to process\n`)

  const results: RecalcResult[] = []

  for (const warehouse of warehouses) {
    const result = await recalculateWarehouseBalances(warehouse.id, warehouse.warehouse_code)
    results.push(result)
  }

  // Summary report
  console.log('\n' + '='.repeat(80))
  console.log('📊 RECALCULATION SUMMARY')
  console.log('='.repeat(80) + '\n')

  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)
  const totalCorrections = results.reduce((sum, r) => sum + r.corrections_made, 0)

  console.log(`Total Warehouses: ${results.length}`)
  console.log(`✅ Successful: ${successful.length}`)
  console.log(`❌ Failed: ${failed.length}`)
  console.log(`🔧 Total Corrections: ${totalCorrections}\n`)

  if (failed.length > 0) {
    console.log('❌ FAILED WAREHOUSES:')
    failed.forEach(r => {
      console.log(`   ${r.warehouse_code}: ${r.error}`)
    })
    console.log()
  }

  // Save detailed report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportDir = path.join(process.cwd(), 'reports', 'diesel-inventory')
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  const reportPath = path.join(reportDir, `recalculation-${timestamp}.json`)
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    dry_run: DRY_RUN,
    summary: {
      total_warehouses: results.length,
      successful: successful.length,
      failed: failed.length,
      total_corrections: totalCorrections
    },
    results
  }, null, 2))

  console.log(`📄 Detailed report saved to: ${reportPath}`)
  console.log('\n✅ Recalculation complete!')
}

// Run recalculation
recalculateAll().catch(console.error)
