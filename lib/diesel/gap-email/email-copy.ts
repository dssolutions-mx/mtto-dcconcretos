import type { CuentaLitrosGap } from '@/lib/diesel-cuenta-litros-gaps'
import type { GapEvidencePhoto } from '@/lib/diesel/gap-email/load-gap-evidence'

const B = {
  navy: '#1B365D',
  green: '#00A64F',
  white: '#FFFFFF',
  textSecondary: '#44403C',
  textMuted: '#78716C',
  borderLight: '#E7E5E4',
  borderMedium: '#D6D3D1',
  surface: '#FAFAF9',
  rowAlt: '#F5F5F4',
  gapWarn: '#C2410C',
} as const

const CONTACT = {
  companyLine: 'DC CONCRETOS, S.A. DE C.V.',
  address: 'Carr. Silao-San Felipe km 4.1, CP 36110',
  phone: '477-129-2394',
  email: 'ventas@dcconcretos.com.mx',
  web: 'www.dcconcretos.com.mx',
}

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:system-ui,-apple-system,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#FFFFFF;border:1px solid ${B.borderMedium};border-radius:4px;overflow:hidden">
${body}
</table>
</td></tr>
</table>
</body></html>`
}

function header(warehouseLabel: string, plantLabel: string): string {
  const today = new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return `
<tr><td>
  <div style="height:4px;background:${B.green}"></div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${B.navy}">
    <tr>
      <td style="padding:18px 24px">
        <div style="color:${B.white};font-size:16px;font-weight:700;letter-spacing:0.02em">${CONTACT.companyLine}</div>
        <div style="color:#93A8C4;font-size:11px;margin-top:2px">${CONTACT.address} · ${CONTACT.phone}</div>
      </td>
      <td align="right" style="padding:18px 24px;white-space:nowrap">
        <div style="color:${B.white};font-size:13px;font-weight:600">Huecos cuenta litros</div>
        <div style="color:#93A8C4;font-size:11px;margin-top:2px">${warehouseLabel} · ${plantLabel}</div>
        <div style="color:#93A8C4;font-size:11px;margin-top:2px">${today}</div>
      </td>
    </tr>
  </table>
</td></tr>`
}

function footer(): string {
  return `
<tr><td style="padding:16px 24px;background:${B.surface};border-top:1px solid ${B.borderLight}">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="font-size:11px;color:${B.textMuted}">
        <strong style="color:${B.navy}">${CONTACT.companyLine}</strong><br>
        ${CONTACT.address}<br>
        ${CONTACT.phone} · <a href="mailto:${CONTACT.email}" style="color:${B.textMuted}">${CONTACT.email}</a>
      </td>
      <td align="right" style="font-size:10px;color:${B.textMuted}">
        Mensaje generado desde el dashboard de mantenimiento.<br>
        Favor de registrar las salidas faltantes o justificar.
      </td>
    </tr>
  </table>
</td></tr>`
}

function p(text: string): string {
  return `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${B.textSecondary}">${text}</p>`
}

function th(label: string, opts?: { right?: boolean }): string {
  let style = `padding:8px 10px;background:${B.navy};color:${B.white};font-size:11px;font-weight:600;white-space:nowrap;border-right:1px solid #2D4D7A`
  if (opts?.right) style += ';text-align:right'
  return `<th align="left" style="${style}">${label}</th>`
}

