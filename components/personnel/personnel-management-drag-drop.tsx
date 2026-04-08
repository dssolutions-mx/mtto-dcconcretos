'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import {
  plantDroppableId,
  parseOperatorDragId,
  resolvePersonnelDropTarget,
  preferZoneDroppableCollision,
  isDroppableContainerId,
} from '@/lib/dnd/assignment-drop-targets'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'react-hot-toast'
import { Loader2, Search, Filter, Users, Building2, MapPin, RefreshCw, CheckCircle2, AlertCircle, UserPlus } from 'lucide-react'
import { PersonnelDraggableItem } from './personnel-draggable-item'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { UserRegistrationTool } from '@/components/auth/user-registration-tool'
import { MoveConflictDialog, ConflictData, ResolutionStrategy } from './dialogs/move-conflict-dialog'
import { BatchAssignmentDialog } from './batch-assignment-dialog'
import { dropZoneVariants, dragOverlayVariants } from '@/lib/utils/framer-drag-animations'
import {
  usePersonnelBoardData,
  type PersonnelBoardProfile as Profile,
  type PersonnelBoardPlant as Plant,
  type PersonnelBoardBusinessUnit as BusinessUnit,
} from '@/hooks/use-personnel-board-data'
import { canRegisterOperatorsClient, isFullPersonnelRegistrationClient } from '@/lib/auth/client-authorization'

export type PersonnelManagementDragDropProps = {
  /** Parent can call board `refetch` after user registration (e.g. header CTA). */
  registrationRefetchRef?: MutableRefObject<() => void>
  /** When false, `UserRegistrationTool` is rendered by the parent (homogeneous shell). */
  embedRegistrationTool?: boolean
}

type PlacementPatch = {
  plant_id: string | null
  business_unit_id: string | null
}

