'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { CreateTireInput } from '@/types/tires'
import { CreateTireSummaryCard } from './summary-card'

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

interface CreateTireStepLocationProps {
  form: CreateTireInput
  previewCode: string | null
  autoGenerate: boolean
  plants: PlantOption[]
  warehouses: WarehouseOption[]
  onFormChange: (patch: Partial<CreateTireInput>) => void
}

export function CreateTireStepLocation({
  form,
  previewCode,
  autoGenerate,
  plants,
  warehouses,
  onFormChange,
}: CreateTireStepLocationProps) {
  return (
    <section className="space-y-4">
      <CreateTireSummaryCard
        form={form}
        previewCode={previewCode}
        autoGenerate={autoGenerate}
        plants={plants}
        warehouses={warehouses}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="cost">Costo de compra</Label>
          <Input
            id="cost"
            type="number"
            min={0}
            step="0.01"
            value={form.purchase_cost ?? ''}
            onChange={(e) =>
              onFormChange({
                purchase_cost: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="purchase-date">Fecha de compra</Label>
          <Input
            id="purchase-date"
            type="date"
            value={form.purchase_date ?? ''}
            onChange={(e) =>
              onFormChange({ purchase_date: e.target.value || undefined })
            }
          />
        </div>
      </div>

      {warehouses.length > 0 && (
        <div className="space-y-1">
          <Label>Almacén</Label>
          <Select
            value={form.warehouse_id ?? '__none__'}
            onValueChange={(v) =>
              onFormChange({ warehouse_id: v === '__none__' ? undefined : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar almacén" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin asignar</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.warehouse_code} — {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          value={form.notes ?? ''}
          onChange={(e) => onFormChange({ notes: e.target.value })}
          rows={2}
        />
      </div>
    </section>
  )
}
