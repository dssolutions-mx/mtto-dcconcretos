import { createClient } from "@/lib/supabase-server"
import { PurchaseOrderDetailsMobile } from "@/components/purchase-orders/purchase-order-details-mobile"
import { notFound, redirect } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ReactNode, use } from "react"
import { PurchaseOrderStatus } from "@/types"
import { PurchaseOrderType } from "@/types/purchase-orders"
import { Button } from "@/components/ui/button"
import { FileCheck, Package, ShoppingCart } from "lucide-react"
import Link from "next/link"

// Helper functions (same as main page)
function formatCurrency(amount: string | null): string {
  if (!amount) return "$0.00"
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(amount))
}

function formatDate(dateString: string | null, formatStr: string = 'PP'): string {
  if (!dateString) return "N/A"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return format(date, formatStr, { locale: es })
  } catch (error) {
    return dateString
  }
}

function isImageFile(url: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const extension = url.split('.').pop()?.toLowerCase() || '';
  return imageExtensions.includes(extension);
}

function isPdfFile(url: string): boolean {
  return (url.split('.').pop()?.toLowerCase() || '') === 'pdf';
}

function getPurchaseOrderTypeInfo(poType: string | null) {
  // This would match the implementation from the main page
  const typeMap: Record<string, any> = {
    [PurchaseOrderType.DIRECT_SERVICE]: {
      label: "Servicio Directo",
      description: "Contratación directa de servicios profesionales",
      icon: Package,
      color: "text-blue-700"
    },
    [PurchaseOrderType.DIRECT_PURCHASE]: {
      label: "Compra Directa", 
      description: "Compra directa de productos o materiales",
      icon: ShoppingCart,
      color: "text-green-700"
    }
  }
  
  return poType ? typeMap[poType] : null
}

export default function PurchaseOrderDetailsMobilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  return <PurchaseOrderDetailsMobileContent id={id} />;
}

async function PurchaseOrderDetailsMobileContent({ id }: { id: string }) {
  const supabase = await createClient();
  
  // Get the purchase order details
  const { data: order, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", id)
    .single();
    
  if (error || !order) {
    notFound();
  }
  
  // Get work order if it exists
  let workOrder = null;
  if (order.work_order_id) {
    const { data: workOrderData, error: workOrderError } = await supabase
      .from("work_orders")
      .select("*")
      .eq("id", order.work_order_id)
      .single();
      
    if (!workOrderError && workOrderData) {
      workOrder = workOrderData;
    }
  }
  
  // Parse JSON items if it's a string
  const items = typeof order.items === 'string' 
    ? JSON.parse(order.items) 
    : order.items
  
  // Get requestor information
  let requesterName = "No especificado"
  if (order.requested_by) {
    const { data: requesterData } = await supabase
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", order.requested_by)
      .single()
      
    if (requesterData && requesterData.nombre) {
      requesterName = `${requesterData.nombre || ''} ${requesterData.apellido || ''}`.trim()
    }
  }
  
  // Get the approver name if available
  let approverName = "No aprobado"
  if (order.approved_by) {
    const { data: approverData } = await supabase
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", order.approved_by)
      .single()
      
    if (approverData && approverData.nombre) {
      approverName = `${approverData.nombre || ''} ${approverData.apellido || ''}`.trim()
    }
  }

  // Get action buttons based on status
  function getActionButtons(order: any): ReactNode {
    if (!order) return null
    
    // Check if this is an enhanced purchase order with po_type
    if (order.po_type) {
      // For enhanced purchase orders, let the WorkflowStatusDisplay handle actions
      return null
    }
    
    // Legacy purchase order status handling
    switch (order.status) {
      case PurchaseOrderStatus.Pending:
        return (
          <>
            <Button asChild className="w-full">
              <Link href={`/compras/${order.id}/aprobar`}>
                <FileCheck className="mr-2 h-4 w-4" />
                Aprobar Orden
              </Link>
            </Button>
            <Button asChild variant="destructive" className="w-full">
              <Link href={`/compras/${order.id}/rechazar`}>
                Rechazar Orden
              </Link>
            </Button>
          </>
        )
      case PurchaseOrderStatus.Approved:
        return (
          <Button asChild className="w-full">
            <Link href={`/compras/${order.id}/pedido`}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Marcar como Pedida
            </Link>
          </Button>
        )
      case PurchaseOrderStatus.Ordered:
        return (
          <Button asChild className="w-full">
            <Link href={`/compras/${order.id}/recibido`}>
              <Package className="mr-2 h-4 w-4" />
              Registrar Recepción
            </Link>
          </Button>
        )
      default:
        return null
    }
  }

  return (
    <PurchaseOrderDetailsMobile
      order={order}
      workOrder={workOrder}
      requesterName={requesterName}
      approverName={approverName}
      items={items || []}
      formatCurrency={formatCurrency}
      formatDate={formatDate}
      getActionButtons={getActionButtons}
      getPurchaseOrderTypeInfo={getPurchaseOrderTypeInfo}
      isImageFile={isImageFile}
      isPdfFile={isPdfFile}
    />
  )
} 