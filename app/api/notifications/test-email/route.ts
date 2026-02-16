import { NextRequest, NextResponse } from 'next/server'

const TEST_EMAIL = 'juan.aguirre@dssolutions-mx.com'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'po'
  const sendBoth = searchParams.get('send_both') === 'true' || searchParams.get('send_both') === '1'
  const poIdParam = searchParams.get('po_id') // Optional: force a specific PO for testing (e.g. one with 2 quotations)
  const recipientParam = searchParams.get('recipient') || searchParams.get('to') // Optional: override test recipient
  const realSend = searchParams.get('real') === 'true' || searchParams.get('real') === '1' // Send to actual GMs, no test recipient
  const testRecipient = realSend ? undefined : (recipientParam || TEST_EMAIL)

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY' },
      { status: 500 }
    )
  }

  const base = SUPABASE_URL.replace(/\/$/, '')
  const fnBase = `${base}/functions/v1`
  const dataKey = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY

  try {
    if (type === 'po') {
      let poId = poIdParam
      if (!poId) {
        const poRes = await fetch(
          `${base}/rest/v1/purchase_orders?status=eq.pending_approval&select=id&limit=1`,
        {
          headers: {
            apikey: dataKey,
            Authorization: `Bearer ${dataKey}`,
            'Content-Type': 'application/json',
          },
        }
        )
        const pos = (await poRes.json()) as { id: string }[]
        poId = pos?.[0]?.id
      }
      if (!poId) {
        return NextResponse.json(
          { error: 'No pending PO found. Create one first.' },
          { status: 404 }
        )
      }

      const fnRes = await fetch(`${fnBase}/purchase-order-approval-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          po_id: poId,
          test_recipient: testRecipient,
          test_send_both: sendBoth,
        }),
      })

      const data = await fnRes.json().catch(() => ({}))
      if (!fnRes.ok) {
        return NextResponse.json({ error: 'Edge function failed', details: data }, { status: fnRes.status })
      }
      return NextResponse.json({
        success: true,
        message: sendBoth ? `PO approval test (BU + GM) sent to ${testRecipient}` : `PO approval test sent to ${testRecipient}`,
        data,
      })
    }

    if (type === 'asset') {
      const histRes = await fetch(
        `${base}/rest/v1/asset_assignment_history?previous_plant_id=not.is.null&new_plant_id=not.is.null&select=asset_id,previous_plant_id,new_plant_id,changed_by&order=created_at.desc&limit=1`,
        {
          headers: {
            apikey: dataKey,
            Authorization: `Bearer ${dataKey}`,
            'Content-Type': 'application/json',
          },
        }
      )
      const hist = (await histRes.json()) as {
        asset_id: string
        previous_plant_id: string
        new_plant_id: string
        changed_by: string | null
      }[]
      const h = hist?.[0]
      if (!h?.asset_id || !h?.previous_plant_id || !h?.new_plant_id) {
        return NextResponse.json(
          { error: 'No asset movement history found.' },
          { status: 404 }
        )
      }

      const body: Record<string, unknown> = {
        asset_id: h.asset_id,
        previous_plant_id: h.previous_plant_id,
        new_plant_id: h.new_plant_id,
        changed_by: h.changed_by,
      }
      if (testRecipient) body.test_recipient = testRecipient

      const fnRes = await fetch(`${fnBase}/asset-movement-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(body),
      })

      const data = await fnRes.json().catch(() => ({}))
      if (!fnRes.ok) {
        return NextResponse.json({ error: 'Edge function failed', details: data }, { status: fnRes.status })
      }
      return NextResponse.json({
        success: true,
        message: testRecipient ? `Asset movement test sent to ${testRecipient}` : 'Asset movement notification sent to GM recipients',
        data,
      })
    }

    return NextResponse.json({ error: 'Invalid type. Use ?type=po or ?type=asset' }, { status: 400 })
  } catch (e) {
    console.error('Test email error', e)
    return NextResponse.json({ error: 'Internal error', details: String(e) }, { status: 500 })
  }
}
