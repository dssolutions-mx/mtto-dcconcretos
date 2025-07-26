'use client'

import { useState, useEffect } from 'react'
import { 
  Users, 
  Package, 
  UserCheck, 
  Search,
  Building2,
  Plus,
  UserPlus,
  Filter,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { CreateOperatorDialog } from '@/components/personnel/create-operator-dialog'
import { OperatorTransferDialog, TransferData } from './dialogs/operator-transfer-dialog'

interface Plant {
  id: string
  name: string
  code: string
  business_unit_id: string
}

interface Asset {
  id: string
  asset_id: string
  name: string
  model_id: string | null
  plant_id: string
  status: string
  equipment_models?: {
    id: string
    name: string
    manufacturer: string
  }
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
  // Fields from asset_operators_full view
  operator_nombre?: string
  operator_apellido?: string
  operator_role?: string
  employee_code?: string
  operator_shift?: string
  operator_status?: string
  // Legacy fields for backward compatibility
  assets?: Asset
  operators?: Operator
}

// Draggable Operator Card - Improved Design
function DraggableOperatorCard({ operator }: { operator: Operator }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: operator.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing ${
        isDragging ? 'scale-105 rotate-1' : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${operator.nombre} ${operator.apellido}`} />
          <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
            {operator.nombre?.[0]}{operator.apellido?.[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {operator.nombre} {operator.apellido}
          </h3>
          {operator.employee_code && (
            <p className="text-sm text-gray-500">#{operator.employee_code}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {getRoleDisplayName(operator.role)}
            </Badge>
            {operator.shift && (
              <span className="text-xs text-gray-400">
                {getShiftDisplayName(operator.shift)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Droppable Asset Card - Fixed with useDroppable hook
function DroppableAssetCard({ 
  asset, 
  assignments,
  onRemoveAssignment
}: { 
  asset: Asset
  assignments: AssetOperator[]
  onRemoveAssignment: (assignmentId: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: asset.id,
  })

  const primaryOperator = assignments.find(a => a.assignment_type === 'primary')
  const secondaryOperators = assignments.filter(a => a.assignment_type === 'secondary')

  return (
    <div
      ref={setNodeRef}
      className={`relative bg-white border-2 rounded-lg transition-all duration-200 ${
        isOver 
          ? 'border-blue-500 bg-blue-50 shadow-lg' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Asset Header - Asset ID is now the main identifier */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{asset.asset_id}</h3>
            <p className="text-sm font-medium text-gray-700">{asset.name}</p>
            <p className="text-xs text-gray-500">{asset.equipment_models?.name || 'Sin modelo'}</p>
          </div>
          <Badge variant={asset.status === 'active' ? 'default' : 'secondary'}>
            {asset.status === 'active' ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
      </div>

      {/* Assignment Areas */}
      <div className="p-4 space-y-4">
        {/* Primary Operator */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">Operador Principal</span>
          </div>
          {primaryOperator ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                    {(primaryOperator.operator_nombre || primaryOperator.operators?.nombre)?.[0]}
                    {(primaryOperator.operator_apellido || primaryOperator.operators?.apellido)?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-green-900">
                    {primaryOperator.operator_nombre || primaryOperator.operators?.nombre} {primaryOperator.operator_apellido || primaryOperator.operators?.apellido}
                  </p>
                  <p className="text-xs text-green-600">
                    {getRoleDisplayName(primaryOperator.operator_role || primaryOperator.operators?.role || '')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveAssignment(primaryOperator.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  ×
                </Button>
              </div>
            </div>
          ) : (
            <div className={`p-6 border-2 border-dashed rounded-lg text-center transition-colors ${
              isOver ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'
            }`}>
              <UserCheck className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500">
                {isOver ? 'Suelta aquí para asignar como principal' : 'Arrastra un operador aquí'}
              </p>
            </div>
          )}
        </div>

        {/* Secondary Operators */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-600">Operadores Secundarios</span>
            <Badge variant="outline" className="text-xs">
              {secondaryOperators.length}
            </Badge>
          </div>
          
          <div className="space-y-2">
            {secondaryOperators.map((assignment) => (
              <div key={assignment.id} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                      {(assignment.operator_nombre || assignment.operators?.nombre)?.[0]}
                      {(assignment.operator_apellido || assignment.operators?.apellido)?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-blue-900">
                      {assignment.operator_nombre || assignment.operators?.nombre} {assignment.operator_apellido || assignment.operators?.apellido}
                    </p>
                    <p className="text-xs text-blue-600">
                      {getRoleDisplayName(assignment.operator_role || assignment.operators?.role || '')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveAssignment(assignment.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    ×
                  </Button>
                </div>
              </div>
            ))}
            
            {secondaryOperators.length === 0 && (
              <div className={`p-4 border-2 border-dashed rounded-lg text-center transition-colors ${
                isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
              }`}>
                <Users className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">
                  {isOver ? 'Suelta aquí para asignar como secundario' : 'Sin operadores secundarios'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function getRoleDisplayName(role: string) {
  const names: Record<string, string> = {
    'GERENCIA_GENERAL': 'Gerencia General',
    'JEFE_UNIDAD_NEGOCIO': 'Jefe Unidad de Negocio',
    'ENCARGADO_MANTENIMIENTO': 'Encargado Mantenimiento',
    'JEFE_PLANTA': 'Jefe de Planta',
    'DOSIFICADOR': 'Dosificador',
    'OPERADOR': 'Operador',
    'AUXILIAR_COMPRAS': 'Auxiliar de Compras',
    'AREA_ADMINISTRATIVA': 'Área Administrativa',
    'VISUALIZADOR': 'Visualizador'
  }
  return names[role] || role
}

function getShiftDisplayName(shift?: string) {
  const shifts: Record<string, string> = {
    'morning': 'Matutino',
    'afternoon': 'Vespertino',
    'night': 'Nocturno'
  }
  return shift ? shifts[shift] || shift : ''
}

export function AssetAssignmentDragDrop() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [assignments, setAssignments] = useState<AssetOperator[]>([])
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null)
  const [plants, setPlants] = useState<Plant[]>([])
  const [searchOperators, setSearchOperators] = useState('')
  const [searchAssets, setSearchAssets] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [showCreateOperator, setShowCreateOperator] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState<TransferData | null>(null)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

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
        const plants = data.plants || []
        setPlants(plants)
        if (plants.length > 0 && !selectedPlant) {
          setSelectedPlant(plants[0])
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
      const response = await fetch(`/api/operators/register?plant_id=${plantId}`)
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over) return

    const operatorId = active.id as string
    const assetId = over.id as string

    const operator = operators.find(op => op.id === operatorId)
    const asset = assets.find(a => a.id === assetId)

    if (operator && asset) {
      await handleCreateAssignment(assetId, operatorId)
    }
  }

  const handleCreateAssignment = async (assetId: string, operatorId: string) => {
    try {
      // Fetch fresh assignments data
      const response = await fetch('/api/asset-operators')
      if (!response.ok) {
        throw new Error('Failed to fetch current assignments')
      }
      const freshAssignments = await response.json()
      
      // Check if operator is already assigned to any asset using fresh data
      const operatorAssignments = freshAssignments.filter((a: AssetOperator) => 
        a.operator_id === operatorId && a.status === 'active'
      )
      
      // Check if asset already has a primary operator using fresh data
      const assetAssignments = freshAssignments.filter((a: AssetOperator) => 
        a.asset_id === assetId && a.status === 'active'
      )
      const hasPrimaryOperator = assetAssignments.some((a: AssetOperator) => a.assignment_type === 'primary')
      
      const assignmentType = hasPrimaryOperator ? 'secondary' : 'primary'

      // If operator has existing assignments, use transfer logic
      if (operatorAssignments.length > 0) {
        const currentAssignment = operatorAssignments[0] // Get the first active assignment
        const fromAssetId = currentAssignment.asset_id
        
        // Get operator and asset details for the dialog
        const operator = operators.find(op => op.id === operatorId)
        const fromAsset = assets.find(a => a.id === fromAssetId)
        const toAsset = assets.find(a => a.id === assetId)
        
        if (!operator || !toAsset) {
          toast({
            title: "Error",
            description: "No se pudo encontrar información del operador o activo",
            variant: "destructive"
          })
          return
        }

        // Check if there's a conflict (existing primary operator)
        let conflictType: 'existing_primary' | 'none' = 'none'
        let existingOperator = null
        
        if (assignmentType === 'primary' && hasPrimaryOperator) {
          const primaryAssignment = assetAssignments.find((a: AssetOperator) => a.assignment_type === 'primary')
          if (primaryAssignment) {
            existingOperator = operators.find(op => op.id === primaryAssignment.operator_id)
            conflictType = 'existing_primary'
          }
        }

        // Show transfer dialog
        setPendingTransfer({
          operator: {
            id: operator.id,
            name: `${operator.nombre} ${operator.apellido}`,
            employee_code: operator.employee_code
          },
          fromAsset: {
            id: fromAsset?.id || fromAssetId,
            name: fromAsset?.name || 'Activo desconocido',
            asset_id: fromAsset?.asset_id || 'N/A'
          },
          toAsset: {
            id: toAsset.id,
            name: toAsset.name,
            asset_id: toAsset.asset_id
          },
          assignmentType,
          conflictType,
          existingOperator: existingOperator ? {
            id: existingOperator.id,
            name: `${existingOperator.nombre} ${existingOperator.apellido}`
          } : undefined
        })
        
        setShowTransferDialog(true)
        return // Exit here, transfer will be handled by dialog confirmation
      } else {
        // No existing assignments, use regular assignment logic
        const response = await fetch('/api/asset-operators', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            asset_id: assetId,
            operator_id: operatorId,
            assignment_type: assignmentType,
            start_date: new Date().toISOString().split('T')[0]
          })
        })

        if (response.ok) {
          toast({
            title: "Éxito",
            description: `Operador asignado como ${assignmentType === 'primary' ? 'principal' : 'secundario'}`,
          })
        } else {
          const error = await response.json()
          
          // Handle specific API errors with helpful messages
          if (response.status === 409) {
            // Primary operator conflict - suggest using transfer
            toast({
              title: "Conflicto de Asignación",
              description: error.error + "\n\nUse arrastar y soltar para transferir automáticamente.",
              variant: "destructive"
            })
          } else if (response.status === 400 && error.error.includes('already assigned')) {
            // Operator already assigned - suggest transfer
            toast({
              title: "Operador Ya Asignado",
              description: error.error,
              variant: "destructive"
            })
          } else {
            // Generic error
            throw new Error(error.error || 'Error al asignar operador')
          }
          return // Exit early for handled errors
        }
      }

      // Refresh both assignments and assets to show updated status
      await Promise.all([
        fetchAssignments(),
        selectedPlant ? fetchAssetsByPlant(selectedPlant.id) : Promise.resolve()
      ])
      
    } catch (error) {
      console.error('Error assigning/transferring operator:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al asignar operador",
        variant: "destructive"
      })
    }
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(`/api/asset-operators?id=${assignmentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Asignación eliminada",
        })
        // Refresh both assignments and assets to show updated status
        await Promise.all([
          fetchAssignments(),
          selectedPlant ? fetchAssetsByPlant(selectedPlant.id) : Promise.resolve()
        ])
      } else {
        throw new Error('Error al eliminar asignación')
      }
    } catch (error) {
      console.error('Error removing assignment:', error)
      toast({
        title: "Error",
        description: "No se pudo eliminar la asignación",
        variant: "destructive"
      })
    }
  }

  const handleOperatorCreated = (newOperator: Operator) => {
    setOperators(prev => [newOperator, ...prev])
    setShowCreateOperator(false)
    toast({
      title: "Éxito",
      description: "Operador creado exitosamente",
    })
  }

  const handleTransferConfirm = async (forceTransfer = false) => {
    if (!pendingTransfer) return

    try {
      const response = await fetch('/api/asset-operators/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operator_id: pendingTransfer.operator.id,
          from_asset_id: pendingTransfer.fromAsset.id,
          to_asset_id: pendingTransfer.toAsset.id,
          assignment_type: pendingTransfer.assignmentType,
          transfer_reason: 'Transferred via drag and drop interface',
          force_transfer: forceTransfer
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Éxito",
          description: `Operador transferido exitosamente como ${pendingTransfer.assignmentType === 'primary' ? 'principal' : 'secundario'}`,
        })
        console.log('Transfer result:', result)
        
        // Refresh data
        await Promise.all([
          fetchAssignments(),
          selectedPlant ? fetchAssetsByPlant(selectedPlant.id) : Promise.resolve()
        ])
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Error al transferir operador')
      }
    } catch (error) {
      console.error('Error in transfer:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al transferir operador",
        variant: "destructive"
      })
    } finally {
      setPendingTransfer(null)
      setShowTransferDialog(false)
    }
  }

  const handleTransferCancel = () => {
    setPendingTransfer(null)
    setShowTransferDialog(false)
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
      (searchOperators === '' || 
        `${op.nombre} ${op.apellido}`.toLowerCase().includes(searchOperators.toLowerCase()) ||
        op.employee_code?.toLowerCase().includes(searchOperators.toLowerCase())
      )
    )
  }

  const filteredAssets = assets.filter(asset =>
    searchAssets === '' || 
    asset.asset_id.toLowerCase().includes(searchAssets.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchAssets.toLowerCase()) ||
    asset.equipment_models?.name?.toLowerCase().includes(searchAssets.toLowerCase())
  )

  const activeOperator = operators.find(op => op.id === activeId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Asignación de Activos</h1>
            <p className="text-gray-600 mt-1">Arrastra operadores desde la columna izquierda hacia los activos para asignarlos</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedPlant?.id || ''} onValueChange={(value) => {
              const plant = plants.find(p => p.id === value)
              setSelectedPlant(plant || null)
            }}>
              <SelectTrigger className="w-[200px]">
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
            <Button onClick={() => setShowCreateOperator(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Nuevo Operador
            </Button>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </div>

        {selectedPlant && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Operators Column */}
            <div className="lg:col-span-1">
              <Card className="h-[700px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Operadores Disponibles
                    <Badge variant="secondary">{getUnassignedOperators().length}</Badge>
                  </CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar operadores..."
                      value={searchOperators}
                      onChange={(e) => setSearchOperators(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[550px] px-6 pb-6">
                    <div className="space-y-3">
                      <SortableContext
                        items={getUnassignedOperators().map(op => op.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {getUnassignedOperators().map((operator) => (
                          <DraggableOperatorCard key={operator.id} operator={operator} />
                        ))}
                      </SortableContext>
                      {getUnassignedOperators().length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                          <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                          <p className="text-sm">No hay operadores disponibles</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {searchOperators ? 'Intenta con otra búsqueda' : 'Todos los operadores están asignados'}
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Assets Column */}
            <div className="lg:col-span-2">
              <Card className="h-[700px]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-600" />
                    Activos - {selectedPlant.name}
                    <Badge variant="secondary">{filteredAssets.length}</Badge>
                  </CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar activos..."
                      value={searchAssets}
                      onChange={(e) => setSearchAssets(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[550px] px-6 pb-6">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {filteredAssets.map((asset) => {
                        const assetAssignments = getAssetAssignments(asset.id)
                        return (
                          <DroppableAssetCard
                            key={asset.id}
                            asset={asset}
                            assignments={assetAssignments}
                            onRemoveAssignment={handleRemoveAssignment}
                          />
                        )
                      })}
                    </div>
                    {filteredAssets.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="text-sm">No hay activos disponibles</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {searchAssets ? 'Intenta con otra búsqueda' : 'No hay activos en esta planta'}
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Drag Overlay */}
        <DragOverlay>
          {activeOperator && (
            <div className="p-4 bg-white border-2 border-blue-500 rounded-lg shadow-xl transform rotate-3 scale-105">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${activeOperator.nombre} ${activeOperator.apellido}`} />
                  <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                    {activeOperator.nombre?.[0]}{activeOperator.apellido?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-gray-900">
                    {activeOperator.nombre} {activeOperator.apellido}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {getRoleDisplayName(activeOperator.role)}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DragOverlay>

        {/* Create Operator Dialog */}
        <CreateOperatorDialog
          open={showCreateOperator}
          onOpenChange={setShowCreateOperator}
          onOperatorCreated={handleOperatorCreated}
          plants={plants}
        />

        {/* Transfer Confirmation Dialog */}
        <OperatorTransferDialog
          open={showTransferDialog}
          onOpenChange={setShowTransferDialog}
          transferData={pendingTransfer}
          onConfirm={handleTransferConfirm}
          onCancel={handleTransferCancel}
        />
      </div>
    </DndContext>
  )
} 