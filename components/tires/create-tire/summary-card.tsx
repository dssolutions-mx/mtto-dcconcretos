'use client'

import type { CreateTireInput } from '@/types/tires'

interface WarehouseOption {
  id: string
  name: string
  warehouse_code: string
}

interface PlantOption {
  id: string
  name: string
  code?: string | null
}

interface CreateTireSummaryCardProps {
  form: CreateTireInput
  previewCode: string | null
  autoGenerate: boolean
  plants: PlantOption[]
  warehouses: WarehouseOption[]
}

function conditionLabel(condition?: CreateTireInput['condition']): string {
  if (condition === 'renovada') return 'Renovada'
  return 'Nueva'
}

export function CreateTireSummaryCard({
  form,
  previewCode,
  autoGenerate,
  plants,
  warehouses,
}: CreateTireSummaryCardProps) {
  const plant = plants.find((p) => p.id === form.plant_id)
  const warehouse = warehouses.find((w) => w.id === form.warehouse_id)

  const fleetCode = autoGenerate
    ? previewCode ?? 'Se asignará al guardar'
    : form.internal_code?.trim() || form.serial_number?.trim() || '—'

  const spec = [form.brand, form.size].filter(Boolean).join(' ')
  const modelPart = form.model?.trim() ? ` · ${form.model.trim()}` : ''

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1.5 text-sm">
      <p className="font-medium">Resumen</p>
      <dl className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-4">
          <dt>Código de flota</dt>
          <dd className="font-mono text-foreground text-right">{fleetCode}</dd>
        </div>
        {form.serial_number?.trim() && (
          <div className="flex justify-between gap-4">
            <dt>DOT / serie</dt>
            <dd className="font-mono text-foreground text-right">{form.serial_number.trim()}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt>Llanta</dt>
          <dd className="text-foreground text-right">
            {spec}
            {modelPart} · {conditionLabel(form.condition)}
          </dd>
        </div>
        {plant && (
          <div className="flex justify-between gap-4">
            <dt>Planta</dt>
            <dd className="text-foreground text-right">
              {plant.code ? `${plant.code} — ` : ''}
              {plant.name}
            </dd>
          </div>
        )}
        {warehouse && (
          <div className="flex justify-between gap-4">
            <dt>Almacén</dt>
            <dd className="text-foreground text-right">
              {warehouse.warehouse_code} — {warehouse.name}
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
