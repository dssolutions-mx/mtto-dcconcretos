"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Search,
  Star,
  MapPin,
  Plus,
  Check,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  CircleAlert,
} from "lucide-react"
import { Supplier, SupplierType } from "@/types/suppliers"
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
  /** Nombre almacenado sin `supplier_id` (ej. al editar una cotización) */
  initialManualName?: string | null
  /** Nombre a mostrar si el id del padrón no está en la lista cargada */
  registryNameFallback?: string | null
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
  businessUnitId,
  initialManualName,
  registryNameFallback,
}: SupplierSelectorProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [suggestions, setSuggestions] = useState<SupplierSuggestion[]>([])
  const [manualName, setManualName] = useState<string>("")
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false)
  const [duplicateBanner, setDuplicateBanner] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load suppliers
  useEffect(() => {
    loadSuppliers()
  }, [filterByType, businessUnitId])

  const loadSuppliers = async () => {
    setLoading(true)
    try {
      // Load all non-suspended suppliers — filter to active/certified client-side
      const params = new URLSearchParams({
        status: 'all',
        limit: '200'
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
        // Only show active and certified suppliers; sort certified first
        const eligible = (data.suppliers || []).filter(
          (s: Supplier) => s.status === 'active' || s.status === 'active_certified'
        )
        eligible.sort((a: Supplier, b: Supplier) => {
          if (a.status === 'active_certified' && b.status !== 'active_certified') return -1
          if (b.status === 'active_certified' && a.status !== 'active_certified') return 1
          return 0
        })
        setSuppliers(eligible)
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

  useEffect(() => {
    if (showDialog) {
      setDuplicateBanner(null)
    }
  }, [showDialog])

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

  // Get selected supplier details (y fallback si el id no está en el padrón cargado)
  useEffect(() => {
    if (!value) {
      setSelectedSupplier(null)
      return
    }
    if (suppliers.length === 0) return
    const supplier = suppliers.find((s) => s.id === value)
    if (supplier) {
      setSelectedSupplier(supplier)
    } else if (registryNameFallback?.trim()) {
      setSelectedSupplier({
        id: value,
        name: registryNameFallback.trim(),
        supplier_type: "company",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Supplier)
    } else {
      setSelectedSupplier(null)
    }
  }, [value, suppliers, registryNameFallback])

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

  const isCertified = (supplier: Supplier) => supplier.status === 'active_certified'

  const handleSupplierSelect = (supplier: Supplier) => {
    setDuplicateBanner(null)
    setSelectedSupplier(supplier)
    onChange(supplier)
    setShowDialog(false)
  }

  const handleDuplicateBlocked = (payload: { message: string; searchedName: string }) => {
    setShowCreateForm(false)
    setDuplicateBanner(payload.message)
    if (payload.searchedName) setSearchTerm(payload.searchedName)
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  const handleClearSelection = () => {
    setSelectedSupplier(null)
    onChange(null)
  }

  const SupplierCard = ({ supplier, suggestion }: { supplier: Supplier; suggestion?: SupplierSuggestion }) => {
    const certified = isCertified(supplier)
    return (
      <Card
        key={supplier.id}
        className={`transition-all cursor-pointer hover:shadow-md ${
          selectedSupplier?.id === supplier.id ? 'ring-2 ring-primary' : ''
        }`}
        onClick={() => handleSupplierSelect(supplier)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h4 className="font-semibold">{supplier.name}</h4>
                {getTypeBadge(supplier.supplier_type)}
                {certified ? (
                  <Badge className="bg-green-50 text-green-700 border border-green-300 text-xs flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Certificado
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-300 text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Sin Certificar
                  </Badge>
                )}
              </div>
              {supplier.business_name && (
                <p className="text-sm text-muted-foreground mb-2">{supplier.business_name}</p>
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

              {!certified && (
                <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 mt-1">
                  Completa RFC y datos bancarios para certificar al proveedor
                </p>
              )}

              {supplier.specialties && supplier.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {supplier.specialties.slice(0, 3).map((specialty, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {String(specialty).replace(/_/g, ' ')}
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
  }

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
      ) : !value && initialManualName?.trim() ? (
        <Card className="border-border/80 bg-muted/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="font-medium text-sm">Proveedor (solo nombre)</h4>
                <p className="text-sm text-muted-foreground">{initialManualName.trim()}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (initialManualName) setManualName(initialManualName)
                  setShowDialog(true)
                }}
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
            <DialogTitle>Seleccionar proveedor</DialogTitle>
            <DialogDescription>
              Busca en el padrón primero; solo agrega uno nuevo si no aparece en la lista.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {duplicateBanner && (
              <Alert
                variant="destructive"
                className="border-destructive/40 bg-destructive/5"
              >
                <CircleAlert className="h-4 w-4" aria-hidden />
                <AlertTitle>Proveedor duplicado</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{duplicateBanner}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 border-destructive/40 bg-background"
                    onClick={() => setDuplicateBanner(null)}
                  >
                    Entendido, ocultar aviso
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Search first — primary action after duplicate */}
            <div className="relative">
              <label htmlFor="supplier-selector-search" className="sr-only">
                Buscar en el padrón de proveedores
              </label>
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
                aria-hidden
              />
              <Input
                id="supplier-selector-search"
                ref={searchInputRef}
                placeholder="Buscar por nombre comercial, razón social o contacto…"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  if (duplicateBanner) setDuplicateBanner(null)
                }}
                className="pl-10"
                autoComplete="off"
              />
            </div>

            {filterByType && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground">Filtrando por tipo:</span>
                {getTypeBadge(filterByType)}
              </div>
            )}

            {suggestions.length > 0 && searchTerm.trim() === "" && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground">Sugeridos</h4>
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

            <div className="space-y-2">
              <h4 className="font-medium text-sm">
                Padrón
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  certificados primero
                </span>
              </h4>
              {loading ? (
                <div
                  className="flex items-center justify-center py-10 text-sm text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  <div
                    className="animate-spin rounded-full h-8 w-8 border-2 border-muted-foreground/20 border-t-primary mr-3"
                    aria-hidden
                  />
                  Cargando proveedores…
                </div>
              ) : filteredSuppliers.length > 0 ? (
                <div className="grid gap-3 max-h-[min(24rem,50vh)] overflow-y-auto rounded-md border border-border/60 bg-muted/20 p-2">
                  {filteredSuppliers.map((s) => (
                    <SupplierCard key={s.id} supplier={s} />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border/80 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                  <p className="font-medium text-foreground/90">
                    {searchTerm.trim()
                      ? "Ningún resultado con ese criterio"
                      : "Escribe en el buscador o revisa la lista"}
                  </p>
                  {duplicateBanner && searchTerm.trim() !== "" && (
                    <p className="mt-2 text-xs leading-relaxed">
                      Si el proveedor ya existe pero no lo ves, puede estar en otra unidad de negocio o
                      con otro nombre en el padrón. Prueba otra búsqueda o quita filtros del listado
                      cargado.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="h-px w-full bg-border/60" aria-hidden />

            {allowManualInput && (
              <Card className="border-border/80 shadow-none">
                <CardContent className="p-4 space-y-2">
                  <h4 className="font-medium text-sm">Solo nombre en la orden</h4>
                  <p className="text-xs text-muted-foreground">
                    Sin registrar en el padrón; útil para compras puntuales.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      placeholder="Nombre del proveedor"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                    />
                    <Button
                      type="button"
                      className="shrink-0"
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
                </CardContent>
              </Card>
            )}

            {creationEnabled && (
              <Card className="border-border/80 shadow-none">
                <CardContent className="p-4 space-y-3">
                  {!showCreateForm ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Registra al proveedor en el padrón solo si no aparece arriba.
                      </p>
                      <Button type="button" variant="outline" onClick={() => setShowCreateForm(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Registrar nuevo proveedor en el padrón
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm">Nuevo proveedor</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCreateForm(false)}
                        >
                          Volver al buscador
                        </Button>
                      </div>
                      <SupplierForm
                        onDuplicateBlocked={handleDuplicateBlocked}
                        onSuccess={(supplier) => {
                          setShowCreateForm(false)
                          setDuplicateBanner(null)
                          setSelectedSupplier(supplier)
                          onChange(supplier)
                          setShowDialog(false)
                        }}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
