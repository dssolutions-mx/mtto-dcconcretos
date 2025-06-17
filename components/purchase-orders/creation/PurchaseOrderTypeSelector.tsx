"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Store, 
  Wrench, 
  Building2,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react"
import { PurchaseOrderType } from "@/types/purchase-orders"

interface PurchaseOrderTypeSelectorProps {
  onTypeSelected: (type: PurchaseOrderType) => void
  selectedType?: PurchaseOrderType
  workOrderId: string
}

export function PurchaseOrderTypeSelector({ 
  onTypeSelected, 
  selectedType,
  workOrderId 
}: PurchaseOrderTypeSelectorProps) {
  const [hoveredType, setHoveredType] = useState<PurchaseOrderType | null>(null)

  const purchaseOrderTypes = [
    {
      type: PurchaseOrderType.DIRECT_PURCHASE,
      title: "Compra Directa",
      subtitle: "Ferretería, tienda local, refacciones básicas",
      icon: Store,
      color: "bg-blue-50 border-blue-200 hover:border-blue-400",
      iconColor: "text-blue-600",
      badge: { text: "Sin cotización", variant: "secondary" as const },
      features: [
        "✅ Proceso inmediato",
        "✅ Perfecto para urgencias",
        "✅ Ferretería local, tiendas",
        "✅ Máxima agilidad operativa"
      ],
      process: "Solicitud → Aprobación → Compra → Comprobante",
      examples: "Tornillos, cables, herramientas básicas, consumibles",
      timeEstimate: "15 minutos - 2 horas",
      threshold: "No requiere cotización"
    },
    {
      type: PurchaseOrderType.DIRECT_SERVICE,
      title: "Servicio Directo", 
      subtitle: "Técnico especialista, servicio rápido",
      icon: Wrench,
      color: "bg-green-50 border-green-200 hover:border-green-400",
      iconColor: "text-green-600",
      badge: { text: "Cotización si > $10k", variant: "outline" as const },
      features: [
        "⚡ Respuesta rápida",
        "🔧 Técnicos especializados", 
        "💰 Control inteligente",
        "📋 Cotización automática"
      ],
      process: "Solicitud → [Cotización] → Aprobación → Servicio → Comprobante",
      examples: "Reparaciones eléctricas, soldadura, calibración",
      timeEstimate: "1-4 horas",
      threshold: "Cotización requerida si > $10,000 MXN"
    },
    {
      type: PurchaseOrderType.SPECIAL_ORDER,
      title: "Pedido Especial",
      subtitle: "Agencia, proveedor formal, partes especiales", 
      icon: Building2,
      color: "bg-purple-50 border-purple-200 hover:border-purple-400",
      iconColor: "text-purple-600",
      badge: { text: "Siempre cotización", variant: "default" as const },
      features: [
        "🏢 Proveedores certificados",
        "📋 Proceso formal completo",
        "🛡️ Garantías extendidas",
        "⚡ Para componentes críticos"
      ],
      process: "Solicitud → Cotización → Aprobación → Pedido → Recepción → Factura",
      examples: "Motores, bombas, componentes OEM, equipos especializados",
      timeEstimate: "1-5 días",
      threshold: "Siempre requiere cotización formal"
    }
  ]

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">¿Cómo vas a resolver esta necesidad?</h2>
        <p className="text-muted-foreground">
          Selecciona el tipo de orden de compra más apropiado para tu situación
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {purchaseOrderTypes.map((orderType) => {
          const Icon = orderType.icon
          const isSelected = selectedType === orderType.type
          const isHovered = hoveredType === orderType.type

          return (
            <Card 
              key={orderType.type}
              className={`
                cursor-pointer transition-all duration-200 relative
                ${orderType.color}
                ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                ${isHovered ? 'shadow-lg transform -translate-y-1' : 'shadow-sm'}
              `}
              onMouseEnter={() => setHoveredType(orderType.type)}
              onMouseLeave={() => setHoveredType(null)}
              onClick={() => onTypeSelected(orderType.type)}
            >
              {isSelected && (
                <div className="absolute -top-2 -right-2">
                  <CheckCircle className="h-6 w-6 text-primary bg-white rounded-full" />
                </div>
              )}

              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-white/80 ${orderType.iconColor}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">{orderType.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {orderType.subtitle}
                    </CardDescription>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Badge variant={orderType.badge.variant}>
                    {orderType.badge.text}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium">
                    {orderType.timeEstimate}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Features */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Características:</h4>
                  <div className="grid grid-cols-1 gap-1">
                    {orderType.features.map((feature, index) => (
                      <div key={index} className="text-xs text-muted-foreground">
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Process Flow */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Proceso:</h4>
                  <div className="text-xs text-muted-foreground bg-white/60 p-2 rounded">
                    {orderType.process}
                  </div>
                </div>

                {/* Examples */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Ejemplos:</h4>
                  <p className="text-xs text-muted-foreground">
                    {orderType.examples}
                  </p>
                </div>

                {/* Threshold Info */}
                <div className="pt-2 border-t border-white/40">
                  <div className="flex items-start space-x-2">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      {orderType.threshold}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Action Button */}
      {selectedType && (
        <div className="flex justify-center pt-4">
          <Button 
            size="lg" 
            className="min-w-[200px]"
            onClick={() => {
              // This will be handled by parent component
              const selectedTypeData = purchaseOrderTypes.find(t => t.type === selectedType)
              if (selectedTypeData) {
                // Parent will handle the navigation
              }
            }}
          >
            Continuar con {purchaseOrderTypes.find(t => t.type === selectedType)?.title}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Information Panel */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-medium">¿No estás seguro cuál elegir?</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Compra Directa:</strong> Para urgencias y compras simples en tiendas locales</p>
                <p><strong>Servicio Directo:</strong> Para técnicos conocidos y servicios especializados</p>
                <p><strong>Pedido Especial:</strong> Para proveedores formales y componentes críticos</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 