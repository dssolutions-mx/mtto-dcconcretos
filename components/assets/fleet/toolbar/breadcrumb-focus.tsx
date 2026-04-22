'use client'

import type { FleetTreeNode } from '@/types/fleet'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export function BreadcrumbFocus({
  focus,
  onClear,
}: {
  focus: FleetTreeNode | null
  onClear: () => void
}) {
  if (!focus || focus.kind === 'root') return null
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="truncate">
        Foco: <strong className="text-foreground">{focus.label}</strong>
      </span>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClear}>
        <ChevronLeft className="mr-1 h-3 w-3" />
        Salir
      </Button>
    </div>
  )
}
