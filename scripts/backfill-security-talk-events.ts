/**
 * Backfill operator_evaluation_events.security_talk from completed_checklists.security_data.
 *
 * Dry run:  npx tsx scripts/backfill-security-talk-events.ts --dry-run
 * Apply:    npx tsx scripts/backfill-security-talk-events.ts
 * Period:   npx tsx scripts/backfill-security-talk-events.ts --year=2026 --month=6
 */
import { createClient } from '@supabase/supabase-js'
import { monthDateKeysUTC } from '../lib/hr/bonus-decision-summary'
import { writeSecurityTalkEvents } from '../lib/hr/operator-evaluation-events'
import {
  fetchSecurityTalkCompletionFallbacks,
  hasNonEmptySecurityData,
  resolvePrimaryOperatorIdsByAsset,
  resolveSecurityTalkEventDate,
} from '../lib/hr/security-talk-reports'
import type { SecurityTalkData } from '../types'

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run')
  const yearArg = process.argv.find((arg) => arg.startsWith('--year='))
  const monthArg = process.argv.find((arg) => arg.startsWith('--month='))
  const now = new Date()
  const year = yearArg ? parseInt(yearArg.split('=')[1] ?? '', 10) : now.getUTCFullYear()
  const month = monthArg ? parseInt(monthArg.split('=')[1] ?? '', 10) : now.getUTCMonth() + 1
  return { dryRun, year, month }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const { dryRun, year, month } = parseArgs()
  const { from, to } = monthDateKeysUTC(year, month)
  const supabase = createClient(url, key)

  const { data: plants, error: plantsError } = await supabase
    .from('plants')
    .select('id, name')
    .order('name')

  if (plantsError) {
    console.error('Failed to load plants:', plantsError.message)
    process.exit(1)
  }

  const plantIds = (plants ?? []).map((plant) => plant.id)
  const completions = await fetchSecurityTalkCompletionFallbacks(supabase, {
    plantIds,
    from,
    to,
  })

  if (completions.length === 0) {
    console.log(`No completions with security_data for ${year}-${month}`)
    return
  }

  const assetIds = [
    ...new Set(completions.map((completion) => completion.asset_id).filter(Boolean) as string[]),
  ]
  const primaryByAsset = await resolvePrimaryOperatorIdsByAsset(supabase, assetIds)

  const completionIds = completions.map((completion) => completion.id)
  const { data: existingEvents, error: eventsError } = await supabase
    .from('operator_evaluation_events')
    .select('source_completion_id')
    .eq('event_type', 'security_talk')
    .in('source_completion_id', completionIds)

  if (eventsError) {
    console.error('Failed to load existing events:', eventsError.message)
    process.exit(1)
  }

  const covered = new Set(
    (existingEvents ?? []).map((row) => row.source_completion_id).filter(Boolean)
  )

  let written = 0
  let skipped = 0

  for (const completion of completions) {
    if (covered.has(completion.id)) {
      skipped += 1
      continue
    }

    if (!hasNonEmptySecurityData(completion.security_data)) continue

    const eventDate = resolveSecurityTalkEventDate({
      scheduled_day: completion.scheduled_day,
      scheduled_date: completion.scheduled_date,
      completion_date: completion.completion_date,
    })

    const payload = {
      id: completion.id,
      schedule_id: completion.schedule_id ?? completion.id,
      event_date: eventDate,
      asset_id: completion.asset_id,
    }

    const primaryOperatorId =
      (completion.asset_id ? primaryByAsset.get(completion.asset_id) : null) ?? null

    if (dryRun) {
      console.log(
        `[dry-run] would backfill completion ${completion.id} (${eventDate}) plant=${completion.plant_id}`
      )
      written += 1
      continue
    }

    const count = await writeSecurityTalkEvents(
      supabase,
      payload,
      completion.security_data as Record<string, SecurityTalkData>,
      completion.plant_id,
      primaryOperatorId
    )
    written += count > 0 ? 1 : 0
  }

  console.log(
    `${dryRun ? 'Dry run' : 'Backfill'} complete for ${year}-${month}: ${written} completion(s) processed, ${skipped} already had events`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
