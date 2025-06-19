import type { Metadata } from "next"
import { createClient } from "@/lib/supabase-server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Receipt, ExternalLink, Download, Eye } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export const metadata: Metadata = {
  title: "Comprobantes | Sistema de Gestión de Mantenimiento",
  description: "Revisión y control de comprobantes de órdenes de compra",
}

interface OrderWithReceipt {
  id: string;
  order_id: string;
  supplier: string;
  total_amount: string;
  actual_amount: string | null;
  status: string;
  po_type: string;
  purchased_at: string | null;
  created_at: string;
  requested_by: string;
  approved_by: string | null;
  store_location: string | null;
  service_provider: string | null;
  notes: string | null;
  receipt_url: string;
  receipt_id: string;
  receipt_expense_type: string;
  receipt_description: string | null;
  receipt_date: string | null;
}

// Helper function to format currency
function formatCurrency(amount: string | number | null): string {
  if (!amount) return "$0.00"
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(amount))
}

// Helper function to format date
function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return format(date, 'dd/MM/yyyy', { locale: es })
  } catch (error) {
    return dateString
  }
}

// Helper function to get file extension from URL
function getFileExtension(url: string): string {
  if (!url) return '';
  return url.split('.').pop()?.toLowerCase() || '';
}

// Helper function to check if a file is a PDF
function isPdfFile(url: string): boolean {
  return getFileExtension(url) === 'pdf';
}

// Helper function to get type badge
function getTypeBadge(poType: string | null) {
  if (!poType) return null;
  
  const typeConfig = {
    'direct_purchase': { label: 'Compra Directa', color: 'bg-blue-100 text-blue-800' },
    'direct_service': { label: 'Servicio Directo', color: 'bg-green-100 text-green-800' },
    'special_order': { label: 'Pedido Especial', color: 'bg-purple-100 text-purple-800' }
  };
  
  const config = typeConfig[poType as keyof typeof typeConfig];
  if (!config) return null;
  
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  );
}

async function ComprobantesListContent() {
  const supabase = await createClient();
  
  // Get all purchase order receipts with order details
  const { data: receiptsData, error } = await supabase
    .from('purchase_order_receipts')
    .select(`
      id,
      file_url,
      expense_type,
      description,
      receipt_date,
      created_at,
      purchase_orders!inner (
        id,
        order_id,
        supplier,
        total_amount,
        actual_amount,
        status,
        po_type,
        purchased_at,
        created_at,
        requested_by,
        approved_by,
        store_location,
        service_provider,
        notes
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders with receipts:', error);
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-red-600">Error al cargar los comprobantes</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Transform the data to have the expected structure and remove duplicates
  const transformedData = receiptsData?.map((receipt: any) => ({
    ...(receipt.purchase_orders as any),
    receipt_url: receipt.file_url,
    receipt_id: receipt.id,
    receipt_expense_type: receipt.expense_type,
    receipt_description: receipt.description,
    receipt_date: receipt.receipt_date
  })) || [];

  // Remove duplicates by receipt_id
  const ordersWithReceipts: OrderWithReceipt[] = transformedData.filter((order, index, self) => 
    index === self.findIndex(o => o.receipt_id === order.receipt_id)
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comprobantes Subidos</h1>
          <p className="text-muted-foreground">
            Revisión y control de todos los comprobantes de órdenes de compra
          </p>
        </div>
        <Badge variant="outline" className="bg-blue-50">
          <Receipt className="h-4 w-4 mr-1" />
          {ordersWithReceipts.length} comprobantes
        </Badge>
      </div>

      {/* Receipts List */}
      <div className="space-y-4">
        {ordersWithReceipts.map((order) => (
          <Card key={order.receipt_id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Order Info */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-semibold text-lg">{order.order_id}</p>
                      {getTypeBadge(order.po_type)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.supplier}
                    </p>
                  </div>

                  {/* Amounts */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Montos</p>
                    <p className="text-sm text-muted-foreground">
                      Estimado: {formatCurrency(order.total_amount)}
                    </p>
                    {order.actual_amount && (
                      <p className="text-sm font-semibold text-green-600">
                        Real: {formatCurrency(order.actual_amount)}
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Fecha</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.purchased_at)}
                    </p>
                  </div>

                  {/* Receipt Type */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Comprobante</p>
                    <div className="flex items-center space-x-1">
                      <div className="flex-shrink-0">
                        {isPdfFile(order.receipt_url) ? (
                          <FileText className="h-5 w-5 text-red-500" />
                        ) : (
                          <FileText className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {isPdfFile(order.receipt_url) ? 'PDF' : 'Imagen'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col space-y-2 ml-4">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/compras/${order.id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      Ver Orden
                    </Link>
                  </Button>
                  
                  <Button asChild variant="outline" size="sm">
                    <a 
                      href={order.receipt_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Ver Comprobante
                    </a>
                  </Button>
                  
                  <Button asChild variant="outline" size="sm">
                    <a 
                      href={order.receipt_url} 
                      download={`comprobante_${order.order_id}.${getFileExtension(order.receipt_url)}`}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Descargar
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {ordersWithReceipts.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay comprobantes subidos</h3>
              <p className="text-muted-foreground">
                Los comprobantes aparecerán aquí una vez que se suban en las órdenes de compra.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function ComprobantesList() {
  return <ComprobantesListContent />;
} 