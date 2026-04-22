'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ShortcutsOverlay({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          <li>
            <kbd className="rounded border bg-muted px-1">⌘K</kbd> — Paleta de comandos
          </li>
          <li>
            <kbd className="rounded border bg-muted px-1">/</kbd> — Enfocar filtro
          </li>
          <li>
            <kbd className="rounded border bg-muted px-1">F</kbd> — Modo foco (nodo seleccionado)
          </li>
          <li>
            <kbd className="rounded border bg-muted px-1">?</kbd> — Esta ayuda
          </li>
          <li>
            <kbd className="rounded border bg-muted px-1">⌘[ / ⌘]</kbd> — Expandir / colapsar
            (según implementación)
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}
