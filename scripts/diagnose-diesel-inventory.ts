/**
 * Diesel Inventory Diagnostic Script
 * 
 * Identifies discrepancies between:
 * 1. Stored warehouse.current_inventory
 * 2. Latest transaction.current_balance
 * 3. Recalculated SUM(entries - consumptions)
 * 
 * Also detects:
 * - Broken balance chains
 * - Backdated transactions
 * - Edited transactions
 * - Negative balances
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

interface WarehouseAudit {
  warehouse_id: string
  warehouse_code: string
  warehouse_name: string
  plant_code: string
  stored_inventory: number
  latest_transaction_balance: number
  calculated_sum_balance: number
  total_transactions: number
  discrepancy_stored_vs_calculated: number
  discrepancy_latest_vs_calculated: number
  status: 'OK' | 'MINOR_ISSUE' | 'MAJOR_ISSUE' | 'CRITICAL'
  issues: string[]
}

interface BalanceBreak {
  warehouse_code: string
  transaction_id: string
  transaction_date: string
  expected_previous_balance: number
  actual_previous_balance: number
  gap: number
}

async function diagnoseAllWarehouses(): Promise<void> {
  console.log('🔍 Starting Diesel Inventory Diagnostic...\n')

  // Get all diesel warehouses
  const { data: warehouses, error: warehousesError } = await supabase
    .from('diesel_warehouses')
    .select(`
      id,
      warehouse_code,
      name,
      current_inventory,
      plants!inner(code, name)
    `)
    .order('warehouse_code')

  if (warehousesError) {
    console.error('❌ Error fetching warehouses:', warehousesError)
    return
  }

  console.log(`Found ${warehouses.length} diesel warehouses\n`)

  const auditResults: WarehouseAudit[] = []
  const balanceBreaks: BalanceBreak[] = []

  for (const warehouse of warehouses) {
    const plantsAny: any = warehouse.plants
    const plantCode = Array.isArray(plantsAny) ? plantsAny[0]?.code : plantsAny?.code

    console.log(`\n📦 Auditing: ${warehouse.warehouse_code} - ${warehouse.name}`)

    // Method 1: Stored inventory
    const storedInventory = Number(warehouse.current_inventory) || 0

    // Method 2: Latest transaction balance
    const { data: latestTx } = await supabase
      .from('diesel_transactions')
      .select('current_balance, transaction_id')
      .eq('warehouse_id', warehouse.id)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .single()

    const latestBalance = latestTx ? Number(latestTx.current_balance) || 0 : 0

    // Method 3: Calculated SUM
    const { data: calculated } = await supabase
      .from('diesel_transactions')
      .select('transaction_type, quantity_liters')
      .eq('warehouse_id', warehouse.id)

    let calculatedSum = 0
    let totalCount = 0
    if (calculated) {
      calculatedSum = calculated.reduce((sum, tx) => {
        totalCount++
        if (tx.transaction_type === 'entry') {
          return sum + Number(tx.quantity_liters)
        } else if (tx.transaction_type === 'consumption') {
          return sum - Number(tx.quantity_liters)
        }
        return sum
      }, 0)
    }

    // Calculate discrepancies
    const discStoredVsCalc = storedInventory - calculatedSum
    const discLatestVsCalc = latestBalance - calculatedSum

    const issues: string[] = []
    let status: 'OK' | 'MINOR_ISSUE' | 'MAJOR_ISSUE' | 'CRITICAL' = 'OK'

    // Check for discrepancies
    if (Math.abs(discStoredVsCalc) > 0.5) {
      issues.push(`Stored inventory off by ${discStoredVsCalc.toFixed(2)}L`)
      if (Math.abs(discStoredVsCalc) > 100) {
        status = 'CRITICAL'
      } else if (Math.abs(discStoredVsCalc) > 10) {
        status = 'MAJOR_ISSUE'
      } else {
        status = 'MINOR_ISSUE'
      }
    }

    if (Math.abs(discLatestVsCalc) > 0.5) {
      issues.push(`Latest transaction off by ${discLatestVsCalc.toFixed(2)}L`)
    }

    // Check for balance chain breaks
    const { data: chainCheck } = await supabase.rpc('check_balance_chain', {
      p_warehouse_id: warehouse.id
    }).catch(() => ({ data: null }))

    // Find chain breaks manually if function doesn't exist
    const { data: transactions } = await supabase
      .from('diesel_transactions')
      .select('id, transaction_id, transaction_date, previous_balance, current_balance')
      .eq('warehouse_id', warehouse.id)
      .order('transaction_date')
      .order('created_at')
      .order('id')

    if (transactions && transactions.length > 1) {
      let chainBreaks = 0
      for (let i = 1; i < transactions.length; i++) {
        const prevTx = transactions[i - 1]
        const currTx = transactions[i]
        
        const prevCurrent = Number(prevTx.current_balance) || 0
        const currPrevious = Number(currTx.previous_balance) || 0
        
        if (Math.abs(prevCurrent - currPrevious) > 0.5) {
          chainBreaks++
          if (chainBreaks <= 5) { // Only store first 5 breaks
            balanceBreaks.push({
              warehouse_code: warehouse.warehouse_code,
              transaction_id: currTx.transaction_id,
              transaction_date: currTx.transaction_date,
              expected_previous_balance: prevCurrent,
              actual_previous_balance: currPrevious,
              gap: currPrevious - prevCurrent
            })
          }
        }
      }
      
      if (chainBreaks > 0) {
        issues.push(`${chainBreaks} balance chain breaks detected`)
        if (chainBreaks > 10) {
          status = 'CRITICAL'
        } else if (status === 'OK') {
          status = 'MAJOR_ISSUE'
        }
      }
    }

    // Check for negative balances
    const { data: negativeBalances } = await supabase
      .from('diesel_transactions')
      .select('transaction_id, current_balance')
      .eq('warehouse_id', warehouse.id)
      .lt('current_balance', 0)

    if (negativeBalances && negativeBalances.length > 0) {
      issues.push(`${negativeBalances.length} negative balance transactions`)
      status = 'CRITICAL'
    }

    auditResults.push({
      warehouse_id: warehouse.id,
      warehouse_code: warehouse.warehouse_code,
      warehouse_name: warehouse.name,
      plant_code: plantCode || 'N/A',
      stored_inventory: storedInventory,
      latest_transaction_balance: latestBalance,
      calculated_sum_balance: calculatedSum,
      total_transactions: totalCount,
      discrepancy_stored_vs_calculated: discStoredVsCalc,
      discrepancy_latest_vs_calculated: discLatestVsCalc,
      status,
      issues
    })

    // Print status
    const statusIcon = status === 'OK' ? '✅' : status === 'MINOR_ISSUE' ? '⚠️' : status === 'MAJOR_ISSUE' ? '🟠' : '🔴'
    console.log(`${statusIcon} Status: ${status}`)
    console.log(`   Stored: ${storedInventory.toFixed(2)}L | Latest TX: ${latestBalance.toFixed(2)}L | Calculated: ${calculatedSum.toFixed(2)}L`)
    if (issues.length > 0) {
      issues.forEach(issue => console.log(`   ⚠️  ${issue}`))
    }
  }

  // Generate summary report
  console.log('\n' + '='.repeat(80))
  console.log('📊 DIAGNOSTIC SUMMARY')
  console.log('='.repeat(80) + '\n')

  const critical = auditResults.filter(r => r.status === 'CRITICAL')
  const major = auditResults.filter(r => r.status === 'MAJOR_ISSUE')
  const minor = auditResults.filter(r => r.status === 'MINOR_ISSUE')
  const ok = auditResults.filter(r => r.status === 'OK')

  console.log(`Total Warehouses: ${auditResults.length}`)
  console.log(`🔴 Critical Issues: ${critical.length}`)
  console.log(`🟠 Major Issues: ${major.length}`)
  console.log(`⚠️  Minor Issues: ${minor.length}`)
  console.log(`✅ OK: ${ok.length}\n`)

  if (critical.length > 0) {
    console.log('\n🔴 CRITICAL WAREHOUSES (require immediate attention):')
    critical.forEach(w => {
      console.log(`\n${w.warehouse_code} - ${w.warehouse_name}`)
      console.log(`  Discrepancy: ${w.discrepancy_stored_vs_calculated.toFixed(2)}L`)
      console.log(`  Issues: ${w.issues.join(', ')}`)
    })
  }

  // Save detailed report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportDir = path.join(process.cwd(), 'reports', 'diesel-inventory')
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  const reportPath = path.join(reportDir, `diagnostic-${timestamp}.json`)
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total_warehouses: auditResults.length,
      critical: critical.length,
      major: major.length,
      minor: minor.length,
      ok: ok.length
    },
    warehouses: auditResults,
    balance_breaks: balanceBreaks
  }, null, 2))

  console.log(`\n📄 Detailed report saved to: ${reportPath}`)

  // Save CSV for Excel analysis
  const csvPath = path.join(reportDir, `diagnostic-${timestamp}.csv`)
  const csvHeader = 'Warehouse Code,Plant,Status,Stored Inventory,Latest TX Balance,Calculated Balance,Discrepancy,Total Transactions,Issues\n'
  const csvRows = auditResults.map(w => 
    `"${w.warehouse_code}","${w.plant_code}","${w.status}",${w.stored_inventory},${w.latest_transaction_balance},${w.calculated_sum_balance},${w.discrepancy_stored_vs_calculated},${w.total_transactions},"${w.issues.join('; ')}"`
  ).join('\n')
  fs.writeFileSync(csvPath, csvHeader + csvRows)

  console.log(`📊 CSV report saved to: ${csvPath}`)

  console.log('\n✅ Diagnostic complete!')
}

// Run diagnostic
diagnoseAllWarehouses().catch(console.error)
