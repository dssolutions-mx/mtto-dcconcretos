import type { TireLayoutTemplateKey } from '@/types/tires'

export const TIRE_TEMPLATE_OPTIONS: {
  key: TireLayoutTemplateKey
  label: string
  description: string
}[] = [
  {
    key: 'truck_6x4',
    label: 'Camión 6 ruedas (10 pos.)',
    description: 'Layout estándar 3 ejes — mixer, tractocamión',
  },
  {
    key: 'vehicle_4wheel',
    label: 'Vehículo 4 ruedas',
    description: 'Loader, camioneta, unidad ligera',
  },
]

export function templateLabel(key: TireLayoutTemplateKey | string | null | undefined): string {
  return TIRE_TEMPLATE_OPTIONS.find((t) => t.key === key)?.label ?? 'Sin asignar'
}

export const ONBOARDING_STEPS = [
  { key: 'scope', label: 'Alcance' },
  { key: 'layouts', label: 'Layouts por modelo' },
  { key: 'id_rules', label: 'Identificación' },
  { key: 'inventory', label: 'Inventario inicial' },
  { key: 'pilot', label: 'Piloto de montaje' },
] as const

export type OnboardingWizardStep = (typeof ONBOARDING_STEPS)[number]['key']
