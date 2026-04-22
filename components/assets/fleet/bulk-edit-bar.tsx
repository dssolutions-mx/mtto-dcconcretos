'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export function BulkEditBar({
  selectedIds,
  onCleared,
  onDone,
  canEdit,
}: {
  selectedIds: string[]
  onCleared: () => void
  onDone: () => void
  canEdit: boolean
}) {
  const [plantId, setPlantId] = useState<string>('')
  const [plants, setPlants] = useState<{ id: string; name: string }[]>([])

  async function loadPlants() {
    const res = await fetch('/api/plants')
    if (!res.ok) return
    const j = await res.json()
    setPlants((j.plants ?? []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
  }

  if (selectedIds.length === 0) return null

  async function reassignPlant() {
    if (!canEdit || !plantId) return
    try {
      const res = await fetch('/api/assets/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_ids: selectedIds,
          patch: { plant_id: plantId },
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Error')
      }
      toast.success('Plantas actualizadas')
      onCleared()
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 shadow-lg">
      <span className="text-sm">
        {selectedIds.length} seleccionado(s)
      </span>
      <Button size="sm" variant="ghost" onClick={onCleared}>
        Limpiar
      </Button>
      <Select
        value={plantId}
        onValueChange={setPlantId}
        onOpenChange={(o) => o && plants.length === 0 && void loadPlants()}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Mover a planta…" />
        </SelectTrigger>
        <SelectContent>
          {plants.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={!canEdit || !plantId} onClick={reassignPlant}>
        Aplicar
      </Button>
    </div>
  )
}