function td(val: unknown, opts?: { mono?: boolean; right?: boolean; html?: boolean }): string {
  const s = val == null || val === '' ? '—' : String(val)
  let style = `padding:7px 10px;border-bottom:1px solid ${B.borderLight};border-right:1px solid ${B.borderLight};font-size:12px;vertical-align:top;color:${B.textSecondary};`
  if (opts?.mono) style += 'font-family:monospace;'
  if (opts?.right) style += 'text-align:right;'
  const content = opts?.html ? s : escapeHtml(s)
  return `<td style="${style}">${content}</td>`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAsset(label: string | null | undefined): string {
  return label?.trim() ? label.trim() : '—'
}

function evidenceCell(photos: GapEvidencePhoto[]): string {
  if (photos.length === 0) {
    return td('Sin foto', { mono: false })
  }

  const thumbs = photos.slice(0, 3).map((photo) => {
    const label = `${photo.transactionCode} (${photo.anchor === 'prev' ? 'desde' : photo.anchor === 'curr' ? 'hasta' : 'intervalo'})`
    return `<div style="margin-bottom:8px">
      <a href="${escapeHtml(photo.photoUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:${B.navy};font-size:11px;font-weight:600">${escapeHtml(label)}</a><br>
      <a href="${escapeHtml(photo.photoUrl)}" target="_blank" rel="noopener noreferrer">
        <img src="${escapeHtml(photo.photoUrl)}" alt="${escapeHtml(label)}" width="120" style="display:block;margin-top:4px;border:1px solid ${B.borderMedium};border-radius:4px;max-width:120px;height:auto" />
      </a>
    </div>`
  })

  const extra =
    photos.length > 3
      ? `<div style="font-size:10px;color:${B.textMuted}">+${photos.length - 3} foto(s) más (ver enlaces)</div>`
      : ''

  return td(`${thumbs.join('')}${extra}`, { html: true })
}

function gapTable(
  gaps: CuentaLitrosGap[],
  evidenceByGapId: Map<string, GapEvidencePhoto[]>,
): string {
  const rows = gaps.map((gap, i) => {
    const photos = evidenceByGapId.get(gap.id) ?? []
    const equipment = `${formatAsset(gap.prev_anchor.asset_label)} → ${formatAsset(gap.curr_anchor.asset_label)}`
    const meterReadings = `${gap.prev_cuenta_litros.toFixed(0)} → ${gap.curr_cuenta_litros.toFixed(0)} L`
    const gapLiters = `${gap.gap_liters > 0 ? '+' : ''}${gap.gap_liters.toFixed(0)} L`
    const row = `<tr>
      ${td(gap.short_label)}
      ${td(formatDateTime(gap.prev_anchor.transaction_date))}
      ${td(formatDateTime(gap.curr_anchor.transaction_date))}
      ${td(equipment)}
      ${td(`${gap.prev_anchor.transaction_id} → ${gap.curr_anchor.transaction_id}`, { mono: true })}
      ${td(meterReadings, { right: true })}
      ${td(`${gap.meter_delta.toFixed(0)} L`, { right: true })}
      ${td(`${gap.registered_liters.toFixed(0)} L`, { right: true })}
      ${td(gapLiters, { right: true })}
      ${td(gap.time_window_label)}
      ${evidenceCell(photos)}
    </tr>`
    return i % 2 === 1 ? row.replace('<tr>', `<tr style="background:${B.rowAlt}">`) : row
  })

  return `
<div style="overflow-x:auto;margin:16px 0;border:1px solid ${B.borderMedium};border-radius:4px">
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;min-width:720px">
  <thead><tr>
    ${th('Hallazgo')}
    ${th('Desde')}
    ${th('Hasta')}
    ${th('Equipo')}
    ${th('Intervalo (Tx)')}
    ${th('Lecturas medidor', { right: true })}
    ${th('Δ medidor', { right: true })}
    ${th('Registrado', { right: true })}
    ${th('Hueco', { right: true })}
    ${th('Ventana')}
    ${th('Evidencia')}
  </tr></thead>
  <tbody>${rows.join('')}</tbody>
</table>
</div>`
}

export function buildDieselGapEmailHtml(input: {
  warehouseName: string
  warehouseCode: string
  plantName: string
  plantCode: string | null
  gaps: CuentaLitrosGap[]
  evidenceByGapId?: Map<string, GapEvidencePhoto[]>
  appUrl?: string
  warehouseId: string
}): { subject: string; html: string } {
  const warehouseLabel = `${input.warehouseName} (${input.warehouseCode})`
  const plantLabel = input.plantCode
    ? `${input.plantName} · ${input.plantCode}`
    : input.plantName
  const evidenceByGapId = input.evidenceByGapId ?? new Map<string, GapEvidencePhoto[]>()

  const totalGap = input.gaps.reduce(
    (sum, g) => sum + (g.gap_type === 'unregistered_dispense' ? g.gap_liters : 0),
    0,
  )

  const subject = `[DC Concretos] Huecos cuenta litros — ${input.warehouseCode} — ${input.gaps.length} hallazgo${input.gaps.length !== 1 ? 's' : ''}`

  const warehouseLink = input.appUrl
    ? `<p style="margin:16px 0 0"><a href="${input.appUrl}/diesel/almacen/${input.warehouseId}" style="display:inline-block;background:${B.navy};color:${B.white};padding:10px 22px;border-radius:4px;text-decoration:none;font-size:13px;font-weight:600">Ver almacén en mantenimiento</a></p>`
    : ''

  const html = wrap(`
    ${header(warehouseLabel, plantLabel)}
    <tr><td style="padding:24px">
      ${p('Estimado equipo,')}
      ${p(`Se detectaron <strong>${input.gaps.length}</strong> hueco${input.gaps.length !== 1 ? 's' : ''} significativo${input.gaps.length !== 1 ? 's' : ''} entre lecturas consecutivas del medidor <strong>cuenta litros</strong> en el almacén <strong>${warehouseLabel}</strong> (planta ${plantLabel}).`)}
      ${totalGap > 0 ? p(`Litros sin registrar en total (aprox.): <strong style="color:${B.gapWarn}">${totalGap.toFixed(0)} L</strong>.`) : ''}
      ${p('Favor de revisar cada intervalo, registrar las salidas faltantes o justificar la diferencia en las próximas <strong>24 horas</strong>. Las fotos de evidencia aparecen en la columna final; también se adjuntan al correo cuando están disponibles.')}
      ${gapTable(input.gaps, evidenceByGapId)}
      ${input.gaps.map((g) => `<p style="margin:0 0 8px;font-size:11px;color:${B.textMuted};line-height:1.5"><strong>${escapeHtml(g.short_label)}:</strong> ${escapeHtml(g.narrative)}</p>`).join('')}
      ${warehouseLink}
    </td></tr>
    ${footer()}
  `)

  return { subject, html }
}