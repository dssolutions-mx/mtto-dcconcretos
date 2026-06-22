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
import type { CreateTireInput } from '@/types/tires'

interface CreateTireStepSpecsProps {
  form: CreateTireInput
  onFormChange: (patch: Partial<CreateTireInput>) => void
}

export function CreateTireStepSpecs({ form, onFormChange }: CreateTireStepSpecsProps) {
  return (
    <section className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Marca y medida son obligatorias para identificar la llanta en inventario y montajes.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="brand">Marca *</Label>
          <Input
            id="brand"
            value={form.brand}
            onChange={(e) => onFormChange({ brand: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="size">Medida *</Label>
          <Input
            id="size"
            placeholder="11R22.5"
            value={form.size}
            onChange={(e) => onFormChange({ size: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="model">Modelo</Label>
        <Input
          id="model"
          value={form.model ?? ''}
          onChange={(e) => onFormChange({ model: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>Condición</Label>
        <Select
          value={form.condition}
          onValueChange={(v) =>
            onFormChange({ condition: v as CreateTireInput['condition'] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nueva">Nueva</SelectItem>
            <SelectItem value="renovada">Renovada</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}
