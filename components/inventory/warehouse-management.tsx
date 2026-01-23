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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Search, Edit, Trash2, Building2, MapPin } from "lucide-react"
import { toast } from "sonner"
import { InventoryWarehouse } from "@/types/inventory"

export function WarehouseManagement() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([])
  const [plants, setPlants] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState<InventoryWarehouse | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    plant_id: "",
    warehouse_code: "",
    name: "",
    location_notes: "",
    is_primary: false
  })

  useEffect(() => {
    fetchWarehouses()
    fetchPlants()
  }, [])

  const fetchWarehouses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/inventory/warehouses')
      const result = await response.json()
      if (result.success) {
        setWarehouses(result.warehouses || [])
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
      toast.error('Error al cargar almacenes')
    } finally {
      setLoading(false)
    }
  }

  const fetchPlants = async () => {
    try {
      const { data, error } = await supabase
        .from('plants')
        .select('id, name')
        .order('name')
      
      if (error) throw error
      setPlants(data || [])
    } catch (error) {
      console.error('Error fetching plants:', error)
    }
  }

  const handleCreate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Debes estar autenticado')
        return
      }

      const response = await fetch('/api/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Almacén creado exitosamente')
        setCreateDialogOpen(false)
        resetForm()
        fetchWarehouses()
      } else {
        toast.error(result.error || 'Error al crear almacén')
      }
    } catch (error) {
      console.error('Error creating warehouse:', error)
      toast.error('Error al crear almacén')
    }
  }

  const handleEdit = async () => {
    if (!selectedWarehouse) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Debes estar autenticado')
        return
      }

      const response = await fetch(`/api/inventory/warehouses/${selectedWarehouse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Almacén actualizado exitosamente')
        setEditDialogOpen(false)
        setSelectedWarehouse(null)
        resetForm()
        fetchWarehouses()
      } else {
        toast.error(result.error || 'Error al actualizar almacén')
      }
    } catch (error) {
      console.error('Error updating warehouse:', error)
      toast.error('Error al actualizar almacén')
    }
  }

  const handleDelete = async (warehouse: InventoryWarehouse) => {
    if (!confirm(`¿Estás seguro de desactivar el almacén "${warehouse.name}"?`)) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Debes estar autenticado')
        return
      }

      const response = await fetch(`/api/inventory/warehouses/${warehouse.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (result.success) {
        toast.success('Almacén desactivado exitosamente')
        fetchWarehouses()
      } else {
        toast.error(result.error || 'Error al desactivar almacén')
      }
    } catch (error) {
      console.error('Error deleting warehouse:', error)
      toast.error('Error al desactivar almacén')
    }
  }

  const resetForm = () => {
    setFormData({
      plant_id: "",
      warehouse_code: "",
      name: "",
      location_notes: "",
      is_primary: false
    })
  }

  const openEditDialog = (warehouse: InventoryWarehouse) => {
    setSelectedWarehouse(warehouse)
    setFormData({
      plant_id: warehouse.plant_id,
      warehouse_code: warehouse.warehouse_code,
      name: warehouse.name,
      location_notes: warehouse.location_notes || "",
      is_primary: warehouse.is_primary
    })
    setEditDialogOpen(true)
  }

  const filteredWarehouses = warehouses.filter(w =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.warehouse_code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="p-4">Cargando...</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Almacenes de Inventario</CardTitle>
            <div className="flex gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar almacenes..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Almacén
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Planta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWarehouses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No hay almacenes registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWarehouses.map((warehouse) => {
                    const plant = plants.find(p => p.id === warehouse.plant_id)
                    return (
                      <TableRow key={warehouse.id}>
                        <TableCell className="font-medium">{warehouse.warehouse_code}</TableCell>
                        <TableCell>{warehouse.name}</TableCell>
                        <TableCell>{plant?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={warehouse.is_active ? "default" : "secondary"}>
                            {warehouse.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {warehouse.is_primary && (
                            <Badge variant="outline">Principal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(warehouse)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {warehouse.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(warehouse)}
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
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Almacén</DialogTitle>
            <DialogDescription>
              Crea un nuevo almacén de inventario para una planta
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plant_id">Planta *</Label>
              <Select
                value={formData.plant_id}
                onValueChange={(value) => setFormData({ ...formData, plant_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar planta" />
                </SelectTrigger>
                <SelectContent>
                  {plants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id}>
                      {plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warehouse_code">Código *</Label>
                <Input
                  id="warehouse_code"
                  value={formData.warehouse_code}
                  onChange={(e) => setFormData({ ...formData, warehouse_code: e.target.value })}
                  placeholder="ALM-001-PARTS"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Almacén Principal"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_notes">Notas de Ubicación</Label>
              <Textarea
                id="location_notes"
                value={formData.location_notes}
                onChange={(e) => setFormData({ ...formData, location_notes: e.target.value })}
                placeholder="Ubicación física del almacén..."
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
              />
              <Label htmlFor="is_primary">Almacén principal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm() }}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.plant_id || !formData.warehouse_code || !formData.name}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Almacén</DialogTitle>
            <DialogDescription>
              Actualiza la información del almacén
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_plant_id">Planta *</Label>
              <Select
                value={formData.plant_id}
                onValueChange={(value) => setFormData({ ...formData, plant_id: value })}
                disabled
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar planta" />
                </SelectTrigger>
                <SelectContent>
                  {plants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id}>
                      {plant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_warehouse_code">Código *</Label>
                <Input
                  id="edit_warehouse_code"
                  value={formData.warehouse_code}
                  onChange={(e) => setFormData({ ...formData, warehouse_code: e.target.value })}
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
              <Label htmlFor="edit_location_notes">Notas de Ubicación</Label>
              <Textarea
                id="edit_location_notes"
                value={formData.location_notes}
                onChange={(e) => setFormData({ ...formData, location_notes: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit_is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
              />
              <Label htmlFor="edit_is_primary">Almacén principal</Label>
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
