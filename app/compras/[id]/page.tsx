import { createClient } from "@/lib/supabase-server"
import { PurchaseOrderType, EnhancedPOStatus } from "@/types/purchase-orders"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft, FileText, ShoppingCart, Package,
  ExternalLink, Store, Wrench, Building2, Warehouse,
  User, Calendar, FileCheck, Receipt
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { use, Suspense } from "react"
import {
  WorkflowStatusDisplay,
  type POFulfillmentHints,
} from "@/components/purchase-orders/workflow/WorkflowStatusDisplay"
import { TypeBadge } from "@/components/purchase-orders/shared/TypeBadge"
import { ReceiptDisplaySection } from "@/components/purchase-orders/ReceiptDisplaySection"
import { PurchaseOrderDetailsRouter } from "@/components/purchase-orders/purchase-order-details-router"
import { PurchaseOrderWorkOrderLink } from "@/components/purchase-orders/purchase-order-work-order-link"
import { EditPOButton } from "@/components/purchase-orders/EditPOButton"
import { QuotationComparisonManager } from "@/components/purchase-orders/quotations/QuotationComparisonManager"
import { ReportIssueButton } from "@/components/purchase-orders/ReportIssueButton"
import { POInventoryActions } from "@/components/purchase-orders/inventory-actions"
import { POLifecycleStrip } from "@/components/purchase-orders/details/po-lifecycle-strip"
import { POContextBand } from "@/components/purchase-orders/details/po-context-band"
import { ReceiptSection } from "@/components/work-orders/receipt-section"

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { getPOStatusLabel } from "@/lib/purchase-orders/status-labels"

function formatCurrency(amount: string | null | number): string {
  if (amount === null || amount === undefined || amount === "") return "$0.00"
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(amount))
}

function formatDate(dateString: string | null, formatStr = "PP"): string {
  if (!dateString) return "N/A"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return format(date, formatStr, { locale: es })
  } catch {
    return dateString
  }
}

