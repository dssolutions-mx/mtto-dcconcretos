'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'react-hot-toast'
import { Loader2, Search, Filter, Users, Building2, MapPin, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { PersonnelDraggableItem } from './personnel-draggable-item'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { UserRegistrationTool } from '@/components/auth/user-registration-tool'
import { MoveConflictDialog, ConflictData, ResolutionStrategy } from './dialogs/move-conflict-dialog'
import { BatchAssignmentDialog } from './batch-assignment-dialog'

interface Profile {
  id: string
  nombre: string
  apellido: string
  role: string
  employee_code: string
  position: string
  shift: string
  telefono: string
  plant_id: string | null
  business_unit_id: string | null
  status: string
  plants?: {
    id: string
    name: string
    code: string
  }
  business_units?: {
    id: string
    name: string
  }
  // Para feedback optimista
  _isUpdating?: boolean
  _originalPlantId?: string | null
  _originalBusinessUnitId?: string | null
}

interface Plant {
  id: string
  name: string
  code: string
  business_unit_id: string
  status: string
  business_units?: {
    id: string
    name: string
  }
}

interface BusinessUnit {
  id: string
  name: string
  code: string
}

// Componente de zona droppable optimizada
function BusinessUnitContainer({ 
  businessUnit, 
  plants, 
  operators, 
  onDrop,
  draggedOperator
}: {
  businessUnit: BusinessUnit
  plants: Plant[]
  operators: Profile[]
  onDrop: (operatorId: string, target: { type: 'businessUnit' | 'plant' | 'unassigned', id?: string }) => void
  draggedOperator: Profile | null
}) {
  
  const { setNodeRef, isOver } = useDroppable({
    id: `business-unit-${businessUnit.id}`,
  })
  
  // Operadores asignados a esta business unit pero no a plantas específicas
  const businessUnitOperators = Array.isArray(operators) ? operators.filter(op => 
    op.business_unit_id === businessUnit.id && !op.plant_id
  ) : []

  // Plantas de esta business unit
  const businessUnitPlants = Array.isArray(plants) ? plants.filter(p => p.business_unit_id === businessUnit.id) : []

  return (
    <Card 
      ref={setNodeRef}
      className={`transition-all duration-300 border-2 ${
        isOver 
          ? 'border-green-500 bg-green-50 shadow-xl ring-2 ring-green-200' 
          : 'border-green-200 hover:border-green-300 hover:shadow-lg'
      }`}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Building2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-green-800">{businessUnit.name}</CardTitle>
              <p className="text-sm text-green-600">Unidad de Negocio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700">
              {businessUnitOperators.length} directos
            </Badge>
            <Badge variant="secondary">
              {businessUnitPlants.length} plantas
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Zona de drop para business unit - ARRIBA */}
        {isOver && (
          <div className="border-2 border-dashed border-green-400 bg-green-50 rounded-lg p-4 text-center animate-pulse">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <p className="text-sm font-medium text-green-700">
              Asignando a {businessUnit.name}
            </p>
            <p className="text-xs text-green-600">
              Acceso a toda la unidad de negocio
            </p>
          </div>
        )}

        {/* Operadores directos de la business unit - ARRIBA */}
        {businessUnitOperators.length > 0 && (
          <div className="space-y-2 bg-green-25 p-3 rounded-lg border border-green-100">
            <h4 className="text-sm font-medium text-green-800 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Personal de Unidad ({businessUnitOperators.length})
            </h4>
            <div className="grid gap-2 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-green-200">
              {businessUnitOperators.map((operator) => (
                <PersonnelDraggableItem
                  key={operator.id}
                  operator={operator}
                  compact={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Plantas contenidas - ABAJO */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Plantas ({businessUnitPlants.length})
          </h4>
          <div className="grid gap-3">
            {businessUnitPlants.map((plant) => (
              <PlantContainer 
                key={plant.id}
                plant={plant}
                operators={operators}
                onDrop={onDrop}
                draggedOperator={draggedOperator}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente de planta contenida
function PlantContainer({
  plant,
  operators,
  onDrop,
  draggedOperator
}: {
  plant: Plant
  operators: Profile[]
  onDrop: (operatorId: string, target: { type: 'businessUnit' | 'plant' | 'unassigned', id?: string }) => void
  draggedOperator: Profile | null
}) {
  
  const { setNodeRef, isOver } = useDroppable({
    id: plant.id,
  })
  
  const plantOperators = Array.isArray(operators) ? operators.filter(op => op.plant_id === plant.id) : []

  return (
    <div
      ref={setNodeRef}
      className={`border rounded-lg p-3 transition-all duration-300 ${
        isOver 
          ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200' 
          : 'border-blue-200 hover:border-blue-300 bg-white hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isOver ? 'bg-blue-600 animate-ping' : 'bg-blue-500'}`}></div>
          <span className="font-medium text-blue-800">{plant.name}</span>
          <span className="text-xs text-blue-600">({plant.code})</span>
        </div>
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
          {plantOperators.length}
        </Badge>
      </div>
      
      {isOver && (
        <div className="mb-2 p-2 bg-blue-100 rounded text-center">
          <p className="text-xs font-medium text-blue-700">⬇ Asignando a {plant.name}</p>
        </div>
      )}
      
      {plantOperators.length > 0 ? (
        <div className="grid gap-1 max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-200">
          {plantOperators.map((operator) => (
            <PersonnelDraggableItem
              key={operator.id}
              operator={operator}
              compact={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-2 text-gray-500">
          <span className="text-xs">Sin personal asignado</span>
        </div>
      )}
    </div>
  )
}

// Componente de personal sin asignar
function UnassignedContainer({
  operators,
  onDrop,
  draggedOperator,
  onBatchAssign
}: {
  operators: Profile[]
  onDrop: (operatorId: string, target: { type: 'businessUnit' | 'plant' | 'unassigned', id?: string }) => void
  draggedOperator: Profile | null
  onBatchAssign?: () => void
}) {
  
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned',
  })
  
  const unassignedOperators = Array.isArray(operators) ? operators.filter(op => !op.plant_id && !op.business_unit_id) : []

  return (
    <Card 
      ref={setNodeRef}
      className={`transition-all duration-300 border-2 ${
        isOver 
          ? 'border-gray-500 bg-gray-50 shadow-xl ring-2 ring-gray-200' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-lg'
      }`}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Users className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-gray-800">Sin Asignar</CardTitle>
              <p className="text-sm text-gray-600">Personal disponible para asignación</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onBatchAssign && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBatchAssign()}
                className="text-xs"
              >
                Asignación Masiva
              </Button>
            )}
            <Badge variant="outline" className="bg-gray-50 text-gray-700">
              {unassignedOperators.length}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isOver && (
          <div className="mb-4 border-2 border-dashed border-gray-400 bg-gray-50 rounded-lg p-3 text-center animate-pulse">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-gray-600" />
            <p className="text-sm font-medium text-gray-700">Desasignando personal</p>
            <p className="text-xs text-gray-500">Se quitarán todas las asignaciones</p>
          </div>
        )}
        
        <ScrollArea className="h-80">
          <div className="space-y-2 pr-2">
            {unassignedOperators.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Todo el personal está asignado
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Arrastra personal aquí para desasignar y hacerlo disponible para otras ubicaciones
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                  <MapPin className="h-4 w-4" />
                  <span>O asigna personal nuevo desde el registro</span>
                </div>
              </div>
            ) : (
              unassignedOperators.map((operator) => (
                <PersonnelDraggableItem
                  key={operator.id}
                  operator={operator}
                  compact={false}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export function PersonnelManagementDragDrop() {
  const { profile } = useAuthZustand()
  const [operators, setOperators] = useState<Profile[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedOperator, setDraggedOperator] = useState<Profile | null>(null)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflictData, setConflictData] = useState<ConflictData | null>(null)
  const [pendingMove, setPendingMove] = useState<{ operatorId: string; updateData: any; targetName: string } | null>(null)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string>('all')

  // Sensores optimizados para mejor rendimiento
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Muy sensible para respuesta inmediata
      },
    })
  )

  const availableRoles = [
    'OPERADOR',
    'ENCARGADO_MANTENIMIENTO',
    'JEFE_PLANTA',
    'JEFE_UNIDAD_NEGOCIO',
    'DOSIFICADOR',
    'AUXILIAR_COMPRAS',
    'AREA_ADMINISTRATIVA',
    'EJECUTIVO',
    'VISUALIZADOR'
  ]

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [operatorsRes, plantsRes, businessUnitsRes] = await Promise.all([
        fetch('/api/operators/register'),
        fetch('/api/plants'),
        fetch('/api/business-units')
      ])

      const [operatorsData, plantsData, businessUnitsData] = await Promise.all([
        operatorsRes.ok ? operatorsRes.json() : [],
        plantsRes.ok ? plantsRes.json() : [],
        businessUnitsRes.ok ? businessUnitsRes.json() : []
      ])

      // Extract arrays from API response objects
      const operators = Array.isArray(operatorsData) ? operatorsData : (operatorsData?.operators || [])
      const plants = Array.isArray(plantsData) ? plantsData : (plantsData?.plants || [])
      const businessUnits = Array.isArray(businessUnitsData) ? businessUnitsData : (businessUnitsData?.business_units || [])

      console.log('Personnel data loaded:', {
        operators: operators.length,
        plants: plants.length,
        businessUnits: businessUnits.length,
        plantsData: plantsData,
        businessUnitsData: businessUnitsData
      })

      // Apply scope-based filtering based on user role
      let filteredOperators = operators
      let filteredPlants = plants
      let filteredBusinessUnits = businessUnits

      if (profile?.role === 'JEFE_UNIDAD_NEGOCIO' && profile?.business_unit_id) {
        // JEFE_UNIDAD_NEGOCIO can only see their business unit and its personnel/plants
        // Also include unassigned operators (no plant_id and no business_unit_id) so they can assign them
        filteredBusinessUnits = businessUnits.filter((bu: BusinessUnit) => bu.id === profile.business_unit_id)
        filteredPlants = plants.filter((p: Plant) => p.business_unit_id === profile.business_unit_id)
        filteredOperators = operators.filter((op: Profile) => 
          op.business_unit_id === profile.business_unit_id || 
          filteredPlants.some((p: Plant) => p.id === op.plant_id) ||
          (!op.plant_id && !op.business_unit_id) // Include unassigned operators
        )
      } else if (profile?.role === 'JEFE_PLANTA' && profile?.plant_id) {
        // JEFE_PLANTA can only see their plant and its personnel
        const userPlant = plants.find((p: Plant) => p.id === profile.plant_id)
        if (userPlant) {
          filteredBusinessUnits = businessUnits.filter((bu: BusinessUnit) => bu.id === userPlant.business_unit_id)
          filteredPlants = plants.filter((p: Plant) => p.id === profile.plant_id)
          filteredOperators = operators.filter((op: Profile) => op.plant_id === profile.plant_id)
        }
      }

      setOperators(filteredOperators)
      setPlants(filteredPlants)
      setBusinessUnits(filteredBusinessUnits)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!Array.isArray(operators)) {
      setDraggedOperator(null)
      return
    }
    const operator = operators.find(op => op.id === event.active.id)
    setDraggedOperator(operator || null)
  }, [operators])

  // Función optimista para feedback inmediato
  const handleOptimisticUpdate = useCallback((
    operatorId: string, 
    target: { type: 'businessUnit' | 'plant' | 'unassigned', id?: string }
  ) => {
    setOperators(prev => prev.map(op => {
      if (op.id === operatorId) {
        // Guardar valores originales para rollback si es necesario
        const updated = {
          ...op,
          _isUpdating: true,
          _originalPlantId: op.plant_id,
          _originalBusinessUnitId: op.business_unit_id
        }

        // Aplicar cambios optimistas
        switch (target.type) {
          case 'unassigned':
            updated.plant_id = null
            updated.business_unit_id = null
            break
          case 'businessUnit':
            updated.plant_id = null
            updated.business_unit_id = target.id!
            break
          case 'plant':
            const plant = plants.find(p => p.id === target.id)
            updated.plant_id = target.id!
            updated.business_unit_id = plant?.business_unit_id || null
            break
        }

        return updated
      }
      return op
    }))
  }, [plants])

  const handleDrop = useCallback(async (
    operatorId: string, 
    target: { type: 'businessUnit' | 'plant' | 'unassigned', id?: string }
  ) => {
    const operator = operators.find(op => op.id === operatorId)
    if (!operator) return

    // Aplicar cambio optimista inmediatamente para UX inmediata
    handleOptimisticUpdate(operatorId, target)

    // Determinar datos para backend
    let updateData: any = {}
    let targetName = ''

    switch (target.type) {
      case 'unassigned':
        updateData = { plant_id: null, business_unit_id: null }
        targetName = 'Sin asignar'
        break
      case 'businessUnit':
        const businessUnit = businessUnits.find(bu => bu.id === target.id)
        updateData = { plant_id: null, business_unit_id: target.id }
        targetName = businessUnit?.name || 'Unidad de negocio'
        break
      case 'plant':
        const plant = plants.find(p => p.id === target.id)
        updateData = { plant_id: target.id, business_unit_id: plant?.business_unit_id }
        targetName = plant?.name || 'Planta'
        break
    }

    try {
      const response = await fetch(`/api/operators/register/${operatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check if this is a conflict response
        if (response.status === 409 && data.conflicts) {
          // Get plant names for display
          const currentPlant = operator.plant_id ? plants.find(p => p.id === operator.plant_id) : null
          const newPlant = updateData.plant_id ? plants.find(p => p.id === updateData.plant_id) : null

          const conflictData: ConflictData = {
            type: 'operator_move',
            operatorId: operator.id,
            operatorName: `${operator.nombre} ${operator.apellido}`,
            employeeCode: operator.employee_code,
            currentPlantId: operator.plant_id || null,
            currentPlantName: currentPlant?.name || null,
            newPlantId: updateData.plant_id || null,
            newPlantName: newPlant?.name || null,
            affected_assets: data.affected_assets || [],
            assets_in_new_plant: data.assets_in_new_plant || [],
            assets_in_other_plants: data.assets_in_other_plants || []
          }

          setConflictData(conflictData)
          setPendingMove({ operatorId, updateData, targetName })
          setConflictDialogOpen(true)
          
          // Rollback optimistic update
          setOperators(prev => prev.map(op => {
            if (op.id === operatorId) {
              return {
                ...op,
                plant_id: op._originalPlantId!,
                business_unit_id: op._originalBusinessUnitId!,
                _isUpdating: false
              }
            }
            return op
          }))
          return
        }

        throw new Error(data.error || 'Failed to update assignment')
      }

      // Confirmar el cambio exitoso
      setOperators(prev => prev.map(op => {
        if (op.id === operatorId) {
          return {
            ...op,
            _isUpdating: false,
            _originalPlantId: undefined,
            _originalBusinessUnitId: undefined
          }
        }
        return op
      }))

      // Toast de éxito con información del cambio
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{operator.nombre} {operator.apellido} → {targetName}</span>
        </div>
      )
    } catch (error) {
      console.error('Error updating assignment:', error)
      
      // Rollback en caso de error
      setOperators(prev => prev.map(op => {
        if (op.id === operatorId) {
          return {
            ...op,
            plant_id: op._originalPlantId!,
            business_unit_id: op._originalBusinessUnitId!,
            _isUpdating: false,
            _originalPlantId: undefined,
            _originalBusinessUnitId: undefined
          }
        }
        return op
      }))

      toast.error('Error al actualizar asignación. Cambio revertido.')
    }
  }, [operators, businessUnits, plants, handleOptimisticUpdate])

  const handleConflictResolve = useCallback(async (strategy: ResolutionStrategy) => {
    if (!pendingMove) return

    if (strategy === 'cancel') {
      setPendingMove(null)
      setConflictData(null)
      return
    }

    // Apply optimistic update again
    const operator = operators.find(op => op.id === pendingMove.operatorId)
    if (operator) {
      handleOptimisticUpdate(pendingMove.operatorId, {
        type: pendingMove.updateData.plant_id ? 'plant' : 
              pendingMove.updateData.business_unit_id ? 'businessUnit' : 'unassigned',
        id: pendingMove.updateData.plant_id || pendingMove.updateData.business_unit_id
      })
    }

    try {
      const response = await fetch(`/api/operators/register/${pendingMove.operatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pendingMove.updateData,
          resolve_conflicts: strategy
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update assignment')
      }

      // Confirm success
      setOperators(prev => prev.map(op => {
        if (op.id === pendingMove.operatorId) {
          return {
            ...op,
            _isUpdating: false,
            _originalPlantId: undefined,
            _originalBusinessUnitId: undefined
          }
        }
        return op
      }))

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{operator?.nombre} {operator?.apellido} → {pendingMove.targetName}</span>
        </div>
      )
    } catch (error) {
      console.error('Error updating assignment:', error)
      
      // Rollback
      setOperators(prev => prev.map(op => {
        if (op.id === pendingMove.operatorId) {
          return {
            ...op,
            plant_id: op._originalPlantId!,
            business_unit_id: op._originalBusinessUnitId!,
            _isUpdating: false,
            _originalPlantId: undefined,
            _originalBusinessUnitId: undefined
          }
        }
        return op
      }))

      toast.error('Error al actualizar asignación. Cambio revertido.')
    } finally {
      setPendingMove(null)
      setConflictData(null)
    }
  }, [pendingMove, operators, handleOptimisticUpdate])

  const handleConflictCancel = useCallback(() => {
    setPendingMove(null)
    setConflictData(null)
  }, [])

  const handleBatchAssign = useCallback(async (
    operatorIds: string[], 
    targetType: 'plant' | 'businessUnit', 
    targetId: string
  ) => {
    try {
      // Get target plant/business unit info
      let targetPlantId: string | null = null
      let targetBusinessUnitId: string | null = null

      if (targetType === 'plant') {
        const plant = plants.find(p => p.id === targetId)
        if (plant) {
          targetPlantId = plant.id
          targetBusinessUnitId = plant.business_unit_id
        }
      } else {
        targetBusinessUnitId = targetId
      }

      // Assign each operator
      const promises = operatorIds.map(async (operatorId) => {
        const response = await fetch(`/api/operators/register/${operatorId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plant_id: targetPlantId,
            business_unit_id: targetBusinessUnitId
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || `Failed to assign operator ${operatorId}`)
        }
      })

      await Promise.all(promises)

      // Refresh data
      await fetchData()
    } catch (error) {
      console.error('Error in batch assignment:', error)
      throw error
    }
  }, [plants, fetchData])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setDraggedOperator(null)

    if (!over || !draggedOperator) return

    const dropZoneId = over.id as string
    let target: { type: 'businessUnit' | 'plant' | 'unassigned', id?: string }

    if (dropZoneId === 'unassigned') {
      target = { type: 'unassigned' }
    } else if (dropZoneId.startsWith('business-unit-')) {
      target = { type: 'businessUnit', id: dropZoneId.replace('business-unit-', '') }
    } else {
      target = { type: 'plant', id: dropZoneId }
    }

    await handleDrop(draggedOperator.id, target)
  }, [draggedOperator, handleDrop])

  // Datos filtrados memoizados
  const filteredOperators = useMemo(() => {
    if (!Array.isArray(operators)) return []
    
    return operators.filter(operator => {
      const matchesSearch = 
        operator.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        operator.apellido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        operator.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesRole = roleFilter === 'all' || operator.role === roleFilter
      const matchesBusinessUnit = businessUnitFilter === 'all' || operator.business_unit_id === businessUnitFilter

      return matchesSearch && matchesRole && matchesBusinessUnit
    })
  }, [operators, searchTerm, roleFilter, businessUnitFilter])

  // Estadísticas memoizadas
  const stats = useMemo(() => {
    if (!Array.isArray(filteredOperators)) {
      return { total: 0, unassigned: 0, businessUnitOnly: 0, plantAssigned: 0, updating: 0 }
    }
    
    const total = filteredOperators.length
    const unassigned = filteredOperators.filter(op => !op.plant_id && !op.business_unit_id).length
    const businessUnitOnly = filteredOperators.filter(op => op.business_unit_id && !op.plant_id).length
    const plantAssigned = filteredOperators.filter(op => op.plant_id).length
    const updating = filteredOperators.filter(op => op._isUpdating).length

    return { total, unassigned, businessUnitOnly, plantAssigned, updating }
  }, [filteredOperators])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Cargando personal...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Filter className="h-6 w-6 text-blue-600" />
            Gestión de Personal
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Arrastra y suelta personal entre unidades de negocio y plantas, o usa asignación masiva para múltiples operadores
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar personal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {availableRoles.map(role => (
                  <SelectItem key={role} value={role}>
                    {role.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={businessUnitFilter} onValueChange={setBusinessUnitFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por unidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las unidades</SelectItem>
                {Array.isArray(businessUnits) && businessUnits.map(unit => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* User Registration Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gestión de Usuarios
            </span>
            <UserRegistrationTool />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Registra nuevos usuarios en el sistema. Los usuarios registrados podrán acceder al sistema con sus credenciales.
          </p>
        </CardContent>
      </Card>

      {/* Estadísticas mejoradas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-blue-200">
          <CardContent className="p-4 text-center">
            <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            <p className="text-sm text-gray-600">Total</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-gray-600" />
            <p className="text-2xl font-bold text-gray-600">{stats.unassigned}</p>
            <p className="text-sm text-gray-600">Sin Asignar</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <Building2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <p className="text-2xl font-bold text-green-600">{stats.businessUnitOnly}</p>
            <p className="text-sm text-gray-600">Nivel Unidad</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="p-4 text-center">
            <MapPin className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold text-blue-600">{stats.plantAssigned}</p>
            <p className="text-sm text-gray-600">Planta Específica</p>
          </CardContent>
        </Card>
        {stats.updating > 0 && (
          <Card className="border-orange-200">
            <CardContent className="p-4 text-center">
              <Loader2 className="h-6 w-6 mx-auto mb-2 text-orange-600 animate-spin" />
              <p className="text-2xl font-bold text-orange-600">{stats.updating}</p>
              <p className="text-sm text-gray-600">Procesando</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Vista principal optimizada */}
      <DndContext 
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Personal sin asignar */}
          <UnassignedContainer
            operators={filteredOperators}
            onDrop={handleDrop}
            draggedOperator={draggedOperator}
            onBatchAssign={() => {
              setBatchDialogOpen(true)
            }}
          />

          {/* Business Units con sus plantas */}
          {Array.isArray(businessUnits) && businessUnits.map(businessUnit => (
            <BusinessUnitContainer
              key={businessUnit.id}
              businessUnit={businessUnit}
              plants={plants}
              operators={filteredOperators}
              onDrop={handleDrop}
              draggedOperator={draggedOperator}
            />
          ))}
        </div>

        <DragOverlay>
          {draggedOperator && (
            <div className="transform rotate-1 scale-90 opacity-95 shadow-lg">
              <PersonnelDraggableItem
                operator={draggedOperator}
                isDragging={true}
                compact={true}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Conflict Resolution Dialog */}
      <MoveConflictDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
        conflictData={conflictData}
        onResolve={handleConflictResolve}
        onCancel={handleConflictCancel}
      />

      {/* Batch Assignment Dialog */}
      <BatchAssignmentDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        availableOperators={filteredOperators}
        plants={plants}
        businessUnits={businessUnits}
        onAssign={handleBatchAssign}
      />

      {/* Botón de actualizar */}
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 hover:bg-blue-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>
    </div>
  )
} 