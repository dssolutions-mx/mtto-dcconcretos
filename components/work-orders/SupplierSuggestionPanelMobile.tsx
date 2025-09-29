"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
  RefreshCw,
  X,
  Eye,
  UserCheck
} from "lucide-react"
import { Supplier } from "@/types/suppliers"

interface SupplierSuggestion {
  supplier: Supplier
  score: number
  reasoning: string[]
  estimated_cost?: number
  estimated_completion_time?: number
  confidence_level?: number
}

interface SupplierSuggestionPanelMobileProps {
  workOrderId?: string
  assetId?: string
  problemDescription?: string
  requiredServices?: string[]
  urgency?: string
  budgetRange?: { min?: number; max?: number }
  onSupplierSelect?: (supplier: Supplier) => void
  onSupplierAssign?: (supplier: Supplier) => void
  className?: string
  compact?: boolean
}

export function SupplierSuggestionPanelMobile({
  workOrderId,
  assetId,
  problemDescription,
  requiredServices = [],
  urgency = 'medium',
  budgetRange,
  onSupplierSelect,
  onSupplierAssign,
  className,
  compact = false
}: SupplierSuggestionPanelMobileProps) {
  const [suggestions, setSuggestions] = useState<SupplierSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSheet, setShowSheet] = useState(false)

  useEffect(() => {
    loadSuggestions()
  }, [workOrderId, assetId, problemDescription, requiredServices, urgency, budgetRange])

  const loadSuggestions = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: compact ? '3' : '5'
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
      service_provider: { color: "bg-cyan-50 text-cyan-700 border-cyan-200", label: "Servicios" }
    }

    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.company

    return (
      <Badge className={`${config.color} text-xs`}>
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
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Buscando proveedores...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={loadSuggestions}>
              <RefreshCw className="w-3 h-3 mr-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!suggestions.length) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay recomendaciones</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      <Sheet open={showSheet} onOpenChange={setShowSheet}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="w-full">
            <Sparkles className="w-4 h-4 mr-2" />
            Ver {suggestions.length} proveedores recomendados
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Proveedores Recomendados
            </SheetTitle>
            <SheetDescription>
              Sugerencias basadas en el activo, problema y rendimiento histórico
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div key={suggestion.supplier.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{suggestion.supplier.name}</h4>
                      {getTypeBadge(suggestion.supplier.supplier_type)}
                      <Badge variant="outline" className={getUrgencyColor(urgency)}>
                        {urgency}
                      </Badge>
                    </div>
                    {suggestion.supplier.business_name && (
                      <p className="text-xs text-muted-foreground truncate mb-1">
                        {suggestion.supplier.business_name}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-2">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-medium">Puntuación:</span>
                      <span className="text-sm font-bold">{suggestion.score}</span>
                    </div>
                    <Progress value={suggestion.confidence_level} className="w-16 h-1.5" />
                    <p className={`text-xs ${getConfidenceColor(suggestion.confidence_level || 0)}`}>
                      {suggestion.confidence_level}%
                    </p>
                  </div>
                </div>

                {/* Key Metrics - Compact for mobile */}
                <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <span>{suggestion.supplier.rating?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span>{suggestion.supplier.reliability_score || 'N/A'}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-500" />
                    <span>{suggestion.estimated_completion_time || 'N/A'}d</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-purple-500" />
                    <span>${suggestion.estimated_cost?.toLocaleString() || 'N/A'}</span>
                  </div>
                </div>

                {/* Reasoning - Compact */}
                <div className="mb-2">
                  <div className="flex flex-wrap gap-1">
                    {suggestion.reasoning.slice(0, 2).map((reason, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {reason}
                      </Badge>
                    ))}
                    {suggestion.reasoning.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{suggestion.reasoning.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Location - Compact */}
                {suggestion.supplier.city && suggestion.supplier.state && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{suggestion.supplier.city}, {suggestion.supplier.state}</span>
                  </div>
                )}

                {/* Specialties - Compact */}
                {suggestion.supplier.specialties && suggestion.supplier.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {suggestion.supplier.specialties.slice(0, 3).map((specialty, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {specialty}
                      </Badge>
                    ))}
                    {suggestion.supplier.specialties.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{suggestion.supplier.specialties.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions - Compact */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onSupplierSelect?.(suggestion.supplier)
                      setShowSheet(false)
                    }}
                    className="flex-1 text-xs"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      onSupplierAssign?.(suggestion.supplier)
                      setShowSheet(false)
                    }}
                    className="flex-1 text-xs"
                  >
                    <UserCheck className="w-3 h-3 mr-1" />
                    Asignar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
