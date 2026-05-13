import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { computeAssetDieselEfficiencyMonths } from '@/lib/reports/compute-asset-diesel-efficiency-monthly'
import type { Database } from '@/types/supabase-types'

type PatchBody = {
  horometer_reading: number
  previous_horometer?: number | null
  reason?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: txId } = await params
    const body = (await req.json()) as PatchBody
    const { horometer_reading: newReading, previous_horometer: newPrev, reason } = body

    if (typeof newReading !== 'number' || !Number.isFinite(newReading) || newReading < 0) {
      return NextResponse.json({ error: 'Lectura de horómetro inválida' }, { status: 400 })
    }

    // Fetch the transaction being corrected.
    // Cast: some columns are added in later migrations not yet in generated types.
    type TxRow = {
      id: string
      asset_id: string | null
      transaction_date: string
      horometer_reading: number | null
      previous_horometer: number | null
      hours_consumed: number | null
      quantity_liters: number | null
    }
    const { data: tx, error: txErr } = (await supabase
      .from('diesel_transactions')
      .select('id, asset_id, transaction_date, horometer_reading, previous_horometer, hours_consumed, quantity_liters')
      .eq('id', txId)
      .eq('transaction_type', 'consumption')
      .single()) as { data: TxRow | null; error: { message: string } | null }
    if (txErr || !tx || !tx.asset_id) {
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
    }

    const prevHorometer = newPrev !== undefined ? newPrev : tx.previous_horometer

    // Use the unified meter-event timeline (diesel + checklist + audit) to bound this edit.
    // The view `asset_meter_reading_events` is not in generated Database types — cast to escape strict typing.
    type EventRow = { source_kind: string | null; source_id: string; event_at: string; hours_reading: number | null }
    const sb = supabase as unknown as {
      from: (rel: string) => {
        select: (cols: string) => {
          eq: (c: string, v: unknown) => any
          not: (c: string, op: string, v: unknown) => any
        }
      }
    }
    const { data: currentEvent } = (await sb
      .from('asset_meter_reading_events')
      .select('event_at')
      .eq('source_kind', 'diesel_consumption')
      .eq('source_id', txId)
      .maybeSingle()) as { data: { event_at: string } | null }
    const currentEventAt =
      currentEvent?.event_at ?? new Date(tx.transaction_date).toISOString()

    // Closest prior event of ANY source with an hours reading
    const { data: priorEvent } = (await sb
      .from('asset_meter_reading_events')
      .select('source_kind, event_at, hours_reading')
      .eq('asset_id', tx.asset_id)
      .not('hours_reading', 'is', null)
      .lt('event_at', currentEventAt)
      .order('event_at', { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: EventRow | null }

    // previous_horometer must not exceed the closest prior event's reading
    if (newPrev !== undefined && newPrev !== null && priorEvent?.hours_reading != null) {
      if (newPrev > priorEvent.hours_reading) {
        const when = new Date(priorEvent.event_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
        return NextResponse.json({
          error: `El horómetro previo ${newPrev.toLocaleString('es-MX')} excede el último evento anterior (${priorEvent.hours_reading.toLocaleString('es-MX')} h del ${when}). Debe ser ≤ ${priorEvent.hours_reading.toLocaleString('es-MX')}.`,
          safe_max_prev: priorEvent.hours_reading,
        }, { status: 422 })
      }
    }

    // Validate monotonicity: new reading must be >= effective previous horometer
    if (prevHorometer != null && newReading < prevHorometer) {
      return NextResponse.json({
        error: `La lectura ${newReading.toLocaleString('es-MX')} es menor al horómetro previo (${prevHorometer.toLocaleString('es-MX')}). El delta resultante sería negativo.`,
        safe_min: prevHorometer,
      }, { status: 422 })
    }

    // Closest next event of ANY source with an hours reading
    const { data: nextEvent } = (await sb
      .from('asset_meter_reading_events')
      .select('source_kind, source_id, event_at, hours_reading')
      .eq('asset_id', tx.asset_id)
      .not('hours_reading', 'is', null)
      .gt('event_at', currentEventAt)
      .order('event_at', { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: EventRow | null }

    if (nextEvent?.hours_reading != null && newReading > nextEvent.hours_reading) {
      const when = new Date(nextEvent.event_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
      return NextResponse.json({
        error: `La lectura ${newReading.toLocaleString('es-MX')} excede el siguiente evento (${nextEvent.hours_reading.toLocaleString('es-MX')} h del ${when}). Debe ser ≤ ${nextEvent.hours_reading.toLocaleString('es-MX')}.`,
        safe_max: nextEvent.hours_reading,
      }, { status: 422 })
    }

    // Same-source cascade: still only update the next *diesel transaction*'s previous_horometer
    const { data: nextTx } = (await supabase
      .from('diesel_transactions')
      .select('id, transaction_date, previous_horometer, horometer_reading')
      .eq('asset_id', tx.asset_id)
      .eq('transaction_type', 'consumption')
      .gt('transaction_date', tx.transaction_date)
      .order('transaction_date', { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: { id: string; previous_horometer: number | null; horometer_reading: number | null } | null }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY requerida para escritura' }, { status: 503 })
    }
    const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })

    const updatePayload: Record<string, unknown> = {
      horometer_reading: newReading,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }
    if (newPrev !== undefined) {
      updatePayload.previous_horometer = newPrev
    }
    if (reason) {
      updatePayload.notes = reason
    }

    const { error: updateErr } = await (admin as any)
      .from('diesel_transactions')
      .update(updatePayload)
      .eq('id', txId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // If next transaction's previous_horometer should cascade to new reading, update it too
    if (nextTx && nextTx.previous_horometer != null) {
      await (admin as any)
        .from('diesel_transactions')
        .update({
          previous_horometer: newReading,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', nextTx.id)
    }

    // Recompute the monthly rollup for the affected month
    const yearMonth = new Date(tx.transaction_date)
      .toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' })
      .slice(0, 7)
    await computeAssetDieselEfficiencyMonths(admin, { yearMonths: [yearMonth] })

    return NextResponse.json({
      ok: true,
      transaction_id: txId,
      new_horometer_reading: newReading,
      new_previous_horometer: prevHorometer,
      next_tx_cascaded: !!nextTx,
      year_month: yearMonth,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    console.error('[diesel/transactions/meters PATCH]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
