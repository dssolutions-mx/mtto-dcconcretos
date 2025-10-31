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
import { Plus, Pencil, Trash2, RefreshCw, DollarSign, Building2, Calendar, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { DistributionMethodToggle } from '@/components/manual-costs/distribution-method-toggle'
import { DistributionTable } from '@/components/manual-costs/distribution-table'
import { VolumeDistributionView } from '@/components/manual-costs/volume-distribution-view'
import { Checkbox } from '@/components/ui/checkbox'

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

type Distribution = {
  id: string
  type: 'plant' | 'businessUnit' | 'department'
  plantId?: string
  businessUnitId?: string
  department?: string
  percentage: number
  amount: number
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
  is_bonus?: boolean
  is_cash_payment?: boolean
  is_distributed?: boolean
  distribution_method?: 'percentage' | 'volume' | null
  created_at: string
  plant?: { id: string; name: string; code: string }
  business_unit?: { id: string; name: string; code: string }
  created_by_profile?: { id: string; nombre: string | null; apellido: string | null; email: string | null }
  distributions?: Array<{
    id: string
    plant_id?: string
    business_unit_id?: string
    department?: string
    percentage: number
    amount: number
    volume_m3?: number
    plant?: { id: string; name: string; code: string }
    business_unit?: { id: string; name: string; code: string }
  }>
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
  const [formIsBonus, setFormIsBonus] = useState(false)
  const [formIsCashPayment, setFormIsCashPayment] = useState(false)
  const [formDistributionMethod, setFormDistributionMethod] = useState<'percentage' | 'volume' | null>(null)
  const [formDistributions, setFormDistributions] = useState<Distribution[]>([])
  const [volumeDistributionsData, setVolumeDistributionsData] = useState<Array<{ plantId: string; volumeM3: number }>>([])
  const [departments, setDepartments] = useState<string[]>([])

  // Load filters data
  useEffect(() => {
    loadFiltersData()
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    try {
      const resp = await fetch('/api/departments')
      if (resp.ok) {
        const data = await resp.json()
        setDepartments(data.departments || [])
      }
    } catch (err) {
      console.error('Failed to load departments:', err)
    }
  }

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
        setBusinessUnits(buData.business_units || [])
      }
      
      if (plantResp.ok) {
        const plantData = await plantResp.json()
        setPlants(plantData.plants || [])
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
        console.log('Loaded adjustments:', data.adjustments?.length || 0, 'for month:', selectedMonth)
        setAdjustments(data.adjustments || [])
      } else {
        console.error('Failed to load adjustments:', data.error)
        throw new Error(data.error || 'Failed to load adjustments')
      }
    } catch (err: any) {
      console.error('Error loading adjustments:', err)
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
    setFormIsBonus(adjustment.is_bonus || false)
    setFormIsCashPayment(adjustment.is_cash_payment || false)
    setFormDistributionMethod(adjustment.distribution_method || null)
    
    // Convert distributions to form format
    if (adjustment.distributions && adjustment.distributions.length > 0) {
      const formDists: Distribution[] = adjustment.distributions.map((dist, idx) => {
        let type: 'plant' | 'businessUnit' | 'department' = 'plant'
        if (dist.business_unit_id) type = 'businessUnit'
        else if (dist.department) type = 'department'
        
        return {
          id: dist.id || `dist-${idx}`,
          type,
          plantId: dist.plant_id,
          businessUnitId: dist.business_unit_id,
          department: dist.department,
          percentage: dist.percentage,
          amount: dist.amount
        }
      })
      setFormDistributions(formDists)
    } else {
      setFormDistributions([])
    }
    
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
    setFormIsBonus(false)
    setFormIsCashPayment(false)
    setFormDistributionMethod(null)
    setFormDistributions([])
    setVolumeDistributionsData([])
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

    // Validate: either plant OR (BU/distributions) must be provided
    const hasDirectPlantAssignment = !!formPlantId
    const hasBusinessUnit = !!formBusinessUnitId
    const hasDistributions = formDistributions.length > 0

    // If plant is selected, no distributions needed
    // If only BU is selected, distributions are required to allocate to plants
    // If nothing selected, distributions are required
    if (!hasDirectPlantAssignment && !hasDistributions) {
      toast({
        title: 'Error',
        description: hasBusinessUnit 
          ? 'Por favor configure distribuciones para asignar el costo a las plantas de esta unidad de negocio'
          : 'Please select either a Plant or configure distributions',
        variant: 'destructive'
      })
      return
    }

    if (hasDistributions && !formDistributionMethod) {
      toast({
        title: 'Error',
        description: 'Please select a distribution method',
        variant: 'destructive'
      })
      return
    }

    // Convert distributions to API format
    const distributionsApi = formDistributions.map(dist => {
      const base: any = {
        percentage: dist.percentage,
        amount: dist.amount
      }
      if (dist.type === 'plant' && dist.plantId) {
        base.plantId = dist.plantId
        // Add volume if this is from volume-based distribution
        const volDist = volumeDistributionsData.find(vd => vd.plantId === dist.plantId)
        if (volDist) {
          base.volumeM3 = volDist.volumeM3
        }
      } else if (dist.type === 'businessUnit' && dist.businessUnitId) {
        base.businessUnitId = dist.businessUnitId
      } else if (dist.type === 'department' && dist.department) {
        base.department = dist.department
      }
      return base
    })

    setLoading(true)
    try {
      const basePayload: any = {
        department: formDepartment || null,
        subcategory: formSubcategory || null,
        description: formDescription || null,
        amount: parseFloat(formAmount),
        notes: formNotes || null,
        isBonus: formIsBonus,
        isCashPayment: formIsCashPayment
      }

      if (editingAdjustment) {
        // Update
        basePayload.id = editingAdjustment.id
        if (hasDistributions) {
          basePayload.distributionMethod = formDistributionMethod
          basePayload.distributions = distributionsApi
        } else {
          basePayload.distributionMethod = null
          basePayload.distributions = []
        }

        const resp = await fetch('/api/reports/gerencial/manual-costs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(basePayload)
        })

        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error)

        toast({
          title: 'Success',
          description: 'Manual cost updated successfully'
        })
      } else {
        // Create
        // Note: If only BU is selected (no plant), we require distributions
        // In this case, don't send businessUnitId as it will be distributed to plants
        const payload = {
          ...basePayload,
          businessUnitId: (hasDirectPlantAssignment || !hasDistributions) ? (formBusinessUnitId || null) : null,
          plantId: formPlantId || null,
          month: selectedMonth,
          category: formCategory,
          distributionMethod: hasDistributions ? formDistributionMethod : null,
          distributions: hasDistributions ? distributionsApi : []
        }

        const resp = await fetch('/api/reports/gerencial/manual-costs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
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

  // Distribution helpers
  const addDistribution = () => {
    const newDist: Distribution = {
      id: `dist-${Date.now()}`,
      type: 'plant',
      percentage: 0,
      amount: 0
    }
    setFormDistributions([...formDistributions, newDist])
  }

  const removeDistribution = (id: string) => {
    setFormDistributions(formDistributions.filter(d => d.id !== id))
  }

  const updateDistribution = (id: string, updates: Partial<Distribution>) => {
    setFormDistributions(formDistributions.map(d => {
      if (d.id === id) {
        const updated = { ...d, ...updates }
        // Recalculate amount if percentage changed
        if (updates.percentage !== undefined) {
          updated.amount = (parseFloat(formAmount || '0') * updated.percentage) / 100
        }
        return updated
      }
      return d
    }))
  }

  const handleVolumeDistributionsChange = (distributions: Array<{
    plantId: string
    percentage: number
    amount: number
    volumeM3: number
  }>) => {
    // Store volume data for API submission
    setVolumeDistributionsData(distributions.map(d => ({ plantId: d.plantId, volumeM3: d.volumeM3 })))
    const formDists: Distribution[] = distributions.map((dist, idx) => ({
      id: `vol-dist-${idx}`,
      type: 'plant' as const,
      plantId: dist.plantId,
      percentage: dist.percentage,
      amount: dist.amount
    }))
    setFormDistributions(formDists)
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
                <TableHead>Bono</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Creado por</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No hay registros para este mes
                  </TableCell>
                </TableRow>
              ) : (
                adjustments.map(adj => (
                  <TableRow key={adj.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={adj.category === 'nomina' ? 'default' : 'secondary'}>
                          {adj.category === 'nomina' ? 'Nómina' : 'Otros Indirectos'}
                        </Badge>
                        {adj.is_distributed && (
                          <Badge variant="outline" className="text-xs">
                            Distribuido
                          </Badge>
                        )}
                      </div>
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
                    <TableCell>
                      {adj.is_bonus ? (
                        <Badge variant="outline" className="text-xs">Sí</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {adj.is_cash_payment ? (
                        <Badge variant="outline" className="text-xs">Efectivo</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(adj.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {adj.created_by_profile 
                        ? `${adj.created_by_profile.nombre || ''} ${adj.created_by_profile.apellido || ''}`.trim() || adj.created_by_profile.email || 'Unknown'
                        : 'Unknown'}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <Select
                  value={formDepartment || 'none'}
                  onValueChange={(val) => setFormDepartment(val === 'none' ? '' : val)}
                >
                  <SelectTrigger id="formDepartment">
                    <SelectValue placeholder="Seleccionar departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            {/* Bonus and Cash Payment Checkboxes */}
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="formIsBonus"
                  checked={formIsBonus}
                  onCheckedChange={(checked) => setFormIsBonus(checked === true)}
                />
                <Label htmlFor="formIsBonus" className="font-normal cursor-pointer">
                  Es Bono
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="formIsCashPayment"
                  checked={formIsCashPayment}
                  onCheckedChange={(checked) => setFormIsCashPayment(checked === true)}
                />
                <Label htmlFor="formIsCashPayment" className="font-normal cursor-pointer">
                  Pago en Efectivo
                </Label>
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

            {/* Distribution Section - Show when no plant selected (allows BU-only or no assignment) */}
            {!editingAdjustment && !formPlantId && (
              <div className="border-t pt-4 mt-4 space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Distribución</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    {formBusinessUnitId 
                      ? 'Distribuir el costo entre las plantas de esta unidad de negocio'
                      : 'Distribuir el costo entre plantas, unidades de negocio o departamentos'}
                  </p>
                  <DistributionMethodToggle
                    value={formDistributionMethod}
                    onChange={(val) => {
                      setFormDistributionMethod(val)
                      setFormDistributions([])
                      setVolumeDistributionsData([])
                    }}
                  />
                </div>

                {formDistributionMethod === 'percentage' && (
                  <DistributionTable
                    distributions={formDistributions}
                    totalAmount={parseFloat(formAmount || '0')}
                    onAdd={addDistribution}
                    onRemove={removeDistribution}
                    onUpdate={updateDistribution}
                    plants={formBusinessUnitId ? availablePlants : plants}
                    businessUnits={businessUnits}
                    departments={departments}
                  />
                )}

                {formDistributionMethod === 'volume' && (
                  <VolumeDistributionView
                    month={selectedMonth}
                    totalAmount={parseFloat(formAmount || '0')}
                    businessUnitId={formBusinessUnitId || null}
                    plants={formBusinessUnitId ? availablePlants : plants}
                    onDistributionsChange={handleVolumeDistributionsChange}
                  />
                )}
              </div>
            )}
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




