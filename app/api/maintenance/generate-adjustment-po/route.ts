import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { PurchaseOrderStatus, WorkOrderStatus } from "@/types"

export async function POST(request: Request) {
  try {
    // Initialize Supabase client with proper cookie handling
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // This can be ignored if you have middleware refreshing sessions
            }
          },
        },
      }
    )
    
    // Verify user authentication
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error("API: Error al obtener la sesión:", sessionError)
      return NextResponse.json(
        { error: `Error de autenticación: ${sessionError.message}` },
        { status: 401 }
      )
    }

    if (!sessionData.session?.user) {
      console.error("API: Usuario no autenticado")
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    // Parse request data
    const data = await request.json()
    const { 
      workOrderId,
      originalPurchaseOrderId,
      additionalExpenses,
      supplier
    } = data

    if (!workOrderId || !additionalExpenses || additionalExpenses.length === 0) {
      return NextResponse.json(
        { error: "Datos incompletos para generar orden de compra de ajuste" },
        { status: 400 }
      )
    }

    // Get work order details including asset
    const { data: workOrder, error: workOrderError } = await supabase
      .from("work_orders")
      .select(`
        *,
        asset:assets (*)
      `)
      .eq("id", workOrderId)
      .single()

    if (workOrderError || !workOrder) {
      console.error("Error al obtener la orden de trabajo:", workOrderError)
      return NextResponse.json(
        { error: "No se pudo obtener la información de la orden de trabajo" },
        { status: 500 }
      )
    }

    // Get original purchase order if exists
    let originalPurchaseOrder = null
    if (originalPurchaseOrderId) {
      const { data: poData, error: poError } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", originalPurchaseOrderId)
        .single()

      if (!poError && poData) {
        originalPurchaseOrder = poData
      }
    }

    // Calculate total amount of additional expenses
    const totalAmount = additionalExpenses.reduce(
      (sum: number, expense: any) => sum + (parseFloat(expense.amount) || 0), 
      0
    )

    // Generate a sequential order number for the adjustment PO
    const { count: orderCount, error: countError } = await supabase
      .from("purchase_orders")
      .select("*", { count: "exact", head: true })

    if (countError) {
      console.error("Error contando órdenes de compra:", countError)
      return NextResponse.json(
        { error: "Error al generar número de orden" },
        { status: 500 }
      )
    }

    // Format the adjustment order ID with "AJ" prefix
    const orderNumber = (orderCount || 0) + 1
    const orderId = `AJ-${orderNumber.toString().padStart(4, '0')}`

    // Format expenses as items for the purchase order
    const poItems = additionalExpenses.map((expense: any) => ({
      name: expense.description,
      description: `Gasto adicional: ${expense.description}`,
      justification: expense.justification,
      quantity: 1,
      unit_price: parseFloat(expense.amount) || 0,
      total_price: parseFloat(expense.amount) || 0
    }))

    // Create the adjustment purchase order
    const purchaseOrderData = {
      order_id: orderId,
      work_order_id: workOrderId,
      supplier: supplier || "Gastos Adicionales",
      items: JSON.stringify(poItems),
      total_amount: totalAmount.toString(),
      status: PurchaseOrderStatus.Received,
      requested_by: sessionData.session.user.id,
      approved_by: sessionData.session.user.id,
      approval_date: new Date().toISOString(),
      expected_delivery_date: new Date().toISOString(),
      actual_delivery_date: new Date().toISOString(),
      is_adjustment: true,
      original_purchase_order_id: originalPurchaseOrderId || null,
      notes: `Orden de ajuste por gastos adicionales en trabajo completado: ${workOrder.order_id}`
    }

    // Insert the new purchase order
    const { data: newPO, error: insertError } = await supabase
      .from("purchase_orders")
      .insert(purchaseOrderData)
      .select("id")
      .single()

    if (insertError) {
      console.error("Error al crear orden de compra de ajuste:", insertError)
      return NextResponse.json(
        { error: "No se pudo crear la orden de compra de ajuste" },
        { status: 500 }
      )
    }

    // Update additional expenses with the new purchase order ID
    for (const expense of additionalExpenses) {
      await supabase
        .from("additional_expenses")
        .update({ 
          adjustment_po_id: newPO.id,
          updated_at: new Date().toISOString()
        })
        .eq("id", expense.id)
    }

    return NextResponse.json({
      message: "Orden de compra de ajuste generada exitosamente",
      purchaseOrderId: newPO.id,
      orderId: orderId
    })
  } catch (error) {
    console.error("Error al procesar la petición:", error)
    return NextResponse.json(
      { error: "Error interno al procesar la petición" },
      { status: 500 }
    )
  }
} 