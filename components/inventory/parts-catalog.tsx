"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Search, Edit, Trash2, Package } from "lucide-react"
import { toast } from "sonner"
import { InventoryPart, PartCategory } from "@/types/inventory"

export function PartsCatalog() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [parts, setParts] = useState<InventoryPart[]>([])
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedPart, setSelectedPart] = useState<InventoryPart | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 50

  // Form state
  const [formData, setFormData] = useState({
    part_number: "",
    name: "",
    description: "",
    category: "Otro" as PartCategory,
    unit_of_measure: "pcs",
    manufacturer: "",
    supplier_id: "",
    warranty_period_months: "",
    default_unit_cost: "",
    specifications: ""
  })

  useEffect(() => {
    fetchParts()
    fetchSuppliers()
  }, [page, categoryFilter, searchTerm])

  const fetchParts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        is_active: "true"
      })
      if (searchTerm) params.append('search', searchTerm)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)

      const response = await fetch(`/api/inventory/parts?${params}`)
      const result = await response.json()
      if (result.success) {
        setParts(result.parts || [])
        setTotal(result.total || 0)
      }
    } catch (error) {
      console.error('Error fetching parts:', error)
      toast.error('Error al cargar partes')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name')
      
      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const handleCreate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Debes estar autenticado')
        return
      }

      const response = await fetch('/api/inventory/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          warranty_period_months: formData.warranty_period_months ? parseInt(formData.warranty_period_months) : undefined,
          default_unit_cost: formData.default_unit_cost ? parseFloat(formData.default_unit_cost) : undefined,
          supplier_id: formData.supplier_id && formData.supplier_id !== 'none' ? formData.supplier_id : undefined,
          specifications: formData.specifications ? JSON.parse(formData.specifications) : undefined
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Parte creada exitosamente')
        setCreateDialogOpen(false)
        resetForm()
        fetchParts()
      } else {
        toast.error(result.error || 'Error al crear parte')
      }
    } catch (error) {
      console.error('Error creating part:', error)
      toast.error('Error al crear parte')
    }
  }

  const handleEdit = async () => {
    if (!selectedPart) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Debes estar autenticado')
        return
      }

      const response = await fetch(`/api/inventory/parts/${selectedPart.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          warranty_period_months: formData.warranty_period_months ? parseInt(formData.warranty_period_months) : undefined,
          default_unit_cost: formData.default_unit_cost ? parseFloat(formData.default_unit_cost) : undefined,
          supplier_id: formData.supplier_id && formData.supplier_id !== 'none' ? formData.supplier_id : undefined,
          specifications: formData.specifications ? JSON.parse(formData.specifications) : undefined
        })
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Parte actualizada exitosamente')
        setEditDialogOpen(false)
        setSelectedPart(null)
        resetForm()
        fetchParts()
      } else {
        toast.error(result.error || 'Error al actualizar parte')
      }
    } catch (error) {
      console.error('Error updating part:', error)
      toast.error('Error al actualizar parte')
    }
  }

  const handleDelete = async (part: InventoryPart) => {
    if (!confirm(`¿Estás seguro de desactivar la parte "${part.name}"?`)) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Debes estar autenticado')
        return
      }

      const response = await fetch(`/api/inventory/parts/${part.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Parte desactivada exitosamente')
        fetchParts()
      } else {
        toast.error(result.error || 'Error al desactivar parte')
      }
    } catch (error) {
      console.error('Error deleting part:', error)
      toast.error('Error al desactivar parte')
    }
  }

  const resetForm = () => {
    setFormData({
      part_number: "",
      name: "",
      description: "",
      category: "Otro",
      unit_of_measure: "pcs",
      manufacturer: "",
      supplier_id: "",
      warranty_period_months: "",
      default_unit_cost: "",
      specifications: ""
    })
  }

  const openEditDialog = (part: InventoryPart) => {
    setSelectedPart(part)
    setFormData({
      part_number: part.part_number,
      name: part.name,
      description: part.description || "",
      category: part.category,
      unit_of_measure: part.unit_of_measure,
      manufacturer: part.manufacturer || "",
      supplier_id: part.supplier_id || "",
      warranty_period_months: part.warranty_period_months?.toString() || "",
      default_unit_cost: part.default_unit_cost?.toString() || "",
      specifications: part.specifications ? JSON.stringify(part.specifications, null, 2) : ""
    })
    setEditDialogOpen(true)
  }

  const categoryLabels: Record<PartCategory, string> = {
    Repuesto: "Repuesto",
    Consumible: "Consumible",
    Herramienta: "Herramienta",
    Otro: "Otro"
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Catálogo de Partes</CardTitle>
            <div className="flex gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar partes..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                />
              </div>
              <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setPage(1) }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Repuesto">Repuestos</SelectItem>
                  <SelectItem value="Consumible">Consumibles</SelectItem>
                  <SelectItem value="Herramienta">Herramientas</SelectItem>
                  <SelectItem value="Otro">Otros</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Parte
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-4 text-center">Cargando...</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número de Parte</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Fabricante</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No hay partes registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    parts.map((part) => {
                      const supplier = suppliers.find(s => s.id === part.supplier_id)
                      return (
                        <TableRow key={part.id}>
                          <TableCell className="font-medium">{part.part_number}</TableCell>
                          <TableCell>{part.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{categoryLabels[part.category]}</Badge>
                          </TableCell>
                          <TableCell>{part.unit_of_measure}</TableCell>
                          <TableCell>{part.manufacturer || '-'}</TableCell>
                          <TableCell>{supplier?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={part.is_active ? "default" : "secondary"}>
                              {part.is_active ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(part)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {part.is_active && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(part)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {total > limit && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= total}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nueva Parte</DialogTitle>
            <DialogDescription>
              Agrega una nueva parte al catálogo de inventario
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="part_number">Número de Parte *</Label>
                <Input
                  id="part_number"
                  value={formData.part_number}
                  onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                  placeholder="FIL-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Filtro de Aceite"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción detallada de la parte..."
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoría *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value as PartCategory })}
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
                <Input
                  id="unit_of_measure"
                  value={formData.unit_of_measure}
                  onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                  placeholder="pcs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Fabricante</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="Nombre del fabricante"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_id">Proveedor</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
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
              <div className="space-y-2">
                <Label htmlFor="default_unit_cost">Costo Unitario por Defecto</Label>
                <Input
                  id="default_unit_cost"
                  type="number"
                  step="0.01"
                  value={formData.default_unit_cost}
                  onChange={(e) => setFormData({ ...formData, default_unit_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warranty_period_months">Período de Garantía (meses)</Label>
                <Input
                  id="warranty_period_months"
                  type="number"
                  value={formData.warranty_period_months}
                  onChange={(e) => setFormData({ ...formData, warranty_period_months: e.target.value })}
                  placeholder="12"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm() }}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.part_number || !formData.name || !formData.category}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Parte</DialogTitle>
            <DialogDescription>
              Actualiza la información de la parte
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_part_number">Número de Parte *</Label>
                <Input
                  id="edit_part_number"
                  value={formData.part_number}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_name">Nombre *</Label>
                <Input
                  id="edit_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Descripción</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_category">Categoría *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value as PartCategory })}
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
                <Label htmlFor="edit_unit_of_measure">Unidad de Medida</Label>
                <Input
                  id="edit_unit_of_measure"
                  value={formData.unit_of_measure}
                  onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_manufacturer">Fabricante</Label>
                <Input
                  id="edit_manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_supplier_id">Proveedor</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
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
              <div className="space-y-2">
                <Label htmlFor="edit_default_unit_cost">Costo Unitario por Defecto</Label>
                <Input
                  id="edit_default_unit_cost"
                  type="number"
                  step="0.01"
                  value={formData.default_unit_cost}
                  onChange={(e) => setFormData({ ...formData, default_unit_cost: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_warranty_period_months">Período de Garantía (meses)</Label>
                <Input
                  id="edit_warranty_period_months"
                  type="number"
                  value={formData.warranty_period_months}
                  onChange={(e) => setFormData({ ...formData, warranty_period_months: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); resetForm() }}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={!formData.name}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
