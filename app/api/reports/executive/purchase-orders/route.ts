import { createClient as createServerSupabase } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const assetId = searchParams.get('assetId')
    
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    // Get purchase orders with work order and asset details
    let query = supabase
      .from("purchase_orders")
      .select(`
        id, 
        order_id, 
        total_amount, 
        actual_amount, 
        created_at, 
        posting_date,
        purchased_at,
        plant_id,
        work_order_id, 
        status, 
        supplier, 
        items,
        work_orders!purchase_orders_work_order_id_fkey (
          id,
          type,
          asset_id,
          planned_date,
          completed_at,
          created_at,
          assets (
            id,
            asset_id,
            equipment_models (
              name,
              manufacturer
            )
          )
        ),
        plants (
          name
        )
      `)
      .neq("status", "pending_approval")
      .order('created_at', { ascending: false })

    const { data: purchaseOrders, error } = await query

    if (error) {
      console.error("Purchase orders fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter by date using priority: purchased_at → work_order.completed_at → work_order.planned_date → work_order.created_at
    // Also filter by assetId if provided
    const filteredPOs = (purchaseOrders || []).filter((po: any) => {
      // Filter by asset if specified
      if (assetId && po.work_orders?.asset_id !== assetId) {
        return false
      }
      
      // Filter by date - priority: purchased_at → work_order.completed_at → work_order.planned_date → work_order.created_at
      let dateToCheck: string
      if (po.purchased_at) {
        dateToCheck = po.purchased_at
      } else if (po.work_orders?.completed_at) {
        dateToCheck = po.work_orders.completed_at
      } else if (po.work_orders?.planned_date) {
        dateToCheck = po.work_orders.planned_date
      } else if (po.work_orders?.created_at) {
        dateToCheck = po.work_orders.created_at
      } else {
        dateToCheck = po.created_at
      }
      
      return dateToCheck >= startDate! && dateToCheck <= endDate!
    })

    // Transform the data for easier consumption
    const transformedPOs = filteredPOs.map(po => {
      const finalAmount = po.actual_amount ? parseFloat(po.actual_amount) : parseFloat(po.total_amount || '0')
      
      return {
        id: po.id,
        order_id: po.order_id,
        amount: finalAmount,
        status: po.status,
        supplier: po.supplier || 'N/A',
        created_at: po.created_at,
        plant_name: po.plants?.name || 'N/A',
        items: po.items || [],
        work_order: po.work_orders ? {
          id: po.work_orders.id,
          type: po.work_orders.type,
          planned_date: po.work_orders.planned_date,
          asset: po.work_orders.assets ? {
            id: po.work_orders.assets.id,
            code: po.work_orders.assets.asset_id,
            model: po.work_orders.assets.equipment_models?.name || 'N/A',
            manufacturer: po.work_orders.assets.equipment_models?.manufacturer || 'N/A'
          } : null
        } : null,
        // Add direct link to purchase order
        link: `/compras/${po.id}`
      }
    }) || []

    return NextResponse.json({
      purchase_orders: transformedPOs,
      total: transformedPOs.length,
      total_amount: transformedPOs.reduce((sum, po) => sum + po.amount, 0)
    })

  } catch (error) {
    console.error("Purchase orders breakdown error:", error)
    return NextResponse.json({ 
      error: "Failed to fetch purchase orders breakdown",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
