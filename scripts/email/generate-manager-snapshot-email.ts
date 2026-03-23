/**
 * Generates docs/email-templates/maintenance-manager-department-snapshot.html from live Supabase data.
 * Preventive cyclic metrics align with maintenance-alerts-schedule (shared helpers in this folder).
 *
 * Run: npx tsx scripts/email/generate-manager-snapshot-email.ts
 *      npx tsx scripts/email/generate-manager-snapshot-email.ts --recipient "Nombre Apellido"
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: NEXT_PUBLIC_APP_URL (deep links), MANAGER_SNAPSHOT_RECIPIENT_NAME
 */

import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { calculateMaintenanceSummary, type MaintenanceAlert } from './calculateMaintenanceSummary'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const appBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://[SU-DOMINIO]').replace(/\/$/, '')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const LEGACY_PENDING = [
  'Cotizada',
  'Aprobada',
  'En ejecución',
  'En Progreso',
  'Esperando Partes',
  'pendiente',
  'en_progreso',
] as const

function isPendingWorkOrderStatus(status: string | null): boolean {
  if (!status) return false
  if (status === 'Completada' || status === 'Completado' || status === 'Cancelado') return false
  return (
    status === 'Pendiente' ||
    status === 'Programada' ||
    status === 'Esperando repuestos' ||
    (LEGACY_PENDING as readonly string[]).includes(status)
  )
}

