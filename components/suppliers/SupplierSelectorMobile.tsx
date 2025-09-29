"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
  Users,
  X,
  Filter,
  SortAsc,
  SortDesc
} from "lucide-react"
import { Supplier, SupplierType } from "@/types/suppliers"

interface SupplierSelectorMobileProps {
  value?: string | null
  onChange: (supplier: Supplier | null) => void
  placeholder?: string
  showPerformance?: boolean
  filterByType?: SupplierType
  className?: string
}

interface SupplierSuggestion {
  supplier: Supplier
  score: number
  reasoning: string[]
  estimated_cost?: number
}

export function SupplierSelectorMobile({
  value,
  onChange,
  placeholder = "Seleccionar proveedor",
  showPerformance = true,
  filterByType,
  className
}: SupplierSelectorMobileProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [suggestions, setSuggestions] = useState<SupplierSuggestion[]>([])
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'reliability'>('rating')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Load suppliers
  useEffect(() => {
    loadSuppliers()
  }, [filterByType])

  const loadSuppliers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: 'active',
        limit: '50' // Reduced for mobile
      })

      if (filterByType) {
        params.append('type', filterByType)
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

  // Load supplier suggestions
  useEffect(() => {
    if (showSheet && suppliers.length > 0) {
      loadSuggestions()
    }
  }, [showSheet, suppliers, sortBy, sortDirection])

  const loadSuggestions = async () => {
    try {
      const scoredSuppliers = suppliers.map(supplier => ({
        supplier,
        score: (supplier.rating || 0) * 20 + (supplier.reliability_score || 0),
        reasoning: [
          supplier.rating ? `Calificación: ${supplier.rating}/5` : 'Sin calificación',
          supplier.reliability_score ? `Confiabilidad: ${supplier.reliability_score}%` : 'Sin datos de confiabilidad'
        ],
        estimated_cost: supplier.avg_order_amount || 0
      }))

      // Sort suppliers
      scoredSuppliers.sort((a, b) => {
        let aValue, bValue

        switch (sortBy) {
          case 'name':
            aValue = a.supplier.name.toLowerCase()
            bValue = b.supplier.name.toLowerCase()
            break
          case 'rating':
            aValue = a.supplier.rating || 0
            bValue = b.supplier.rating || 0
            break
          case 'reliability':
            aValue = a.supplier.reliability_score || 0
            bValue = b.supplier.reliability_score || 0
            break
          default:
            aValue = a.score
            bValue = b.score
        }

        if (sortDirection === 'asc') {
          return aValue > bValue ? 1 : -1
        } else {
          return aValue < bValue ? 1 : -1
        }
      })

      setSuggestions(scoredSuppliers.slice(0, 10)) // Limit for mobile
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
      service_provider: { color: "bg-cyan-50 text-cyan-700 border-cyan-200", label: "Servicios" }
    }

    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.company

    return (
      <Badge className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    )
  }

  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    onChange(supplier)
    setShowSheet(false)
  }

  const handleClearSelection = () => {
    setSelectedSupplier(null)
    onChange(null)
  }

  const toggleSort = (field: 'name' | 'rating' | 'reliability') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDirection('desc')
    }
  }

  const SupplierCard = ({ supplier, suggestion, compact = false }: {
    supplier: Supplier
    suggestion?: SupplierSuggestion
    compact?: boolean
  }) => (
    <Card
      key={supplier.id}
      className={`cursor-pointer transition-all hover:shadow-md ${
        selectedSupplier?.id === supplier.id ? 'ring-2 ring-primary' : ''
      } ${compact ? 'p-3' : 'p-4'}`}
      onClick={() => handleSupplierSelect(supplier)}
    >
      <CardContent className={`p-0 ${compact ? 'space-y-2' : 'space-y-3'}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-semibold truncate ${compact ? 'text-sm' : ''}`}>
                {supplier.name}
              </h4>
              {getTypeBadge(supplier.supplier_type)}
            </div>
            {supplier.business_name && !compact && (
              <p className="text-sm text-muted-foreground mb-2 truncate">
                {supplier.business_name}
              </p>
            )}

            {!compact && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                {supplier.city && supplier.state && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{supplier.city}, {supplier.state}</span>
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
            )}

            {supplier.specialties && supplier.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {supplier.specialties.slice(0, compact ? 2 : 3).map((specialty, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
                {supplier.specialties.length > (compact ? 2 : 3) && (
                  <Badge variant="outline" className="text-xs">
                    +{supplier.specialties.length - (compact ? 2 : 3)}
                  </Badge>
                )}
              </div>
            )}

            {showPerformance && suggestion && !compact && (
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
            <div className="flex items-center ml-2">
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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium truncate text-sm">{selectedSupplier.name}</h4>
                  {getTypeBadge(selectedSupplier.supplier_type)}
                </div>
                {selectedSupplier.business_name && (
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedSupplier.business_name}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="ml-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Sheet open={showSheet} onOpenChange={setShowSheet}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
            >
              <Plus className="w-4 h-4 mr-2" />
              {placeholder}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
            <SheetHeader className="pb-4">
              <SheetTitle>Seleccionar Proveedor</SheetTitle>
              <SheetDescription>
                Elige un proveedor de la lista
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar proveedores..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Sort Controls */}
                <div className="flex gap-2">
                  <Button
                    variant={sortBy === 'rating' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleSort('rating')}
                    className="flex-1"
                  >
                    <Star className="w-4 h-4 mr-1" />
                    {sortDirection === 'desc' ? 'Mejor' : 'Peor'}
                  </Button>
                  <Button
                    variant={sortBy === 'name' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleSort('name')}
                    className="flex-1"
                  >
                    {sortDirection === 'asc' ? <SortAsc className="w-4 h-4 mr-1" /> : <SortDesc className="w-4 h-4 mr-1" />}
                    Nombre
                  </Button>
                </div>

                {/* Filter */}
                {filterByType && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Filtrando por:</span>
                    {getTypeBadge(filterByType)}
                  </div>
                )}
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Proveedores Recomendados</h4>
                  <div className="space-y-2">
                    {suggestions.slice(0, 3).map(({ supplier, score, reasoning }) => (
                      <SupplierCard
                        key={supplier.id}
                        supplier={supplier}
                        suggestion={{ supplier, score, reasoning }}
                        compact={true}
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
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredSuppliers.map(supplier => (
                      <SupplierCard key={supplier.id} supplier={supplier} compact={true} />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No se encontraron proveedores
                  </p>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
