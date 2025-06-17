import { createClient } from "@/lib/supabase-server"
import { PurchaseOrderStatus } from "@/types"
import { PurchaseOrderType, EnhancedPOStatus } from "@/types/purchase-orders"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, FileCheck, Package, ShoppingCart, Truck, FileText, Download, ExternalLink, Store, Wrench, Building2, Receipt } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ReactNode, use } from "react"
import { ReceiptSection } from "@/components/work-orders/receipt-section"
import { WorkflowStatusDisplay } from "@/components/purchase-orders/workflow/WorkflowStatusDisplay"
import { TypeBadge } from "@/components/purchase-orders/shared/TypeBadge"
import { ReceiptDisplaySection } from "@/components/purchase-orders/ReceiptDisplaySection"

// Helper function to format currency
function formatCurrency(amount: string | null): string {
  if (!amount) return "$0.00"
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(amount))
}

// Helper function to format date
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

// Helper function to get badge variant based on status
function getStatusVariant(status: string | null): "outline" | "secondary" | "default" | "destructive" | undefined {
  switch (status) {
    case PurchaseOrderStatus.Pending:
      return "outline"
    case PurchaseOrderStatus.Approved:
      return "secondary"
    case PurchaseOrderStatus.Ordered:
      return "default"
    case PurchaseOrderStatus.Received:
      return "default"
    case PurchaseOrderStatus.Rejected:
      return "destructive"
    default:
      return "outline"
  }
}

// Helper function to get file extension from URL
function getFileExtension(url: string): string {
  if (!url) return '';
  return url.split('.').pop()?.toLowerCase() || '';
}

// Helper function to check if a file is an image
function isImageFile(url: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const extension = getFileExtension(url);
  return imageExtensions.includes(extension);
}

// Helper function to check if a file is a PDF
function isPdfFile(url: string): boolean {
  return getFileExtension(url) === 'pdf';
}

export default function PurchaseOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  // Return the content component with the id
  return <PurchaseOrderDetailsContent id={id} />;
}

