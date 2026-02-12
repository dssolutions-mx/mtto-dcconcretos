"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, FileCheck, Package, ShoppingCart, FileText, Download, ExternalLink, 
  Store, Wrench, Building2, Receipt, AlertCircle, DollarSign, Calendar, User,
  Clock, MapPin
} from "lucide-react"
import Link from "next/link"
import { ReactNode } from "react"
import { PurchaseOrderType } from "@/types/purchase-orders"
import { TypeBadge } from "@/components/purchase-orders/shared/TypeBadge"

interface PurchaseOrderDetailsMobileProps {
  order: any
  workOrder: any
  requesterName: string
  approverName: string
  items: any[]
  formatCurrency: (amount: string | null) => string
  formatDate: (dateString: string | null, formatStr?: string) => string
  getActionButtons: (order: any) => ReactNode
  getPurchaseOrderTypeInfo: (poType: string | null) => any
  isImageFile: (url: string) => boolean
  isPdfFile: (url: string) => boolean
}

export function PurchaseOrderDetailsMobile({
  order,
  workOrder,
  requesterName,
  approverName,
  items,
  formatCurrency,
  formatDate,
  getActionButtons,
  getPurchaseOrderTypeInfo,
  isImageFile,
  isPdfFile
}: PurchaseOrderDetailsMobileProps) {
  
  return (
    <div className="container mx-auto px-4 py-4 space-y-4">
      {/* Mobile Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/compras">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold truncate">{order.order_id}</h1>
          {order.po_type && (
            <div className="mt-1">
              <TypeBadge type={order.po_type as PurchaseOrderType} size="sm" />
            </div>
          )}
        </div>
        <div className="w-10" /> {/* Spacer for balance */}
      </div>

      {/* Status Card */}
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Estado Actual</p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="secondary" className="text-sm">
                  {order.status || "Pendiente"}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(order.total_amount)}
              </p>
              {order.actual_amount && (
                <p className="text-sm text-green-600">
                  Real: {formatCurrency(order.actual_amount.toString())}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Building2 className="h-5 w-5 mr-2" />
            Información Principal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Purchase Order Type - only show for enhanced orders */}
          {order.po_type && (
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              {(() => {
                const typeInfo = getPurchaseOrderTypeInfo(order.po_type)
                if (!typeInfo) return <span>{order.po_type}</span>
                
                const Icon = typeInfo.icon
                return (
                  <>
                    <div className={`p-2 rounded-lg ${typeInfo.color.replace('text-', 'bg-').replace('-700', '-100')}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{typeInfo.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {typeInfo.description}
                      </p>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* Supplier/Provider */}
          <div className="flex items-start space-x-3">
            <Store className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                {order.po_type === PurchaseOrderType.DIRECT_SERVICE ? "Proveedor de Servicio" : "Proveedor"}
              </p>
              <p className="text-sm font-medium">
                {order.service_provider || order.supplier || "No especificado"}
              </p>
            </div>
          </div>

          {/* Store Location */}
          {order.store_location && (
            <div className="flex items-start space-x-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Ubicación</p>
                <p className="text-sm">{order.store_location}</p>
              </div>
            </div>
          )}

          {/* Payment Method */}
          {order.payment_method && (
            <div className="flex items-start space-x-3">
              <Receipt className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Forma de Pago</p>
                <p className="text-sm capitalize">{order.payment_method}</p>
              </div>
            </div>
          )}

          {/* Quote Requirement */}
          {order.requires_quote !== undefined && (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Requiere Cotización</p>
              <Badge variant={order.requires_quote ? "default" : "secondary"} className="text-xs">
                {order.requires_quote ? "Sí" : "No"}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* People & Dates Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <User className="h-5 w-5 mr-2" />
            Personas y Fechas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start space-x-3">
            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">Solicitado por</p>
              <p className="text-sm">{requesterName}</p>
            </div>
          </div>

          {order.approved_by && (
            <div className="flex items-start space-x-3">
              <FileCheck className="h-4 w-4 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Aprobado por</p>
                <p className="text-sm">{approverName}</p>
              </div>
            </div>
          )}

          <div className="flex items-start space-x-3">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">Fecha de Creación</p>
              <p className="text-sm">{formatDate(order.created_at)}</p>
            </div>
          </div>

          {/* Purchase Date */}
          {order.purchase_date && (
            <div className="flex items-start space-x-3">
              <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Fecha Planeada de Compra</p>
                <p className="text-sm font-semibold text-blue-600">{formatDate(order.purchase_date)}</p>
              </div>
            </div>
          )}

          {order.approval_date && (
            <div className="flex items-start space-x-3">
              <Clock className="h-4 w-4 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Fecha de Aprobación</p>
                <p className="text-sm">{formatDate(order.approval_date)}</p>
              </div>
            </div>
          )}

          {order.purchased_at && (
            <div className="flex items-start space-x-3">
              <ShoppingCart className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Fecha de Compra</p>
                <p className="text-sm">{formatDate(order.purchased_at)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work Order Card */}
      {workOrder && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Wrench className="h-5 w-5 mr-2" />
              Orden de Trabajo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">ID de Orden</p>
              <p className="text-sm font-medium">{workOrder.order_id}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-muted-foreground">Descripción</p>
              <p className="text-sm">{workOrder.description}</p>
            </div>
            
            <div>
              <p className="text-xs font-medium text-muted-foreground">Estado</p>
              <Badge variant="outline" className="text-xs">{workOrder.status}</Badge>
            </div>
            
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/ordenes/${workOrder.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver Orden de Trabajo
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quotation Card */}
      {order.po_type && (order.quotation_url || order.requires_quote) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Cotización</span>
              {order.requires_quote && (
                <Badge variant={order.quotation_url ? "default" : "destructive"} className="text-xs">
                  {order.quotation_url ? "Completada" : "Requerida"}
                </Badge>
              )}
            </CardTitle>
            {order.requires_quote && (
              <CardDescription className="text-sm">
                {order.po_type === PurchaseOrderType.DIRECT_SERVICE
                  ? `Esta orden de servicio por ${formatCurrency(order.total_amount)} requiere cotización por ser mayor o igual a $5,000 MXN`
                  : "Esta orden requiere cotización antes de ser aprobada"
                }
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {order.quotation_url ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-green-600 bg-green-50 text-xs">
                    <FileCheck className="h-3 w-3 mr-1" />
                    Cotización Disponible
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a 
                      href={order.quotation_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center space-x-1"
                    >
                      <Download className="h-4 w-4" />
                      <span>Descargar</span>
                    </a>
                  </Button>
                  
                  <Button asChild variant="secondary" size="sm">
                    <a 
                      href={order.quotation_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center space-x-1"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Ver</span>
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="rounded-full bg-yellow-100 p-3 mx-auto w-12 h-12 flex items-center justify-center mb-4">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
                <h4 className="font-medium mb-2">Cotización Pendiente</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Esta orden requiere cotización antes de poder ser aprobada.
                </p>
                <Badge variant="destructive" className="text-xs">Pendiente de Cotización</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes Card */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Items Card */}
      {items && items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {order.po_type === PurchaseOrderType.DIRECT_SERVICE 
                ? "Servicios Solicitados" 
                : order.po_type === PurchaseOrderType.DIRECT_PURCHASE 
                ? "Productos Solicitados"
                : "Artículos Solicitados"
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Direct Service Display */}
              {order.po_type === PurchaseOrderType.DIRECT_SERVICE ? (
                items.map((service: any, index: number) => (
                  <div key={index} className="p-3 border rounded-lg space-y-2">
                    <div>
                      <p className="font-medium text-sm">{service.description || "Sin descripción"}</p>
                      {service.specialist_required && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          Especialista Requerido
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-muted-foreground">Categoría</p>
                        <p>{service.category || "General"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Horas Est.</p>
                        <p>{service.estimated_hours ? `${Number(service.estimated_hours).toFixed(1)}h` : "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tarifa/Hora</p>
                        <p>{formatCurrency(service.hourly_rate?.toString() || "0")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-semibold">{formatCurrency(service.total_cost?.toString() || "0")}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                /* Generic Items Display - with Fuente badge when inventory/purchase mix */
                items.map((item: any, index: number) => {
                  const isInventory = item._source === 'inventory' || item.fulfill_from === 'inventory'
                  return (
                    <div key={index} className={`p-3 border rounded-lg space-y-2 ${isInventory ? 'bg-green-50/50 border-green-200' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{item.description || item.item || item.name || "Sin descripción"}</p>
                        {isInventory ? (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 shrink-0">De Inventario</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-orange-700 shrink-0">A Comprar</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-muted-foreground">Código</p>
                          <p>{item.part_number || item.partNumber || item.code || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cantidad</p>
                          <p>{item.quantity || 1}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Precio Unit.</p>
                          <p>{isInventory ? 'N/A' : formatCurrency(item.unit_price?.toString() || item.price?.toString() || "0")}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className={`font-semibold ${isInventory ? 'text-green-700' : ''}`}>
                            {formatCurrency(item.total_price?.toString() || (item.quantity * (item.unit_price || item.price || 0)).toString())}
                            {isInventory && <span className="text-muted-foreground font-normal ml-1">(sin impacto efectivo)</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {getActionButtons(order) && (
              <div className="flex flex-col gap-3">
                {getActionButtons(order)}
              </div>
            )}
            
            {/* Always show "Ver Detalles Completos" button */}
            <Button asChild variant="outline" className="w-full">
              <Link href={`/compras/${order.id}?view=desktop`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver Detalles Completos
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 