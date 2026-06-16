/**
 * Canonical incident-routing departments for DC Concretos.
 * DB rows in `departments` are matched by code/name; routing rules and UI
 * should target these four buckets (per plant when multiple plants exist).
 */

export type CanonicalRoutingDepartmentSlug =
  | "mantenimiento"
  | "operaciones"
  | "recursos_humanos"
  | "calidad"

export type CanonicalRoutingDepartment = {
  slug: CanonicalRoutingDepartmentSlug
  label: string
  shortLabel: string
  /** Preferred department codes when seeding or matching DB rows */
  preferredCodes: string[]
  /** Substrings matched against lowercased department name/code */
  namePatterns: string[]
  colorClass: string
}

export const CANONICAL_ROUTING_DEPARTMENTS: CanonicalRoutingDepartment[] = [
  {
    slug: "mantenimiento",
    label: "Mantenimiento",
    shortLabel: "Mtto",
    preferredCodes: ["MANT", "MTTO", "MANTENIMIENTO"],
    namePatterns: ["mantenimiento", "mtto", "mant", "maintenance"],
    colorClass: "border-blue-300 bg-blue-50 text-blue-900",
  },
  {
    slug: "operaciones",
    label: "Operaciones",
    shortLabel: "Ops",
    preferredCodes: ["OPER", "OPS", "OPERACIONES"],
    namePatterns: ["operaciones", "operacion", "oper", "operations", "planta"],
    colorClass: "border-amber-300 bg-amber-50 text-amber-900",
  },
  {
    slug: "recursos_humanos",
    label: "Recursos Humanos",
    shortLabel: "RH",
    preferredCodes: ["RH", "RRHH", "RECURSOS_HUMANOS"],
    namePatterns: ["recursos humanos", "rh", "rrhh", "human resources"],
    colorClass: "border-violet-300 bg-violet-50 text-violet-900",
  },
  {
    slug: "calidad",
    label: "Calidad",
    shortLabel: "Calidad",
    preferredCodes: ["CAL", "CALIDAD", "QC", "QUALITY"],
    namePatterns: ["calidad", "quality", "qc"],
    colorClass: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
]

export type DbDepartmentRow = {
  id: string
  name: string
  code: string
  plant_id: string
  plants?: { name?: string; code?: string } | null
}

export type ResolvedCanonicalDepartment = CanonicalRoutingDepartment & {
  departmentIds: string[]
  /** Best single id when UI needs one default per canonical bucket */
  primaryDepartmentId: string | null
  plantLabels: string[]
}

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
}

export function matchDepartmentToCanonical(
  department: Pick<DbDepartmentRow, "name" | "code">,
): CanonicalRoutingDepartmentSlug | null {
  const code = normalizeToken(department.code)
  const name = normalizeToken(department.name)

  for (const canonical of CANONICAL_ROUTING_DEPARTMENTS) {
    const codeHit = canonical.preferredCodes.some(
      (c) => normalizeToken(c) === code || code.includes(normalizeToken(c)),
    )
    const nameHit = canonical.namePatterns.some(
      (p) => name.includes(p) || name === p,
    )
    if (codeHit || nameHit) return canonical.slug
  }

  return null
}

export function resolveCanonicalRoutingDepartments(
  departments: DbDepartmentRow[],
): ResolvedCanonicalDepartment[] {
  const bySlug = new Map<CanonicalRoutingDepartmentSlug, ResolvedCanonicalDepartment>()

  for (const canonical of CANONICAL_ROUTING_DEPARTMENTS) {
    bySlug.set(canonical.slug, {
      ...canonical,
      departmentIds: [],
      primaryDepartmentId: null,
      plantLabels: [],
    })
  }

  for (const dept of departments) {
    const slug = matchDepartmentToCanonical(dept)
    if (!slug) continue
    const bucket = bySlug.get(slug)!
    bucket.departmentIds.push(dept.id)
    if (!bucket.primaryDepartmentId) bucket.primaryDepartmentId = dept.id
    const plantLabel = dept.plants?.name ?? dept.plants?.code
    if (plantLabel && !bucket.plantLabels.includes(plantLabel)) {
      bucket.plantLabels.push(plantLabel)
    }
  }

  return CANONICAL_ROUTING_DEPARTMENTS.map((c) => bySlug.get(c.slug)!)
}

export function isCanonicalRoutingDepartmentId(
  departmentId: string | null | undefined,
  resolved: ResolvedCanonicalDepartment[],
): boolean {
  if (!departmentId) return false
  return resolved.some((bucket) => bucket.departmentIds.includes(departmentId))
}
