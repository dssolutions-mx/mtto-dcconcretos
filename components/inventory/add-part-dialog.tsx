"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Package } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"

export interface AddPartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialName?: string
  initialPartNumber?: string
  onPartCreated: (part: {
    id: string
    part_number: string
    name: string
    description?: string
    default_unit_cost?: number
    unit_of_measure?: string
    category?: string
  }) => void
}

export function AddPartDialog({
  open,
  onOpenChange,
  initialName = "",
  initialPartNumber = "",
  onPartCreated
}: AddPartDialogProps) {
  const [formData, setFormData] = useState({
    part_number: initialPartNumber,
    name: initialName,
    description: "",
    category: "Repuesto" as "Repuesto" | "Consumible" | "Herramienta" | "Otro",
    unit_of_measure: "pcs",
    manufacturer: "",
    default_unit_cost: "",
    supplier_id: ""
  })
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true)

  // Load suppliers when dialog opens
  useEffect(() => {
    if (open) {
      loadSuppliers()
    }
  }, [open])

  const loadSuppliers = async () => {
    try {
      setIsLoadingSuppliers(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name')
      
      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error loading suppliers:', error)
    } finally {
      setIsLoadingSuppliers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.part_number || !formData.name || !formData.category) {
      toast.error('Número de parte, nombre y categoría son requeridos')
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error('Debes estar autenticado')
        return
      }

      const response = await fetch('/api/inventory/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_number: formData.part_number.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          category: formData.category,
          unit_of_measure: formData.unit_of_measure || 'pcs',
          manufacturer: formData.manufacturer.trim() || undefined,
          default_unit_cost: formData.default_unit_cost ? parseFloat(formData.default_unit_cost) : undefined,
          supplier_id: formData.supplier_id && formData.supplier_id !== 'none' ? formData.supplier_id : undefined
        })
      })

      const result = await response.json()
      
      if (result.success && result.data) {
        toast.success('Parte agregada al catálogo')
        onPartCreated({
          id: result.data.id,
          part_number: result.data.part_number,
          name: result.data.name,
          description: result.data.description,
          default_unit_cost: result.data.default_unit_cost,
          unit_of_measure: result.data.unit_of_measure,
          category: result.data.category
        })
        onOpenChange(false)
        // Reset form
        setFormData({
          part_number: "",
          name: "",
          description: "",
          category: "Repuesto",
          unit_of_measure: "pcs",
          manufacturer: "",
          default_unit_cost: "",
          supplier_id: ""
        })
      } else {
        const errorMessage = result.error || result.details || 'Error al crear parte'
        toast.error(errorMessage)
        
        // If part number already exists, highlight the field
        if (errorMessage.includes('already exists') || errorMessage.includes('ya existe')) {
          // Keep form data so user can fix it
        }
      }
    } catch (error) {
      console.error('Error creating part:', error)
      toast.error('Error al crear parte')
    } finally {
      setIsLoading(false)
    }
  }

  // Update form when initial values change
  useEffect(() => {
    if (open) {
      // Try to extract part number if it looks like one (e.g., "FIL-123" or "ABC123")
      let extractedPartNumber = initialPartNumber
      let extractedName = initialName
      
      if (initialName && !initialPartNumber) {
        // Check if the name contains something that looks like a part number
        const partNumberMatch = initialName.match(/([A-Z0-9-]{3,})/i)
        if (partNumberMatch) {
          extractedPartNumber = partNumberMatch[1]
          extractedName = initialName.replace(partNumberMatch[0], '').trim()
        }
      }
      
      setFormData(prev => ({
        ...prev,
        name: extractedName || prev.name,
        part_number: extractedPartNumber || prev.part_number
      }))
    } else {
      // Reset form when dialog closes
      setFormData({
        part_number: "",
        name: "",
        description: "",
        category: "Repuesto",
        unit_of_measure: "pcs",
        manufacturer: "",
        default_unit_cost: "",
        supplier_id: ""
      })
    }
  }, [open, initialName, initialPartNumber])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Agregar Parte al Catálogo
          </DialogTitle>
          <DialogDescription>
            Agregue una nueva parte al catálogo de inventario. Los campos marcados con * son obligatorios.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="part_number">
                Número de Parte <span className="text-red-500">*</span>
              </Label>
              <Input
                id="part_number"
                value={formData.part_number}
                onChange={(e) => setFormData(prev => ({ ...prev, part_number: e.target.value }))}
                placeholder="Ej: FIL-123"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Filtro de aceite"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">
                Categoría <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value: "Repuesto" | "Consumible" | "Herramienta" | "Otro") => 
                  setFormData(prev => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Repuesto">Repuesto</SelectItem>
                  <SelectItem value="Consumible">Consumible</SelectItem>
                  <SelectItem value="Herramienta">Herramienta</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_of_measure">Unidad de Medida</Label>
              <Select
                value={formData.unit_of_measure}
                onValueChange={(value) => setFormData(prev => ({ ...prev, unit_of_measure: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">Piezas (pcs)</SelectItem>
                  <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                  <SelectItem value="L">Litros (L)</SelectItem>
                  <SelectItem value="m">Metros (m)</SelectItem>
                  <SelectItem value="m²">Metros cuadrados (m²)</SelectItem>
                  <SelectItem value="m³">Metros cúbicos (m³)</SelectItem>
                  <SelectItem value="gal">Galones (gal)</SelectItem>
                  <SelectItem value="lb">Libras (lb)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                placeholder="Ej: Caterpillar"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_unit_cost">Costo Unitario por Defecto</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  id="default_unit_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.default_unit_cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, default_unit_cost: e.target.value }))}
                  placeholder="0.00"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="supplier_id">Proveedor</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}
                disabled={isLoadingSuppliers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingSuppliers ? "Cargando..." : "Seleccionar proveedor (opcional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción adicional de la parte..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agregando...
                </>
              ) : (
                <>
                  <Package className="mr-2 h-4 w-4" />
                  Agregar al Catálogo
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
