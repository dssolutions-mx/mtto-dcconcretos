"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Calendar, CheckCircle, CreditCard, DollarSign, Receipt, Clock, Building2, Store, Wrench, Filter, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AccountsPayableItem, AccountsPayableResponse, PaymentStatus, PaymentMethod, MarkAsPaidRequest } from "@/types/purchase-orders"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

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

// Helper function to get payment status badge
function getPaymentStatusBadge(status: string, daysUntilDue: number) {
  switch (status) {
    case 'Pagado':
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Pagado</Badge>
    case 'Vencido':
      return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Vencido</Badge>
    case 'Pendiente':
      if (daysUntilDue === 0) {
        return <Badge className="bg-orange-100 text-orange-800"><Clock className="h-3 w-3 mr-1" />Vence Hoy</Badge>
      } else if (daysUntilDue <= 7) {
        return <Badge className="bg-yellow-100 text-yellow-800"><Calendar className="h-3 w-3 mr-1" />Vence en {daysUntilDue}d</Badge>
      } else {
        return <Badge className="bg-blue-100 text-blue-800"><Calendar className="h-3 w-3 mr-1" />Pendiente</Badge>
      }
    case 'Inmediato':
      return <Badge className="bg-green-100 text-green-800"><CreditCard className="h-3 w-3 mr-1" />Inmediato</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// Helper function to get type icon
function getTypeIcon(poType: string) {
  switch (poType) {
    case 'direct_purchase':
      return <Store className="h-4 w-4" />
    case 'direct_service':
      return <Wrench className="h-4 w-4" />
    case 'special_order':
      return <Building2 className="h-4 w-4" />
    default:
      return <Receipt className="h-4 w-4" />
  }
}

interface MarkAsPaidDialogProps {
  item: AccountsPayableItem
  onPaid: () => void
}

function MarkAsPaidDialog({ item, onPaid }: MarkAsPaidDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_reference: '',
    payment_notes: ''
  })

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const request: MarkAsPaidRequest = {
        purchase_order_id: item.id,
        payment_date: formData.payment_date,
        payment_reference: formData.payment_reference || undefined,
        payment_notes: formData.payment_notes || undefined
      }

      const response = await fetch('/api/purchase-orders/mark-as-paid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      })

      const result = await response.json()

      if (result.success) {
        toast.success(result.message)
        setOpen(false)
        onPaid()
      } else {
        toast.error(result.error || 'Error al marcar como pagado')
      }
    } catch (error) {
      console.error('Error marking as paid:', error)
      toast.error('Error al marcar como pagado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-green-600 hover:bg-green-700">
          <CheckCircle className="h-4 w-4 mr-1" />
          Marcar como Pagado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Marcar como Pagado</DialogTitle>
          <DialogDescription>
            Orden: {item.order_id} - {item.supplier}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Monto a Pagar</Label>
              <p className="text-lg font-semibold text-green-600">
                {formatCurrency(item.actual_amount || item.total_amount)}
              </p>
            </div>
            <div>
              <Label>Método de Pago</Label>
              <p>{item.payment_method === 'transfer' ? 'Transferencia' : item.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="payment_date">Fecha de Pago *</Label>
            <Input
              id="payment_date"
              type="date"
              value={formData.payment_date}
              onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div>
            <Label htmlFor="payment_reference">Referencia de Pago</Label>
            <Input
              id="payment_reference"
              placeholder="Número de transferencia, cheque, etc."
              value={formData.payment_reference}
              onChange={(e) => setFormData(prev => ({ ...prev, payment_reference: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="payment_notes">Notas del Pago</Label>
            <Textarea
              id="payment_notes"
              placeholder="Comentarios adicionales sobre el pago..."
              value={formData.payment_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, payment_notes: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.payment_date}>
            {loading ? 'Procesando...' : 'Confirmar Pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AccountsPayableView() {
  const [data, setData] = useState<AccountsPayableResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async (filter?: string) => {
    try {
      setRefreshing(true)
      const params = new URLSearchParams()
      
      if (filter && filter !== 'all') {
        if (filter === 'overdue') {
          params.append('days_filter', 'overdue')
        } else if (filter === 'today') {
          params.append('days_filter', 'today')
        } else if (filter === 'week') {
          params.append('days_filter', 'week')
        } else {
          params.append('status', filter)
        }
      }

      const response = await fetch(`/api/purchase-orders/accounts-payable?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast.error('Error al cargar cuentas por pagar')
      }
    } catch (error) {
      console.error('Error fetching accounts payable:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData(activeFilter)
  }, [activeFilter])

  const handleRefresh = () => {
    fetchData(activeFilter)
  }

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Cargando cuentas por pagar...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-red-600">Error al cargar las cuentas por pagar</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-end">
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                <div className="flex items-center space-x-2">
                  <p className="text-2xl font-bold">{data.summary.total_pending}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(data.summary.total_amount_pending)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vencidos</p>
                <div className="flex items-center space-x-2">
                  <p className="text-2xl font-bold text-red-600">{data.summary.total_overdue}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(data.summary.total_amount_overdue)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Esta Semana</p>
                <p className="text-2xl font-bold">{data.summary.items_due_this_week}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Hoy</p>
                <p className="text-2xl font-bold">{data.summary.items_due_today}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Tabs value={activeFilter} onValueChange={handleFilterChange}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="overdue">Vencidos</TabsTrigger>
          <TabsTrigger value="today">Hoy</TabsTrigger>
          <TabsTrigger value="week">Esta Semana</TabsTrigger>
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
          <TabsTrigger value="paid">Pagados</TabsTrigger>
        </TabsList>

        <TabsContent value={activeFilter} className="space-y-4">
          {data.items.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                  No hay elementos para mostrar con los filtros aplicados
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {data.items.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Order Info */}
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            {getTypeIcon(item.po_type)}
                            <p className="font-semibold">{item.order_id}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.supplier}
                          </p>
                          {item.service_provider && (
                            <p className="text-xs text-muted-foreground">
                              Servicio: {item.service_provider}
                            </p>
                          )}
                          {item.store_location && (
                            <p className="text-xs text-muted-foreground">
                              Tienda: {item.store_location}
                            </p>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Monto</p>
                          <p className="text-lg font-semibold text-green-600">
                            {formatCurrency(item.actual_amount || item.total_amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.payment_method === 'transfer' ? 'Transferencia' : 
                             item.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}
                          </p>
                        </div>

                        {/* Payment Status */}
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Estado</p>
                          {getPaymentStatusBadge(item.payment_status_display, item.days_until_due)}
                          {item.max_payment_date && (
                            <p className="text-xs text-muted-foreground">
                              Vence: {formatDate(item.max_payment_date)}
                            </p>
                          )}
                        </div>

                        {/* Dates */}
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Fechas</p>
                          <p className="text-xs text-muted-foreground">
                            Creada: {formatDate(item.created_at)}
                          </p>
                          {item.purchased_at && (
                            <p className="text-xs text-muted-foreground">
                              Comprada: {formatDate(item.purchased_at)}
                            </p>
                          )}
                          {item.payment_date && (
                            <p className="text-xs text-green-600">
                              Pagada: {formatDate(item.payment_date)}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col space-y-2">
                          {item.payment_status_display !== 'Pagado' && (
                            <MarkAsPaidDialog item={item} onPaid={handleRefresh} />
                          )}
                          {item.payment_date && item.paid_by_name && (
                            <div className="text-xs text-muted-foreground">
                              <p>Pagado por:</p>
                              <p className="font-medium">{item.paid_by_name}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 