import { SUPPLIER_INDUSTRIES, SUPPLIER_SPECIALTIES, SupplierIndustry, SupplierSpecialty, NormalizedServiceCategory } from '@/types/suppliers'

const industrySynonyms: Record<string, SupplierIndustry> = {
  'vehiculos pesados': 'vehiculos_pesados',
  'vehiculos_pesados': 'vehiculos_pesados',
  'automotriz': 'automotriz',
  'industrial': 'industrial',
  'metal mecanica': 'metal_mecanica',
  'metal_mecánica': 'metal_mecanica',
  'electrico automotriz': 'electrico_automotriz',
  'neumaticos': 'neumaticos',
  'hvac': 'hvac',
  'bombeo proceso': 'bombeo_proceso',
  'refacciones': 'refacciones_consumibles',
  'consumibles': 'refacciones_consumibles',
  'multioficio': 'servicios_multioficio',
}

const specialtyKeywords: Array<{keys: RegExp[], value: SupplierSpecialty}> = [
  { keys: [/motor|transmi|diferenc/i], value: 'mecanica' },
  { keys: [/cable|alternador|arranque/i], value: 'electrica' },
  { keys: [/ecu|sensor|tabler|testig/i], value: 'electronica_instrumentacion' },
  { keys: [/hidrauli|manguer|valvul|cilind/i], value: 'hidraulica' },
  { keys: [/neumatic/i], value: 'neumatica' },
  { keys: [/aire acondi|climat|refrigerant|desempe/i], value: 'climatizacion' },
  { keys: [/freno|balat|abs/i], value: 'frenos_seguridad' },
  { keys: [/llanta|neuma/i], value: 'llantas' },
  { keys: [/luz|luces|faro|reversa|torret|ilumin/i], value: 'iluminacion' },
  { keys: [/fuga.*(diesel|combust|gasol)|filtro|inyect|bomba.*(diesel|combust)/i], value: 'combustible_filtracion' },
  { keys: [/aceite|grasa|atf|lubric/i], value: 'lubricacion_fluids' },
  { keys: [/soldadur|fabric/i], value: 'soldadura_fabricacion' },
  { keys: [/carrocer|pintur|hojalat/i], value: 'carroceria' },
  { keys: [/bomba(?!.*(diesel|combust))/i], value: 'bombas_flujos' },
  { keys: [/refaccion|consumible|filtro/i], value: 'refacciones_consumibles' },
  { keys: [/inspecci|ajuste|manten.*general/i], value: 'mantenimiento_general' },
]

export function normalizeIndustry(input?: string | null): SupplierIndustry | 'other' | undefined {
  if (!input) return undefined
  const key = input.toLowerCase().trim().replace(/\s+/g, ' ')
  if ((SUPPLIER_INDUSTRIES as readonly string[]).includes(key)) return key as SupplierIndustry
  if (industrySynonyms[key]) return industrySynonyms[key]
  return 'other'
}

export function normalizeSpecialty(input: string): SupplierSpecialty {
  const raw = input.toLowerCase().trim()
  if ((SUPPLIER_SPECIALTIES as readonly string[]).includes(raw)) return raw as SupplierSpecialty
  for (const rule of specialtyKeywords) {
    if (rule.keys.some(r => r.test(raw))) return rule.value
  }
  return (raw.startsWith('otra_') ? raw : (`otra_${raw}`)) as SupplierSpecialty
}

export function normalizeServiceCategory(input?: string | null): NormalizedServiceCategory | undefined {
  if (!input) return undefined
  return normalizeSpecialty(input) as NormalizedServiceCategory
}

export function suggestSpecialtiesFromText(text?: string | null, limit = 5): SupplierSpecialty[] {
  if (!text) return []
  const candidates: SupplierSpecialty[] = []
  const lower = text.toLowerCase()
  for (const rule of specialtyKeywords) {
    if (rule.keys.some(r => r.test(lower))) {
      if (!candidates.includes(rule.value)) candidates.push(rule.value)
    }
    if (candidates.length >= limit) break
  }
  return candidates
}


