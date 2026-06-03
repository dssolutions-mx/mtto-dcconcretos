import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { computeAssetDieselEfficiencyMonths } from '@/lib/reports/compute-asset-diesel-efficiency-monthly'
import type { Database } from '@/types/supabase-types'

type PatchBody = {
  horometer_reading?: number
  previous_horometer?: number | null
  kilometer_reading?: number
  previous_kilometer?: number | null
  reason?: string
}

type MeterEventsClient = {
  from: (rel: string) => {
    select: (cols: string) => {
      eq: (c: string, v: unknown) => {
        eq: (c: string, v: unknown) => { maybeSingle: () => Promise<unknown> }
        not: (c: string, op: string, v: unknown) => {
          lt: (c: string, v: unknown) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => { maybeSingle: () => Promise<unknown> } } }
          gt: (c: string, v: unknown) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => { maybeSingle: () => Promise<unknown> } } }
        }
      }
    }
  }
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
    const {
      horometer_reading: newHoursReading,
      previous_horometer: newHoursPrev,
      kilometer_reading: newKmReading,
      previous_kilometer: newKmPrev,
      reason,
    } = body

    const patchHours = newHoursReading !== undefined
    const patchKm = newKmReading !== undefined
    if (patchHours === patchKm) {
      return NextResponse.json(
        { error: patchHours ? 'Envía solo horómetro u odómetro, no ambos' : 'Indica horometer_reading o kilometer_reading' },
        { status: 400 }
      )
    }

    type TxRow = {
      id: string
      asset_id: string | null
      transaction_date: string
      horometer_reading: number | null
      previous_horometer: number | null
      kilometer_reading: number | null
      previous_kilometer: number | null
      hours_consumed: number | null
      quantity_liters: number | null
    }
    const { data: tx, error: txErr } = (await supabase
      .from('diesel_transactions')
      .select(
        'id, asset_id, transaction_date, horometer_reading, previous_horometer, kilometer_reading, previous_kilometer, hours_consumed, quantity_liters'
      )
      .eq('id', txId)
      .eq('transaction_type', 'consumption')
      .single()) as { data: TxRow | null; error: { message: string } | null }
    if (txErr || !tx || !tx.asset_id) {
      return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
    }

    const sb = supabase as unknown as MeterEventsClient

    const { data: currentEvent } = (await sb
      .from('asset_meter_reading_events')
      .select('event_at')
      .eq('source_kind', 'diesel_consumption')
      .eq('source_id', txId)
      .maybeSingle()) as { data: { event_at: string } | null }
    const currentEventAt =
      currentEvent?.event_at ?? new Date(tx.transaction_date).toISOString()

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY requerida para escritura' }, { status: 503 })
    }
    const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })

    const yearMonth = new Date(tx.transaction_date)
      .toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' })
      .slice(0, 7)

    if (patchKm) {
      const newReading = newKmReading!
      if (typeof newReading !== 'number' || !Number.isFinite(newReading) || newReading < 0) {
        return NextResponse.json({ error: 'Lectura de odómetro inválida' }, { status: 400 })
      }

      const prevKilometer = newKmPrev !== undefined ? newKmPrev : tx.previous_kilometer

      type KmEventRow = { source_kind: string | null; event_at: string; km_reading: number | null }
      const { data: priorEvent } = (await sb
        .from('asset_meter_reading_events')
        .select('source_kind, event_at, km_reading')
        .eq('asset_id', tx.asset_id)
        .not('km_reading', 'is', null)
        .lt('event_at', currentEventAt)
        .order('event_at', { ascending: false })
        .limit(1)
        .maybeSingle()) as { data: KmEventRow | null }

      if (newKmPrev !== undefined && newKmPrev !== null && priorEvent?.km_reading != null) {
        if (newKmPrev > priorEvent.km_reading) {
          const when = new Date(priorEvent.event_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
          return NextResponse.json({
            error: `El odómetro previo ${newKmPrev.toLocaleString('es-MX')} excede el último evento anterior (${priorEvent.km_reading.toLocaleString('es-MX')} km del ${when}). Debe ser ≤ ${priorEvent.km_reading.toLocaleString('es-MX')}.`,
            safe_max_prev: priorEvent.km_reading,
          }, { status: 422 })
        }
      }

      if (prevKilometer != null && newReading < prevKilometer) {
        return NextResponse.json({
          error: `La lectura ${newReading.toLocaleString('es-MX')} es menor al odómetro previo (${prevKilometer.toLocaleString('es-MX')}). El delta resultante sería negativo.`,
          safe_min: prevKilometer,
        }, { status: 422 })
      }

      const { data: nextEvent } = (await sb
        .from('asset_meter_reading_events')
        .select('source_kind, source_id, event_at, km_reading')
        .eq('asset_id', tx.asset_id)
        .not('km_reading', 'is', null)
        .gt('event_at', currentEventAt)
        .order('event_at', { ascending: true })
        .limit(1)
        .maybeSingle()) as { data: KmEventRow | null }

      if (nextEvent?.km_reading != null && newReading > nextEvent.km_reading) {
        const when = new Date(nextEvent.event_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
        return NextResponse.json({
          error: `La lectura ${newReading.toLocaleString('es-MX')} excede el siguiente evento (${nextEvent.km_reading.toLocaleString('es-MX')} km del ${when}). Debe ser ≤ ${nextEvent.km_reading.toLocaleString('es-MX')}.`,
          safe_max: nextEvent.km_reading,
        }, { status: 422 })
      }

      const { data: nextTx } = (await supabase
        .from('diesel_transactions')
        .select('id, transaction_date, previous_kilometer, kilometer_reading')
        .eq('asset_id', tx.asset_id)
        .eq('transaction_type', 'consumption')
        .gt('transaction_date', tx.transaction_date)
        .order('transaction_date', { ascending: true })
        .limit(1)
        .maybeSingle()) as { data: { id: string; previous_kilometer: number | null; kilometer_reading: number | null } | null }

      const updatePayload: Record<string, unknown> = {
        kilometer_reading: newReading,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }
      if (newKmPrev !== undefined) updatePayload.previous_kilometer = newKmPrev
      if (reason) updatePayload.notes = reason

      const { error: updateErr } = await (admin as any)
        .from('diesel_transactions')
        .update(updatePayload)
        .eq('id', txId)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      if (nextTx && nextTx.previous_kilometer != null) {
        await (admin as any)
          .from('diesel_transactions')
          .update({
            previous_kilometer: newReading,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq('id', nextTx.id)
      }

      await computeAssetDieselEfficiencyMonths(admin, { yearMonths: [yearMonth] })

      return NextResponse.json({
        ok: true,
        transaction_id: txId,
        new_kilometer_reading: newReading,
        new_previous_kilometer: prevKilometer,
        next_tx_cascaded: !!nextTx,
        year_month: yearMonth,
      })
    }

    const newReading = newHoursReading!
    if (typeof newReading !== 'number' || !Number.isFinite(newReading) || newReading < 0) {
      return NextResponse.json({ error: 'Lectura de horómetro inválida' }, { status: 400 })
    }

    const prevHorometer = newHoursPrev !== undefined ? newHoursPrev : tx.previous_horometer

    type HoursEventRow = { source_kind: string | null; source_id: string; event_at: string; hours_reading: number | null }
    const { data: priorEvent } = (await sb
      .from('asset_meter_reading_events')
      .select('source_kind, event_at, hours_reading')
      .eq('asset_id', tx.asset_id)
      .not('hours_reading', 'is', null)
      .lt('event_at', currentEventAt)
      .order('event_at', { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: HoursEventRow | null }

    if (newHoursPrev !== undefined && newHoursPrev !== null && priorEvent?.hours_reading != null) {
      if (newHoursPrev > priorEvent.hours_reading) {
        const when = new Date(priorEvent.event_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
        return NextResponse.json({
          error: `El horómetro previo ${newHoursPrev.toLocaleString('es-MX')} excede el último evento anterior (${priorEvent.hours_reading.toLocaleString('es-MX')} h del ${when}). Debe ser ≤ ${priorEvent.hours_reading.toLocaleString('es-MX')}.`,
          safe_max_prev: priorEvent.hours_reading,
        }, { status: 422 })
      }
    }

    if (prevHorometer != null && newReading < prevHorometer) {
      return NextResponse.json({
        error: `La lectura ${newReading.toLocaleString('es-MX')} es menor al horómetro previo (${prevHorometer.toLocaleString('es-MX')}). El delta resultante sería negativo.`,
        safe_min: prevHorometer,
      }, { status: 422 })
    }

    const { data: nextEvent } = (await sb
      .from('asset_meter_reading_events')
      .select('source_kind, source_id, event_at, hours_reading')
      .eq('asset_id', tx.asset_id)
      .not('hours_reading', 'is', null)
      .gt('event_at', currentEventAt)
      .order('event_at', { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: HoursEventRow | null }

    if (nextEvent?.hours_reading != null && newReading > nextEvent.hours_reading) {
      const when = new Date(nextEvent.event_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
      return NextResponse.json({
        error: `La lectura ${newReading.toLocaleString('es-MX')} excede el siguiente evento (${nextEvent.hours_reading.toLocaleString('es-MX')} h del ${when}). Debe ser ≤ ${nextEvent.hours_reading.toLocaleString('es-MX')}.`,
        safe_max: nextEvent.hours_reading,
      }, { status: 422 })
    }

    const { data: nextTx } = (await supabase
      .from('diesel_transactions')
      .select('id, transaction_date, previous_horometer, horometer_reading')
      .eq('asset_id', tx.asset_id)
      .eq('transaction_type', 'consumption')
      .gt('transaction_date', tx.transaction_date)
      .order('transaction_date', { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: { id: string; previous_horometer: number | null; horometer_reading: number | null } | null }

    const updatePayload: Record<string, unknown> = {
      horometer_reading: newReading,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }
    if (newHoursPrev !== undefined) updatePayload.previous_horometer = newHoursPrev
    if (reason) updatePayload.notes = reason

    const { error: updateErr } = await (admin as any)
      .from('diesel_transactions')
      .update(updatePayload)
      .eq('id', txId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

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
