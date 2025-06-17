import { createClient } from "@/lib/supabase-server"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Receipt, ExternalLink, Download, Search, Calendar, DollarSign, Eye } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

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
    return format(date, 'dd/MM/yyyy HH:mm', { locale: es })
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

// Helper function to get status badge
function getStatusBadge(status: string) {
  const statusConfig = {
    'receipt_uploaded': { label: 'Por Validar', color: 'bg-yellow-100 text-yellow-800' },
    'validated': { label: 'Validado', color: 'bg-green-100 text-green-800' },
    'approved': { label: 'Aprobado', color: 'bg-blue-100 text-blue-800' }
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || 
                 { label: status, color: 'bg-gray-100 text-gray-800' };
  
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  );
}

export default async function ComprobantesList() {
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

  // Transform the data to have the expected structure
  const ordersWithReceipts: OrderWithReceipt[] = receiptsData?.map((receipt: any) => ({
    ...(receipt.purchase_orders as any),
    receipt_url: receipt.file_url,
    receipt_id: receipt.id,
    receipt_expense_type: receipt.expense_type,
    receipt_description: receipt.description,
    receipt_date: receipt.receipt_date
  })) || [];

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

  // Get user names for requesters and approvers
  const userIds = [...new Set([
    ...ordersWithReceipts.map(order => order.requested_by),
    ...ordersWithReceipts.map(order => order.approved_by)
  ].filter(Boolean))];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nombre, apellido')
    .in('id', userIds);

  const userMap = profiles?.reduce((acc, profile) => {
    acc[profile.id] = `${profile.nombre || ''} ${profile.apellido || ''}`.trim();
    return acc;
  }, {} as Record<string, string>) || {};

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
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-blue-50">
            <Receipt className="h-4 w-4 mr-1" />
            {ordersWithReceipts.length} comprobantes
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ID, proveedor, notas..."
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Orden</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="direct_purchase">Compra Directa</SelectItem>
                  <SelectItem value="direct_service">Servicio Directo</SelectItem>
                  <SelectItem value="special_order">Pedido Especial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="receipt_uploaded">Por Validar</SelectItem>
                  <SelectItem value="validated">Validado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Todo el tiempo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el tiempo</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Comprobantes</p>
                <p className="text-2xl font-bold">{ordersWithReceipts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Por Validar</p>
                <p className="text-2xl font-bold">
                  {ordersWithReceipts.filter(order => order.status === 'receipt_uploaded').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Validados</p>
                <p className="text-2xl font-bold">
                  {ordersWithReceipts.filter(order => order.status === 'validated').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monto Total</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    ordersWithReceipts.reduce((sum, order) => 
                      sum + Number(order.actual_amount || order.total_amount || 0), 0
                    )
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Receipts List */}
      <div className="space-y-4">
        {ordersWithReceipts.map((order) => (
          <Card key={order.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Order Info */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-semibold text-lg">{order.order_id}</p>
                      {getTypeBadge(order.po_type)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.supplier}
                    </p>
                    {(order.store_location || order.service_provider) && (
                      <p className="text-xs text-muted-foreground">
                        {order.store_location || order.service_provider}
                      </p>
                    )}
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

                  {/* Status & Date */}
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {formatDate(order.purchased_at)}
                    </p>
                  </div>

                  {/* Users */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Personal</p>
                    <p className="text-xs text-muted-foreground">
                      Solicitó: {userMap[order.requested_by] || 'N/A'}
                    </p>
                    {order.approved_by && (
                      <p className="text-xs text-muted-foreground">
                        Aprobó: {userMap[order.approved_by] || 'N/A'}
                      </p>
                    )}
                  </div>

                  {/* Receipt */}
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

              {/* Notes if available */}
              {order.notes && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    <strong>Notas:</strong> {order.notes}
                  </p>
                </div>
              )}
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