"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Store,
  Wrench,
  Building2,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  ChevronDown,
} from "lucide-react"
import { PurchaseOrderType } from "@/types/purchase-orders"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

interface PurchaseOrderTypeSelectorProps {
  onTypeSelected: (type: PurchaseOrderType) => void
  selectedType?: PurchaseOrderType
  workOrderId?: string
}

export function PurchaseOrderTypeSelector({
  onTypeSelected,
  selectedType,
  workOrderId,
}: PurchaseOrderTypeSelectorProps) {
  const isMobile = useIsMobile()
  const [hoveredType, setHoveredType] = useState<PurchaseOrderType | null>(null)

  const purchaseOrderTypes = [
    {
      type: PurchaseOrderType.DIRECT_PURCHASE,
      title: "Compra directa",
      subtitle: "Refacciones en tienda o ferretería; puede incluir surtido desde almacén.",
      icon: Store,
      accent: "border-sky-200 bg-sky-50/50",
      iconWrap: "bg-sky-100 text-sky-800",
      badge: { text: "Sin cotización habitual", variant: "outline" as const },
      detail: "Flujo ágil: aprobación, compra y comprobante. Si la OT trae partes, podrás marcar almacén o proveedor por línea.",
    },
    {
      type: PurchaseOrderType.DIRECT_SERVICE,
      title: "Servicio directo",
      subtitle: "Técnico o taller; cotización automática si el monto lo requiere.",
      icon: Wrench,
      accent: "border-green-200 bg-green-50/50",
      iconWrap: "bg-green-100 text-green-800",
      badge: { text: "Cotización si ≥ $5k", variant: "outline" as const },
      detail: "Ideal para reparaciones y servicios especializados. El sistema guía cotización y aprobación.",
    },
    {
      type: PurchaseOrderType.SPECIAL_ORDER,
      title: "Pedido especial",
      subtitle: "Proveedor formal, OEM o agencia; siempre con cotización.",
      icon: Building2,
      accent: "border-violet-200 bg-violet-50/50",
      iconWrap: "bg-violet-100 text-violet-900",
      badge: { text: "Cotización formal", variant: "outline" as const },
      detail: "Para partes críticas o largos tiempos de entrega. Comparación de cotizaciones y aprobación estructurada.",
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Tipo de solicitud
        </p>
        <h2
          className={cn(
            "text-xl font-semibold sm:text-2xl tracking-tight",
            isMobile && "text-lg"
          )}
        >
          ¿Cómo vas a cubrir esta necesidad?
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Elige el camino principal; después podrás ajustar almacén vs proveedor en las partidas si aplica.
          {workOrderId ? " Esta solicitud está vinculada a una orden de trabajo." : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {purchaseOrderTypes.map((orderType) => {
          const Icon = orderType.icon
          const isSelected = selectedType === orderType.type
          const isHovered = !isMobile && hoveredType === orderType.type

          return (
            <Card
              key={orderType.type}
              className={cn(
                "relative cursor-pointer rounded-2xl border border-border/60 bg-card transition-all duration-200",
                orderType.accent,
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                isHovered && "border-border shadow-sm"
              )}
              onMouseEnter={() => !isMobile && setHoveredType(orderType.type)}
              onMouseLeave={() => setHoveredType(null)}
              onClick={() => onTypeSelected(orderType.type)}
            >
              {isSelected && (
                <div className="absolute -top-2 -right-2 z-10 hidden sm:block">
                  <CheckCircle className="h-6 w-6 text-primary bg-background rounded-full border border-border" />
                </div>
              )}

              <CardHeader className={cn("p-5 pb-3 relative", isMobile && "p-4")}>
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "p-2.5 rounded-xl shrink-0",
                      orderType.iconWrap
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <CardTitle className="text-base font-semibold leading-snug">
                      {orderType.title}
                    </CardTitle>
                    <CardDescription className="text-sm leading-snug">
                      {orderType.subtitle}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-3">
                  <Badge
                    variant={orderType.badge.variant}
                    className="rounded-full text-[10px] font-semibold border"
                  >
                    {orderType.badge.text}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className={cn("pt-0 pb-5 px-5", isMobile && "px-4 pb-4")}>
                {isMobile ? (
                  <Collapsible>
                    <CollapsibleTrigger
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-full py-2 min-h-[44px] [&[data-state=open]_svg]:rotate-180"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Más detalle
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200" />
                    </CollapsibleTrigger>
                    <CollapsibleContent onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
                        {orderType.detail}
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
                    {orderType.detail}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selectedType && (
        <div className="flex justify-center pt-2">
          <Button
            size="lg"
            className={cn("min-h-[44px] rounded-xl cursor-pointer", isMobile && "w-full")}
            onClick={() => onTypeSelected(selectedType)}
          >
            Continuar con {purchaseOrderTypes.find((t) => t.type === selectedType)?.title}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      <Card className="rounded-2xl border border-border/60 bg-muted/20">
        <CardContent className={cn("p-5", isMobile && "p-4")}>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">¿Dudas entre opciones?</p>
              <p>
                <span className="text-foreground font-medium">Compra directa</span> — refacciones rápidas.
                <span className="text-foreground font-medium"> Servicio</span> — mano de obra o especialista.
                <span className="text-foreground font-medium"> Pedido especial</span> — proveedor formal y
                cotización.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
