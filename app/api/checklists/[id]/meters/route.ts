import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { computeAssetDieselEfficiencyMonths } from '@/lib/reports/compute-asset-diesel-efficiency-monthly'
import type { Database } from '@/types/supabase-types'

type PatchBody = {
  hours_reading?: number | null
  previous_hours?: number | null
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

    const { id: checklistId } = await params
    const body = (await req.json()) as PatchBody
    const { hours_reading: newReading, previous_hours: newPrev, reason } = body

    if (newReading !== undefined && newReading !== null) {
      if (typeof newReading !== 'number' || !Number.isFinite(newReading) || newReading < 0) {
        return NextResponse.json({ error: 'Lectura de horómetro inválida' }, { status: 400 })
      }
    }

    // Fetch the checklist being corrected.
    // Cast: equipment_hours_reading/previous_hours added in a later migration not yet in generated types.
    type CcRow = {
      id: string
      asset_id: string | null
      completion_date: string
      equipment_hours_reading: number | null
      previous_hours: number | null
    }
    const { data: cc, error: ccErr } = (await supabase
      .from('completed_checklists')
      .select('id, asset_id, completion_date, equipment_hours_reading, previous_hours')
      .eq('id', checklistId)
      .single()) as { data: CcRow | null; error: { message: string } | null }
    if (ccErr || !cc || !cc.asset_id) {
      return NextResponse.json({ error: 'Checklist no encontrado' }, { status: 404 })
    }

    const effectiveReading = newReading !== undefined ? newReading : cc.equipment_hours_reading
    const effectivePrev = newPrev !== undefined ? newPrev : cc.previous_hours

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
      .eq('source_kind', 'checklist_completion')
      .eq('source_id', checklistId)
      .maybeSingle()) as { data: { event_at: string } | null }
    const currentEventAt =
      currentEvent?.event_at ?? new Date(cc.completion_date).toISOString()

    // Closest prior event of ANY source with an hours reading
    const { data: priorEvent } = (await sb
      .from('asset_meter_reading_events')
      .select('source_kind, event_at, hours_reading')
      .eq('asset_id', cc.asset_id)
      .not('hours_reading', 'is', null)
      .lt('event_at', currentEventAt)
      .order('event_at', { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: EventRow | null }

    // previous_hours must not exceed the closest prior event's reading
    if (newPrev !== undefined && newPrev !== null && priorEvent?.hours_reading != null) {
      if (newPrev > priorEvent.hours_reading) {
        const when = new Date(priorEvent.event_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
        return NextResponse.json({
          error: `El horómetro previo ${newPrev.toLocaleString('es-MX')} excede el último evento anterior (${priorEvent.hours_reading.toLocaleString('es-MX')} h del ${when}). Debe ser ≤ ${priorEvent.hours_reading.toLocaleString('es-MX')}.`,
          safe_max_prev: priorEvent.hours_reading,
        }, { status: 422 })
      }
    }

    // Validate monotonicity: new reading must be >= effective previous
    if (effectiveReading != null && effectivePrev != null && effectiveReading < effectivePrev) {
      return NextResponse.json({
        error: `La lectura ${effectiveReading.toLocaleString('es-MX')} es menor al horómetro previo (${effectivePrev.toLocaleString('es-MX')}). El delta resultante sería negativo.`,
        safe_min: effectivePrev,
      }, { status: 422 })
    }

    // Closest next event of ANY source with an hours reading
    const { data: nextEvent } = (await sb
      .from('asset_meter_reading_events')
      .select('source_kind, source_id, event_at, hours_reading')
      .eq('asset_id', cc.asset_id)
      .not('hours_reading', 'is', null)
      .gt('event_at', currentEventAt)
      .order('event_at', { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: EventRow | null }

    if (effectiveReading != null && nextEvent?.hours_reading != null && effectiveReading > nextEvent.hours_reading) {
      const when = new Date(nextEvent.event_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
      return NextResponse.json({
        error: `La lectura ${effectiveReading.toLocaleString('es-MX')} excede el siguiente evento (${nextEvent.hours_reading.toLocaleString('es-MX')} h del ${when}). Debe ser ≤ ${nextEvent.hours_reading.toLocaleString('es-MX')}.`,
        safe_max: nextEvent.hours_reading,
      }, { status: 422 })
    }

    // Same-source cascade: only update the next *checklist*'s previous_hours
    const { data: nextCc } = (await supabase
      .from('completed_checklists')
      .select('id, completion_date, equipment_hours_reading, previous_hours')
      .eq('asset_id', cc.asset_id)
      .not('equipment_hours_reading', 'is', null)
      .gt('completion_date', cc.completion_date)
      .order('completion_date', { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: { id: string; previous_hours: number | null } | null }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY requerida para escritura' }, { status: 503 })
    }
    const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }
    if (newReading !== undefined) updatePayload.equipment_hours_reading = newReading
    if (newPrev !== undefined) updatePayload.previous_hours = newPrev
    if (reason) updatePayload.notes = reason

    const { error: updateErr } = await (admin as any)
      .from('completed_checklists')
      .update(updatePayload)
      .eq('id', checklistId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Cascade: if next checklist's previous_hours should match our new reading, update it
    if (newReading !== undefined && newReading !== null && nextCc && nextCc.previous_hours != null) {
      await (admin as any)
        .from('completed_checklists')
        .update({
          previous_hours: newReading,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', nextCc.id)
    }

    // Recompute monthly rollup for the affected month
    const yearMonth = new Date(cc.completion_date)
      .toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' })
      .slice(0, 7)
    await computeAssetDieselEfficiencyMonths(admin, { yearMonths: [yearMonth] })

    return NextResponse.json({
      ok: true,
      checklist_id: checklistId,
      new_hours_reading: effectiveReading,
      new_previous_hours: effectivePrev,
      next_cascaded: !!(newReading !== undefined && nextCc),
      year_month: yearMonth,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    console.error('[checklists/meters PATCH]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
