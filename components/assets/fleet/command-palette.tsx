'use client'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { FleetTreeNode } from '@/types/fleet'

export function FleetCommandPalette({
  open,
  onOpenChange,
  nodes,
  onSelectNode,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  nodes: FleetTreeNode[]
  onSelectNode: (n: FleetTreeNode) => void
}) {
  const assets = nodes.filter((n) => n.kind === 'asset')
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar por código de activo o etiqueta…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Activos">
          {assets.map((n) => (
            <CommandItem
              key={n.id}
              value={`${n.label} ${n.asset_ids?.[0] ?? ''}`}
              onSelect={() => onSelectNode(n)}
            >
              <span className="font-mono">{n.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
