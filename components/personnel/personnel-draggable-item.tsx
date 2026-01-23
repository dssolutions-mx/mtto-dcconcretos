'use client'

import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, Phone, MapPin } from 'lucide-react'
import { dragItemVariants, springTransition } from '@/lib/utils/framer-drag-animations'

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

interface PersonnelDraggableItemProps {
  operator: Profile
  compact?: boolean
  isDragging?: boolean
}

const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    'GERENCIA_GENERAL': 'default',
    'JEFE_UNIDAD_NEGOCIO': 'default',
    'ENCARGADO_MANTENIMIENTO': 'secondary',
    'JEFE_PLANTA': 'secondary',
    'OPERADOR': 'outline',
    'DOSIFICADOR': 'outline',
    'AUXILIAR_COMPRAS': 'outline',
    'AREA_ADMINISTRATIVA': 'outline',
  }
  return variants[role] || 'outline'
}

const getRoleDisplayName = (role: string) => {
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

const getShiftDisplayName = (shift?: string) => {
  const shifts: Record<string, string> = {
    'morning': 'Matutino',
    'afternoon': 'Vespertino',
    'night': 'Nocturno'
  }
  return shift ? shifts[shift] || shift : ''
}

export function PersonnelDraggableItem({ operator, compact = false, isDragging = false }: PersonnelDraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: operator.id,
  })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.8 : 1,
  }

  const initials = `${operator.nombre?.[0] || ''}${operator.apellido?.[0] || ''}`

  if (compact) {
    return (
      <motion.div
        variants={dragItemVariants}
        initial="idle"
        animate={isDragging ? "dragging" : "idle"}
        whileHover={isDragging ? undefined : "hover"}
        // No layout prop during drag - conflicts with @dnd-kit transforms
        transition={springTransition}
      >
        <div
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          className={`group relative p-2 bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing ${
            isDragging ? 'shadow-lg' : ''
          }`}
        >
          <div className="flex items-center space-x-2">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${operator.nombre} ${operator.apellido}`} />
              <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900 truncate">
                {operator.nombre} {operator.apellido}
              </p>
              <div className="flex items-center gap-1">
                <Badge variant={getRoleBadgeVariant(operator.role)} className="text-xs">
                  {getRoleDisplayName(operator.role)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={dragItemVariants}
      initial="idle"
      animate={isDragging ? "dragging" : "idle"}
      whileHover={isDragging ? undefined : "hover"}
      // No layout prop during drag - conflicts with @dnd-kit transforms
      transition={springTransition}
    >
      <Card
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`group relative cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md ${
          isDragging ? 'shadow-lg' : ''
        }`}
      >
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${operator.nombre} ${operator.apellido}`} />
            <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {operator.nombre} {operator.apellido}
            </h3>
            {operator.employee_code && (
              <p className="text-sm text-gray-500">#{operator.employee_code}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant={getRoleBadgeVariant(operator.role)} className="text-xs">
                {getRoleDisplayName(operator.role)}
              </Badge>
              {operator.shift && (
                <span className="text-xs text-gray-400">
                  {getShiftDisplayName(operator.shift)}
                </span>
              )}
            </div>
            {operator.position && (
              <p className="text-xs text-gray-500 mt-1 truncate">
                {operator.position}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              {operator.telefono && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{operator.telefono}</span>
                </div>
              )}
              {operator.plants && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{operator.plants.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </motion.div>
  )
} 