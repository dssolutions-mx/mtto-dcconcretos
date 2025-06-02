import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Test generating multiple unique work order IDs
    const { data: workOrderIds, error: workOrderError } = await supabase
      .rpc('generate_unique_work_order_id')
    
    if (workOrderError) {
      console.error('Error generating work order ID:', workOrderError)
      return NextResponse.json(
        { error: `Error generando ID de orden de trabajo: ${workOrderError.message}` },
        { status: 500 }
      )
    }
    
    // Test generating multiple unique purchase order IDs
    const { data: purchaseOrderIds, error: purchaseOrderError } = await supabase
      .rpc('generate_unique_purchase_order_id')
    
    if (purchaseOrderError) {
      console.error('Error generating purchase order ID:', purchaseOrderError)
      return NextResponse.json(
        { error: `Error generando ID de orden de compra: ${purchaseOrderError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Generación de IDs funcionando correctamente',
      generated_ids: {
        work_order_id: workOrderIds,
        purchase_order_id: purchaseOrderIds
      }
    })

  } catch (error) {
    console.error('Error in test ID generation API:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 