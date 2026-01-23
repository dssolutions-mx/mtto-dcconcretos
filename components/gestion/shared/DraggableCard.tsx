'use client'

import { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { GripVertical } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { dragItemVariants, springTransition } from '@/lib/utils/framer-drag-animations'

interface DraggableCardProps {
  id: string
  children: ReactNode
  className?: string
  disabled?: boolean
}

export function DraggableCard({ 
  id, 
  children, 
  className = '',
  disabled = false 
}: DraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    disabled
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <motion.div
      variants={dragItemVariants}
      initial="idle"
      animate={isDragging ? "dragging" : "idle"}
      whileHover={disabled || isDragging ? undefined : "hover"}
      // No layout prop during drag - conflicts with @dnd-kit transforms
      transition={springTransition}
    >
      <Card
        ref={setNodeRef}
        style={style}
        className={`transition-all ${
          isDragging ? 'cursor-grabbing shadow-lg' : 'cursor-grab hover:shadow-md'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            {!disabled && (
              <div {...attributes} {...listeners} className="cursor-grab">
                <GripVertical className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {children}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
} 