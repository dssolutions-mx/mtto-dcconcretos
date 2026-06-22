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
import { previewInternalCode } from '@/lib/tires/identifier'
import type { CreateTireInput, TireIdRules } from '@/types/tires'
import type { IdentityFeedback } from '@/lib/tires/identity-feedback'
import {
  IdentityFieldFeedback,
  identityInputInvalid,
} from '@/components/tires/create-tire/identity-feedback'
import { CreateTireRulesBanner } from './rules-banner'

interface PlantOption {
  id: string
  name: string
  code?: string | null
}

interface CreateTireStepIdentificationProps {
  form: CreateTireInput
  idRules: TireIdRules
  previewCode: string | null
  plants: PlantOption[]
  selectedPlantCode: string | null
  dotFeedback: IdentityFeedback
  internalFeedback: IdentityFeedback
  onFormChange: (patch: Partial<CreateTireInput>) => void
  onPlantChange: (plantId: string | undefined) => void
  onDotBlur: () => void
}

export function CreateTireStepIdentification({
  form,
  idRules,
  previewCode,
  plants,
  selectedPlantCode,
  dotFeedback,
  internalFeedback,
  onFormChange,
  onPlantChange,
  onDotBlur,
}: CreateTireStepIdentificationProps) {
  const manualPreview = previewInternalCode({
    rules: idRules,
    plantCode: selectedPlantCode,
    sequence: 1,
  })

  const showPlantSelect = plants.length > 0
  const plantValue =
    form.plant_id ?? (plants.length === 1 ? plants[0]?.id : undefined) ?? '__none__'

  return (
    <section className="space-y-4">
      <CreateTireRulesBanner idRules={idRules} previewCode={previewCode} />

      {showPlantSelect && (
        <div className="space-y-1">
          <Label>Planta</Label>
          <Select
            value={plantValue}
            onValueChange={(v) => onPlantChange(v === '__none__' ? undefined : v)}
            disabled={plants.length === 1}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar planta" />
            </SelectTrigger>
            <SelectContent>
              {plants.length > 1 && <SelectItem value="__none__">Sin planta</SelectItem>}
              {plants.map((plant) => (
                <SelectItem key={plant.id} value={plant.id}>
                  {plant.code ? `${plant.code} — ` : ''}
                  {plant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            El código de flota puede variar por planta cuando la auto-generación está activa.
          </p>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="serial">
          DOT / serie del fabricante {idRules.dot_required ? '*' : '(opcional)'}
        </Label>
        <Input
          id="serial"
          placeholder="Ej. 4521 ABCD 0123"
          value={form.serial_number ?? ''}
          onChange={(e) => onFormChange({ serial_number: e.target.value })}
          onBlur={onDotBlur}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={identityInputInvalid(dotFeedback)}
          required={idRules.dot_required === true}
        />
        <IdentityFieldFeedback feedback={dotFeedback} />
        <p className="text-xs text-muted-foreground">
          Código impreso en la pared lateral de la llanta. No se auto-genera.
        </p>
      </div>

      {idRules.auto_generate ? (
        <div className="rounded-lg border bg-muted/40 px-3 py-2.5 space-y-1">
          <Label className="text-muted-foreground text-xs">Código de flota (al guardar)</Label>
          <p className="font-mono text-sm font-medium">{previewCode ?? manualPreview}</p>
          <p className="text-xs text-muted-foreground">
            Se asignará automáticamente según las reglas de flota.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <Label htmlFor="internal-code">
            Código de flota {!form.serial_number?.trim() ? '*' : '(opcional)'}
          </Label>
          <Input
            id="internal-code"
            placeholder={manualPreview}
            value={form.internal_code ?? ''}
            onChange={(e) => onFormChange({ internal_code: e.target.value })}
            aria-invalid={identityInputInvalid(internalFeedback)}
            required={!form.serial_number?.trim()}
          />
          <IdentityFieldFeedback feedback={internalFeedback} />
          <p className="text-xs text-muted-foreground">
            ID operativo en almacén, montajes y reportes. Obligatorio si no captura DOT.
          </p>
        </div>
      )}
    </section>
  )
}