function getStatusBadgeVariant(
  status: string | null
): "outline" | "secondary" | "default" | "destructive" {
  switch (status) {
    case EnhancedPOStatus.PENDING_APPROVAL:
      return "outline"
    case EnhancedPOStatus.APPROVED:
      return "secondary"
    case EnhancedPOStatus.ORDERED:
    case EnhancedPOStatus.PURCHASED:
    case EnhancedPOStatus.RECEIVED:
    case EnhancedPOStatus.RECEIPT_UPLOADED:
    case EnhancedPOStatus.VALIDATED:
    case EnhancedPOStatus.FULFILLED:
      return "default"
    case EnhancedPOStatus.REJECTED:
      return "destructive"
    default:
      return "outline"
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export default function PurchaseOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <PurchaseOrderDetailsContent id={id} />
}

// ─── Server component (data fetching) ────────────────────────────────────────

async function PurchaseOrderDetailsContent({ id }: { id: string }) {
  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !order) notFound()

  // Work order + asset
  let workOrder: any = null
  if (order.work_order_id) {
    const { data } = await supabase
      .from("work_orders")
      .select(`*, asset:assets(id, name, asset_id, location)`)
      .eq("id", order.work_order_id)
      .single()
    if (data) workOrder = data
  }

  // Items
  const rawItems =
    typeof order.items === "string" ? JSON.parse(order.items) : order.items
  const poItems = Array.isArray(rawItems) ? rawItems : []

  // Quotation items
  let quotationItems: any[] = []
  if (order.selected_quotation_id) {
    const { data: q } = await supabase
      .from("purchase_order_quotations")
      .select("quotation_items")
      .eq("id", order.selected_quotation_id)
      .single()
    if (q?.quotation_items) {
      quotationItems = Array.isArray(q.quotation_items)
        ? q.quotation_items
        : typeof q.quotation_items === "string"
        ? JSON.parse(q.quotation_items)
        : []
    }
  }

  const hasInventoryItems = poItems.some((i: any) => i.fulfill_from === "inventory")
  const hasQuotationItems = quotationItems.length > 0
  const inventoryItems = poItems.filter((i: any) => i.fulfill_from === "inventory")
  const purchaseItemsFromPO = poItems.filter((i: any) => i.fulfill_from !== "inventory")
  const purchaseItems = hasQuotationItems
    ? quotationItems.map((q: any) => ({
        name: q.description,
        description: q.description,
        part_number: q.part_number,
        quantity: q.quantity,
        unit_price: q.unit_price,
        total_price: q.total_price,
        _source: "quotation" as const,
      }))
    : purchaseItemsFromPO.map((i: any) => ({ ...i, _source: "po" as const }))

  const items = [
    ...inventoryItems.map((i: any) => ({ ...i, _source: "inventory" as const })),
    ...purchaseItems,
  ]

  const workflowFulfillmentHints: POFulfillmentHints = {
    poPurpose: order.po_purpose ?? null,
    inventoryFulfilled: !!order.inventory_fulfilled,
    receivedToInventory: !!order.received_to_inventory,
    hasInventoryLines: hasInventoryItems,
    hasPurchaseLines: purchaseItems.length > 0,
  }

  // People
  const fetchName = async (userId: string | null): Promise<string | null> => {
    if (!userId) return null
    const { data } = await supabase
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", userId)
      .single()
    return data?.nombre
      ? `${data.nombre} ${data.apellido ?? ""}`.trim()
      : null
  }

  const [requesterName, authorizerName, approverName] = await Promise.all([
    fetchName(order.requested_by),
    fetchName(order.authorized_by),
    fetchName(order.approved_by),
  ])

  // ── Desktop layout ─────────────────────────────────────────────────────────
  const hasCatalogItems = items.some((i: any) => i.part_id || i.partNumber)
  const showReceiptsCard = order.status &&
    ["approved", "purchased", "ordered", "receipt_uploaded", "fulfilled", "validated"].includes(order.status)

  const desktopContent = (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <Button variant="outline" size="icon" asChild className="shrink-0 mt-0.5">
          <Link href="/compras">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold sm:text-2xl tracking-tight">
              {order.order_id}
            </h1>
            {order.po_type && (
              <TypeBadge type={order.po_type as PurchaseOrderType} size="default" />
            )}
            <Badge
              variant={getStatusBadgeVariant(order.status)}
              className="rounded-full text-[11px] font-semibold"
            >
              {getPOStatusLabel(order.status)}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {order.supplier_id && (
            <ReportIssueButton
              purchaseOrderId={order.id}
              purchaseOrderIdDisplay={order.order_id}
              supplierId={order.supplier_id}
              supplierName={order.supplier}
            />
          )}
          {order.status !== "validated" && (
            <EditPOButton
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
                items: poItems,
              }}
            />
          )}
        </div>
      </div>

      {/* ── Lifecycle strip ─────────────────────────────────────────────────── */}
      <POLifecycleStrip status={order.status ?? "draft"} />

      {/* ── Context band ────────────────────────────────────────────────────── */}
      <POContextBand order={order} workOrder={workOrder} />

      {/* ── Main grid: 2/3 left + 1/3 sidebar ──────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-3">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* General Info card */}
          <Card className="rounded-2xl border border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {/* People */}
              <div className="space-y-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Responsables
                </p>
                <InfoRow
                  icon={User}
                  label="Solicitado por"
                  value={requesterName ?? "No especificado"}
                />
                {authorizerName && (
                  <InfoRow
                    icon={FileCheck}
                    label="Validación técnica"
                    value={authorizerName}
                    valueClass="text-sky-700"
                  />
                )}
                {approverName && (
                  <InfoRow
                    icon={FileCheck}
                    label="Aprobado por"
                    value={approverName}
                    valueClass="text-green-700"
                  />
                )}
                {order.viability_state && order.viability_state !== "not_required" && (
                  <InfoRow
                    icon={Receipt}
                    label="Viabilidad"
                    value={
                      order.viability_state === "viable"
                        ? "Viable"
                        : order.viability_state === "not_viable"
                        ? "No viable"
                        : "Pendiente"
                    }
                    valueClass={
                      order.viability_state === "viable"
                        ? "text-green-700"
                        : order.viability_state === "not_viable"
                        ? "text-destructive"
                        : "text-amber-700"
                    }
                  />
                )}
              </div>

              <Separator />

              {/* Dates */}
              <div className="space-y-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Fechas
                </p>
                <InfoRow
                  icon={Calendar}
                  label="Creación"
                  value={formatDate(order.created_at)}
                />
                {order.purchase_date && (
                  <InfoRow
                    icon={Calendar}
                    label="Fecha planeada de compra"
                    value={formatDate(order.purchase_date)}
                    valueClass="text-sky-700 font-semibold"
                  />
                )}
                {order.approval_date && (
                  <InfoRow
                    icon={Calendar}
                    label="Fecha de aprobación"
                    value={formatDate(order.approval_date)}
                  />
                )}
                {order.purchased_at && (
                  <InfoRow
                    icon={Calendar}
                    label="Fecha de compra"
                    value={formatDate(order.purchased_at)}
                  />
                )}
              </div>

              {/* Notes */}
              {order.notes && (
                <>
                  <Separator />
                  <div className="py-3 space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {order.status === "receipt_uploaded"
                        ? "Notas / justificación del comprobante"
                        : "Notas"}
                    </p>
                    <p className="text-sm whitespace-pre-wrap break-words">{order.notes}</p>
                  </div>
                </>
              )}

              {/* Quotation URL (legacy) */}
              {order.quotation_url && (
                <>
                  <Separator />
                  <div className="py-3">
                    <a
                      href={order.quotation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      Ver cotización adjunta
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </>
              )}

              {/* Actual amount */}
              {order.actual_amount && (
                <>
                  <Separator />
                  <div className="py-3">
                    <InfoRow
                      icon={Receipt}
                      label="Monto real gastado"
                      value={formatCurrency(order.actual_amount)}
                      valueClass="text-green-700 font-semibold tabular-num"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Items / Services card */}
          {items.length > 0 && (
            <Card className="rounded-2xl border border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {order.po_type === PurchaseOrderType.DIRECT_SERVICE
                    ? "Servicios Solicitados"
                    : order.po_type === PurchaseOrderType.DIRECT_PURCHASE
                    ? "Productos Solicitados"
                    : "Artículos Solicitados"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.po_type === PurchaseOrderType.DIRECT_SERVICE ? (
                  <ServiceItemsTable items={items} formatCurrency={formatCurrency} />
                ) : (
                  <ProductItemsTable
                    items={items}
                    inventoryItems={inventoryItems}
                    purchaseItems={purchaseItems}
                    hasQuotationItems={hasQuotationItems}
                    formatCurrency={formatCurrency}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Quotation card */}
          {order.po_type && order.po_purpose !== "work_order_inventory" && (
            <Card className="rounded-2xl border border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Cotización
                  {order.requires_quote && (
                    <Badge
                      variant={order.quotation_url || order.selected_quotation_id ? "default" : "destructive"}
                      className="rounded-full text-[10px]"
                    >
                      {order.quotation_url || order.selected_quotation_id ? "Completada" : "Requerida"}
                    </Badge>
                  )}
                </CardTitle>
                {order.requires_quote && (
                  <CardDescription className="text-xs">
                    {order.po_type === PurchaseOrderType.DIRECT_SERVICE
                      ? `Servicio por ${formatCurrency(order.total_amount)} — requiere cotización (≥$5,000 MXN)`
                      : "Esta orden requiere cotización antes de ser aprobada"}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <QuotationComparisonManager
                  purchaseOrderId={order.id}
                  workOrderId={order.work_order_id}
                  quotationSelectionRequired={order.quotation_selection_required || false}
                  quotationSelectionStatus={order.quotation_selection_status}
                  poPurpose={order.po_purpose}
                />
              </CardContent>
            </Card>
          )}

          {/* Receipts / Comprobantes card */}
          {showReceiptsCard && (
            <ReceiptDisplaySection purchaseOrderId={order.id} poType={order.po_type} />
          )}
        </div>

        {/* ── Right sidebar (sticky on xl) ──────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6 xl:sticky xl:top-4 xl:self-start">

          {/* Workflow + Actions — PRIMARY */}
          {order.po_type ? (
            <WorkflowStatusDisplay
              purchaseOrderId={order.id}
              poType={order.po_type as PurchaseOrderType}
              currentStatus={order.status}
              totalAmount={Number(order.approval_amount) > 0 ? order.approval_amount : order.total_amount}
              workOrderType={order.work_order_type}
              fulfillmentHints={workflowFulfillmentHints}
            />
          ) : (
            /* Legacy PO fallback */
            <LegacyActionCard order={order} />
          )}

          {/* Work order relationship */}
          <Card className="rounded-2xl border border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-semibold uppercase tracking-widest">
                Orden de Trabajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PurchaseOrderWorkOrderLink
                workOrder={workOrder}
                isAdjustment={order.is_adjustment || false}
              />
            </CardContent>
          </Card>

          {/* Inventory actions */}
          {hasCatalogItems && (
            <Card id="po-gestion-inventario" className="rounded-2xl border border-border/60 scroll-mt-24">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-semibold uppercase tracking-widest">
                  Gestión de Inventario
                </CardTitle>
              </CardHeader>
              <CardContent>
                <POInventoryActions
                  purchaseOrderId={order.id}
                  receivedToInventory={order.received_to_inventory || false}
                  inventoryFulfilled={order.inventory_fulfilled || false}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Legacy receipt section */}
      {!order.po_type && (
        <div className="mt-2">
          <ReceiptSection purchaseOrderId={order.id} isAdjustment={order.is_adjustment || false} />
        </div>
      )}
    </div>
  )

  return (
    <Suspense fallback={desktopContent}>
      <PurchaseOrderDetailsRouter
        order={order}
        workOrder={workOrder}
        requesterName={requesterName ?? "No especificado"}
        approverName={approverName ?? "No aprobado"}
        authorizerName={authorizerName}
        items={items}
        desktopContent={desktopContent}
        fulfillmentHints={workflowFulfillmentHints}
      />
    </Suspense>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ElementType
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-sm", valueClass)}>{value}</p>
      </div>
    </div>
  )
}

function ServiceItemsTable({
  items,
  formatCurrency,
}: {
  items: any[]
  formatCurrency: (v: string | null | number) => string
}) {
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Descripción
            </th>
            <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Categoría
            </th>
            <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
              Horas
            </th>
            <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
              Tarifa/h
            </th>
            <th className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {items.map((s: any, i: number) => (
            <tr key={i} className="hover:bg-muted/20 transition-colors">
              <td className="py-2.5 pr-4">
                <p className="font-medium">{s.description || "Sin descripción"}</p>
                {s.specialist_required && (
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    Especialista
                  </Badge>
                )}
              </td>
              <td className="py-2.5 pr-4 text-muted-foreground">{s.category || "General"}</td>
              <td className="py-2.5 pr-4 text-right tabular-num">
                {s.estimated_hours ? `${Number(s.estimated_hours).toFixed(1)}h` : "—"}
              </td>
              <td className="py-2.5 pr-4 text-right tabular-num">
                {formatCurrency(s.hourly_rate?.toString() || "0")}
              </td>
              <td className="py-2.5 text-right font-semibold tabular-num">
                {formatCurrency(s.total_cost?.toString() || "0")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ProductItemsTable({
  items,
  inventoryItems,
  purchaseItems,
  hasQuotationItems,
  formatCurrency,
}: {
  items: any[]
  inventoryItems: any[]
  purchaseItems: any[]
  hasQuotationItems: boolean
  formatCurrency: (v: string | null | number) => string
}) {
  const hasMixed = inventoryItems.length > 0 || hasQuotationItems
  return (
    <div className="space-y-4">
      {hasMixed && (
        <div className="rounded-xl bg-muted/30 px-3 py-2.5 text-xs space-y-1">
          {inventoryItems.length > 0 && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Warehouse className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <strong className="text-foreground">{inventoryItems.length} artículo(s) de inventario</strong>{" "}
              — se cumplen desde almacén, sin impacto financiero directo
            </p>
          )}
          {purchaseItems.length > 0 && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <ShoppingCart className="h-3.5 w-3.5 text-orange-600 shrink-0" />
              <strong className="text-foreground">{purchaseItems.length} artículo(s) a comprar</strong>{" "}
              — requieren compra a proveedor
            </p>
          )}
        </div>
      )}
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Descripción
              </th>
              <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Código
              </th>
              {hasMixed && (
                <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Fuente
                </th>
              )}
              <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                Cant.
              </th>
              <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                P. Unit.
              </th>
              <th className="pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {items.map((item: any, i: number) => {
              const isInv = item._source === "inventory" || item.fulfill_from === "inventory"
              return (
                <tr
                  key={i}
                  className={cn(
                    "hover:bg-muted/20 transition-colors",
                    isInv && "bg-green-50/40"
                  )}
                >
                  <td className="py-2.5 pr-4 font-medium">
                    {item.description || item.item || item.name || "Sin descripción"}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground text-xs">
                    {item.part_number || item.partNumber || item.code || "—"}
                  </td>
                  {hasMixed && (
                    <td className="py-2.5 pr-4">
                      {isInv ? (
                        <Badge
                          variant="secondary"
                          className="gap-1 rounded-full text-[10px] bg-green-100 text-green-800 border border-green-200"
                        >
                          <Warehouse className="h-2.5 w-2.5" />
                          Inventario
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full text-[10px] text-orange-700 border-orange-200"
                        >
                          <ShoppingCart className="h-2.5 w-2.5" />
                          Compra
                        </Badge>
                      )}
                    </td>
                  )}
                  <td className="py-2.5 pr-4 text-right tabular-num">{item.quantity || 1}</td>
                  <td className="py-2.5 pr-4 text-right tabular-num text-muted-foreground">
                    {isInv ? "—" : formatCurrency(item.unit_price?.toString() || item.price?.toString() || "0")}
                  </td>
                  <td className={cn("py-2.5 text-right font-semibold tabular-num", isInv && "text-green-700")}>
                    {formatCurrency(
                      item.total_price?.toString() ||
                        (item.quantity * (item.unit_price || item.price || 0)).toString()
                    )}
                    {isInv && (
                      <span className="text-[10px] text-muted-foreground font-normal ml-1">
                        (sin impacto)
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LegacyActionCard({ order }: { order: any }) {
  switch (order.status) {
    case "pending_approval":
      return (
        <Card className="rounded-2xl border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-semibold uppercase tracking-widest">
              Acciones
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild variant="secondary" className="w-full">
              <Link href={`/compras/${order.id}/aprobar`}>Aprobar Orden</Link>
            </Button>
            <Button asChild variant="destructive" className="w-full">
              <Link href={`/compras/${order.id}/rechazar`}>Rechazar Orden</Link>
            </Button>
          </CardContent>
        </Card>
      )
    case "approved":
      return (
        <Card className="rounded-2xl border border-border/60">
          <CardContent className="pt-4">
            <Button asChild className="w-full">
              <Link href={`/compras/${order.id}/pedido`}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Marcar como Pedida
              </Link>
            </Button>
          </CardContent>
        </Card>
      )
    case "ordered":
      return (
        <Card className="rounded-2xl border border-border/60">
          <CardContent className="pt-4">
            <Button asChild className="w-full">
              <Link href={`/compras/${order.id}/recibido`}>
                <Package className="mr-2 h-4 w-4" />
                Registrar Recepción
              </Link>
            </Button>
          </CardContent>
        </Card>
      )
    default:
      return null
  }
}
