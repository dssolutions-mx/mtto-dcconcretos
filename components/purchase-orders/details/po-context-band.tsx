import Link from "next/link"
import { ExternalLink, Store, Wrench, Building2, CreditCard, Banknote, LayoutGrid } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PurchaseOrderType } from "@/types/purchase-orders"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

const PO_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; colorClass: string }
> = {
  [PurchaseOrderType.DIRECT_PURCHASE]: {
    label: "Compra Directa",
    icon: Store,
    colorClass: "text-sky-700 bg-sky-50 border-sky-200",
  },
  [PurchaseOrderType.DIRECT_SERVICE]: {
    label: "Servicio Directo",
    icon: Wrench,
    colorClass: "text-green-700 bg-green-50 border-green-200",
  },
  [PurchaseOrderType.SPECIAL_ORDER]: {
    label: "Pedido Especial",
    icon: Building2,
    colorClass: "text-violet-700 bg-violet-50 border-violet-200",
  },
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
}

const PAYMENT_CONDITION_LABELS: Record<string, string> = {
  cash: "Contado",
  credit: "Crédito",
}

const WO_PRIORITY_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  critical: { label: "Crítica", variant: "destructive" },
  alta: { label: "Alta", variant: "destructive" },
  media: { label: "Media", variant: "secondary" },
  normal: { label: "Normal", variant: "outline" },
  baja: { label: "Baja", variant: "outline" },
}

interface POContextBandProps {
  order: {
    po_type?: string | null
    supplier?: string | null
    service_provider?: string | null
    store_location?: string | null
    /** Canonical routing amount. Preferred over total_amount for display. */
    approval_amount?: number | string | null
    total_amount?: string | null
    payment_method?: string | null
    payment_condition?: string | null
  }
  workOrder?: {
    id: string
    order_id?: string | null
    status?: string | null
    priority?: string | null
    asset?: {
      id?: string
      name?: string | null
      asset_id?: string | null
      location?: string | null
    } | null
  } | null
}

export function POContextBand({ order, workOrder }: POContextBandProps) {
  const typeConfig = order.po_type ? PO_TYPE_CONFIG[order.po_type] : null
  const TypeIcon = typeConfig?.icon ?? LayoutGrid
  const supplierLabel = order.po_type === PurchaseOrderType.DIRECT_SERVICE
    ? (order.service_provider ?? order.supplier)
    : (order.supplier ?? order.service_provider)
  const priorityConfig = workOrder?.priority ? WO_PRIORITY_CONFIG[workOrder.priority.toLowerCase()] : null

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-muted/20",
        "grid gap-5 px-5 py-4",
        workOrder
          ? "md:grid-cols-[minmax(200px,1fr)_1px_minmax(200px,1.4fr)]"
          : "grid-cols-1"
      )}
    >
      {/* Left: PO key facts */}
      <div className="flex flex-col gap-3">
        {/* Type badge */}
        {typeConfig && (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              typeConfig.colorClass
            )}
          >
            <TypeIcon className="h-3 w-3" />
            {typeConfig.label}
          </div>
        )}

        {/* Amount — hero number */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
            Monto autorizado
          </p>
          <p
            className="font-bold tabular-num leading-none text-foreground"
            style={{ fontSize: "clamp(1.35rem, 4vw, 1.75rem)" }}
          >
            {formatCurrency(order.approval_amount ?? order.total_amount ?? 0)}
          </p>
        </div>

        {/* Supplier row */}
        {supplierLabel && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
              {order.po_type === PurchaseOrderType.DIRECT_SERVICE ? "Proveedor de servicio" : "Proveedor"}
            </p>
            <p className="text-sm font-medium text-foreground truncate">{supplierLabel}</p>
            {order.store_location && order.po_type !== PurchaseOrderType.DIRECT_SERVICE && (
              <p className="text-xs text-muted-foreground">{order.store_location}</p>
            )}
          </div>
        )}

        {/* Payment method + condition */}
        {(order.payment_method || order.payment_condition) && (
          <div className="flex items-center gap-3 flex-wrap">
            {order.payment_method && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {order.payment_method === "card" ? (
                  <CreditCard className="h-3.5 w-3.5" />
                ) : (
                  <Banknote className="h-3.5 w-3.5" />
                )}
                <span>{PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method}</span>
              </div>
            )}
            {order.payment_condition && (
              <span className="text-xs text-muted-foreground">
                · {PAYMENT_CONDITION_LABELS[order.payment_condition] ?? order.payment_condition}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Divider (desktop only) */}
      {workOrder && (
        <div className="hidden md:block w-px bg-border/50 self-stretch" />
      )}

      {/* Right: OT/Asset facts */}
      {workOrder ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Orden de Trabajo
            </p>
            {workOrder.status && (
              <Badge variant="outline" className="text-[10px] font-semibold rounded-full h-5">
                {workOrder.status}
              </Badge>
            )}
          </div>

          <Link
            href={`/ordenes/${workOrder.id}`}
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors self-start"
          >
            {workOrder.order_id ?? workOrder.id.slice(0, 8)}
            <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          {workOrder.asset && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {workOrder.asset.asset_id && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                    Activo
                  </p>
                  <p className="text-sm font-medium">{workOrder.asset.asset_id}</p>
                </div>
              )}
              {workOrder.asset.name && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                    Descripción
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{workOrder.asset.name}</p>
                </div>
              )}
              {workOrder.asset.location && (
                <div className="col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                    Ubicación
                  </p>
                  <p className="text-sm">{workOrder.asset.location}</p>
                </div>
              )}
            </div>
          )}

          {priorityConfig && (
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Urgencia
              </p>
              <Badge
                variant={priorityConfig.variant}
                className="text-[10px] font-semibold rounded-full"
              >
                {priorityConfig.label}
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center text-sm text-muted-foreground">
          Sin orden de trabajo vinculada
        </div>
      )}
    </div>
  )
}
