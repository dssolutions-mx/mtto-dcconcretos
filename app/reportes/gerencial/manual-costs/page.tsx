'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, RefreshCw, DollarSign, Building2, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type BusinessUnit = {
  id: string
  name: string
  code: string
}

type Plant = {
  id: string
  name: string
  code: string
  business_unit_id: string
}

type Adjustment = {
  id: string
  business_unit_id: string | null
  plant_id: string | null
  period_month: string
  category: 'nomina' | 'otros_indirectos'
  department: string | null
  subcategory: string | null
  description: string | null
  amount: number
  notes: string | null
  created_at: string
  plant?: { id: string; name: string; code: string }
  business_unit?: { id: string; name: string; code: string }
  created_by_profile?: { id: string; full_name: string; email: string }
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

export default function ManualCostsAdminPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterBusinessUnitId, setFilterBusinessUnitId] = useState<string>('')
  const [filterPlantId, setFilterPlantId] = useState<string>('')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAdjustment, setEditingAdjustment] = useState<Adjustment | null>(null)
  
  // Form state
  const [formBusinessUnitId, setFormBusinessUnitId] = useState<string>('')
  const [formPlantId, setFormPlantId] = useState<string>('')
  const [formCategory, setFormCategory] = useState<'nomina' | 'otros_indirectos'>('nomina')
  const [formDepartment, setFormDepartment] = useState('')
  const [formSubcategory, setFormSubcategory] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Load filters data
  useEffect(() => {
    loadFiltersData()
  }, [])

  // Load adjustments when filters change
  useEffect(() => {
    if (selectedMonth) {
      loadAdjustments()
    }
  }, [selectedMonth, filterBusinessUnitId, filterPlantId])

  const loadFiltersData = async () => {
    try {
      const [buResp, plantResp] = await Promise.all([
        fetch('/api/business-units'),
        fetch('/api/plants')
      ])
      
      if (buResp.ok) {
        const buData = await buResp.json()
        setBusinessUnits(buData)
      }
      
      if (plantResp.ok) {
        const plantData = await plantResp.json()
        setPlants(plantData)
      }
    } catch (err) {
      console.error('Failed to load filters:', err)
    }
  }

  const loadAdjustments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ month: selectedMonth })
      if (filterPlantId) params.append('plantId', filterPlantId)
      else if (filterBusinessUnitId) params.append('businessUnitId', filterBusinessUnitId)

      const resp = await fetch(`/api/reports/gerencial/manual-costs?${params}`)
      const data = await resp.json()
      
      if (resp.ok) {
        setAdjustments(data.adjustments || [])
      } else {
        throw new Error(data.error || 'Failed to load adjustments')
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to load manual costs',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const openCreateDialog = () => {
    setEditingAdjustment(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (adjustment: Adjustment) => {
    setEditingAdjustment(adjustment)
    setFormBusinessUnitId(adjustment.business_unit_id || '')
    setFormPlantId(adjustment.plant_id || '')
    setFormCategory(adjustment.category)
    setFormDepartment(adjustment.department || '')
    setFormSubcategory(adjustment.subcategory || '')
    setFormDescription(adjustment.description || '')
    setFormAmount(String(adjustment.amount))
    setFormNotes(adjustment.notes || '')
    setDialogOpen(true)
  }

  const resetForm = () => {
    setFormBusinessUnitId('')
    setFormPlantId('')
    setFormCategory('nomina')
    setFormDepartment('')
    setFormSubcategory('')
    setFormDescription('')
    setFormAmount('')
    setFormNotes('')
  }

  const handleSubmit = async () => {
    if (!formAmount || parseFloat(formAmount) <= 0) {
      toast({
        title: 'Error',
        description: 'Amount must be greater than 0',
        variant: 'destructive'
      })
      return
    }

    if (!formPlantId && !formBusinessUnitId) {
      toast({
        title: 'Error',
        description: 'Please select either a Business Unit or a Plant',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      if (editingAdjustment) {
        // Update
        const resp = await fetch('/api/reports/gerencial/manual-costs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingAdjustment.id,
            department: formDepartment || null,
            subcategory: formSubcategory || null,
            description: formDescription || null,
            amount: parseFloat(formAmount),
            notes: formNotes || null
          })
        })

        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error)

        toast({
          title: 'Success',
          description: 'Manual cost updated successfully'
        })
      } else {
        // Create
        const resp = await fetch('/api/reports/gerencial/manual-costs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessUnitId: formBusinessUnitId || null,
            plantId: formPlantId || null,
            month: selectedMonth,
            category: formCategory,
            department: formDepartment || null,
            subcategory: formSubcategory || null,
            description: formDescription || null,
            amount: parseFloat(formAmount),
            notes: formNotes || null
          })
        })

        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error)

        toast({
          title: 'Success',
          description: 'Manual cost created successfully'
        })
      }

      setDialogOpen(false)
      resetForm()
      loadAdjustments()
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save manual cost',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return

    setLoading(true)
    try {
      const resp = await fetch(`/api/reports/gerencial/manual-costs?id=${id}`, {
        method: 'DELETE'
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error)

      toast({
        title: 'Success',
        description: 'Manual cost deleted successfully'
      })
      loadAdjustments()
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete manual cost',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const availablePlants = formBusinessUnitId
    ? plants.filter(p => p.business_unit_id === formBusinessUnitId)
    : plants

  const filterAvailablePlants = filterBusinessUnitId
    ? plants.filter(p => p.business_unit_id === filterBusinessUnitId)
    : plants

  // Aggregate totals by category
  const totals = adjustments.reduce(
    (acc, adj) => {
      if (adj.category === 'nomina') {
        acc.nomina += Number(adj.amount)
      } else {
        acc.otros_indirectos += Number(adj.amount)
      }
      acc.total += Number(adj.amount)
      return acc
    },
    { nomina: 0, otros_indirectos: 0, total: 0 }
  )

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Costos Manuales - Admin</h1>
          <p className="text-muted-foreground">
            Gestión de nómina y costos indirectos para reporte gerencial
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Costo
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="month">Mes</Label>
              <Input
                id="month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="filterBu">Unidad de Negocio</Label>
              <Select
                value={filterBusinessUnitId || 'all'}
                onValueChange={(val) => {
                  setFilterBusinessUnitId(val === 'all' ? '' : val)
                  setFilterPlantId('')
                }}
              >
                <SelectTrigger id="filterBu">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las unidades</SelectItem>
                  {businessUnits.map(bu => (
                    <SelectItem key={bu.id} value={bu.id}>{bu.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filterPlant">Planta</Label>
              <Select
                value={filterPlantId || 'all'}
                onValueChange={(val) => setFilterPlantId(val === 'all' ? '' : val)}
              >
                <SelectTrigger id="filterPlant">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las plantas</SelectItem>
                  {filterAvailablePlants.map(plant => (
                    <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={loadAdjustments} disabled={loading} className="w-full">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Cargando...' : 'Actualizar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totals Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nómina Total</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.nomina)}</div>
            <p className="text-xs text-muted-foreground">{adjustments.filter(a => a.category === 'nomina').length} entradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Otros Indirectos Total</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.otros_indirectos)}</div>
            <p className="text-xs text-muted-foreground">{adjustments.filter(a => a.category === 'otros_indirectos').length} entradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total General</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
            <p className="text-xs text-muted-foreground">{adjustments.length} entradas totales</p>
          </CardContent>
        </Card>
      </div>

      {/* Adjustments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registros de Costos Manuales</CardTitle>
          <CardDescription>
            Listado de entradas para {selectedMonth}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead>Planta / BU</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Subcategoría</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Creado por</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No hay registros para este mes
                  </TableCell>
                </TableRow>
              ) : (
                adjustments.map(adj => (
                  <TableRow key={adj.id}>
                    <TableCell>
                      <Badge variant={adj.category === 'nomina' ? 'default' : 'secondary'}>
                        {adj.category === 'nomina' ? 'Nómina' : 'Otros Indirectos'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {adj.plant ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          <span className="text-sm">{adj.plant.name}</span>
                        </div>
                      ) : adj.business_unit ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          <span className="text-sm">{adj.business_unit.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{adj.department || '-'}</TableCell>
                    <TableCell>{adj.subcategory || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{adj.description || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(adj.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {adj.created_by_profile?.full_name || 'Unknown'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(adj)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(adj.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAdjustment ? 'Editar Costo Manual' : 'Agregar Costo Manual'}
            </DialogTitle>
            <DialogDescription>
              {editingAdjustment
                ? 'Actualiza los detalles del costo manual'
                : 'Ingresa los detalles del nuevo costo manual'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {!editingAdjustment && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="formBu">Unidad de Negocio</Label>
                    <Select
                      value={formBusinessUnitId || 'none'}
                      onValueChange={(val) => {
                        setFormBusinessUnitId(val === 'none' ? '' : val)
                        setFormPlantId('')
                      }}
                    >
                      <SelectTrigger id="formBu">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguna</SelectItem>
                        {businessUnits.map(bu => (
                          <SelectItem key={bu.id} value={bu.id}>{bu.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="formPlant">Planta</Label>
                    <Select
                      value={formPlantId || 'none'}
                      onValueChange={(val) => setFormPlantId(val === 'none' ? '' : val)}
                    >
                      <SelectTrigger id="formPlant">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguna</SelectItem>
                        {availablePlants.map(plant => (
                          <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="formCategory">Categoría</Label>
                  <Select
                    value={formCategory}
                    onValueChange={(val) => setFormCategory(val as 'nomina' | 'otros_indirectos')}
                  >
                    <SelectTrigger id="formCategory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nomina">Nómina</SelectItem>
                      <SelectItem value="otros_indirectos">Otros Indirectos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="formDepartment">Departamento (Opcional)</Label>
                <Input
                  id="formDepartment"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  placeholder="ej: RH, Operaciones, Admin"
                />
              </div>

              <div>
                <Label htmlFor="formSubcategory">Subcategoría (Opcional)</Label>
                <Input
                  id="formSubcategory"
                  value={formSubcategory}
                  onChange={(e) => setFormSubcategory(e.target.value)}
                  placeholder="ej: Salarios, Bonos, Servicios"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="formDescription">Descripción (Opcional)</Label>
              <Input
                id="formDescription"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descripción breve del costo"
              />
            </div>

            <div>
              <Label htmlFor="formAmount">Monto *</Label>
              <Input
                id="formAmount"
                type="number"
                step="0.01"
                min="0"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="formNotes">Notas (Opcional)</Label>
              <Textarea
                id="formNotes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Notas adicionales o detalles"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Guardando...' : editingAdjustment ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


