'use client'

import { ReactNode } from 'react'
import { DragOverlay } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'framer-motion'
import { dragOverlayVariants } from '@/lib/utils/framer-drag-animations'

interface AnimatedDragOverlayProps {
  children: ReactNode | null
  isDragging: boolean
}

/**
 * Animated drag overlay component that uses @dnd-kit's DragOverlay for cursor tracking
 * and adds Framer Motion animations to the content
 */
export function AnimatedDragOverlay({ children, isDragging }: AnimatedDragOverlayProps) {
  return (
    <DragOverlay>
      <AnimatePresence>
        {isDragging && children && (
          <motion.div
            variants={dragOverlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </DragOverlay>
  )
}


