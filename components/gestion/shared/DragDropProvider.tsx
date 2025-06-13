'use client'

import { ReactNode } from 'react'
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
} from '@dnd-kit/core'

interface DragDropProviderProps {
  children: ReactNode
  onDragStart?: (event: DragStartEvent) => void
  onDragOver?: (event: DragOverEvent) => void
  onDragEnd: (event: DragEndEvent) => void
  overlay?: ReactNode
}

export function DragDropProvider({
  children,
  onDragStart,
  onDragOver,
  onDragEnd,
  overlay
}: DragDropProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      {children}
      <DragOverlay>
        {overlay}
      </DragOverlay>
    </DndContext>
  )
} 