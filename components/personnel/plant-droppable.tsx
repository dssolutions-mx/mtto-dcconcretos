'use client'

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Building2, Users, MapPin } from 'lucide-react'
import { PersonnelDraggableItem } from './personnel-draggable-item'

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

interface PlantDroppableProps {
  plant: Plant
  operators: Profile[]
  isOver?: boolean
}

export function PlantDroppable({ plant, operators, isOver }: PlantDroppableProps) {
  const { setNodeRef } = useDroppable({
    id: plant.id,
  })

  // Show only operators assigned specifically to this plant
  const plantOperators = operators.filter(op => op.plant_id === plant.id)

  return (
    <Card 
      ref={setNodeRef}
      className={`h-full transition-all duration-200 ${
        isOver 
          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20' 
          : 'hover:shadow-md'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-lg">{plant.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Código: {plant.code}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="flex items-center space-x-1">
            <Users className="h-3 w-3" />
            <span>{plantOperators.length}</span>
          </Badge>
        </div>
        
        {plant.business_units && (
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{plant.business_units.name}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {plantOperators.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin personal asignado</p>
                <p className="text-xs">Arrastra operadores aquí</p>
              </div>
            ) : (
              plantOperators.map((operator) => (
                <PersonnelDraggableItem
                  key={operator.id}
                  operator={operator}
                  compact={true}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Business Unit assigned operators droppable zone
interface BusinessUnitDroppableProps {
  businessUnit: {
    id: string
    name: string
    code: string
  }
  operators: Profile[]
  isOver?: boolean
}

export function BusinessUnitDroppable({ businessUnit, operators, isOver }: BusinessUnitDroppableProps) {
  const { setNodeRef } = useDroppable({
    id: `business-unit-${businessUnit.id}`,
  })

  // Show operators assigned to this business unit but not to specific plants
  const businessUnitOperators = operators.filter(op => 
    op.business_unit_id === businessUnit.id && !op.plant_id
  )

  return (
    <Card 
      ref={setNodeRef}
      className={`h-full transition-all duration-200 ${
        isOver 
          ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20' 
          : 'hover:shadow-md'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-green-600" />
            <div>
              <CardTitle className="text-lg">{businessUnit.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Personal de unidad de negocio
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="flex items-center space-x-1 bg-green-100 text-green-800">
            <Users className="h-3 w-3" />
            <span>{businessUnitOperators.length}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {businessUnitOperators.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Sin personal de unidad</p>
                <p className="text-xs">Personal asignado a plantas específicas</p>
              </div>
            ) : (
              businessUnitOperators.map((operator) => (
                <PersonnelDraggableItem
                  key={operator.id}
                  operator={operator}
                  compact={true}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Unassigned operators droppable zone
interface UnassignedDroppableProps {
  operators: Profile[]
  isOver?: boolean
}

export function UnassignedDroppable({ operators, isOver }: UnassignedDroppableProps) {
  const { setNodeRef } = useDroppable({
    id: 'unassigned',
  })

  // Show operators that are not assigned to any specific plant (regardless of business unit assignment)
  const unassignedOperators = operators.filter(op => !op.plant_id)

  return (
    <Card 
      ref={setNodeRef}
      className={`h-full transition-all duration-200 ${
        isOver 
          ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950/20' 
          : 'hover:shadow-md'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-orange-600" />
            <div>
              <CardTitle className="text-lg">Sin Asignar</CardTitle>
              <p className="text-sm text-muted-foreground">
                Personal disponible
              </p>
            </div>
          </div>
          <Badge variant="outline" className="flex items-center space-x-1">
            <Users className="h-3 w-3" />
            <span>{unassignedOperators.length}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {unassignedOperators.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Todo el personal está asignado</p>
              </div>
            ) : (
                             unassignedOperators.map((operator) => (
                 <PersonnelDraggableItem
                   key={operator.id}
                   operator={operator}
                   compact={true}
                 />
               ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
} 