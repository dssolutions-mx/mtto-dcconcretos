/**
 * Debug script to investigate hours calculation for a specific asset
 * Usage: npx tsx scripts/debug-asset-hours.ts <asset-id> <date-from> <date-to>
 * Example: npx tsx scripts/debug-asset-hours.ts 6be57c11-a350-4e96-bbca-f3772483ee22 2025-11-01 2026-02-09
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load env vars
config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugAssetHours(assetId: string, dateFrom: string, dateTo: string) {
  console.log(`\n=== Debugging hours calculation for asset ${assetId} ===`)
  console.log(`Period: ${dateFrom} to ${dateTo}\n`)

  // Get asset info
  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('id, asset_id, name, current_hours, current_kilometers')
    .eq('id', assetId)
    .single()

  if (assetError) {
    console.error('Error fetching asset:', assetError)
    return
  }

  console.log(`Asset: ${asset.asset_id} - ${asset.name}`)
  console.log(`Current hours: ${asset.current_hours || 0}`)
  console.log(`Current kilometers: ${asset.current_kilometers || 0}\n`)

  // Calculate date range (same as gerencial)
  const dateFromStart = new Date(`${dateFrom}T00:00:00.000Z`)
  const dateToExclusive = new Date(`${dateTo}T00:00:00.000Z`)
  dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1)
  const dateToExclusiveStr = dateToExclusive.toISOString().slice(0, 10)
  const extendedStart = new Date(dateFromStart)
  extendedStart.setDate(extendedStart.getDate() - 30)

  console.log(`Report period: ${dateFromStart.toISOString()} to ${dateToExclusive.toISOString()}`)
  console.log(`Extended start (for baseline): ${extendedStart.toISOString()}\n`)

  // Get checklist readings
  const { data: checklistReadings, error: checklistError } = await supabase
    .from('completed_checklists')
    .select('id, asset_id, equipment_hours_reading, reading_timestamp, created_at')
    .eq('asset_id', assetId)
    .gte('reading_timestamp', extendedStart.toISOString())
    .lt('reading_timestamp', dateToExclusive.toISOString())
    .not('equipment_hours_reading', 'is', null)
    .order('reading_timestamp', { ascending: true })

  if (checklistError) {
    console.error('Error fetching checklist readings:', checklistError)
  } else {
    console.log(`Checklist readings: ${checklistReadings?.length || 0}`)
    checklistReadings?.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.reading_timestamp}: ${r.equipment_hours_reading}h`)
    })
    console.log()
  }

  // Get diesel transaction readings
  const { data: dieselTxs, error: dieselError } = await supabase
    .from('diesel_transactions')
    .select(`
      id,
      asset_id,
      transaction_date,
      horometer_reading,
      previous_horometer,
      quantity_liters,
      transaction_type,
      is_transfer,
      diesel_warehouses!inner(product_type)
    `)
    .eq('asset_id', assetId)
    .eq('diesel_warehouses.product_type', 'diesel')
    .neq('is_transfer', true)
    .gte('transaction_date', dateFrom)
    .lt('transaction_date', dateToExclusiveStr)
    .order('transaction_date', { ascending: true })

  if (dieselError) {
    console.error('Error fetching diesel transactions:', dieselError)
  } else {
    console.log(`Diesel transactions: ${dieselTxs?.length || 0}`)
    dieselTxs?.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.transaction_date}: prev=${t.previous_horometer || 'null'}, reading=${t.horometer_reading || 'null'}, liters=${t.quantity_liters}`)
    })
    console.log()
  }

  // Get extended diesel readings for validation (30 days before period start)
  const extendedStartForValidation = new Date(dateFromStart)
  extendedStartForValidation.setDate(extendedStartForValidation.getDate() - 30)
  const { data: dieselTxsExtended } = await supabase
    .from('diesel_transactions')
    .select(`
      asset_id,
      transaction_date,
      horometer_reading,
      diesel_warehouses!inner(product_type)
    `)
    .eq('asset_id', assetId)
    .eq('diesel_warehouses.product_type', 'diesel')
    .neq('is_transfer', true)
    .gte('transaction_date', extendedStartForValidation.toISOString().slice(0, 10))
    .lt('transaction_date', dateToExclusiveStr)
    .not('horometer_reading', 'is', null)
    .order('transaction_date', { ascending: true })

  // Combine readings (same logic as gerencial)
  type ReadingEvent = { ts: number, val: number, source: string }
  const events: ReadingEvent[] = []

  // Diesel transaction events (only use horometer_reading, not previous_horometer)
  // Filter out diesel readings with unrealistic jumps
  const dieselReadingsRaw: Array<{ ts: number, val: number }> = []
  dieselTxs?.forEach(t => {
    const tts = new Date(t.transaction_date).getTime()
    if (!Number.isNaN(tts) && t.horometer_reading != null) {
      const v = Number(t.horometer_reading)
      if (!Number.isNaN(v)) {
        dieselReadingsRaw.push({ ts: tts, val: v })
      }
    }
  })
  
  // Filter diesel readings: keep only those in logical sequence
  const dieselReadings: ReadingEvent[] = []
  if (dieselReadingsRaw.length > 0) {
    dieselReadingsRaw.sort((a, b) => a.ts - b.ts)
    const MAX_HOURS_PER_DAY = 24
    
    for (let i = 0; i < dieselReadingsRaw.length; i++) {
      const current = dieselReadingsRaw[i]
      
      if (i === 0) {
        dieselReadings.push({ ts: current.ts, val: current.val, source: 'diesel' })
        continue
      }
      
      const previous = dieselReadingsRaw[i - 1]
      const timeDeltaDays = (current.ts - previous.ts) / (1000 * 60 * 60 * 24)
      const delta = current.val - previous.val
      const hoursPerDay = timeDeltaDays > 0 ? delta / timeDeltaDays : 0
      
      // Include if delta is reasonable (positive and <= 24h/day, or gap >60 days)
      if (delta >= 0 && (timeDeltaDays >= 60 || hoursPerDay <= MAX_HOURS_PER_DAY)) {
        dieselReadings.push({ ts: current.ts, val: current.val, source: 'diesel' })
      } else {
        console.log(`  Filtered out diesel reading: ${current.val}h (delta: ${delta}h in ${timeDeltaDays.toFixed(1)} days = ${hoursPerDay.toFixed(1)}h/day)`)
      }
    }
  }
  events.push(...dieselReadings)

  // Build validation values from extended diesel readings (filtered for unrealistic jumps)
  const dieselValidationRaw: Array<{ val: number, date: string }> = []
  dieselTxsExtended?.forEach(t => {
    if (t.horometer_reading != null) {
      const v = Number(t.horometer_reading)
      if (!Number.isNaN(v)) {
        dieselValidationRaw.push({ val: v, date: t.transaction_date })
      }
    }
  })
  
  // Filter diesel validation readings: keep only those in logical sequence
  const validationDieselValues: number[] = []
  if (dieselValidationRaw.length > 0) {
    dieselValidationRaw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const MAX_HOURS_PER_DAY = 24
    
    for (let i = 0; i < dieselValidationRaw.length; i++) {
      const current = dieselValidationRaw[i]
      
      if (i === 0) {
        validationDieselValues.push(current.val)
        continue
      }
      
      const previous = dieselValidationRaw[i - 1]
      const timeDeltaDays = (new Date(current.date).getTime() - new Date(previous.date).getTime()) / (1000 * 60 * 60 * 24)
      const delta = current.val - previous.val
      const hoursPerDay = timeDeltaDays > 0 ? delta / timeDeltaDays : 0
      
      // Include if delta is reasonable (positive and <= 24h/day, or gap >60 days)
      if (delta >= 0 && (timeDeltaDays >= 60 || hoursPerDay <= MAX_HOURS_PER_DAY)) {
        validationDieselValues.push(current.val)
      } else {
        console.log(`  Filtered out extended diesel reading: ${current.val}h (delta: ${delta}h in ${timeDeltaDays.toFixed(1)} days = ${hoursPerDay.toFixed(1)}h/day)`)
      }
    }
  }

  // Checklist events - filter out clearly incorrect readings
  // Use extended diesel readings for validation (includes readings before period start)
  if (validationDieselValues.length > 0 || dieselReadings.length > 0) {
    const dieselValues = validationDieselValues.length > 0 ? validationDieselValues : dieselReadings.map(e => e.val)
    const dieselMin = Math.min(...dieselValues)
    const dieselMax = Math.max(...dieselValues)
    const dieselRange = dieselMax - dieselMin
    const allowedMin = dieselMin - dieselRange * 2
    const allowedMax = dieselMax + dieselRange * 2
    
    console.log(`Diesel readings (extended): ${validationDieselValues.length} readings`)
    console.log(`Diesel readings range: ${dieselMin}h - ${dieselMax}h (range: ${dieselRange}h)`)
    console.log(`Allowed checklist range: ${allowedMin.toFixed(0)}h - ${allowedMax.toFixed(0)}h\n`)
    
    checklistReadings?.forEach(r => {
      const val = Number(r.equipment_hours_reading)
      const ts = new Date(r.reading_timestamp).getTime()
      if (!Number.isNaN(val) && !Number.isNaN(ts)) {
        if (val >= allowedMin && val <= allowedMax) {
          events.push({ ts, val, source: 'checklist' })
        } else {
          console.log(`  Filtered out checklist reading: ${val}h (outside range)`)
        }
      }
    })
  } else {
    // No diesel readings - use all checklist readings
    checklistReadings?.forEach(r => {
      const val = Number(r.equipment_hours_reading)
      const ts = new Date(r.reading_timestamp).getTime()
      if (!Number.isNaN(val) && !Number.isNaN(ts)) {
        events.push({ ts, val, source: 'checklist' })
      }
    })
  }

  console.log(`Total events: ${events.length}`)
  if (events.length === 0) {
    console.log('❌ No readings found - hours will be 0')
    return
  }

  // Sort chronologically
  events.sort((a, b) => a.ts - b.ts)

  // Remove duplicates
  const uniqueEvents: ReadingEvent[] = []
  events.forEach(e => {
    const last = uniqueEvents[uniqueEvents.length - 1]
    if (!last || last.ts !== e.ts || last.val !== e.val) {
      uniqueEvents.push(e)
    }
  })

  console.log(`Unique events: ${uniqueEvents.length}`)
  uniqueEvents.forEach((e, i) => {
    console.log(`  ${i + 1}. ${new Date(e.ts).toISOString()}: ${e.val}h (${e.source})`)
  })
  console.log()

  if (uniqueEvents.length < 2) {
    console.log('❌ Need at least 2 readings - hours will be 0')
    return
  }

  // Find baseline
  const startMs = dateFromStart.getTime()
  const endMs = dateToExclusive.getTime()

  let baselineIdx = -1
  for (let i = uniqueEvents.length - 1; i >= 0; i--) {
    if (uniqueEvents[i].ts < startMs) {
      baselineIdx = i
      break
    }
  }
  if (baselineIdx === -1) {
    for (let i = 0; i < uniqueEvents.length; i++) {
      if (uniqueEvents[i].ts >= startMs) {
        baselineIdx = i
        break
      }
    }
  }

  if (baselineIdx === -1 || baselineIdx >= uniqueEvents.length - 1) {
    console.log('❌ Could not find valid baseline - hours will be 0')
    return
  }

  console.log(`Baseline: Event ${baselineIdx + 1} at ${new Date(uniqueEvents[baselineIdx].ts).toISOString()}: ${uniqueEvents[baselineIdx].val}h`)
  console.log()

  // Calculate incremental deltas
  let totalHours = 0
  const MAX_HOURS_PER_DAY = 24

  console.log('Calculating deltas:')
  for (let i = baselineIdx; i < uniqueEvents.length - 1; i++) {
    const current = uniqueEvents[i]
    const next = uniqueEvents[i + 1]

    if (next.ts < startMs) {
      console.log(`  Skip: ${i + 1}→${i + 2} (next before period start)`)
      continue
    }
    if (current.ts >= endMs) {
      console.log(`  Break: ${i + 1}→${i + 2} (current after period end)`)
      break
    }

    const delta = next.val - current.val
    const timeDeltaDays = (next.ts - current.ts) / (1000 * 60 * 60 * 24)
    const hoursPerDay = timeDeltaDays > 0 ? delta / timeDeltaDays : 0

    console.log(`  ${i + 1}→${i + 2}: ${current.val}h → ${next.val}h = ${delta}h in ${timeDeltaDays.toFixed(1)} days (${hoursPerDay.toFixed(1)}h/day)`)

    if (delta < 0) {
      console.log(`    ❌ SKIP: Negative delta (reset)`)
      continue
    }

    if (hoursPerDay > MAX_HOURS_PER_DAY && timeDeltaDays < 60) {
      console.log(`    ❌ SKIP: Unrealistic jump (>24h/day and gap <60 days)`)
      continue
    }

    let cappedDelta = delta
    if (timeDeltaDays > 0) {
      const maxReasonableDelta = MAX_HOURS_PER_DAY * timeDeltaDays
      if (delta > maxReasonableDelta) {
        console.log(`    ⚠️  CAPPING: ${delta}h → ${maxReasonableDelta.toFixed(0)}h`)
        cappedDelta = maxReasonableDelta
      }
    }

    console.log(`    ✅ ADD: ${cappedDelta}h`)
    totalHours += cappedDelta
  }

  console.log(`\n=== RESULT: ${totalHours.toFixed(1)} hours ===\n`)
}

// Run if called directly
const args = process.argv.slice(2)
if (args.length >= 3) {
  debugAssetHours(args[0], args[1], args[2])
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err)
      process.exit(1)
    })
} else {
  console.log('Usage: npx tsx scripts/debug-asset-hours.ts <asset-id> <date-from> <date-to>')
  console.log('Example: npx tsx scripts/debug-asset-hours.ts 6be57c11-a350-4e96-bbca-f3772483ee22 2025-11-01 2026-02-09')
}