function isOverdueAlert(a: MaintenanceAlert): boolean {
  return (
    (a.hours_overdue !== undefined && a.hours_overdue > 0) ||
    (a.kilometers_overdue !== undefined && a.kilometers_overdue > 0)
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Mexico City calendar date for display */
function formatDateMx(d: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

function parseArgs(): { recipient: string } {
  const idx = process.argv.indexOf('--recipient')
  const recipient =
    (idx >= 0 && process.argv[idx + 1]) || process.env.MANAGER_SNAPSHOT_RECIPIENT_NAME || 'Gerente de Mantenimiento'
  return { recipient }
}

type PlantAgg = {
  name: string
  overdue: number
  upcoming: number
  woCorr: [number, number, number, number]
  woPrev: [number, number, number, number]
  chk813: number
  chk1429: number
  chk30p: number
  stale14: number
  stale30: number
  stale90: number
  noOp: number
}

function emptyPlant(name: string): PlantAgg {
  return {
    name,
    overdue: 0,
    upcoming: 0,
    woCorr: [0, 0, 0, 0],
    woPrev: [0, 0, 0, 0],
    chk813: 0,
    chk1429: 0,
    chk30p: 0,
    stale14: 0,
    stale30: 0,
    stale90: 0,
    noOp: 0,
  }
}

function ageBandDays(createdAt: string): number {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  return Math.floor((now - created) / 86400000)
}

/** Exclusive bands: 0–7, 8–30, 31–100, 100+ */
function pushWoBand(bands: [number, number, number, number], days: number) {
  if (days <= 7) bands[0] += 1
  else if (days <= 30) bands[1] += 1
  else if (days <= 100) bands[2] += 1
  else bands[3] += 1
}

const ASSET_EXCLUDE = new Set(['maintenance', 'repair', 'out_of_service', 'scrapped'])

function assetExcludedStatus(status: string | null): boolean {
  if (!status) return false
  return ASSET_EXCLUDE.has(String(status).toLowerCase())
}

type WoRow = {
  id: string
  type: string | null
  status: string | null
  created_at: string | null
  plant_id: string | null
  incident_id: string | null
  asset_id: string | null
  assets?: { plant_id: string | null } | null
}

async function fetchAllWorkOrders(): Promise<WoRow[]> {
  const page = 1000
  let from = 0
  const out: WoRow[] = []
  for (;;) {
    const { data, error } = await supabase
      .from('work_orders')
      .select('id, type, status, created_at, plant_id, incident_id, asset_id, assets(plant_id)')
      .range(from, from + page - 1)
    if (error) throw error
    if (!data?.length) break
    out.push(...(data as WoRow[]))
    if (data.length < page) break
    from += page
  }
  return out
}

async function main() {
  const { recipient } = parseArgs()
  const cutDate = formatDateMx(new Date())

  console.log('Fetching maintenance summary (same logic as edge function)…')
  const alerts = await calculateMaintenanceSummary(supabase)

  const plantMap = new Map<string, PlantAgg>()

  function ensurePlant(id: string, name: string): PlantAgg {
    let p = plantMap.get(id)
    if (!p) {
      p = emptyPlant(name)
      plantMap.set(id, p)
    }
    return p
  }

  let globalOverdue = 0
  let globalUpcoming = 0

  for (const a of alerts) {
    if (!a.plant_id) continue
    const p = ensurePlant(a.plant_id, a.plant_name || 'Sin planta')
    if (isOverdueAlert(a)) {
      p.overdue += 1
      globalOverdue += 1
    } else {
      p.upcoming += 1
      globalUpcoming += 1
    }
  }

  console.log('Fetching work orders…')
  const wos = await fetchAllWorkOrders()
  const pendingWos = wos.filter((w) => isPendingWorkOrderStatus(w.status))

  let woCorrTotal = 0
  let woPrevTotal = 0
  let woCorrFromIncident = 0

  for (const w of pendingWos) {
    if (!w.created_at) continue
    const days = ageBandDays(w.created_at)
    const pid = w.plant_id || w.assets?.plant_id || null
    if (!pid) continue
    const plantName =
      alerts.find((x) => x.plant_id === pid)?.plant_name || plantMap.get(pid)?.name || 'Planta'
    const p = ensurePlant(pid, plantName)

    const t = (w.type || 'corrective').toLowerCase()
    if (t === 'preventive') {
      pushWoBand(p.woPrev, days)
      woPrevTotal += 1
    } else {
      pushWoBand(p.woCorr, days)
      woCorrTotal += 1
      if (w.incident_id) woCorrFromIncident += 1
    }
  }

  console.log('Fetching accountability + incidents…')
  const { data: trackingRows, error: trErr } = await supabase.from('asset_accountability_tracking').select(`
    asset_id,
    days_without_checklist,
    has_operator,
    alert_level,
    asset:assets!inner (
      id,
      plant_id,
      status,
      updated_at,
      plants ( id, name )
    )
  `)
  if (trErr) {
    console.warn('asset_accountability_tracking:', trErr.message)
  }

  let checklistGt7 = 0
  let noOperator = 0

  for (const row of trackingRows || []) {
    const asset = row.asset as any
    if (!asset?.plant_id || assetExcludedStatus(asset.status)) continue
    const pid = asset.plant_id as string
    const pname = (asset.plants?.name as string) || plantMap.get(pid)?.name || 'Planta'
    const p = ensurePlant(pid, pname)

    const dwc = Number(row.days_without_checklist) || 0
    if (dwc > 7) {
      checklistGt7 += 1
      if (dwc >= 8 && dwc <= 13) p.chk813 += 1
      else if (dwc >= 14 && dwc <= 29) p.chk1429 += 1
      else if (dwc >= 30) p.chk30p += 1
    }

    if (row.has_operator === false) {
      noOperator += 1
      p.noOp += 1
    }
  }

  const { data: incidentsOpen, error: incErr } = await supabase
    .from('incident_history')
    .select('id, status, work_order_id, asset_id, assets!inner(plant_id, status)')
    .is('work_order_id', null)
    .neq('status', 'Resuelto')

  if (incErr) {
    console.warn('incident_history:', incErr.message)
  }

  let intakeNoWo = 0
  for (const inc of incidentsOpen || []) {
    const ast = (inc as any).assets
    if (ast && assetExcludedStatus(ast.status)) continue
    intakeNoWo += 1
  }

  console.log('Fetching assets for operational staleness…')
  const { data: activeAssets, error: astErr } = await supabase
    .from('assets')
    .select('id, plant_id, updated_at, status')
    .eq('status', 'activo')

  if (astErr) throw astErr

  const { data: allCc, error: ccErr } = await supabase.from('completed_checklists').select('asset_id, completion_date')
  if (ccErr) throw ccErr

  const { data: allMh, error: mhErr } = await supabase.from('maintenance_history').select('asset_id, date')
  if (mhErr) throw mhErr

  const lastCc = new Map<string, number>()
  for (const r of allCc || []) {
    const aid = r.asset_id as string
    const t = r.completion_date ? new Date(r.completion_date as string).getTime() : 0
    if (t > (lastCc.get(aid) || 0)) lastCc.set(aid, t)
  }

  const lastMh = new Map<string, number>()
  for (const r of allMh || []) {
    const aid = r.asset_id as string
    const t = r.date ? new Date(r.date as string).getTime() : 0
    if (t > (lastMh.get(aid) || 0)) lastMh.set(aid, t)
  }

  const now = Date.now()
  for (const a of activeAssets || []) {
    const pid = a.plant_id as string
    if (!pid) continue
    const pname = alerts.find((x) => x.plant_id === pid)?.plant_name || plantMap.get(pid)?.name || 'Planta'
    const p = ensurePlant(pid, pname)

    const u = a.updated_at ? new Date(a.updated_at as string).getTime() : 0
    const touch = Math.max(u, lastCc.get(a.id) || 0, lastMh.get(a.id) || 0)
    if (touch === 0) {
      p.stale14 += 1
      p.stale30 += 1
      p.stale90 += 1
      continue
    }
    const days = Math.floor((now - touch) / 86400000)
    if (days > 14) p.stale14 += 1
    if (days > 30) p.stale30 += 1
    if (days > 90) p.stale90 += 1
  }

  const plantRows = [...plantMap.entries()]
    .map(([id, agg]) => ({ id, ...agg }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  function sumPlants(getter: (p: PlantAgg) => number): number {
    return plantRows.reduce((s, r) => s + getter(r), 0)
  }

  function sumBands(getter: (p: PlantAgg) => [number, number, number, number]): [number, number, number, number] {
    const z: [number, number, number, number] = [0, 0, 0, 0]
    for (const r of plantRows) {
      const b = getter(r)
      z[0] += b[0]
      z[1] += b[1]
      z[2] += b[2]
      z[3] += b[3]
    }
    return z
  }

  const tCorr = sumBands((p) => p.woCorr)
  const tPrev = sumBands((p) => p.woPrev)

  const tableRow = (
    cells: string[],
    opts?: { header?: boolean; strong?: boolean; bg?: string },
  ) => {
    const tag = opts?.header ? 'th' : 'td'
    const inner = cells
      .map((c, i) => {
        const align = i === 0 ? 'left' : 'right'
        let st =
          `padding:10px;border-bottom:1px solid #E2E8F0;font-size:13px;font-family:Segoe UI,system-ui,Arial,sans-serif;color:#334155;text-align:${align};`
        if (opts?.header) st += 'color:#64748B;font-weight:600;border-bottom:2px solid #E2E8F0;'
        if (opts?.strong && !opts?.header) st += 'font-weight:600;'
        if (opts?.bg) st += `background:${opts.bg};`
        return `<${tag} style="${st}">${c}</${tag}>`
      })
      .join('')
    return `<tr>${inner}</tr>`
  }

  const preventiveBody =
    plantRows.map((r) =>
      tableRow([
        `<strong>${escapeHtml(r.name)}</strong>`,
        String(r.overdue),
        String(r.upcoming),
        String(r.overdue + r.upcoming),
      ]),
    ).join('') +
    tableRow(
      [
        '<strong>Total</strong>',
        String(globalOverdue),
        String(globalUpcoming),
        String(globalOverdue + globalUpcoming),
      ],
      { strong: true, bg: '#F8FAFC' },
    )

  const woCorrBody =
    plantRows
      .map((r) => {
        const [b0, b1, b2, b3] = r.woCorr
        const tot = b0 + b1 + b2 + b3
        return tableRow([
          escapeHtml(r.name),
          String(b0),
          String(b1),
          String(b2),
          String(b3),
          String(tot),
        ])
      })
      .join('') +
    tableRow(
      [
        '<strong>Total</strong>',
        String(tCorr[0]),
        String(tCorr[1]),
        String(tCorr[2]),
        String(tCorr[3]),
        String(woCorrTotal),
      ],
      { strong: true, bg: '#F8FAFC' },
    )

  const woPrevBody =
    plantRows
      .map((r) => {
        const [b0, b1, b2, b3] = r.woPrev
        const tot = b0 + b1 + b2 + b3
        return tableRow([escapeHtml(r.name), String(b0), String(b1), String(b2), String(b3), String(tot)])
      })
      .join('') +
    tableRow(
      [
        '<strong>Total</strong>',
        String(tPrev[0]),
        String(tPrev[1]),
        String(tPrev[2]),
        String(tPrev[3]),
        String(woPrevTotal),
      ],
      { strong: true, bg: '#F8FAFC' },
    )

  const chkTot813 = sumPlants((p) => p.chk813)
  const chkTot1429 = sumPlants((p) => p.chk1429)
  const chkTot30 = sumPlants((p) => p.chk30p)

  const checklistBody =
    plantRows
      .map((r) => {
        const tot = r.chk813 + r.chk1429 + r.chk30p
        return tableRow([
          escapeHtml(r.name),
          String(r.chk813),
          String(r.chk1429),
          `<span style="color:#B45309;font-weight:600;">${r.chk30p}</span>`,
          String(tot),
        ])
      })
      .join('') +
    tableRow(
      [
        '<strong>Total</strong>',
        String(chkTot813),
        String(chkTot1429),
        `<span style="color:#B45309;font-weight:600;">${chkTot30}</span>`,
        String(checklistGt7),
      ],
      { strong: true, bg: '#F8FAFC' },
    )

  const staleBody = plantRows
    .map((r) =>
      tableRow([escapeHtml(r.name), String(r.stale14), String(r.stale30), String(r.stale90)]),
    )
    .join('')

  const noOpBody = plantRows.map((r) => tableRow([escapeHtml(r.name), String(r.noOp)])).join('')

  const noOpTotal = sumPlants((p) => p.noOp)

  const staleDef =
    'Días desde la evidencia operativa más reciente entre: actualización del activo, último checklist completado o último registro en historial de mantenimiento.'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resumen de mantenimiento</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Resumen ${cutDate}: preventivo por intervalos, OT pendientes, checklists, operadores, intake sin OT.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#ffffff;border-radius:8px;box-shadow:0 4px 6px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:#0C4A6E;padding:24px 28px;border-bottom:5px solid #0369A1;">
              <h1 style="margin:0;font-family:Segoe UI,system-ui,Arial,sans-serif;font-size:22px;font-weight:700;color:#ffffff;">
                Resumen del departamento de mantenimiento
              </h1>
              <p style="margin:8px 0 0 0;font-family:Segoe UI,system-ui,Arial,sans-serif;font-size:14px;color:#BAE6FD;">
                Fecha de corte (CDMX): <strong style="color:#ffffff;">${escapeHtml(cutDate)}</strong>
              </p>
              <p style="margin:6px 0 0 0;font-family:Segoe UI,system-ui,Arial,sans-serif;font-size:14px;color:#BAE6FD;">
                Para: <strong style="color:#ffffff;">${escapeHtml(recipient)}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 0 24px;font-family:Segoe UI,system-ui,Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#0C4A6E;">Cómo leer este correo</p>
                    <p style="margin:0;font-size:12px;color:#475569;line-height:1.55;">
                      <strong>Preventivo cíclico</strong> usa la misma lógica que las alertas automáticas (horas/km vs intervalos del modelo).
                      <strong>OT</strong> pendientes alineadas a la vista «Pendientes» del sistema. Franjas de antigüedad por fecha de creación de la OT, sin solapar filas.
                      <strong>Incidentes sin OT</strong> son solo triage aún sin orden generada (no duplican el conteo de OT correctivas).
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 8px 24px;font-family:Segoe UI,system-ui,Arial,sans-serif;">
              <h2 style="margin:0 0 12px 0;font-size:16px;font-weight:700;color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:8px;">Resumen ejecutivo</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="33%" style="padding:4px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F5F9;border-radius:8px;">
                      <tr><td style="padding:14px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:#DC2626;">${globalOverdue}</div>
                        <div style="font-size:11px;color:#64748B;margin-top:4px;">Preventivo vencido<br/>(intervalos)</div>
                      </td></tr>
                    </table>
                  </td>
                  <td width="33%" style="padding:4px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F5F9;border-radius:8px;">
                      <tr><td style="padding:14px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:#0369A1;">${globalUpcoming}</div>
                        <div style="font-size:11px;color:#64748B;margin-top:4px;">Preventivo próximo<br/>(sin vencer)</div>
                      </td></tr>
                    </table>
                  </td>
                  <td width="33%" style="padding:4px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F5F9;border-radius:8px;">
                      <tr><td style="padding:14px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:#B45309;">${woCorrTotal}</div>
                        <div style="font-size:11px;color:#64748B;margin-top:4px;">OT correctivas<br/>pendientes</div>
                      </td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="33%" style="padding:4px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F5F9;border-radius:8px;">
                      <tr><td style="padding:14px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:#0D9488;">${woPrevTotal}</div>
                        <div style="font-size:11px;color:#64748B;margin-top:4px;">OT preventivas<br/>pendientes</div>
                      </td></tr>
                    </table>
                  </td>
                  <td width="33%" style="padding:4px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F5F9;border-radius:8px;">
                      <tr><td style="padding:14px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:#7C3AED;">${checklistGt7}</div>
                        <div style="font-size:11px;color:#64748B;margin-top:4px;">Activos sin checklist<br/>completado &gt;7 días</div>
                      </td></tr>
                    </table>
                  </td>
                  <td width="33%" style="padding:4px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F5F9;border-radius:8px;">
                      <tr><td style="padding:14px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:#CA8A04;">${noOperator}</div>
                        <div style="font-size:11px;color:#64748B;margin-top:4px;">Activos sin<br/>operador</div>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 16px 24px;font-family:Segoe UI,system-ui,Arial,sans-serif;">
              <p style="margin:0;font-size:12px;color:#64748B;line-height:1.5;background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:10px 12px;">
                <strong style="color:#92400E;">Intake sin ejecutar:</strong> incidentes sin OT generada: <strong style="color:#B45309;">${intakeNoWo}</strong>.
                OT correctivas con <code style="font-size:11px;">incident_id</code> (origen incidente): <strong>${woCorrFromIncident}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px;font-family:Segoe UI,system-ui,Arial,sans-serif;">
              <h2 style="margin:0 0 10px 0;font-size:16px;font-weight:700;color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;">Preventivo cíclico por planta</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                ${tableRow(['Planta', 'Vencidos', 'Próximos', 'Total seguimiento'], { header: true })}
                ${preventiveBody}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 8px 24px;font-family:Segoe UI,system-ui,Arial,sans-serif;">
              <h2 style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;">OT correctivas pendientes por planta</h2>
              <p style="margin:0 0 10px 0;font-size:12px;color:#64748B;">Antigüedad desde creación. Franjas: 0–7 · 8–30 · 31–100 · &gt;100 días.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                ${tableRow(['Planta', '0–7 d', '8–30 d', '31–100 d', '&gt;100 d', 'Total'], { header: true })}
                ${woCorrBody}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px 8px 24px;font-family:Segoe UI,system-ui,Arial,sans-serif;">
              <h2 style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;">OT preventivas pendientes por planta</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                ${tableRow(['Planta', '0–7 d', '8–30 d', '31–100 d', '&gt;100 d', 'Total'], { header: true })}
                ${woPrevBody}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 8px 24px;font-family:Segoe UI,system-ui,Arial,sans-serif;">
              <h2 style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;">Activos — checklist (días sin completar)</h2>
              <p style="margin:0 0 10px 0;font-size:12px;color:#64748B;">Fuente: <code style="font-size:11px;">asset_accountability_tracking</code>. Activos fuera de política de exclusión de cumplimiento omitidos.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                ${tableRow(['Planta', '8–13 d', '14–29 d', '30+ d', 'Total &gt;7 d'], { header: true })}
                ${checklistBody}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 8px 24px;font-family:Segoe UI,system-ui,Arial,sans-serif;">
              <h2 style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;">Activos — evidencia operativa antigua</h2>
              <p style="margin:0 0 10px 0;font-size:12px;color:#64748B;">${escapeHtml(staleDef)} Conteos <strong>acumulativos</strong> (&gt;14 incluye &gt;30 y &gt;90).</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                ${tableRow(['Planta', '&gt;14 d', '&gt;30 d', '&gt;90 d'], { header: true })}
                ${staleBody}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 8px 24px;font-family:Segoe UI,system-ui,Arial,sans-serif;">
              <h2 style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:#0C4A6E;border-bottom:2px solid #E2E8F0;padding-bottom:6px;">Activos sin operador asignado</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                ${tableRow(['Planta', 'Cantidad'], { header: true })}
                ${noOpBody}
                ${tableRow(['<strong>Total</strong>', String(noOpTotal)], { strong: true, bg: '#F8FAFC' })}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 28px 24px;font-family:Segoe UI,system-ui,Arial,sans-serif;">
              <p style="margin:0 0 10px 0;font-size:13px;font-weight:700;color:#0C4A6E;">Accesos rápidos</p>
              <p style="margin:0;font-size:13px;line-height:1.8;">
                <a href="${escapeHtml(appBase)}/ordenes" style="color:#0369A1;">Órdenes</a> ·
                <a href="${escapeHtml(appBase)}/incidentes" style="color:#0369A1;">Incidentes</a> ·
                <a href="${escapeHtml(appBase)}/activos" style="color:#0369A1;">Activos</a> ·
                <a href="${escapeHtml(appBase)}/checklists" style="color:#0369A1;">Checklists</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#F1F5F9;padding:16px 24px;text-align:center;border-top:1px solid #E2E8F0;font-family:Segoe UI,system-ui,Arial,sans-serif;">
              <p style="margin:0;font-size:12px;color:#64748B;">Dashboard de Mantenimiento — generado automáticamente desde Supabase.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const outPath = resolve(process.cwd(), 'docs/email-templates/maintenance-manager-department-snapshot.html')
  writeFileSync(outPath, html, 'utf8')
  console.log('Wrote', outPath)
  console.log({
    plants: plantRows.length,
    alerts: alerts.length,
    pendingWO: pendingWos.length,
    intakeNoWo,
    checklistGt7,
    noOperator,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
