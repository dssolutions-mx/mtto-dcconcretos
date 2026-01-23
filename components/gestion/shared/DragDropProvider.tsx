'use client'

import { ReactNode, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverEvent,
} from '@dnd-kit/core'
import { AnimatePresence, motion } from 'framer-motion'
import { dragOverlayVariants } from '@/lib/utils/framer-drag-animations'

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
  const [isDragging, setIsDragging] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setIsDragging(true)
    onDragStart?.(event)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false)
    onDragEnd(event)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        <AnimatePresence>
          {isDragging && overlay && (
            <motion.div
              variants={dragOverlayVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {overlay}
            </motion.div>
          )}
        </AnimatePresence>
      </DragOverlay>
    </DndContext>
  )
} 