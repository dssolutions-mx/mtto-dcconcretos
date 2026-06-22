import type { CreateTireInput, TireIdRules } from '@/types/tires'
import { validateDotFormat } from '@/lib/tires/dot-validation'
import type { IdentityFeedback } from '@/lib/tires/identity-feedback'

export { normalizeDotSerial } from '@/lib/tires/normalize-identity'

export const CREATE_TIRE_WIZARD_STEPS = [
  { key: 'identification', label: 'Identificación' },
  { key: 'specs', label: 'Llanta' },
  { key: 'location', label: 'Ubicación' },
] as const

export type CreateTireWizardStep = (typeof CREATE_TIRE_WIZARD_STEPS)[number]['key']

export function createEmptyTireForm(): CreateTireInput {
  return {
    brand: '',
    size: '',
    condition: 'nueva',
  }
}

export function validateIdentificationStep(
  rules: TireIdRules,
  form: Pick<CreateTireInput, 'serial_number' | 'internal_code'>
): string | null {
  const serial = form.serial_number?.trim() || ''
  const internal = form.internal_code?.trim() || ''

  if (rules.dot_required && !serial) {
    return 'DOT / serie del fabricante es obligatorio según la configuración de flota'
  }

  if (!rules.auto_generate && !serial && !internal) {
    return 'Indique código de flota o DOT / serie del fabricante'
  }

  if (serial) {
    const dotFormat = validateDotFormat(serial)
    if (!dotFormat.valid && dotFormat.severity !== 'warning') {
      return dotFormat.message ?? 'DOT / serie del fabricante inválido'
    }
  }

  return null
}

export function hasIdentityBlockingFeedback(
  dotFeedback: IdentityFeedback,
  internalFeedback: IdentityFeedback,
  options: { checkDot: boolean; checkInternalCode: boolean }
): string | null {
  if (options.checkDot && dotFeedback.status === 'checking') {
    return 'Espere a que termine la verificación del DOT'
  }

  if (options.checkInternalCode && internalFeedback.status === 'checking') {
    return 'Espere a que termine la verificación del código de flota'
  }

  if (options.checkDot && dotFeedback.status === 'duplicate') {
    return dotFeedback.message ?? 'Este DOT ya está registrado'
  }

  if (options.checkDot && dotFeedback.status === 'invalid') {
    return dotFeedback.message ?? 'DOT / serie del fabricante inválido'
  }

  if (options.checkInternalCode && internalFeedback.status === 'duplicate') {
    return internalFeedback.message ?? 'Este código de flota ya está en uso'
  }

  if (options.checkInternalCode && internalFeedback.status === 'invalid') {
    return internalFeedback.message ?? 'Código de flota inválido'
  }

  return null
}

export function validateSpecsStep(form: Pick<CreateTireInput, 'brand' | 'size'>): string | null {
  if (!form.brand?.trim()) return 'La marca es obligatoria'
  if (!form.size?.trim()) return 'La medida es obligatoria'
  return null
}

export function describeFleetIdRules(rules: TireIdRules, previewCode: string | null): string[] {
  const lines: string[] = []

  if (rules.auto_generate) {
    lines.push(
      previewCode
        ? `Código de flota: automático (${previewCode})`
        : 'Código de flota: se asignará automáticamente al guardar'
    )
  } else {
    lines.push('Código de flota: captura manual al registrar')
  }

  lines.push(
    rules.dot_required
      ? 'DOT / serie del fabricante: obligatorio'
      : 'DOT / serie del fabricante: opcional'
  )

  return lines
}

export function buildTireFormForAnother(
  current: CreateTireInput,
  plantId?: string | null
): CreateTireInput {
  return {
    brand: current.brand,
    size: current.size,
    model: current.model,
    condition: current.condition,
    plant_id: plantId ?? current.plant_id,
    warehouse_id: current.warehouse_id,
    purchase_cost: current.purchase_cost,
    purchase_date: current.purchase_date,
  }
}
