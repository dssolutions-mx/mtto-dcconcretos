import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!
const SENDGRID_FROM = Deno.env.get('SENDGRID_FROM') || 'juan.aguirre@dssolutions-mx.com'

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = await req.json()
    const { asset_id, previous_plant_id, new_plant_id, changed_by, test_recipient } = body

    if (!asset_id || !new_plant_id || !previous_plant_id || previous_plant_id === new_plant_id) {
      return new Response(JSON.stringify({ success: true, skipped: 'No plant change' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const [assetRes, fromPlantRes, toPlantRes, userRes] = await Promise.all([
      supabase.from('assets').select('asset_id, name').eq('id', asset_id).single(),
      supabase.from('plants').select('name').eq('id', previous_plant_id).single(),
      supabase.from('plants').select('name').eq('id', new_plant_id).single(),
      changed_by ? supabase.from('profiles').select('nombre, apellido').eq('id', changed_by).single() : Promise.resolve({ data: null })
    ])

    const assetCode = assetRes.data?.asset_id || assetRes.data?.name || asset_id
    const fromPlantName = fromPlantRes.data?.name || previous_plant_id
    const toPlantName = toPlantRes.data?.name || new_plant_id
    const changedByName = userRes.data
      ? `${(userRes.data as any).nombre || ''} ${(userRes.data as any).apellido || ''}`.trim() || 'Usuario'
      : 'Usuario'

    const { data: gms } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'GERENCIA_GENERAL')
      .eq('status', 'active')

    if (!gms?.length) {
      return new Response(JSON.stringify({ success: true, message: 'No GM recipients' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { data: users } = await supabase.auth.admin.listUsers()
    const usersById = new Map((users?.users || []).map((u: any) => [u.id, u]))
    const gmEmails = gms
      .map((p: any) => usersById.get(p.id)?.email)
      .filter(Boolean) as string[]

    const recipientEmails = test_recipient ? [test_recipient] : gmEmails
    if (recipientEmails.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No GM emails' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const isTest = !!test_recipient
    const testBanner = isTest ? `
    <div style="background:#b91c1c; color:#fff; padding:12px 20px; text-align:center; font-weight:700; font-size:14px; margin-bottom:20px;">
      PRUEBA — Este es un correo de prueba. No es una notificación real.
    </div>` : ''

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: Arial, sans-serif; color: #334155; }
  .container { max-width: 560px; margin: 0 auto; padding: 20px; }
  .title { font-size: 18px; font-weight: 700; margin: 0 0 10px; }
  .meta { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; }
  .row { display: flex; justify-content: space-between; margin: 6px 0; }
</style></head>
<body>
  <div class="container">
    ${testBanner}
    <div class="title">📋 Notificación: Activo movido entre plantas</div>
    <div class="meta">
      <div class="row"><div>Activo</div><div><strong>${assetCode}</strong></div></div>
      <div class="row"><div>Planta anterior</div><div>${fromPlantName}</div></div>
      <div class="row"><div>Planta nueva</div><div><strong>${toPlantName}</strong></div></div>
      <div class="row"><div>Movido por</div><div>${changedByName}</div></div>
    </div>
    <p style="margin-top:16px; color:#64748b; font-size:13px;">
      Un activo ha sido reasignado de una planta a otra en el sistema de mantenimiento.
    </p>
  </div>
</body>
</html>`

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: recipientEmails.map((email) => ({ email })),
          tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
        }],
        from: { email: SENDGRID_FROM },
        subject: `${isTest ? '[PRUEBA] ' : ''}[Mantenimiento] Activo ${assetCode} movido: ${fromPlantName} → ${toPlantName}`,
        content: [{ type: 'text/html', value: html }],
        tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('SendGrid asset movement error', errText)
      await supabase.from('notifications').insert({
        user_id: null,
        title: 'Notificación de movimiento de activo (falló)',
        message: `Activo ${assetCode}: ${fromPlantName}→${toPlantName} | ${errText.slice(0, 300)}`,
        type: 'ASSET_MOVEMENT_NOTIFICATION',
        related_entity: 'asset',
        entity_id: asset_id,
      })
      return new Response(JSON.stringify({ error: 'SendGrid failed' }), { status: 500 })
    }

    await supabase.from('notifications').insert({
      user_id: null,
      title: 'Notificación de movimiento de activo (enviado)',
      message: `Activo ${assetCode}: ${fromPlantName} → ${toPlantName}`,
      type: 'ASSET_MOVEMENT_NOTIFICATION',
      related_entity: 'asset',
      entity_id: asset_id,
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Asset movement notification error', e)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })
  }
})
