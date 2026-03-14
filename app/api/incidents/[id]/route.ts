import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Incident ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: incident, error } = await supabase
      .from('incident_history')
      .select(`
        *,
        assets (
          id,
          name,
          asset_id
        )
      `)
      .eq('id', id)
      .single()

    if (error || !incident) {
      return NextResponse.json(
        { error: error?.message || 'Incident not found' },
        { status: 404 }
      )
    }

    // Resolve reporter name from profiles
    const reporterId = incident.reported_by_id || (incident.reported_by && incident.reported_by.length === 36 ? incident.reported_by : null)
    let reporterName = incident.reported_by || 'Usuario del sistema'
    if (reporterId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nombre, apellido')
        .eq('id', reporterId)
        .single()
      if (profile) {
        reporterName = `${profile.nombre || ''} ${profile.apellido || ''}`.trim() || reporterName
      }
    }

    // Fetch work order order_id and purchase_order_id if linked
    let workOrderOrderId: string | null = null
    let purchaseOrderId: string | null = null
    if (incident.work_order_id) {
      const { data: wo } = await supabase
        .from('work_orders')
        .select('order_id, purchase_order_id')
        .eq('id', incident.work_order_id)
        .single()
      if (wo) {
        workOrderOrderId = wo.order_id
        purchaseOrderId = wo.purchase_order_id
      }
    }

    const processed = {
      ...incident,
      reported_by_name: reporterName,
      asset_display_name: incident.assets?.name || 'Activo no encontrado',
      asset_code: incident.assets?.asset_id || 'N/A',
      purchase_order_id: purchaseOrderId,
      work_order_order_id: workOrderOrderId
    }

    return NextResponse.json(processed)
  } catch (err) {
    console.error('Error fetching incident:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
