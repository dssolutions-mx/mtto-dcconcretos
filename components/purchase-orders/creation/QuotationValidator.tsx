"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Calculator,
  Clock,
  FileText
} from "lucide-react"
import { PurchaseOrderType, QuoteValidationResponse } from "@/types/purchase-orders"

interface QuotationValidatorProps {
  poType: PurchaseOrderType
  amount: number
  poPurpose?: string
  onValidationResult: (result: QuoteValidationResponse) => void
  className?: string
}

export function QuotationValidator({ 
  poType, 
  amount,
  poPurpose,
  onValidationResult,
  className = ""
}: QuotationValidatorProps) {
  const [validationResult, setValidationResult] = useState<QuoteValidationResponse | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate quotation requirement whenever type or amount changes
  useEffect(() => {
    const validateQuotationRequirement = async () => {
      if (!poType || amount <= 0) {
        setValidationResult(null)
        return
      }

      setIsValidating(true)
      setError(null)

      try {
        const response = await fetch('/api/purchase-orders/validate-quotation-requirement', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            po_type: poType,
            total_amount: amount,
            po_purpose: poPurpose
          })
        })

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`)
        }

        const result: QuoteValidationResponse = await response.json()
        setValidationResult(result)
        onValidationResult(result)

      } catch (err) {
        console.error('Error validating quotation requirement:', err)
        setError(err instanceof Error ? err.message : 'Error validando cotización')
        
        // Fallback validation based on business rules
        const fallbackResult = getFallbackValidation(poType, amount)
        setValidationResult(fallbackResult)
        onValidationResult(fallbackResult)
        
      } finally {
        setIsValidating(false)
      }
    }

    const debounceTimer = setTimeout(validateQuotationRequirement, 300)
    return () => clearTimeout(debounceTimer)
    
  }, [poType, amount, poPurpose, onValidationResult])

  // Fallback validation when API is not available
  const getFallbackValidation = (poType: PurchaseOrderType, amount: number): QuoteValidationResponse => {
    switch (poType) {
      case PurchaseOrderType.DIRECT_PURCHASE:
        return {
          requires_quote: false,
          reason: "Las compras directas no requieren cotización",
          recommendation: "Proceda con la compra una vez aprobada."
        }
      
      case PurchaseOrderType.DIRECT_SERVICE:
        const requiresQuote = amount >= 5000
        return {
          requires_quote: requiresQuote,
          reason: requiresQuote 
            ? `Servicio por $${amount.toLocaleString()} requiere cotización por ser mayor o igual a $5,000`
            : `Servicio por $${amount.toLocaleString()} puede proceder sin cotización`,
          threshold_amount: 5000,
          recommendation: requiresQuote 
            ? "Solicite cotización formal antes de proceder."
            : "Puede proceder directamente una vez aprobado."
        }
      
      case PurchaseOrderType.SPECIAL_ORDER:
        return {
          requires_quote: true,
          reason: "Los pedidos especiales siempre requieren cotización formal",
          recommendation: "Contacte al proveedor para obtener cotización oficial."
        }
      
      default:
        return {
          requires_quote: true,
          reason: "Tipo de orden no reconocido",
          recommendation: "Verifique los requisitos específicos."
        }
    }
  }

  const getTypeDisplayName = (type: PurchaseOrderType): string => {
    switch (type) {
      case PurchaseOrderType.DIRECT_PURCHASE:
        return "Compra Directa"
      case PurchaseOrderType.DIRECT_SERVICE:
        return "Servicio Directo"
      case PurchaseOrderType.SPECIAL_ORDER:
        return "Pedido Especial"
      default:
        return type
    }
  }

  const getAlertVariant = () => {
    if (error) return "destructive"
    if (!validationResult) return "default"
    return validationResult.requires_quote ? "default" : "default"
  }

  const getStatusIcon = () => {
    if (isValidating) return <Calculator className="h-4 w-4 animate-pulse" />
    if (error) return <AlertTriangle className="h-4 w-4 text-destructive" />
    if (!validationResult) return <Info className="h-4 w-4" />
    return validationResult.requires_quote 
      ? <FileText className="h-4 w-4 text-orange-600" />
      : <CheckCircle className="h-4 w-4 text-green-600" />
  }

  if (isValidating) {
    return (
      <Card className={`border-dashed ${className}`}>
        <CardContent className="flex items-center space-x-3 py-4">
          <Calculator className="h-4 w-4 animate-pulse text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Validando requisitos de cotización...
          </span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium">Error al validar cotización</p>
            <p className="text-sm">{error}</p>
            <p className="text-xs">Se aplicará validación local como respaldo.</p>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (!validationResult) {
    return (
      <Alert className={className}>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Ingrese el tipo de orden y monto para validar requisitos de cotización.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Validation Result */}
      <Alert variant={getAlertVariant()}>
        <div className="flex items-start space-x-3">
          {getStatusIcon()}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <AlertDescription className="font-medium">
                {getTypeDisplayName(poType)} - ${amount.toLocaleString('es-MX')} MXN
              </AlertDescription>
              <Badge 
                variant={validationResult.requires_quote ? "default" : "secondary"}
                className="ml-2"
              >
                {validationResult.requires_quote ? "Requiere Cotización" : "Sin Cotización"}
              </Badge>
            </div>
            
            <AlertDescription className="text-sm">
              {validationResult.reason}
            </AlertDescription>
            
            {validationResult.recommendation && (
              <AlertDescription className="text-xs text-muted-foreground">
                <strong>Recomendación:</strong> {validationResult.recommendation}
              </AlertDescription>
            )}
          </div>
        </div>
      </Alert>

      {/* Threshold Information for Direct Service */}
      {poType === PurchaseOrderType.DIRECT_SERVICE && validationResult.threshold_amount && (
        <Card className="bg-muted/30">
          <CardContent className="py-3">
            <div className="flex items-center space-x-2 text-sm">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Umbral de cotización: 
                <strong className="ml-1">
                  ${validationResult.threshold_amount.toLocaleString('es-MX')} MXN
                </strong>
              </span>
            </div>
            
            {amount <= validationResult.threshold_amount && (
              <div className="flex items-center space-x-2 text-xs text-green-700 mt-2">
                <CheckCircle className="h-3 w-3" />
                <span>
                  Monto por debajo del umbral - No requiere cotización
                </span>
              </div>
            )}
            
            {amount > validationResult.threshold_amount && (
              <div className="flex items-center space-x-2 text-xs text-orange-700 mt-2">
                <Clock className="h-3 w-3" />
                <span>
                  Monto por encima del umbral - Cotización requerida
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Process Steps */}
      <Card className="bg-blue-50/50">
        <CardContent className="py-3">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Próximos pasos:
            </h4>
            
            {validationResult.requires_quote ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-orange-400" />
                  <span>1. Solicitar cotización al proveedor</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span>2. Adjuntar cotización al formulario</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span>3. Enviar para aprobación</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span>4. Proceder con la compra/servicio</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span>1. Completar formulario</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span>2. Enviar para aprobación</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span>3. Proceder con la compra directamente</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span>4. Subir comprobante de pago</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 