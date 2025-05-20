import { createClient } from "@/lib/supabase-server"
import { PurchaseOrderStatus } from "@/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, FileCheck, Package, ShoppingCart, Truck, FileText, Download, ExternalLink } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ReactNode, use } from "react"
import { ReceiptSection } from "@/components/work-orders/receipt-section"

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
    .select(`
      *,
      work_order:work_orders (*)
    `)
    .eq("id", id)
    .single();
    
  if (error || !order) {
    notFound();
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
  function getActionButtons(): ReactNode {
    if (!order) return null
    
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

  return (
    <div className="container py-4 md:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Orden de Compra: {order.order_id}</h1>
        <Button variant="outline" size="icon" asChild>
          <Link href="/compras">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Estado</p>
              <Badge variant={getStatusVariant(order.status)} className="mt-1">
                {order.status || 'Pendiente'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Orden de Trabajo</p>
              <p className="font-medium">
                {order.work_order ? (
                  <Link href={`/ordenes/${order.work_order.id}`} className="text-blue-600 hover:underline">
                    {order.work_order.order_id}
                  </Link>
                ) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Solicitada por</p>
              <p className="font-medium">{requesterName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fecha de Creación</p>
              <p className="font-medium">{formatDate(order.created_at, 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Proveedor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nombre del Proveedor</p>
              <p className="font-medium">{order.supplier || 'No especificado'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fecha Estimada de Entrega</p>
              <p className="font-medium">{formatDate(order.expected_delivery_date, 'dd/MM/yyyy')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Notas para el Proveedor</p>
              <p className="font-medium">{order.notes || 'No hay notas'}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Aprobación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Estado de Aprobación</p>
              <Badge
                variant={
                  order.status === PurchaseOrderStatus.Approved || 
                  order.status === PurchaseOrderStatus.Ordered || 
                  order.status === PurchaseOrderStatus.Received 
                    ? "secondary"
                    : order.status === PurchaseOrderStatus.Rejected 
                      ? "destructive" 
                      : "outline"
                }
                className="mt-1"
              >
                {order.status === PurchaseOrderStatus.Approved || 
                 order.status === PurchaseOrderStatus.Ordered || 
                 order.status === PurchaseOrderStatus.Received 
                  ? "Aprobada" 
                  : order.status === PurchaseOrderStatus.Rejected 
                    ? "Rechazada" 
                    : "Pendiente de Aprobación"}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Aprobada por</p>
              <p className="font-medium">{approverName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fecha de Aprobación</p>
              <p className="font-medium">{order.approval_date ? formatDate(order.approval_date, 'dd/MM/yyyy HH:mm') : 'Pendiente'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Comentarios</p>
              <p className="font-medium">{'approval_comments' in order && order.approval_comments ? order.approval_comments : 'No hay comentarios'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* File Viewer Section */}
      {order.quotation_url && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Documentos Adjuntos</CardTitle>
            <CardDescription>
              Archivos relacionados con esta orden de compra
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 border rounded-md bg-slate-50">
                <FileText className="h-8 w-8 text-blue-500" />
                <div className="flex-1">
                  <p className="font-medium">Cotización de Proveedor</p>
                  <p className="text-sm text-muted-foreground">
                    {order.quotation_url.split('/').pop()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={order.quotation_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={order.quotation_url} download>
                      <Download className="h-4 w-4 mr-2" />
                      Descargar
                    </a>
                  </Button>
                </div>
              </div>
              
              {isPdfFile(order.quotation_url) && (
                <div className="border rounded-md p-4 bg-white">
                  <iframe
                    src={`${order.quotation_url}#toolbar=0&navpanes=0`}
                    className="w-full h-[400px] rounded border"
                    title="PDF Viewer"
                  />
                </div>
              )}
              
              {isImageFile(order.quotation_url) && (
                <div className="border rounded-md p-4 bg-white">
                  <img 
                    src={order.quotation_url} 
                    alt="Documento adjunto" 
                    className="max-w-full max-h-[400px] mx-auto rounded" 
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Repuestos Solicitados</CardTitle>
          <CardDescription>
            Monto Total: <span className="font-bold">{formatCurrency(order.total_amount)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repuesto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número de Parte</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Precio Unitario</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items && items.length > 0 ? (
                  items.map((item: any, index: number) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.partNumber || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-right">${item.unit_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">${item.total_price.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                      No hay repuestos registrados para esta orden de compra.
                    </td>
                  </tr>
                )}
                {items && items.length > 0 && (
                  <tr className="bg-gray-50">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-900">Total:</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{formatCurrency(order.total_amount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Add Receipt Section for completed orders */}
      {(order.status === PurchaseOrderStatus.Received || order.is_adjustment) && (
        <ReceiptSection 
          purchaseOrderId={order.id} 
          isAdjustment={Boolean(order.is_adjustment)} 
        />
      )}
      
      <div className="flex justify-end gap-4 mt-6">
        <Button variant="outline" asChild>
          <Link href="/compras">Volver</Link>
        </Button>
        {getActionButtons()}
      </div>
    </div>
  )
} 