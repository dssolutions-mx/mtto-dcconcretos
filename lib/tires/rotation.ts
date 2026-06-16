import type { TirePosition } from '@/types/tires'

export interface RotateTireInput {
  installation_id: string
  to_position_code: string
  to_position_label: string
  to_axle_number?: number | null
  notes?: string
}

export function validateRotation(input: {
  from_position_code: string
  to_position_code: string
  occupied_positions: string[]
  positions: TirePosition[]
}): { ok: true } | { ok: false; error: string } {
  if (input.from_position_code === input.to_position_code) {
    return { ok: false, error: 'La posición destino debe ser diferente a la actual' }
  }

  const targetExists = input.positions.some((p) => p.code === input.to_position_code)
  if (!targetExists) {
    return { ok: false, error: 'Posición destino no válida para este activo' }
  }

  if (input.occupied_positions.includes(input.to_position_code)) {
    return { ok: false, error: 'Ya hay una llanta montada en la posición destino' }
  }

  return { ok: true }
}
