import type { FleetNodeKind } from '@/types/fleet'

/** Spanish labels for audit / trust field keys in fleet UI */
export const FLEET_FIELD_LABELS: Record<string, string> = {
  model_id: 'Modelo',
  plant_id: 'Planta',
  status: 'Estado',
  current_hours: 'Horómetro',
  current_kilometers: 'Odómetro',
  serial_number: 'Serie',
  insurance_end_date: 'Vigencia seguro',
  fabrication_year: 'Año de fabricación',
  department_id: 'Departamento',
  location: 'Ubicación',
  notes: 'Notas',
}

export function fleetFieldLabel(field: string): string {
  return FLEET_FIELD_LABELS[field] ?? field
}

const KIND_LABELS: Record<FleetNodeKind, string> = {
  root: 'Resumen',
  bu: 'Unidad de negocio',
  plant: 'Planta',
  category: 'Categoría',
  manufacturer: 'Fabricante',
  year: 'Año',
  status: 'Estado',
  model: 'Modelo',
  asset: 'Activo',
}

export function fleetNodeKindLabel(kind: FleetNodeKind): string {
  return KIND_LABELS[kind] ?? kind
}
