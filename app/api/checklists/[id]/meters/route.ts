import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { computeAssetDieselEfficiencyMonths } from '@/lib/reports/compute-asset-diesel-efficiency-monthly'
import type { Database } from '@/types/supabase-types'

type PatchBody = {
  hours_reading?: number | null
  previous_hours?: number | null
  equipment_kilometers_reading?: number | null
  previous_kilometers?: number | null
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
    const {
      hours_reading: newHoursReading,
      previous_hours: newHoursPrev,
      equipment_kilometers_reading: newKmReading,
      previous_kilometers: newKmPrev,
      reason,
    } = body

    const patchHours = newHoursReading !== undefined
    const patchKm = newKmReading !== undefined
    if (patchHours === patchKm) {
      return NextResponse.json(
        {
          error: patchHours
            ? 'Envía solo horómetro u odómetro, no ambos'
            : 'Indica hours_reading o equipment_kilometers_reading',
        },
        { status: 400 }
      )
    }

    type CcRow = {
      id: string
      asset_id: string | null
      completion_date: string
      equipment_hours_reading: number | null
      previous_hours: number | null
      equipment_kilometers_reading: number | null
      previous_kilometers: number | null
    }
    const { data: cc, error: ccErr } = (await supabase
      .from('completed_checklists')
      .select(
        'id, asset_id, completion_date, equipment_hours_reading, previous_hours, equipment_kilometers_reading, previous_kilometers'
      )
      .eq('id', checklistId)
      .single()) as { data: CcRow | null; error: { message: string } | null }
    if (ccErr || !cc || !cc.asset_id) {
      return NextResponse.json({ error: 'Checklist no encontrado' }, { status: 404 })
    }

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

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY requerida para escritura' }, { status: 503 })
    }
    const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })

    const yearMonth = new Date(cc.completion_date)
      .toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' })
      .slice(0, 7)

    if (patchKm) {
      if (newKmReading !== null) {
        if (typeof newKmReading !== 'number' || !Number.isFinite(newKmReading) || newKmReading < 0) {
          return NextResponse.json({ error: 'Lectura de odómetro inválida' }, { status: 400 })
        }
      }

      const effectiveReading =
        newKmReading !== undefined ? newKmReading : cc.equipment_kilometers_reading
      const effectivePrev = newKmPrev !== undefined ? newKmPrev : cc.previous_kilometers

      type KmEventRow = { source_kind: string | null; event_at: string; km_reading: number | null }
      const { data: priorEvent } = (await sb
        .from('asset_meter_reading_events')
        .select('source_kind, event_at, km_reading')
        .eq('asset_id', cc.asset_id)
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

      if (effectiveReading != null && effectivePrev != null && effectiveReading < effectivePrev) {
        return NextResponse.json({
          error: `La lectura ${effectiveReading.toLocaleString('es-MX')} es menor al odómetro previo (${effectivePrev.toLocaleString('es-MX')}). El delta resultante sería negativo.`,
          safe_min: effectivePrev,
        }, { status: 422 })
      }

      const { data: nextEvent } = (await sb
        .from('asset_meter_reading_events')
        .select('source_kind, source_id, event_at, km_reading')
        .eq('asset_id', cc.asset_id)
        .not('km_reading', 'is', null)
        .gt('event_at', currentEventAt)
        .order('event_at', { ascending: true })
        .limit(1)
        .maybeSingle()) as { data: KmEventRow | null }

      if (effectiveReading != null && nextEvent?.km_reading != null && effectiveReading > nextEvent.km_reading) {
        const when = new Date(nextEvent.event_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
        return NextResponse.json({
          error: `La lectura ${effectiveReading.toLocaleString('es-MX')} excede el siguiente evento (${nextEvent.km_reading.toLocaleString('es-MX')} km del ${when}). Debe ser ≤ ${nextEvent.km_reading.toLocaleString('es-MX')}.`,
          safe_max: nextEvent.km_reading,
        }, { status: 422 })
      }

      const { data: nextCc } = (await supabase
        .from('completed_checklists')
        .select('id, completion_date, equipment_kilometers_reading, previous_kilometers')
        .eq('asset_id', cc.asset_id)
        .not('equipment_kilometers_reading', 'is', null)
        .gt('completion_date', cc.completion_date)
        .order('completion_date', { ascending: true })
        .limit(1)
        .maybeSingle()) as { data: { id: string; previous_kilometers: number | null } | null }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }
      if (newKmReading !== undefined) updatePayload.equipment_kilometers_reading = newKmReading
      if (newKmPrev !== undefined) updatePayload.previous_kilometers = newKmPrev
      if (reason) updatePayload.notes = reason

      const { error: updateErr } = await (admin as any)
        .from('completed_checklists')
        .update(updatePayload)
        .eq('id', checklistId)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      if (newKmReading !== undefined && newKmReading !== null && nextCc && nextCc.previous_kilometers != null) {
        await (admin as any)
          .from('completed_checklists')
          .update({
            previous_kilometers: newKmReading,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq('id', nextCc.id)
      }

      await computeAssetDieselEfficiencyMonths(admin, { yearMonths: [yearMonth] })

      return NextResponse.json({
        ok: true,
        checklist_id: checklistId,
        new_kilometers_reading: effectiveReading,
        new_previous_kilometers: effectivePrev,
        next_cascaded: !!(newKmReading !== undefined && newKmReading !== null && nextCc),
        year_month: yearMonth,
      })
    }

    if (newHoursReading !== undefined && newHoursReading !== null) {
      if (typeof newHoursReading !== 'number' || !Number.isFinite(newHoursReading) || newHoursReading < 0) {
        return NextResponse.json({ error: 'Lectura de horómetro inválida' }, { status: 400 })
      }
    }

    const effectiveReading = newHoursReading !== undefined ? newHoursReading : cc.equipment_hours_reading
    const effectivePrev = newHoursPrev !== undefined ? newHoursPrev : cc.previous_hours

    type HoursEventRow = { source_kind: string | null; source_id: string; event_at: string; hours_reading: number | null }
    const { data: priorEvent } = (await sb
      .from('asset_meter_reading_events')
      .select('source_kind, event_at, hours_reading')
      .eq('asset_id', cc.asset_id)
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

    if (effectiveReading != null && effectivePrev != null && effectiveReading < effectivePrev) {
      return NextResponse.json({
        error: `La lectura ${effectiveReading.toLocaleString('es-MX')} es menor al horómetro previo (${effectivePrev.toLocaleString('es-MX')}). El delta resultante sería negativo.`,
        safe_min: effectivePrev,
      }, { status: 422 })
    }

    const { data: nextEvent } = (await sb
      .from('asset_meter_reading_events')
      .select('source_kind, source_id, event_at, hours_reading')
      .eq('asset_id', cc.asset_id)
      .not('hours_reading', 'is', null)
      .gt('event_at', currentEventAt)
      .order('event_at', { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: HoursEventRow | null }

    if (effectiveReading != null && nextEvent?.hours_reading != null && effectiveReading > nextEvent.hours_reading) {
      const when = new Date(nextEvent.event_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
      return NextResponse.json({
        error: `La lectura ${effectiveReading.toLocaleString('es-MX')} excede el siguiente evento (${nextEvent.hours_reading.toLocaleString('es-MX')} h del ${when}). Debe ser ≤ ${nextEvent.hours_reading.toLocaleString('es-MX')}.`,
        safe_max: nextEvent.hours_reading,
      }, { status: 422 })
    }

    const { data: nextCc } = (await supabase
      .from('completed_checklists')
      .select('id, completion_date, equipment_hours_reading, previous_hours')
      .eq('asset_id', cc.asset_id)
      .not('equipment_hours_reading', 'is', null)
      .gt('completion_date', cc.completion_date)
      .order('completion_date', { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: { id: string; previous_hours: number | null } | null }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }
    if (newHoursReading !== undefined) updatePayload.equipment_hours_reading = newHoursReading
    if (newHoursPrev !== undefined) updatePayload.previous_hours = newHoursPrev
    if (reason) updatePayload.notes = reason

    const { error: updateErr } = await (admin as any)
      .from('completed_checklists')
      .update(updatePayload)
      .eq('id', checklistId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    if (newHoursReading !== undefined && newHoursReading !== null && nextCc && nextCc.previous_hours != null) {
      await (admin as any)
        .from('completed_checklists')
        .update({
          previous_hours: newHoursReading,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', nextCc.id)
    }

    await computeAssetDieselEfficiencyMonths(admin, { yearMonths: [yearMonth] })

    return NextResponse.json({
      ok: true,
      checklist_id: checklistId,
      new_hours_reading: effectiveReading,
      new_previous_hours: effectivePrev,
      next_cascaded: !!(newHoursReading !== undefined && nextCc),
      year_month: yearMonth,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    console.error('[checklists/meters PATCH]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
