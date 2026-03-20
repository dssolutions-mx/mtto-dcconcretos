"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft, FileCheck, Package, ShoppingCart, FileText, ExternalLink,
  Store, Wrench, Building2, Receipt, DollarSign, Calendar, User,
  Clock, MapPin, ChevronDown
} from "lucide-react"
import Link from "next/link"
import { ReactNode } from "react"
import { PurchaseOrderType } from "@/types/purchase-orders"
import { TypeBadge } from "@/components/purchase-orders/shared/TypeBadge"
import {
  WorkflowStatusDisplay,
  type POFulfillmentHints,
} from "@/components/purchase-orders/workflow/WorkflowStatusDisplay"
import { QuotationComparisonManager } from "@/components/purchase-orders/quotations/QuotationComparisonManager"
import { ReceiptDisplaySection } from "@/components/purchase-orders/ReceiptDisplaySection"
import { POInventoryActions } from "@/components/purchase-orders/inventory-actions"
import { EditPOButton } from "@/components/purchase-orders/EditPOButton"
import { getPOStatusLabel } from "@/lib/purchase-orders/status-labels"

interface PurchaseOrderDetailsMobileProps {
  order: any
  workOrder: any
  requesterName: string
  approverName: string
  authorizerName?: string | null
  items: any[]
  formatCurrency: (amount: string | null) => string
  formatDate: (dateString: string | null, formatStr?: string) => string
  getActionButtons: (order: any) => ReactNode
  getPurchaseOrderTypeInfo: (poType: string | null) => any
  isImageFile: (url: string) => boolean
  isPdfFile: (url: string) => boolean
  fulfillmentHints?: POFulfillmentHints | null
}

