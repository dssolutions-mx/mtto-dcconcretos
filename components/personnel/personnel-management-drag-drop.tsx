'use client'

import React, { useState, useEffect } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'react-hot-toast'
import { Loader2, User, Search, Filter } from 'lucide-react'
import { PersonnelDraggableItem } from './personnel-draggable-item'
import { PlantDroppable, UnassignedDroppable } from './plant-droppable'

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

export function PersonnelManagementDragDrop() {
  const [operators, setOperators] = useState<Profile[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedOperator, setDraggedOperator] = useState<Profile | null>(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string>('all')

  const availableRoles = [
    'OPERADOR',
    'ENCARGADO_MANTENIMIENTO',
    'JEFE_PLANTA',
    'DOSIFICADOR',
    'AUXILIAR_COMPRAS',
    'AREA_ADMINISTRATIVA'
  ]

  const fetchData = async () => {
    try {
      setLoading(true)
      const [operatorsRes, plantsRes, businessUnitsRes] = await Promise.all([
        fetch('/api/operators/register'),
        fetch('/api/plants'),
        fetch('/api/business-units')
      ])

      if (!operatorsRes.ok || !plantsRes.ok || !businessUnitsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const [operatorsData, plantsData, businessUnitsData] = await Promise.all([
        operatorsRes.json(),
        plantsRes.json(),
        businessUnitsRes.json()
      ])

      setOperators(operatorsData || [])
      setPlants(plantsData || [])
      setBusinessUnits(businessUnitsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    const operator = operators.find(op => op.id === event.active.id)
    setDraggedOperator(operator || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setDraggedOperator(null)

    if (!over) return

    const operatorId = active.id as string
    const dropZoneId = over.id as string

    // Find the operator being moved
    const operator = operators.find(op => op.id === operatorId)
    if (!operator) return

    // Determine the type of drop zone
    let updateData: any = {}
    let targetName = ''

    if (dropZoneId === 'unassigned') {
      // Dropped on unassigned zone
      updateData = { plant_id: null, business_unit_id: null }
      targetName = 'Sin asignar'
    } else {
      // Dropped on plant zone
      const plant = plants.find(p => p.id === dropZoneId)
      if (!plant) return
      
      updateData = { plant_id: dropZoneId, business_unit_id: plant.business_unit_id }
      targetName = plant.name
    }

    // If dropped on the same assignment, do nothing
    if (operator.plant_id === updateData.plant_id && 
        operator.business_unit_id === updateData.business_unit_id) {
      return
    }

    try {
      // Update operator's assignment
      const response = await fetch(`/api/operators/register/${operatorId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update operator assignment')
      }

      const updatedOperator = await response.json()
      
      // Update local state
      setOperators(prev => 
        prev.map(op => 
          op.id === operatorId 
            ? { 
                ...op, 
                plant_id: updatedOperator.plant_id, 
                business_unit_id: updatedOperator.business_unit_id,
                plants: updatedOperator.plants,
                business_units: updatedOperator.business_units
              }
            : op
        )
      )

      toast.success(`${operator.nombre} ${operator.apellido} asignado a ${targetName}`)
    } catch (error) {
      console.error('Error updating operator assignment:', error)
      toast.error('Error al actualizar asignación')
    }
  }

  // Filter operators
  const filteredOperators = operators.filter(operator => {
    const matchesSearch = 
      operator.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operator.apellido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operator.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesRole = roleFilter === 'all' || operator.role === roleFilter
    const matchesBusinessUnit = businessUnitFilter === 'all' || operator.business_unit_id === businessUnitFilter

    return matchesSearch && matchesRole && matchesBusinessUnit
  })

  // Group operators by assignment status
  const unassignedOperators = filteredOperators.filter(op => !op.plant_id)
  const assignedOperators = filteredOperators.filter(op => op.plant_id)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando personal...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre o código..."
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
                {businessUnits.map(unit => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <DndContext 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Unassigned Operators */}
          <UnassignedDroppable 
            operators={filteredOperators}
            isOver={draggedOperator !== null}
          />

          {/* Plants with Assigned Operators */}
          {plants.map(plant => (
            <PlantDroppable
              key={plant.id}
              plant={plant}
              operators={filteredOperators}
              isOver={draggedOperator !== null}
            />
          ))}
        </div>

        <DragOverlay>
          {draggedOperator && (
            <PersonnelDraggableItem
              operator={draggedOperator}
              isDragging
            />
          )}
        </DragOverlay>
      </DndContext>

      <div className="flex justify-end">
        <Button 
          variant="outline" 
          onClick={fetchData}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Actualizar
        </Button>
      </div>
    </div>
  )
} 