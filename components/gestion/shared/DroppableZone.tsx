'use client'

import { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { dropZoneVariants } from '@/lib/utils/framer-drag-animations'

interface DroppableZoneProps {
  id: string
  title: string
  description?: string
  children: ReactNode
  items: string[]
  count?: number
  isOver?: boolean
  className?: string
  emptyMessage?: string
  emptyIcon?: ReactNode
}

export function DroppableZone({
  id,
  title,
  description,
  children,
  items,
  count,
  isOver: propIsOver = false,
  className = '',
  emptyMessage = 'Arrastra elementos aquí',
  emptyIcon
}: DroppableZoneProps) {
  const { setNodeRef, isOver: hookIsOver } = useDroppable({ id })
  const isOver = hookIsOver || propIsOver

  return (
    <motion.div
      variants={dropZoneVariants}
      animate={isOver ? "dragOver" : "idle"}
      transition={{ duration: 0.1 }}
    >
      <Card 
        ref={setNodeRef}
        className={`transition-all ${
          isOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''
        } ${className}`}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && (
                <CardDescription className="mt-1">{description}</CardDescription>
              )}
            </div>
            {count !== undefined && (
              <Badge variant="secondary">{count}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              <SortableContext items={items} strategy={verticalListSortingStrategy}>
                {children}
              </SortableContext>
              {items.length === 0 && (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                  {emptyIcon && (
                    <div className="flex justify-center mb-2">
                      {emptyIcon}
                    </div>
                  )}
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </motion.div>
  )
} 