export function PurchaseOrderDetailsMobile({
  order,
  workOrder,
  requesterName,
  approverName,
  authorizerName,
  items,
  formatCurrency,
  formatDate,
  getActionButtons,
  getPurchaseOrderTypeInfo,
  isImageFile,
  isPdfFile,
  fulfillmentHints,
}: PurchaseOrderDetailsMobileProps) {
  
  return (
    <div className="container mx-auto px-4 md:px-6 py-5 md:py-6 space-y-6 md:space-y-8">
      {/* Mobile Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="icon" asChild>
          <Link href="/compras">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 text-center min-w-0">
          <h1 className="text-xl font-bold truncate">{order.order_id}</h1>
          {order.po_type && (
            <div className="mt-1">
              <TypeBadge type={order.po_type as PurchaseOrderType} size="sm" />
            </div>
          )}
        </div>
        {order.status !== "validated" ? (
          <div className="shrink-0">
            <EditPOButton
              compact
              id={order.id}
              initialData={{
                supplier: order.supplier,
                total_amount: order.total_amount ? Number(order.total_amount) : 0,
                payment_method: order.payment_method,
                notes: order.notes,
                store_location: order.store_location,
                service_provider: order.service_provider,
                quotation_url: order.quotation_url,
                purchase_date: order.purchase_date,
                max_payment_date: order.max_payment_date,
                items: (() => {
                  const raw = typeof order.items === "string" ? JSON.parse(order.items) : order.items
                  return Array.isArray(raw) ? raw : []
                })(),
              }}
            />
          </div>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Status Card - simplified for legacy; enhanced POs use WorkflowStatusDisplay below */}
      {!order.po_type && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Estado Actual</p>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="secondary" className="text-sm">
                    {getPOStatusLabel(order.status)}
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
      )}

      {/* Resumen Card */}
      <Card>
        <CardHeader className="p-5 md:p-6">
          <CardTitle className="text-lg flex items-center">
            <Building2 className="h-5 w-5 mr-2" />
            Resumen
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 md:p-6 pt-0 space-y-4">
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
            <Store className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {order.po_type === PurchaseOrderType.DIRECT_SERVICE ? "Proveedor de Servicio" : "Proveedor"}
              </p>
              <p className="text-sm font-medium truncate">
                {order.service_provider || order.supplier || "No especificado"}
              </p>
            </div>
          </div>

          {/* Amount */}
          <div className="flex items-start space-x-3">
            <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-muted-foreground">Monto Total</p>
              <p className="text-sm font-semibold">{formatCurrency(order.total_amount)}</p>
              {order.actual_amount && (
                <p className="text-xs text-green-600 mt-0.5">
                  Real: {formatCurrency(order.actual_amount.toString())}
                </p>
              )}
            </div>
          </div>

          {/* Store Location */}
          {order.store_location && (
            <div className="flex items-start space-x-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Ubicación</p>
                <p className="text-sm">{order.store_location}</p>
              </div>
            </div>
          )}

          {/* Payment Method */}
          {order.payment_method && (
            <div className="flex items-start space-x-3">
              <Receipt className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
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

          {/* Historial - Collapsible (default closed on mobile) */}
          <Collapsible defaultOpen={false} className="mt-4 pt-4 border-t">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Historial de la orden
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-4 pt-4">
                <div className="flex items-start space-x-3">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground">Solicitado por</p>
                    <p className="text-sm">{requesterName}</p>
                  </div>
                </div>

                {authorizerName && (
                  <div className="flex items-start space-x-3">
                    <FileCheck className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground">Validación técnica</p>
                      <p className="text-sm">{authorizerName}</p>
                    </div>
                  </div>
                )}

                {order.viability_state && order.viability_state !== 'not_required' && (
                  <div className="flex items-start space-x-3">
                    <FileCheck className={`h-4 w-4 mt-0.5 shrink-0 ${order.viability_state === 'viable' ? 'text-green-600' : order.viability_state === 'not_viable' ? 'text-destructive' : 'text-amber-600'}`} />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground">Viabilidad administrativa</p>
                      <p className="text-sm">
                        {order.viability_state === 'viable' ? 'Viable' : order.viability_state === 'not_viable' ? 'No viable' : 'Pendiente'}
                      </p>
                    </div>
                  </div>
                )}

                {order.approved_by && (
                  <div className="flex items-start space-x-3">
                    <FileCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground">Aprobado por</p>
                      <p className="text-sm">{approverName}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start space-x-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground">Fecha de Creación</p>
                    <p className="text-sm">{formatDate(order.created_at)}</p>
                  </div>
                </div>

                {order.purchase_date && (
                  <div className="flex items-start space-x-3">
                    <Calendar className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground">Fecha Planeada de Compra</p>
                      <p className="text-sm font-semibold text-blue-600">{formatDate(order.purchase_date)}</p>
                    </div>
                  </div>
                )}

                {order.approval_date && (
                  <div className="flex items-start space-x-3">
                    <Clock className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground">Fecha de Aprobación</p>
                      <p className="text-sm">{formatDate(order.approval_date)}</p>
                    </div>
                  </div>
                )}

                {order.purchased_at && (
                  <div className="flex items-start space-x-3">
                    <ShoppingCart className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground">Fecha de Compra</p>
                      <p className="text-sm">{formatDate(order.purchased_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Workflow - collapsible, after Resumen */}
      {order.po_type && (
        <Card>
          <Collapsible defaultOpen={order.status === 'pending_approval'}>
            <CollapsibleTrigger asChild>
              <CardHeader className="p-5 md:p-6 pb-2 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg group/trigger">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center">
                      <Clock className="h-5 w-5 mr-2" />
                      Workflow y acciones
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Estado: {getPOStatusLabel(order.status)}
                    </CardDescription>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/trigger:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-5 md:p-6 pt-0">
                <WorkflowStatusDisplay
                  purchaseOrderId={order.id}
                  poType={order.po_type as PurchaseOrderType}
                  currentStatus={order.status}
                  totalAmount={Number(order.approval_amount) > 0 ? order.approval_amount : order.total_amount}
                  workOrderType={order.work_order_type}
                  fulfillmentHints={fulfillmentHints}
                />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Quotation - collapsible, form in modal */}
      {order.po_type && order.po_purpose !== 'work_order_inventory' && (
        <Card>
          <Collapsible defaultOpen={!order.selected_quotation_id}>
            <CollapsibleTrigger asChild>
              <CardHeader className="p-5 md:p-6 pb-2 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg group/trigger">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Cotización
                    </CardTitle>
                    {order.requires_quote && !order.selected_quotation_id && (
                      <CardDescription className="text-sm mt-1">
                        {order.po_type === PurchaseOrderType.DIRECT_SERVICE
                          ? "Requiere cotización (≥ $5,000 MXN)"
                          : "Requiere cotización antes de aprobar"
                        }
                      </CardDescription>
                    )}
                    {order.selected_quotation_id && (
                      <CardDescription className="text-sm mt-1 text-green-700">
                        Toca para ver detalles
                      </CardDescription>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/trigger:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-5 md:p-6 pt-0">
                <QuotationComparisonManager
                  purchaseOrderId={order.id}
                  workOrderId={order.work_order_id}
                  quotationSelectionRequired={order.quotation_selection_required || false}
                  quotationSelectionStatus={order.quotation_selection_status}
                  poPurpose={order.po_purpose}
                  className="space-y-4"
                />
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Work Order Card */}
      {workOrder && (
        <Card>
          <CardHeader className="p-5 md:p-6">
            <CardTitle className="text-lg flex items-center">
              <Wrench className="h-5 w-5 mr-2" />
              Orden de Trabajo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 md:p-6 pt-0 space-y-4">
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

      {/* Notes Card */}
      {order.notes && (
        <Card>
          <CardHeader className="p-5 md:p-6">
            <CardTitle className="text-lg">Notas</CardTitle>
          </CardHeader>
          <CardContent className="p-5 md:p-6 pt-0">
            <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Items Card */}
      {items && items.length > 0 && (
        <Card>
          <CardHeader className="p-5 md:p-6">
            <CardTitle className="text-lg">
              {order.po_type === PurchaseOrderType.DIRECT_SERVICE 
                ? "Servicios Solicitados" 
                : order.po_type === PurchaseOrderType.DIRECT_PURCHASE 
                ? "Productos Solicitados"
                : "Artículos Solicitados"
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 md:p-6 pt-0">
            <div className="space-y-4">
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
                            {isInventory && <span className="text-muted-foreground font-normal ml-1">(desde almacén)</span>}
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

      {/* Receipts - after approval */}
      {order.po_type &&
       order.status &&
       ['approved', 'purchased', 'receipt_uploaded', 'completed', 'validated'].includes(order.status) && (
        <ReceiptDisplaySection purchaseOrderId={order.id} poType={order.po_type} />
      )}

      {/* Inventory actions - when PO has catalog items */}
      {order.po_type && items && items.some((item: any) => item.part_id || item.partNumber) && (
        <Card id="po-gestion-inventario" className="rounded-2xl border border-border/60 scroll-mt-24">
          <CardHeader className="p-5 md:p-6">
            <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Gestión de inventario
            </CardTitle>
            <CardDescription className="text-sm">
              Recibir mercancía al almacén o registrar surtido desde existencias (según la orden).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 md:p-6 pt-0">
            <div className="flex flex-col gap-3">
              <POInventoryActions
                purchaseOrderId={order.id}
                receivedToInventory={order.received_to_inventory || false}
                inventoryFulfilled={order.inventory_fulfilled || false}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons - legacy POs only; enhanced POs use workflow card above */}
      {getActionButtons(order) && (
        <Card>
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col gap-3">
              {getActionButtons(order)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 