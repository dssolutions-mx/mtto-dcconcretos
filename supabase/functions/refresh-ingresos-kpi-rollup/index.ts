/**
 * pg_cron → this Edge Function → POST Next.js /api/internal/refresh-ingresos-kpi-rollup
 *
 * Secrets (Supabase Dashboard → Project Settings → Edge Functions → Secrets):
 *   INGRESOS_KPI_REFRESH_TARGET_URL  — full URL to the internal refresh route on your app
 *   INGRESOS_KPI_REFRESH_TARGET_BEARER — same value as CRON_SECRET (or INGRESOS_GASTOS_KPI_ROLLUP_CRON_SECRET) on Next.js
 *
 * Invoked with Authorization: Bearer <anon_key> (from Vault), per Supabase scheduled-functions docs.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const targetUrl = Deno.env.get('INGRESOS_KPI_REFRESH_TARGET_URL')?.trim()
  const targetBearer = Deno.env.get('INGRESOS_KPI_REFRESH_TARGET_BEARER')?.trim()

  if (!targetUrl || !targetBearer) {
    console.error(
      'refresh-ingresos-kpi-rollup: set INGRESOS_KPI_REFRESH_TARGET_URL and INGRESOS_KPI_REFRESH_TARGET_BEARER in Edge Function secrets'
    )
    return new Response(
      JSON.stringify({
        error:
          'Edge function not configured: add INGRESOS_KPI_REFRESH_TARGET_URL and INGRESOS_KPI_REFRESH_TARGET_BEARER secrets',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${targetBearer}`,
    },
    body: '{}',
  })

  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/json',
    },
  })
})
