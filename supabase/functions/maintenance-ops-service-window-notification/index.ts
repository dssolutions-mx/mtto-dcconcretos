import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!
const FROM_EMAIL = Deno.env.get('MAINTENANCE_FROM_EMAIL') ?? 'mantenimiento@dcconcretos.com'
const FROM_NAME = 'Dashboard de Mantenimiento'

interface QueueRow {
  id: string
  notification_type: string
  recipient_role: string | null
  recipient_user_id: string | null
  plant_id: string | null
  payload: Record<string, unknown>
}

async function getRecipientsByRole(
  supabase: ReturnType<typeof createClient>,
  role: string,
  plantId: string | null,
) {
  let q = supabase
    .from('profiles')
    .select('id, email, nombre, apellido, plant_id')
    .eq('status', 'active')
    .not('email', 'is', null)

  if (role === 'JEFE_PLANTA' || role === 'COORDINADOR_MANTENIMIENTO') {
    q = q.or(`role.eq.${role},business_role.eq.${role}`)
    if (plantId) q = q.eq('plant_id', plantId)
  } else if (role === 'GERENTE_MANTENIMIENTO') {
    q = q.or('role.eq.GERENTE_MANTENIMIENTO,business_role.eq.GERENTE_MANTENIMIENTO')
  } else {
    q = q.eq('role', role)
  }

  const { data } = await q
  return (data ?? []).filter((p) => p.email)
}

function buildServiceWindowEmail(payload: Record<string, unknown>): string {
  const assetCode = payload.asset_code ?? payload.asset_name ?? 'Unidad'
  const starts = payload.starts_at ? new Date(String(payload.starts_at)).toLocaleString('es-MX') : '—'
  const ends = payload.ends_at ? new Date(String(payload.ends_at)).toLocaleString('es-MX') : '—'
  const wo = payload.work_order ?? '—'
  const desc = payload.description ?? ''

  return `
    <h2>Unidad programada fuera de servicio</h2>
    <p><strong>${assetCode}</strong> tiene mantenimiento programado.</p>
    <ul>
      <li><strong>Inicio:</strong> ${starts}</li>
      <li><strong>Fin:</strong> ${ends}</li>
      <li><strong>OT:</strong> ${wo}</li>
      <li><strong>Trabajo:</strong> ${desc}</li>
    </ul>
    <p>Coordinar despachos y asignación de unidad sustituta si aplica.</p>
  `
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SendGrid ${res.status}: ${text}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: pending, error } = await supabase
      .from('maintenance_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_send_at', new Date().toISOString())
      .order('scheduled_send_at')
      .limit(50)

    if (error) throw error

    let sent = 0
    let failed = 0

    for (const row of (pending ?? []) as QueueRow[]) {
      try {
        if (row.notification_type === 'ops_service_window') {
          const recipients = row.recipient_user_id
            ? [{ email: (row as { email?: string }).email }]
            : await getRecipientsByRole(supabase, row.recipient_role ?? 'JEFE_PLANTA', row.plant_id)

          const html = buildServiceWindowEmail(row.payload)
          const subject = `Mantenimiento programado — ${row.payload.asset_code ?? 'unidad'}`

          for (const r of recipients) {
            if (r.email) await sendEmail(r.email, subject, html)
          }
        }

        await supabase
          .from('maintenance_notification_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', row.id)
        sent++
      } catch (e) {
        failed++
        await supabase
          .from('maintenance_notification_queue')
          .update({
            status: 'failed',
            attempts: (row as { attempts?: number }).attempts ?? 0 + 1,
            last_error: e instanceof Error ? e.message : String(e),
          })
          .eq('id', row.id)
      }
    }

    return new Response(JSON.stringify({ processed: (pending ?? []).length, sent, failed }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
