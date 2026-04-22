'use client'

import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operativo' },
  { value: 'maintenance', label: 'En Mantenimiento' },
  { value: 'repair', label: 'En Reparación' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'retired', label: 'Retirado' },
] as const

export function FleetAssetStatusField({
  value,
  assetId,
  canEdit,
  onSaved,
}: {
  value: string
  assetId: string
  canEdit: boolean
  onSaved: () => void
}) {
  const [v, setV] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setV(value)
  }, [value])

  async function save() {
    if (!canEdit || v === value) return
    setSaving(true)
    try {
      const res = await fetch('/api/assets/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_ids: [assetId], patch: { status: v } }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Error')
      }
      toast.success('Guardado')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">Estado</div>
      <div className="flex gap-2 items-center">
        <Select value={v} onValueChange={setV} disabled={!canEdit}>
          <SelectTrigger className="h-9 flex-1 text-xs">
            <SelectValue placeholder="Seleccionar estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          disabled={!canEdit || saving || v === value}
          onClick={save}
        >
          Guardar
        </Button>
      </div>
    </div>
  )
}