// Componente de zona droppable optimizada
function BusinessUnitContainer({ 
  businessUnit, 
  plants, 
  operators, 
}: {
  businessUnit: BusinessUnit
  plants: Plant[]
  operators: Profile[]
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
    <motion.div
      variants={dropZoneVariants}
      animate={isOver ? "dragOver" : "idle"}
      transition={{ duration: 0.1 }}
    >
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
              <AnimatePresence mode="popLayout">
                {businessUnitOperators.map((operator) => (
                  <motion.div
                    key={operator.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <PersonnelDraggableItem
                      operator={operator}
                      compact={true}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
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
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
    </motion.div>
  )
}

// Componente de planta contenida
function PlantContainer({
  plant,
  operators,
}: {
  plant: Plant
  operators: Profile[]
}) {
  
  const { setNodeRef, isOver } = useDroppable({
    id: plantDroppableId(plant.id),
  })
  
  const plantOperators = Array.isArray(operators) ? operators.filter(op => op.plant_id === plant.id) : []

  return (
    <motion.div
      variants={dropZoneVariants}
      animate={isOver ? "dragOver" : "idle"}
      transition={{ duration: 0.1 }}
    >
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
          <AnimatePresence mode="popLayout">
            {plantOperators.map((operator) => (
              <motion.div
                key={operator.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <PersonnelDraggableItem
                  operator={operator}
                  compact={true}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-2 text-gray-500">
          <span className="text-xs">Sin personal asignado</span>
        </div>
      )}
      </div>
    </motion.div>
  )
}

// Componente de personal sin asignar
function UnassignedContainer({
  operators,
  onBatchAssign
}: {
  operators: Profile[]
  onBatchAssign?: () => void
}) {
  
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned',
  })
  
  const unassignedOperators = Array.isArray(operators) ? operators.filter(op => !op.plant_id && !op.business_unit_id) : []

  return (
    <motion.div
      variants={dropZoneVariants}
      animate={isOver ? "dragOver" : "idle"}
      transition={{ duration: 0.1 }}
    >
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
              <AnimatePresence mode="popLayout">
                {unassignedOperators.map((operator) => (
                  <motion.div
                    key={operator.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <PersonnelDraggableItem
                      operator={operator}
                      compact={false}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
    </motion.div>
  )
}

export function PersonnelManagementDragDrop({
  registrationRefetchRef,
  embedRegistrationTool = true,
}: PersonnelManagementDragDropProps = {}) {
  const { profile } = useAuthZustand()
  const {
    operators,
    setOperators,
    plants,
    businessUnits,
    loading,
    refetch,
  } = usePersonnelBoardData(profile)

  useEffect(() => {
    if (!registrationRefetchRef) return
    registrationRefetchRef.current = () => {
      void refetch()
    }
    return () => {
      registrationRefetchRef.current = () => {}
    }
  }, [registrationRefetchRef, refetch])
  const [draggedOperator, setDraggedOperator] = useState<Profile | null>(null)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflictData, setConflictData] = useState<ConflictData | null>(null)
  const [pendingMove, setPendingMove] = useState<{
    operatorId: string
    updateData: PlacementPatch
    targetName: string
  } | null>(null)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string>('all')

  const lastContainerOverRef = useRef<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    })
  )

  const availableRoles = [
    'OPERADOR',
    'COORDINADOR_MANTENIMIENTO',
    'GERENTE_MANTENIMIENTO',
    'MECANICO',
    'RECURSOS_HUMANOS',
    'ENCARGADO_ALMACEN',
    'JEFE_PLANTA',
    'JEFE_UNIDAD_NEGOCIO',
    'DOSIFICADOR',
    'AUXILIAR_COMPRAS',
    'AREA_ADMINISTRATIVA',
    'EJECUTIVO',
    'VISUALIZADOR'
  ]

  const handleDragStart = useCallback((event: DragStartEvent) => {
    lastContainerOverRef.current = null
    if (!Array.isArray(operators)) {
      setDraggedOperator(null)
      return
    }
    const oid = parseOperatorDragId(event.active.id)
    const operator = oid ? operators.find((op) => op.id === oid) : undefined
    setDraggedOperator(operator || null)
  }, [operators])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const id = event.over?.id
    if (id != null && isDroppableContainerId(id)) {
      lastContainerOverRef.current = String(id)
    }
  }, [])

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

    // UI Restriction: JEFE_PLANTA can only move OPERADOR and DOSIFICADOR when dealing with unassigned personnel
    // This is simpler than complex RLS and provides better UX
    if (profile?.role === 'JEFE_PLANTA') {
      // Check if moving FROM unassigned (operator has no plant_id or business_unit_id)
      const isMovingFromUnassigned = !operator.plant_id && !operator.business_unit_id
      // Check if moving TO unassigned
      const isMovingToUnassigned = target.type === 'unassigned'
      
      // If dealing with unassigned personnel (either source or destination), only allow OPERADOR and DOSIFICADOR
      if ((isMovingFromUnassigned || isMovingToUnassigned) && !['OPERADOR', 'DOSIFICADOR'].includes(operator.role)) {
        toast.error(
          `Como Jefe de Planta, solo puedes mover OPERADOR y DOSIFICADOR cuando se trata de personal sin asignar. El rol ${operator.role} requiere autorización de nivel superior.`,
          { duration: 5000 }
        )
        return
      }
    }

    // Aplicar cambio optimista inmediatamente para UX inmediata
    handleOptimisticUpdate(operatorId, target)

    let updateData: PlacementPatch
    let targetName = ''

    switch (target.type) {
      case 'unassigned':
        updateData = { plant_id: null, business_unit_id: null }
        targetName = 'Sin asignar'
        break
      case 'businessUnit': {
        const businessUnit = businessUnits.find(bu => bu.id === target.id)
        updateData = { plant_id: null, business_unit_id: target.id ?? null }
        targetName = businessUnit?.name || 'Unidad de negocio'
        break
      }
      case 'plant': {
        const plant = plants.find(p => p.id === target.id)
        updateData = {
          plant_id: target.id ?? null,
          business_unit_id: plant?.business_unit_id ?? null,
        }
        targetName = plant?.name || 'Planta'
        break
      }
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

      await refetch()
    } catch (error) {
      console.error('Error in batch assignment:', error)
      throw error
    }
  }, [plants, refetch])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setDraggedOperator(null)

      const operatorId = parseOperatorDragId(active.id)
      if (!operatorId) {
        lastContainerOverRef.current = null
        return
      }

      const validPlantIds = new Set(Array.isArray(plants) ? plants.map((p) => p.id) : [])
      const validBuIds = new Set(
        Array.isArray(businessUnits) ? businessUnits.map((b) => b.id) : []
      )

      const resolved = resolvePersonnelDropTarget(
        over?.id,
        lastContainerOverRef.current,
        validPlantIds,
        validBuIds
      )
      lastContainerOverRef.current = null

      if (!resolved) return

      let target: { type: 'businessUnit' | 'plant' | 'unassigned'; id?: string }
      if (resolved.type === 'unassigned') {
        target = { type: 'unassigned' }
      } else if (resolved.type === 'businessUnit') {
        target = { type: 'businessUnit', id: resolved.id }
      } else {
        target = { type: 'plant', id: resolved.id }
      }

      await handleDrop(operatorId, target)
    },
    [handleDrop, plants, businessUnits]
  )

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
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="text-sm">Cargando personal…</span>
      </div>
    )
  }

  const canRegister = canRegisterOperatorsClient(profile)
  const isFullRegistration = isFullPersonnelRegistrationClient(profile)

  return (
    <div className="space-y-6">
      {embedRegistrationTool && canRegister && (
        <section
          className="rounded-xl border border-border bg-card px-4 py-5 shadow-sm ring-1 ring-primary/15 sm:px-6 sm:py-6"
          aria-labelledby="personnel-alta-heading"
        >
          <div className="flex items-center gap-2 text-primary">
            <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Alta de personal
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0 space-y-1.5">
              <h2
                id="personnel-alta-heading"
                className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
              >
                {isFullRegistration
                  ? 'Registrar usuarios en la plataforma'
                  : 'Alta de operadores en tu unidad o planta'}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground max-w-prose">
                {isFullRegistration
                  ? 'Como Recursos Humanos o Gerencia General puedes crear usuarios con distintos roles y asignarlos a cualquier unidad o planta.'
                  : 'Como Jefe de Unidad de Negocio o Jefe de Planta puedes registrar operadores, dosificadores y mecánicos dentro de tu alcance (POL-OPE-001). Recursos Humanos mantiene el gobierno integral y las altas sin restricción de alcance.'}
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2">
              <UserRegistrationTool
                triggerVariant="hero"
                onRegistered={() => {
                  void refetch()
                }}
              />
              <p className="text-[11px] text-muted-foreground text-center sm:text-right max-w-[220px] sm:max-w-xs">
                Acceso directo:{' '}
                <span className="tabular-nums font-medium text-foreground">?registrar=1</span>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Resumen — mismo ritmo que Incidentes (métricas en línea) */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="font-semibold tabular-nums text-foreground">{filteredOperators.length}</span>{' '}
          <span className="text-muted-foreground">mostrados</span>
        </span>
        <span>
          <span className="font-semibold tabular-nums text-foreground">{stats.unassigned}</span>{' '}
          <span className="text-muted-foreground">sin asignar</span>
        </span>
        <span>
          <span className="font-semibold tabular-nums text-foreground">{stats.businessUnitOnly}</span>{' '}
          <span className="text-muted-foreground">solo unidad</span>
        </span>
        <span>
          <span className="font-semibold tabular-nums text-foreground">{stats.plantAssigned}</span>{' '}
          <span className="text-muted-foreground">en planta</span>
        </span>
        {stats.updating > 0 && (
          <span className="text-amber-700">
            <span className="font-semibold tabular-nums">{stats.updating}</span>{' '}
            <span className="text-muted-foreground">actualizando…</span>
          </span>
        )}
      </div>

      {/* Header con filtros */}
      <Card className="border border-border/60">
        <CardHeader className="bg-muted/30 border-b border-border/40">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Filter className="h-5 w-5 text-muted-foreground" aria-hidden />
            Tablero de asignación
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Arrastra personal entre unidades y plantas, o usa asignación masiva. Los cambios se validan en el servidor según tu rol.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
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

      {/* Vista principal optimizada */}
      <DndContext 
        sensors={sensors}
        collisionDetection={preferZoneDroppableCollision()}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Personal sin asignar */}
          <UnassignedContainer
            operators={filteredOperators}
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
            />
          ))}
        </div>

        <DragOverlay>
          {draggedOperator && (
            <motion.div
              variants={dragOverlayVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="transform rotate-1 scale-90 opacity-95 shadow-lg">
                <PersonnelDraggableItem
                  operator={draggedOperator}
                  isDragging={true}
                  compact={true}
                />
              </div>
            </motion.div>
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
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>
    </div>
  )
} 