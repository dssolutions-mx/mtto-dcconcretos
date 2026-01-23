import { Variants } from 'framer-motion'

/**
 * Animation variants for draggable items
 * Optimized: No animations during drag to prevent conflicts with @dnd-kit transforms
 */
export const dragItemVariants: Variants = {
  idle: { 
    scale: 1, 
    rotate: 0, 
    opacity: 1,
    transition: { duration: 0.15, ease: "easeOut" }
  },
  dragging: { 
    // No transform animations during drag - @dnd-kit handles this
    opacity: 0.6,
    transition: { duration: 0.1 }
  },
  hover: { 
    scale: 1.01,
    transition: { duration: 0.15, ease: "easeOut" }
  }
}

/**
 * Animation variants for drop zones
 * Optimized: No color animations - colors are handled via CSS classes to avoid "transparent" animation warnings
 * This prevents Framer Motion from trying to animate non-animatable color values
 */
export const dropZoneVariants: Variants = {
  idle: { 
    transition: { duration: 0.1 }
  },
  dragOver: { 
    transition: { duration: 0.1 }
  },
  hover: {
    transition: { duration: 0.1 }
  }
}

/**
 * Animation variants for drag overlay (ghost preview)
 * Lightweight animations that don't interfere with cursor tracking
 */
export const dragOverlayVariants: Variants = {
  initial: { 
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.1 }
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.15, ease: "easeOut" }
  },
  exit: { 
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.1 }
  }
}

/**
 * Lightweight transition for list items (no spring during drag)
 */
export const springTransition = {
  duration: 0.2,
  ease: "easeOut"
}

/**
 * Fast spring transition for quick interactions
 */
export const fastSpringTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 25
}

/**
 * Layout animation transition
 */
export const layoutTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8
}

/**
 * Hook to get animation props for draggable items
 */
export function useDragAnimations(isDragging: boolean) {
  return {
    variants: dragItemVariants,
    initial: "idle",
    animate: isDragging ? "dragging" : "idle",
    whileHover: "hover",
    layout: true,
    transition: springTransition
  }
}

/**
 * Hook to get animation props for drop zones
 */
export function useDropZoneAnimations(isOver: boolean) {
  return {
    variants: dropZoneVariants,
    animate: isOver ? "dragOver" : "idle",
    whileHover: "hover",
    transition: { duration: 0.2 }
  }
}


