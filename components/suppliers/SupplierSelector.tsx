"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Search,
  Star,
  MapPin,
  Phone,
  Mail,
  Building,
  Plus,
  Check,
  TrendingUp,
  Users
} from "lucide-react"
import { Supplier, SupplierType } from "@/types/suppliers"
import { Separator } from "@/components/ui/separator"
import { SupplierForm } from "@/components/suppliers/SupplierForm"

interface SupplierSelectorProps {
  value?: string | null
  onChange: (supplier: Supplier | null) => void
  placeholder?: string
  showPerformance?: boolean
  filterByType?: SupplierType
  className?: string
  allowManualInput?: boolean
  onManualInputChange?: (value: string) => void
  creationEnabled?: boolean
  businessUnitId?: string
}

interface SupplierSuggestion {
  supplier: Supplier
  score: number
  reasoning: string[]
  estimated_cost?: number
}

export function SupplierSelector({
  value,
  onChange,
  placeholder = "Seleccionar proveedor",
  showPerformance = true,
  filterByType,
  className,
  allowManualInput = false,
  onManualInputChange,
  creationEnabled = true,
  businessUnitId
}: SupplierSelectorProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [suggestions, setSuggestions] = useState<SupplierSuggestion[]>([])
  const [manualName, setManualName] = useState<string>("")
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false)

  // Load suppliers
  useEffect(() => {
    loadSuppliers()
  }, [filterByType, businessUnitId])

  const loadSuppliers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: 'active',
        limit: '100'
      })

      if (filterByType) {
        params.append('type', filterByType)
      }
      if (businessUnitId) {
        params.append('business_unit_id', businessUnitId)
      }

      const response = await fetch(`/api/suppliers?${params}`)
      const data = await response.json()

      if (response.ok) {
        setSuppliers(data.suppliers || [])
      } else {
        console.error('Error loading suppliers:', data.error)
      }
    } catch (error) {
      console.error('Error loading suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load supplier suggestions (if we have context)
  useEffect(() => {
    if (showDialog && suppliers.length > 0) {
      loadSuggestions()
    }
  }, [showDialog, suppliers])

  const loadSuggestions = async () => {
    try {
      // For now, we'll use a simple scoring based on rating
      // In a real implementation, this would use the suggestion API
      const scoredSuppliers = suppliers.map(supplier => ({
        supplier,
        score: (supplier.rating || 0) * 20 + (supplier.reliability_score || 0),
        reasoning: [
          supplier.rating ? `Calificación: ${supplier.rating}/5` : 'Sin calificación',
          supplier.reliability_score ? `Confiabilidad: ${supplier.reliability_score}%` : 'Sin datos de confiabilidad'
        ],
        estimated_cost: supplier.avg_order_amount || 0
      }))

      scoredSuppliers.sort((a, b) => b.score - a.score)
      setSuggestions(scoredSuppliers.slice(0, 5))
    } catch (error) {
      console.error('Error loading suggestions:', error)
    }
  }

  // Filter suppliers based on search
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers

    return suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [suppliers, searchTerm])

  // Get selected supplier details
  useEffect(() => {
    if (value && suppliers.length > 0) {
      const supplier = suppliers.find(s => s.id === value)
      if (supplier) {
        setSelectedSupplier(supplier)
      }
    } else {
      setSelectedSupplier(null)
    }
  }, [value, suppliers])

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

  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    onChange(supplier)
    setShowDialog(false)
  }

  const handleClearSelection = () => {
    setSelectedSupplier(null)
    onChange(null)
  }

  const SupplierCard = ({ supplier, suggestion }: { supplier: Supplier; suggestion?: SupplierSuggestion }) => (
    <Card
      key={supplier.id}
      className={`cursor-pointer transition-all hover:shadow-md ${
        selectedSupplier?.id === supplier.id ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => handleSupplierSelect(supplier)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold">{supplier.name}</h4>
              {getTypeBadge(supplier.supplier_type)}
            </div>
            {supplier.business_name && (
              <p className="text-sm text-muted-foreground mb-2">
                {supplier.business_name}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
              {supplier.city && supplier.state && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {supplier.city}, {supplier.state}
                </div>
              )}
              {supplier.rating && (
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  {supplier.rating.toFixed(1)}
                </div>
              )}
              {supplier.reliability_score && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {supplier.reliability_score}%
                </div>
              )}
            </div>

            {supplier.specialties && supplier.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {supplier.specialties.slice(0, 3).map((specialty, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
                {supplier.specialties.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{supplier.specialties.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {showPerformance && suggestion && (
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                <p className="font-medium">Puntuación: {suggestion.score.toFixed(0)}/100</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {suggestion.reasoning.slice(0, 2).map((reason, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {reason}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedSupplier?.id === supplier.id && (
            <div className="flex items-center">
              <Check className="w-5 h-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className={className}>
      {/* Selected Supplier Display */}
      {selectedSupplier ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{selectedSupplier.name}</h4>
                    {getTypeBadge(selectedSupplier.supplier_type)}
                  </div>
                  {selectedSupplier.business_name && (
                    <p className="text-sm text-muted-foreground">
                      {selectedSupplier.business_name}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    {selectedSupplier.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {selectedSupplier.rating.toFixed(1)}
                      </div>
                    )}
                    {selectedSupplier.reliability_score && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {selectedSupplier.reliability_score}%
                      </div>
                    )}
                    {selectedSupplier.total_orders && (
                      <span>{selectedSupplier.total_orders} órdenes</span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
              >
                Cambiar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={() => setShowDialog(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          {placeholder}
        </Button>
      )}

      {/* Supplier Selection Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Seleccionar Proveedor</DialogTitle>
            <DialogDescription>
              Elige un proveedor de la lista o busca uno específico
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {allowManualInput && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <h4 className="font-medium text-sm">Escribir nombre manualmente</h4>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre del proveedor (libre)"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        onManualInputChange?.(manualName)
                        setSelectedSupplier(null)
                        onChange(null)
                        setShowDialog(false)
                      }}
                      disabled={!manualName.trim()}
                    >
                      Usar este nombre
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Se guardará solo el nombre en la orden.</p>
                </CardContent>
              </Card>
            )}

            {creationEnabled && !showCreateForm && (
              <div>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Agregar nuevo proveedor al padrón
                </Button>
              </div>
            )}

            {showCreateForm && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm">Nuevo Proveedor</h4>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                      Cancelar
                    </Button>
                  </div>
                  <SupplierForm
                    onSuccess={(supplier) => {
                      setShowCreateForm(false)
                      setSelectedSupplier(supplier)
                      onChange(supplier)
                      setShowDialog(false)
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar proveedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter */}
            {filterByType && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Filtrando por:</span>
                {getTypeBadge(filterByType)}
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Proveedores Recomendados</h4>
                <div className="grid gap-3">
                  {suggestions.map(({ supplier, score, reasoning }) => (
                    <SupplierCard
                      key={supplier.id}
                      supplier={supplier}
                      suggestion={{ supplier, score, reasoning }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Suppliers */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Todos los Proveedores</h4>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2">Cargando proveedores...</span>
                </div>
              ) : filteredSuppliers.length > 0 ? (
                <div className="grid gap-3 max-h-96 overflow-y-auto">
                  {filteredSuppliers.map(supplier => (
                    <SupplierCard key={supplier.id} supplier={supplier} />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No se encontraron proveedores
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