// Create an async server component for the content
async function PurchaseOrderDetailsContent({ id }: { id: string }) {
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
            <Button asChild variant="secondary">
              <Link href={`/compras/${order.id}/aprobar`}>
                <FileCheck className="mr-2 h-4 w-4" />
                Aprobar Orden
              </Link>
            </Button>
            <Button asChild variant="destructive">
              <Link href={`/compras/${order.id}/rechazar`}>
                Rechazar Orden
              </Link>
            </Button>
          </>
        )
      case PurchaseOrderStatus.Approved:
        return (
          <Button asChild>
            <Link href={`/compras/${order.id}/pedido`}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Marcar como Pedida
            </Link>
          </Button>
        )
      case PurchaseOrderStatus.Ordered:
        return (
          <Button asChild>
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

  // Helper function to get purchase order type display info
  function getPurchaseOrderTypeInfo(poType: string | null) {
    switch (poType) {
      case PurchaseOrderType.DIRECT_PURCHASE:
        return {
          label: "Compra Directa",
          description: "Ferretería, tienda local",
          icon: Store,
          color: "bg-blue-100 text-blue-700"
        }
      case PurchaseOrderType.DIRECT_SERVICE:
        return {
          label: "Servicio Directo", 
          description: "Técnico especialista",
          icon: Wrench,
          color: "bg-green-100 text-green-700"
        }
      case PurchaseOrderType.SPECIAL_ORDER:
        return {
          label: "Pedido Especial",
          description: "Proveedor formal",
          icon: Building2,
          color: "bg-purple-100 text-purple-700"
        }
      default:
        return null
    }
  }

  return (
    <div className="container py-4 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Orden de Compra: {order.order_id}</h1>
                     {order.po_type && (
             <div className="mt-2">
               <TypeBadge type={order.po_type as PurchaseOrderType} />
             </div>
           )}
        </div>
        <Button variant="outline" size="icon" asChild>
          <Link href="/compras">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      
      <div className="grid gap-8 md:grid-cols-2">
        {/* Order Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Información General
              <Badge variant={getStatusVariant(order.status)}>
                {order.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Purchase Order Type - only show for enhanced orders */}
            {order.po_type && (
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Tipo de Orden</dt>
                <dd className="mt-1">
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const typeInfo = getPurchaseOrderTypeInfo(order.po_type)
                      if (!typeInfo) return <span>{order.po_type}</span>
                      
                      const Icon = typeInfo.icon
                      return (
                        <>
                          <div className={`p-1 rounded ${typeInfo.color.replace('text-', 'bg-').replace('-700', '-200')}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-medium">{typeInfo.label}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              {typeInfo.description}
                            </span>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </dd>
              </div>
            )}

            {/* Enhanced order specific fields */}
            {order.store_location && (
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Tienda/Ubicación</dt>
                <dd className="mt-1">{order.store_location}</dd>
              </div>
            )}

            {order.service_provider && (
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Proveedor de Servicio</dt>
                <dd className="mt-1">{order.service_provider}</dd>
              </div>
            )}

            {order.payment_method && (
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Forma de Pago</dt>
                <dd className="mt-1 capitalize">{order.payment_method}</dd>
              </div>
            )}

            {order.requires_quote !== undefined && (
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Requiere Cotización</dt>
                <dd className="mt-1">
                  <Badge variant={order.requires_quote ? "default" : "secondary"}>
                    {order.requires_quote ? "Sí" : "No"}
                  </Badge>
                </dd>
              </div>
            )}

            <div>
              <dt className="font-medium text-sm text-muted-foreground">Proveedor</dt>
              <dd className="mt-1">{order.supplier || "No especificado"}</dd>
            </div>

            <div>
              <dt className="font-medium text-sm text-muted-foreground">Monto Total</dt>
              <dd className="mt-1 text-lg font-semibold">{formatCurrency(order.total_amount)}</dd>
            </div>

            {order.actual_amount && (
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Monto Real Gastado</dt>
                <dd className="mt-1 text-lg font-semibold text-green-600">{formatCurrency(order.actual_amount.toString())}</dd>
              </div>
            )}

            <div>
              <dt className="font-medium text-sm text-muted-foreground">Solicitado por</dt>
              <dd className="mt-1">{requesterName}</dd>
            </div>

            {order.approved_by && (
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Aprobado por</dt>
                <dd className="mt-1">{approverName}</dd>
              </div>
            )}

            <div>
              <dt className="font-medium text-sm text-muted-foreground">Fecha de Creación</dt>
              <dd className="mt-1">{formatDate(order.created_at)}</dd>
            </div>

            {order.approval_date && (
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Fecha de Aprobación</dt>
                <dd className="mt-1">{formatDate(order.approval_date)}</dd>
              </div>
            )}

            {order.purchased_at && (
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Fecha de Compra</dt>
                <dd className="mt-1">{formatDate(order.purchased_at)}</dd>
              </div>
            )}

            {order.notes && (
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Notas</dt>
                <dd className="mt-1">{order.notes}</dd>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt/Comprobante Section - Always show if exists */}
        <ReceiptDisplaySection purchaseOrderId={order.id} poType={order.po_type} />

        {/* Work Order Information */}
        {workOrder && (
          <Card>
            <CardHeader>
              <CardTitle>Orden de Trabajo Relacionada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <dt className="font-medium text-sm text-muted-foreground">ID de Orden</dt>
                <dd className="mt-1">{workOrder.order_id}</dd>
              </div>
              
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Descripción</dt>
                <dd className="mt-1">{workOrder.description}</dd>
              </div>
              
              <div>
                <dt className="font-medium text-sm text-muted-foreground">Estado</dt>
                <dd className="mt-1">
                  <Badge variant="outline">{workOrder.status}</Badge>
                </dd>
              </div>
              
              <div className="pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/ordenes/${workOrder.id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Ver Orden de Trabajo
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Items */}
      {items && items.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Artículos Solicitados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Descripción</th>
                    <th className="text-left p-2">Parte/Código</th>
                    <th className="text-right p-2">Cantidad</th>
                    <th className="text-right p-2">Precio Unitario</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, index: number) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">{item.description || item.item || "Sin descripción"}</td>
                      <td className="p-2">{item.part_number || item.code || "N/A"}</td>
                      <td className="p-2 text-right">{item.quantity || 1}</td>
                      <td className="p-2 text-right">{formatCurrency(item.unit_price?.toString() || item.price?.toString() || "0")}</td>
                      <td className="p-2 text-right">{formatCurrency(item.total_price?.toString() || (item.quantity * (item.unit_price || item.price || 0)).toString())}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Workflow Status Display */}
      {order.po_type && (
        <div className="mt-8">
          <WorkflowStatusDisplay
            purchaseOrderId={order.id}
            poType={order.po_type as PurchaseOrderType}
            currentStatus={order.status}
          />
        </div>
      )}

      {/* Legacy Action Buttons and Receipt Section for old system */}
      {!order.po_type && (
        <>
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {getActionButtons(order)}
              </div>
            </CardContent>
          </Card>
          
          {/* Receipt Section - only for legacy orders */}
          <div className="mt-8">
            <ReceiptSection purchaseOrderId={order.id} isAdjustment={order.is_adjustment || false} />
          </div>
        </>
      )}
    </div>
  )
} 