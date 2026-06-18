import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  assertDieselGapEmailSender,
  assertWarehouseInScope,
} from '@/lib/diesel/gap-email/auth'
import { buildDieselGapEmailDraft } from '@/lib/diesel/gap-email/build-email-draft'
import {
  filterGapsByIds,
  loadWarehouseGapContext,
} from '@/lib/diesel/gap-email/load-warehouse-gaps'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await assertDieselGapEmailSender()
  if (!auth.ok) return auth.response

  const { searchParams } = req.nextUrl
  const warehouseId = searchParams.get('warehouseId')?.trim()
  if (!warehouseId) {
    return NextResponse.json({ error: 'warehouseId required' }, { status: 400 })
  }

  const gapIdFilters = searchParams
    .getAll('gapId')
    .map((s) => s.trim())
    .filter(Boolean)

  const admin = createAdminClient()
  const context = await loadWarehouseGapContext(admin, warehouseId)
  if ('error' in context) {
    return NextResponse.json({ error: context.error }, { status: context.status })
  }

  const scope = await assertWarehouseInScope(auth.supabase, context.plantId)
  if (!scope.ok) return scope.response

  const selectedGaps =
    gapIdFilters.length > 0
      ? filterGapsByIds(context.significantGaps, gapIdFilters)
      : context.significantGaps

  if ('error' in selectedGaps) {
    return NextResponse.json({ error: selectedGaps.error }, { status: selectedGaps.status })
  }

  if (selectedGaps.length === 0) {
    return NextResponse.json(
      { error: 'No hay huecos significativos para este almacén' },
      { status: 400 },
    )
  }

  const draft = await buildDieselGapEmailDraft(admin, context, selectedGaps)

  return NextResponse.json({
    subject: draft.subject,
    html: draft.html,
    to: draft.to,
    cc: draft.cc,
    includedGapIds: draft.includedGapIds,
    availableFindings: draft.availableFindings,
    warehouseName: draft.warehouseName,
    warehouseCode: draft.warehouseCode,
    plantName: draft.plantName,
    plantCode: draft.plantCode,
  })
}
