import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  assertDieselGapEmailSender,
  assertWarehouseInScope,
  finalizeRecipients,
  prependExecutiveNote,
} from '@/lib/diesel/gap-email/auth'
import { buildDieselGapEmailDraft } from '@/lib/diesel/gap-email/build-email-draft'
import {
  filterGapsByIds,
  loadWarehouseGapContext,
} from '@/lib/diesel/gap-email/load-warehouse-gaps'
import { sendDieselGapMail } from '@/lib/diesel/gap-email/send-mail'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const auth = await assertDieselGapEmailSender()
  if (!auth.ok) return auth.response

  let body: {
    warehouseId?: string
    gapIds?: string[]
    subject?: string
    note?: string
    to?: string[]
    cc?: string[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const warehouseId = body.warehouseId?.trim()
  if (!warehouseId) {
    return NextResponse.json({ error: 'warehouseId required' }, { status: 400 })
  }

  const gapIds = Array.isArray(body.gapIds)
    ? body.gapIds.map((id) => String(id).trim()).filter(Boolean)
    : []

  const context = await loadWarehouseGapContext(auth.supabase, warehouseId)
  if ('error' in context) {
    return NextResponse.json({ error: context.error }, { status: context.status })
  }

  const scope = await assertWarehouseInScope(auth.supabase, context.plantId)
  if (!scope.ok) return scope.response

  const selectedGaps = filterGapsByIds(context.significantGaps, gapIds)
  if ('error' in selectedGaps) {
    return NextResponse.json({ error: selectedGaps.error }, { status: selectedGaps.status })
  }

  const admin = createAdminClient()
  const draft = await buildDieselGapEmailDraft(admin, context, selectedGaps)
  const { to, cc } = finalizeRecipients(body.to, body.cc, draft)

  if (to.length === 0) {
    return NextResponse.json({ error: 'Agrega al menos un destinatario en Para' }, { status: 400 })
  }

  const finalSubject = body.subject?.trim() || draft.subject
  const finalHtml = prependExecutiveNote(draft.html, body.note)

  try {
    await sendDieselGapMail({
      to,
      cc,
      subject: finalSubject,
      html: finalHtml,
      evidencePhotos: draft.evidencePhotos,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al enviar correo'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  try {
    await admin.from('notifications').insert({
      user_id: auth.userId,
      title: 'Correo huecos cuenta litros enviado',
      message: `${context.warehouseCode}: ${selectedGaps.length} hueco(s) → ${to.join(', ')}`,
      type: 'DIESEL_GAP_EMAIL',
      related_entity: warehouseId,
      priority: 'medium',
      status: 'unread',
    })
  } catch (logErr) {
    console.error('[diesel-gap-email] notification log failed', logErr)
  }

  return NextResponse.json({
    success: true,
    to,
    cc,
    includedGapIds: draft.includedGapIds,
  })
}
