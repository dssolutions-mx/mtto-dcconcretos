'use client'

import { useState, useEffect } from 'react'
import { 
  Users, 
  Package, 
  UserCheck, 
  Search,
  Building2,
  AlertTriangle,
  Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Plant {
  id: string
  name: string
  code: string
  business_unit_id: string
}

interface Asset {
  id: string
  name: string
  model: string
  plant_id: string
  status: string
  plants?: Plant
}

interface Operator {
  id: string
  nombre: string
  apellido: string
  role: string
  employee_code?: string
  shift?: string
  status: string
  plants?: Plant
}

interface AssetOperator {
  id: string
  asset_id: string
  operator_id: string
  assignment_type: 'primary' | 'secondary'
  start_date: string
  end_date?: string
  status: string
  notes?: string
  assets?: Asset
  operators?: Operator
}

export function AssetAssignmentPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [assignments, setAssignments] = useState<AssetOperator[]>([])
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null)
  const [plants, setPlants] = useState<Plant[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedPlant) {
      fetchAssetsByPlant(selectedPlant.id)
      fetchOperatorsByPlant(selectedPlant.id)
    }
  }, [selectedPlant])

  const fetchData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        fetchPlants(),
        fetchAssignments()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "Error al cargar los datos",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchPlants = async () => {
    try {
      const response = await fetch('/api/plants')
      if (response.ok) {
        const data = await response.json()
        setPlants(data)
        if (data.length > 0 && !selectedPlant) {
          setSelectedPlant(data[0])
        }
      }
    } catch (error) {
      console.error('Error fetching plants:', error)
    }
  }

  const fetchAssetsByPlant = async (plantId: string) => {
    try {
      const response = await fetch(`/api/assets?plant_id=${plantId}`)
      if (response.ok) {
        const data = await response.json()
        setAssets(data)
      }
    } catch (error) {
      console.error('Error fetching assets:', error)
    }
  }

  const fetchOperatorsByPlant = async (plantId: string) => {
    try {
      const response = await fetch(`/api/operators/register?plant_id=${plantId}&role=OPERADOR`)
      if (response.ok) {
        const data = await response.json()
        setOperators(data)
      }
    } catch (error) {
      console.error('Error fetching operators:', error)
    }
  }

  const fetchAssignments = async () => {
    try {
      const response = await fetch('/api/asset-operators')
      if (response.ok) {
        const data = await response.json()
        setAssignments(data)
      }
    } catch (error) {
      console.error('Error fetching assignments:', error)
    }
  }

  const handleAssignOperator = (asset: Asset, operator: Operator) => {
    setSelectedAsset(asset)
    setSelectedOperator(operator)
    setShowAssignmentDialog(true)
  }

  const handleAssignmentConfirm = async (assignmentData: {
    assignment_type: 'primary' | 'secondary'
    notes?: string
  }) => {
    if (!selectedAsset || !selectedOperator) return

    try {
      const response = await fetch('/api/asset-operators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          asset_id: selectedAsset.id,
          operator_id: selectedOperator.id,
          assignment_type: assignmentData.assignment_type,
          notes: assignmentData.notes,
          start_date: new Date().toISOString().split('T')[0]
        })
      })

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Operador asignado exitosamente",
        })
        fetchAssignments()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Error al asignar operador')
      }
    } catch (error) {
      console.error('Error assigning operator:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al asignar operador",
        variant: "destructive"
      })
    } finally {
      setShowAssignmentDialog(false)
      setSelectedAsset(null)
      setSelectedOperator(null)
    }
  }

  const getAssetAssignments = (assetId: string) => {
    return assignments.filter(a => a.asset_id === assetId && a.status === 'active')
  }

  const getUnassignedOperators = () => {
    const assignedOperatorIds = assignments
      .filter(a => a.status === 'active')
      .map(a => a.operator_id)
    
    return operators.filter(op => 
      !assignedOperatorIds.includes(op.id) &&
      op.status === 'active' &&
      (searchTerm === '' || 
        `${op.nombre} ${op.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
  }

  const filteredAssets = assets.filter(asset =>
    searchTerm === '' || 
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      'OPERADOR': 'bg-gray-100 text-gray-800',
      'DOSIFICADOR': 'bg-yellow-100 text-yellow-800',
      'JEFE_PLANTA': 'bg-orange-100 text-orange-800'
    }
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getShiftDisplayName = (shift?: string) => {
    const shifts = {
      'morning': 'Matutino',
      'afternoon': 'Vespertino',
      'night': 'Nocturno'
    }
    return shift ? shifts[shift as keyof typeof shifts] || shift : ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asignación de Activos</h1>
          <p className="text-gray-600">Asigna operadores a activos de la planta</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar activos u operadores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedPlant?.id || ''} onValueChange={(value) => {
              const plant = plants.find(p => p.id === value)
              setSelectedPlant(plant || null)
            }}>
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

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Package className="w-4 h-4" />
              {filteredAssets.length} activos • {getUnassignedOperators().length} operadores disponibles
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedPlant && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Available Operators */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Operadores Disponibles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {getUnassignedOperators().map((operator) => (
                  <div
                    key={operator.id}
                    className="p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${operator.nombre} ${operator.apellido}`} />
                        <AvatarFallback className="text-xs">
                          {operator.nombre?.[0]}{operator.apellido?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {operator.nombre} {operator.apellido}
                        </p>
                        {operator.employee_code && (
                          <p className="text-xs text-gray-600">{operator.employee_code}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <Badge className={`text-xs ${getRoleBadgeColor(operator.role)}`}>
                            {operator.role}
                          </Badge>
                          {operator.shift && (
                            <span className="text-xs text-gray-500">
                              {getShiftDisplayName(operator.shift)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {getUnassignedOperators().length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay operadores disponibles</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Assets with Assignments */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-semibold">Activos - {selectedPlant.name}</h3>
            {filteredAssets.map((asset) => {
              const assetAssignments = getAssetAssignments(asset.id)
              const primaryOperator = assetAssignments.find(a => a.assignment_type === 'primary')
              const secondaryOperators = assetAssignments.filter(a => a.assignment_type === 'secondary')

              return (
                <Card key={asset.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{asset.name}</CardTitle>
                        <p className="text-sm text-gray-600">{asset.model}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={asset.status === 'active' ? 'default' : 'secondary'}>
                          {asset.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => {
                            const availableOperators = getUnassignedOperators()
                            if (availableOperators.length > 0) {
                              handleAssignOperator(asset, availableOperators[0])
                            }
                          }}
                          disabled={getUnassignedOperators().length === 0}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Asignar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Primary Operator */}
                      {primaryOperator ? (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <UserCheck className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-600">Operador Principal</span>
                          </div>
                          <div className="p-2 bg-white border rounded-lg">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {primaryOperator.operators?.nombre?.[0]}{primaryOperator.operators?.apellido?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">
                                {primaryOperator.operators?.nombre} {primaryOperator.operators?.apellido}
                              </span>
                              <Badge className="text-xs bg-green-100 text-green-800">Principal</Badge>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                            <span className="text-sm font-medium text-orange-600">Sin Operador Principal</span>
                          </div>
                          <div className="p-3 border-2 border-dashed border-orange-200 rounded-lg bg-orange-50">
                            <p className="text-xs text-orange-600 text-center">
                              Haz clic en "Asignar" para asignar un operador principal
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Secondary Operators */}
                      {secondaryOperators.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-600">Operadores Secundarios</span>
                          </div>
                          <div className="space-y-1">
                            {secondaryOperators.map((assignment) => (
                              <div key={assignment.id} className="p-2 bg-white border rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">
                                      {assignment.operators?.nombre?.[0]}{assignment.operators?.apellido?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">
                                    {assignment.operators?.nombre} {assignment.operators?.apellido}
                                  </span>
                                  <Badge className="text-xs bg-blue-100 text-blue-800">Secundario</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {assetAssignments.length === 0 && (
                        <div className="text-center py-6 text-gray-500">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Sin operadores asignados</p>
                          <p className="text-xs">Haz clic en "Asignar" para asignar operadores</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {filteredAssets.length === 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No se encontraron activos
                    </h3>
                    <p className="text-gray-600">
                      {searchTerm ? 'Intenta ajustar el término de búsqueda' : 'No hay activos en esta planta'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Assignment Dialog */}
      <AssignmentDialog
        open={showAssignmentDialog}
        onOpenChange={setShowAssignmentDialog}
        onConfirm={handleAssignmentConfirm}
        asset={selectedAsset}
        operator={selectedOperator}
      />
    </div>
  )
}

interface AssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: { assignment_type: 'primary' | 'secondary'; notes?: string }) => void
  asset: Asset | null
  operator: Operator | null
}

function AssignmentDialog({ open, onOpenChange, onConfirm, asset, operator }: AssignmentDialogProps) {
  const [assignmentType, setAssignmentType] = useState<'primary' | 'secondary'>('primary')
  const [notes, setNotes] = useState('')

  const handleConfirm = () => {
    onConfirm({ assignment_type: assignmentType, notes })
    setNotes('')
    setAssignmentType('primary')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Asignación</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Detalles de la Asignación</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Operador:</span> {operator?.nombre} {operator?.apellido}
              </div>
              <div>
                <span className="font-medium">Activo:</span> {asset?.name}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="assignment-type">Tipo de Asignación</Label>
            <Select value={assignmentType} onValueChange={(value: 'primary' | 'secondary') => setAssignmentType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Operador Principal</SelectItem>
                <SelectItem value="secondary">Operador Secundario</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notas (Opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Agregar notas sobre la asignación..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar Asignación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 