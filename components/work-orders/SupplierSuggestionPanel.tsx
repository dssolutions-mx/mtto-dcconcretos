"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Sparkles,
  Star,
  Clock,
  DollarSign,
  MapPin,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw
} from "lucide-react"
import { Supplier } from "@/types/suppliers"
import { useRouter } from "next/navigation"
import { PurchaseOrderType } from "@/types/purchase-orders"

interface SupplierSuggestion {
  supplier: Supplier
  score: number
  reasoning: string[]
  estimated_cost?: number
  estimated_completion_time?: number
  confidence_level?: number
}

interface SupplierSuggestionPanelProps {
  workOrderId?: string
  assetId?: string
  problemDescription?: string
  requiredServices?: string[]
  urgency?: string
  budgetRange?: { min?: number; max?: number }
  onSupplierSelect?: (supplier: Supplier) => void
  onSupplierAssign?: (supplier: Supplier) => void
  className?: string
}

export function SupplierSuggestionPanel({
  workOrderId,
  assetId,
  problemDescription,
  requiredServices = [],
  urgency = 'medium',
  budgetRange,
  onSupplierSelect,
  onSupplierAssign,
  className
}: SupplierSuggestionPanelProps) {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<SupplierSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Only load suggestions if we have minimum required data
    // Don't load on initial mount if creating new work order (no workOrderId)
    if (assetId && problemDescription && problemDescription.length > 10) {
      // Debounce the API call to avoid conflicts with other concurrent requests
      const timer = setTimeout(() => {
        loadSuggestions()
      }, 1500) // Wait 1.5 seconds after form data changes
      
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, problemDescription]) // Only depend on essential fields to prevent loops

  const loadSuggestions = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: '5'
      })

      if (workOrderId) params.append('work_order_id', workOrderId)
      if (assetId) params.append('asset_id', assetId)
      if (problemDescription) params.append('problem_description', problemDescription)
      if (requiredServices.length > 0) params.append('required_services', requiredServices.join(','))
      if (urgency) params.append('urgency', urgency)
      if (budgetRange?.min) params.append('budget_min', budgetRange.min.toString())
      if (budgetRange?.max) params.append('budget_max', budgetRange.max.toString())

      const response = await fetch(`/api/work-orders/supplier-suggestions?${params}`)
      const data = await response.json()

      if (response.ok) {
        setSuggestions(data.suggestions || [])
      } else {
        setError(data.error || 'Error loading suggestions')
      }
    } catch (err) {
      setError('Error loading supplier suggestions')
      console.error('Error loading suggestions:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTypeBadge = (type: string) => {
    const typeConfig = {
      individual: { color: "bg-blue-50 text-blue-700 border-blue-200", label: "Individual" },
      company: { color: "bg-green-50 text-green-700 border-green-200", label: "Empresa" },
      distributor: { color: "bg-purple-50 text-purple-700 border-purple-200", label: "Distribuidor" },
      manufacturer: { color: "bg-orange-50 text-orange-700 border-orange-200", label: "Fabricante" },
      service_provider: { color: "bg-cyan-50 text-cyan-700 border-cyan-200", label: "Proveedor de Servicios" }
    }

    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.company

    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    )
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-600"
    if (confidence >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'text-red-600'
      case 'high': return 'text-orange-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Buscando proveedores recomendados...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={loadSuggestions}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!suggestions.length) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No se encontraron proveedores recomendados</p>
            <p className="text-sm">Intenta ajustar los criterios de búsqueda</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-primary" />
          Proveedores Recomendados
        </CardTitle>
        <CardDescription>
          Sugerencias basadas en el activo, problema y rendimiento histórico
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.map((suggestion, index) => (
          <div key={suggestion.supplier.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{suggestion.supplier.name}</h4>
                  {getTypeBadge(suggestion.supplier.supplier_type)}
                  <Badge variant="outline" className={getUrgencyColor(urgency)}>
                    {urgency}
                  </Badge>
                </div>
                {suggestion.supplier.business_name && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {suggestion.supplier.business_name}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-sm font-medium">Puntuación:</span>
                  <span className="text-lg font-bold">{suggestion.score}</span>
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
                <Progress value={suggestion.confidence_level} className="w-20 h-2" />
                <p className={`text-xs ${getConfidenceColor(suggestion.confidence_level || 0)}`}>
                  {suggestion.confidence_level}% confianza
                </p>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Calificación</p>
                  <p className="font-semibold text-sm">
                    {suggestion.supplier.rating?.toFixed(1) || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Confiabilidad</p>
                  <p className="font-semibold text-sm">
                    {suggestion.supplier.reliability_score || 'N/A'}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Tiempo Estimado</p>
                  <p className="font-semibold text-sm">
                    {suggestion.estimated_completion_time || 'N/A'} días
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Costo Estimado</p>
                  <p className="font-semibold text-sm">
                    ${suggestion.estimated_cost?.toLocaleString() || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Reasoning */}
            <div className="mb-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Razones de recomendación:</p>
              <div className="flex flex-wrap gap-1">
                {suggestion.reasoning.slice(0, 3).map((reason, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {reason}
                  </Badge>
                ))}
                {suggestion.reasoning.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{suggestion.reasoning.length - 3} más
                  </Badge>
                )}
              </div>
            </div>

            {/* Location */}
            {suggestion.supplier.city && suggestion.supplier.state && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                <MapPin className="w-3 h-3" />
                {suggestion.supplier.city}, {suggestion.supplier.state}
              </div>
            )}

            {/* Specialties */}
            {suggestion.supplier.specialties && suggestion.supplier.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {suggestion.supplier.specialties.slice(0, 4).map((specialty, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
                {suggestion.supplier.specialties.length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{suggestion.supplier.specialties.length - 4}
                  </Badge>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSupplierSelect?.(suggestion.supplier)}
                className="flex-1"
              >
                Ver Detalles
              </Button>
              <Button
                size="sm"
                onClick={() => onSupplierAssign?.(suggestion.supplier)}
                className="flex-1"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Asignar
              </Button>
              {workOrderId && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    const url = `/compras/crear-tipificada?workOrderId=${encodeURIComponent(workOrderId)}&initialType=${encodeURIComponent(PurchaseOrderType.DIRECT_SERVICE)}&prefillSupplier=${encodeURIComponent(suggestion.supplier.name)}`
                    router.push(url)
                  }}
                >
                  Crear OC
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
