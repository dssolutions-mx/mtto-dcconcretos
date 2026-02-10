/**
 * Fix Asset Meter Readings from Diesel Transactions
 * 
 * This script checks an asset and updates it with the correct meter readings
 * from the latest diesel transaction, in case it was manually changed.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const ASSET_ID = 'cc2d54c9-085c-401f-b706-c900cbc19ef3'
const DRY_RUN = !process.argv.includes('--execute')

async function fixAssetFromDieselTransactions() {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🔧 Fixing Asset: ${ASSET_ID}`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (use --execute to apply changes)' : 'EXECUTE'}`)
  console.log('='.repeat(80))

  try {
    // Step 1: Get the asset
    console.log('\n📋 Step 1: Fetching asset information...')
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('id, asset_id, name, current_hours, current_kilometers, current_horometer, current_kilometer, last_reading_date, updated_at')
      .eq('id', ASSET_ID)
      .single()

    if (assetError || !asset) {
      throw new Error(`Asset not found: ${assetError?.message}`)
    }

    console.log(`✅ Asset found: ${asset.name} (${asset.asset_id})`)
    console.log(`   Current hours: ${asset.current_hours ?? 'NULL'} (horometer: ${asset.current_horometer ?? 'NULL'})`)
    console.log(`   Current kilometers: ${asset.current_kilometers ?? 'NULL'} (kilometer: ${asset.current_kilometer ?? 'NULL'})`)
    console.log(`   Last reading date: ${asset.last_reading_date ?? 'NULL'}`)
    console.log(`   Last updated: ${asset.updated_at}`)

    // Step 2: Find latest diesel transaction for this asset
    console.log('\n📋 Step 2: Finding latest diesel transaction...')
    const { data: transactions, error: txError } = await supabase
      .from('diesel_transactions')
      .select('id, transaction_id, transaction_date, transaction_type, asset_id, horometer_reading, kilometer_reading, previous_horometer, previous_kilometer, created_at')
      .eq('asset_id', ASSET_ID)
      .not('horometer_reading', 'is', null)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10)

    if (txError) {
      throw new Error(`Failed to load transactions: ${txError.message}`)
    }

    if (!transactions || transactions.length === 0) {
      console.log('⚠️  No diesel transactions found with meter readings for this asset')
      console.log('   Checking all transactions (including those without readings)...')
      
      const { data: allTx, error: allTxError } = await supabase
        .from('diesel_transactions')
        .select('id, transaction_id, transaction_date, transaction_type, asset_id, horometer_reading, kilometer_reading, created_at')
        .eq('asset_id', ASSET_ID)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5)

      if (allTxError) {
        throw new Error(`Failed to load all transactions: ${allTxError.message}`)
      }

      if (!allTx || allTx.length === 0) {
        console.log('❌ No diesel transactions found for this asset at all')
        return
      }

      console.log(`\n📊 Found ${allTx.length} recent transactions (some may not have readings):`)
      allTx.forEach((tx, idx) => {
        console.log(`   ${idx + 1}. ${tx.transaction_id} - ${tx.transaction_date} (${tx.transaction_type})`)
        console.log(`      Horometer: ${tx.horometer_reading ?? 'NULL'}, Kilometer: ${tx.kilometer_reading ?? 'NULL'}`)
      })
      return
    }

    console.log(`✅ Found ${transactions.length} transaction(s) with meter readings`)

    // Step 3: Get the latest transaction with readings
    const latestTx = transactions[0]
    console.log(`\n📋 Step 3: Latest transaction with readings:`)
    console.log(`   Transaction ID: ${latestTx.transaction_id}`)
    console.log(`   Date: ${latestTx.transaction_date}`)
    console.log(`   Type: ${latestTx.transaction_type}`)
    console.log(`   Horometer reading: ${latestTx.horometer_reading}`)
    console.log(`   Kilometer reading: ${latestTx.kilometer_reading ?? 'NULL'}`)
    console.log(`   Previous horometer: ${latestTx.previous_horometer ?? 'NULL'}`)
    console.log(`   Previous kilometer: ${latestTx.previous_kilometer ?? 'NULL'}`)

    // Step 4: Compare with current asset values
    console.log(`\n📋 Step 4: Comparing with current asset values...`)
    const needsUpdate: string[] = []
    
    // Check horometer/hours
    const expectedHours = latestTx.horometer_reading
    const currentHours = asset.current_hours ?? asset.current_horometer
    
    if (expectedHours !== null && currentHours !== expectedHours) {
      needsUpdate.push(`hours: ${currentHours} → ${expectedHours}`)
      console.log(`   ⚠️  Hours mismatch: Asset has ${currentHours}, transaction shows ${expectedHours}`)
    } else {
      console.log(`   ✅ Hours match: ${currentHours}`)
    }

    // Check kilometer
    const expectedKm = latestTx.kilometer_reading
    const currentKm = asset.current_kilometers ?? asset.current_kilometer
    
    if (expectedKm !== null && currentKm !== expectedKm) {
      needsUpdate.push(`kilometers: ${currentKm} → ${expectedKm}`)
      console.log(`   ⚠️  Kilometers mismatch: Asset has ${currentKm}, transaction shows ${expectedKm}`)
    } else if (expectedKm !== null) {
      console.log(`   ✅ Kilometers match: ${currentKm}`)
    } else {
      console.log(`   ℹ️  No kilometer reading in transaction`)
    }

    // Step 5: Update if needed
    if (needsUpdate.length === 0) {
      console.log(`\n✅ Asset is already up to date! No changes needed.`)
      return
    }

    console.log(`\n📋 Step 5: Updating asset...`)
    console.log(`   Changes needed: ${needsUpdate.join(', ')}`)

    if (DRY_RUN) {
      console.log(`\n🔍 DRY RUN - Would update:`)
      const updateData: any = {}
      if (expectedHours !== null) {
        updateData.current_hours = expectedHours
        updateData.current_horometer = expectedHours
      }
      if (expectedKm !== null) {
        updateData.current_kilometers = expectedKm
        updateData.current_kilometer = expectedKm
      }
      updateData.last_reading_date = latestTx.transaction_date
      updateData.updated_at = new Date().toISOString()
      
      console.log(JSON.stringify(updateData, null, 2))
      console.log(`\n💡 Run with --execute to apply these changes`)
      return
    }

    // Execute update
    const updateData: any = {}
    if (expectedHours !== null) {
      updateData.current_hours = expectedHours
      updateData.current_horometer = expectedHours
    }
    if (expectedKm !== null) {
      updateData.current_kilometers = expectedKm
      updateData.current_kilometer = expectedKm
    }
    updateData.last_reading_date = latestTx.transaction_date
    updateData.updated_at = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('assets')
      .update(updateData)
      .eq('id', ASSET_ID)

    if (updateError) {
      throw new Error(`Failed to update asset: ${updateError.message}`)
    }

    console.log(`\n✅ Asset updated successfully!`)
    console.log(`   Updated values:`)
    if (expectedHours !== null) {
      console.log(`     - Hours: ${expectedHours}`)
    }
    if (expectedKm !== null) {
      console.log(`     - Kilometers: ${expectedKm}`)
    }
    console.log(`     - Last reading date: ${latestTx.transaction_date}`)

    // Verify update
    console.log(`\n📋 Step 6: Verifying update...`)
    const { data: updatedAsset, error: verifyError } = await supabase
      .from('assets')
      .select('id, name, current_hours, current_kilometers, current_horometer, current_kilometer, last_reading_date')
      .eq('id', ASSET_ID)
      .single()

    if (verifyError) {
      console.log(`⚠️  Could not verify update: ${verifyError.message}`)
    } else {
      console.log(`✅ Verification:`)
      console.log(`   Current hours: ${updatedAsset.current_hours ?? 'NULL'}`)
      console.log(`   Current kilometers: ${updatedAsset.current_kilometers ?? 'NULL'}`)
      console.log(`   Last reading date: ${updatedAsset.last_reading_date ?? 'NULL'}`)
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error)
    process.exit(1)
  }
}

fixAssetFromDieselTransactions()
  .then(() => {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ Script completed`)
    console.log('='.repeat(80))
    process.exit(0)
  })
  .catch((error) => {
    console.error(`\n❌ Fatal error:`, error)
    process.exit(1)
  })
