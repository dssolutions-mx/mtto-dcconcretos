"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Star, Clock, DollarSign, CheckCircle2, XCircle, FileText, TrendingDown, Zap } from "lucide-react"
import { PurchaseOrderQuotation } from "@/types/purchase-orders"
import { Supplier } from "@/types/suppliers"
import { QuotationStatus } from "@/types/purchase-orders"

interface QuotationComparisonCardProps {
  quotation: PurchaseOrderQuotation
  isSelected?: boolean
  isBestPrice?: boolean
  isFastestDelivery?: boolean
  onSelect?: (quotationId: string) => void
  onReject?: (quotationId: string) => void
  showActions?: boolean
}

export function QuotationComparisonCard({
  quotation,
  isSelected = false,
  isBestPrice = false,
  isFastestDelivery = false,
  onSelect,
  onReject,
  showActions = true
}: QuotationComparisonCardProps) {
  const supplier = quotation.supplier as Supplier | undefined
  
  return (
    <Card className={`relative h-full ${isSelected ? 'border-green-500 bg-green-50/50' : ''}`}>
      {isSelected && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Seleccionada
          </Badge>
        </div>
      )}
      
      <CardContent className="pt-6 h-full flex flex-col">
        {/* Supplier Header */}
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{quotation.supplier_name}</h3>
              {supplier?.business_name && (
                <p className="text-sm text-muted-foreground">{supplier.business_name}</p>
              )}
            </div>
            {supplier?.rating && (
              <div className="flex items-center space-x-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">{supplier.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
          
          {/* Supplier Type Badge */}
          {supplier?.supplier_type && (
            <Badge variant="outline" className="text-xs">
              {supplier.supplier_type === 'company' ? 'Empresa' :
               supplier.supplier_type === 'individual' ? 'Individual' :
               supplier.supplier_type === 'distributor' ? 'Distribuidor' :
               supplier.supplier_type === 'manufacturer' ? 'Fabricante' :
               supplier.supplier_type === 'service_provider' ? 'Proveedor de Servicios' :
               supplier.supplier_type}
            </Badge>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Precio</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold">
                ${quotation.quoted_amount.toLocaleString('es-MX', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </span>
              {isBestPrice && (
                <Badge variant="default" className="bg-green-600">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  Mejor Precio
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Entrega</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-medium">
                {quotation.delivery_days ? `${quotation.delivery_days} días` : 'N/A'}
              </span>
              {isFastestDelivery && quotation.delivery_days && (
                <Badge variant="default" className="bg-blue-600">
                  <Zap className="h-3 w-3 mr-1" />
                  Más Rápido
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="space-y-2 mb-4 text-sm">
          {quotation.payment_terms && (
            <div>
              <span className="text-muted-foreground">Condiciones: </span>
              <span className="font-medium">{quotation.payment_terms}</span>
            </div>
          )}
          
          {supplier?.reliability_score && (
            <div>
              <span className="text-muted-foreground">Confiabilidad: </span>
              <span className="font-medium">{supplier.reliability_score}%</span>
            </div>
          )}
          
          {supplier?.total_orders && (
            <div>
              <span className="text-muted-foreground">Órdenes previas: </span>
              <span className="font-medium">{supplier.total_orders}</span>
            </div>
          )}
        </div>

        {/* File Link */}
        {quotation.file_url && (
          <div className="mb-4">
            <Button variant="outline" size="sm" asChild className="w-full">
              <a href={quotation.file_url} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4 mr-2" />
                Ver Cotización
              </a>
            </Button>
          </div>
        )}

        {/* Selection Reason (if selected) */}
        {isSelected && quotation.selection_reason && (
          <div className="mb-4 p-3 bg-green-100 rounded-md">
            <p className="text-xs font-medium text-green-900 mb-1">Razón de Selección:</p>
            <p className="text-sm text-green-800">{quotation.selection_reason}</p>
          </div>
        )}

        {/* Rejection Reason (if rejected) */}
        {quotation.status === QuotationStatus.REJECTED && quotation.rejection_reason && (
          <div className="mb-4 p-3 bg-red-100 rounded-md">
            <p className="text-xs font-medium text-red-900 mb-1">Razón de Rechazo:</p>
            <p className="text-sm text-red-800">{quotation.rejection_reason}</p>
          </div>
        )}

        {/* Actions */}
        {showActions && !isSelected && quotation.status === QuotationStatus.PENDING && (
          <div className="flex space-x-2 mt-auto pt-4">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onSelect?.(quotation.id)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Seleccionar
            </Button>
            {onReject && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject?.(quotation.id)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
