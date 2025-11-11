export interface ExpenseCategory {
  id: string
  name: string
  subcategories: string[]
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  {
    id: '1',
    name: 'OPERACIÓN DE PLANTA',
    subcategories: [
      'Materiales de Producción (Urea, Concreto, Materiales Pétreos)',
      'Servicios de Producción (Bombeo, Grúa)',
      'Químicos y Aditivos (Antidoping, Desincrustrante, Catalizadores)'
    ]
  },
  {
    id: '2',
    name: 'COMBUSTIBLES Y TRANSPORTE',
    subcategories: [
      'Combustible y Gasolina',
      'Casetas Viales',
      'Transporte Ejecutivo (Uber, Taxis)',
      'Traslado de Equipos'
    ]
  },
  {
    id: '3',
    name: 'SERVICIOS GENERALES',
    subcategories: [
      'Electricidad',
      'Agua',
      'Telefonía e Internet',
      'Recolección de Residuos'
    ]
  },
  {
    id: '4',
    name: 'ARRENDAMIENTOS',
    subcategories: [
      'Renta de Terrenos',
      'Renta de Inmuebles',
      'Renta de Vehículos (Leasing)',
      'Renta de Maquinaria y Equipo',
      'Renta de Baños y Otros'
    ]
  },
  {
    id: '5',
    name: 'SERVICIOS PROFESIONALES',
    subcategories: [
      'Honorarios y Asesorías',
      'Auditoría',
      'Servicios Legales y Trámites',
      'Soporte de Sistemas',
      'Consultoría'
    ]
  },
  {
    id: '6',
    name: 'MATERIALES Y SUMINISTROS',
    subcategories: [
      'Papelería y Artículos de Oficina',
      'Artículos de Limpieza',
      'Agua de Garrafón',
      'Material de Laboratorio'
    ]
  },
  {
    id: '7',
    name: 'TECNOLOGÍA',
    subcategories: [
      'Licencias de Software',
      'Mantenimiento de Equipo de Cómputo',
      'Dominios y Hosting',
      'Renta de Equipo de Impresión'
    ]
  },
  {
    id: '8',
    name: 'VEHÍCULOS',
    subcategories: [
      'Verificaciones Vehiculares',
      'Reparaciones y Mantenimiento',
      'Diagnósticos'
    ]
  },
  {
    id: '9',
    name: 'PERSONAL',
    subcategories: [
      'NOMINA - Obligaciones Patronales',
      'Uniformes de Trabajo',
      'Atención al Personal (Comidas, Almuerzo)',
      'Viáticos',
      'Cursos y Capacitación'
    ]
  },
  {
    id: '10',
    name: 'COMERCIAL Y MARKETING',
    subcategories: [
      'Publicidad',
      'Atención al Cliente',
      'Material Promocional'
    ]
  },
  {
    id: '11',
    name: 'GASTOS FINANCIEROS FUERA DE SISTEMA',
    subcategories: [
      'Intereses',
      'Comisiones Bancarias',
      'Pérdida Cambiaria',
      'Recargos'
    ]
  },
  {
    id: '12',
    name: 'SEGUROS Y FIANZAS',
    subcategories: [
      'Seguros',
      'Fianzas',
      'Amortización de Seguros'
    ]
  },
  {
    id: '13',
    name: 'IMPUESTOS Y DERECHOS',
    subcategories: [
      'Impuestos Locales',
      'Derechos',
      'Contribuciones'
    ]
  },
  {
    id: '14',
    name: 'OTROS GASTOS',
    subcategories: [
      'Gastos No Deducibles',
      'Paquetería y Envíos',
      'Otros Gastos Varios'
    ]
  }
]

/**
 * Get expense category by ID
 */
export function getExpenseCategoryById(id: string): ExpenseCategory | undefined {
  return EXPENSE_CATEGORIES.find(cat => cat.id === id)
}

/**
 * Get expense category display name (with number prefix)
 */
export function getExpenseCategoryDisplayName(category: ExpenseCategory): string {
  return `${category.id}. ${category.name}`
}

/**
 * Validate if a subcategory belongs to a given category
 */
export function isValidSubcategory(categoryId: string, subcategory: string): boolean {
  const category = getExpenseCategoryById(categoryId)
  if (!category) return false
  return category.subcategories.includes(subcategory)
}

/**
 * Get all valid category IDs
 */
export function getValidCategoryIds(): string[] {
  return EXPENSE_CATEGORIES.map(cat => cat.id)
}

