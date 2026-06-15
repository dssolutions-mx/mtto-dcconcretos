import { normalizeIssueCoreItem } from "@/lib/incidents/normalize-issue-core-item"

export type IssueThemeId =
  | "lighting_signaling"
  | "lubrication"
  | "bodywork_access"
  | "visibility"
  | "cabin_comfort"
  | "tires"
  | "other"

export type IssueThemeDef = {
  id: IssueThemeId
  label: string
  planningHint: string
  sortOrder: number
}

export const ISSUE_THEMES: Record<IssueThemeId, IssueThemeDef> = {
  lighting_signaling: {
    id: "lighting_signaling",
    label: "Iluminación y señalización",
    planningHint: "Considerar kit estándar de luces y alarmas por unidad Sitrak.",
    sortOrder: 1,
  },
  lubrication: {
    id: "lubrication",
    label: "Engrasado y lubricación",
    planningHint: "Programar ronda de engrasado por planta; verificar puntos del checklist mensual.",
    sortOrder: 2,
  },
  bodywork_access: {
    id: "bodywork_access",
    label: "Carrocería y accesos",
    planningHint: "Agrupar reparaciones de carrocería, puertas y escaleras por taller.",
    sortOrder: 3,
  },
  visibility: {
    id: "visibility",
    label: "Visibilidad",
    planningHint: "Revisar cámaras, espejos y parabrisas; puede requerir proveedor especializado.",
    sortOrder: 4,
  },
  cabin_comfort: {
    id: "cabin_comfort",
    label: "Cabina y confort",
    planningHint: "A/C y controles — priorizar unidades de mayor uso operativo.",
    sortOrder: 5,
  },
  tires: {
    id: "tires",
    label: "Llantas",
    planningHint: "Coordinar con proveedor de llantas para compra por lote.",
    sortOrder: 6,
  },
  other: {
    id: "other",
    label: "Otros",
    planningHint: "Revisar caso por caso.",
    sortOrder: 99,
  },
}

const THEME_PATTERNS: { theme: IssueThemeId; patterns: RegExp[] }[] = [
  {
    theme: "lighting_signaling",
    patterns: [
      /^LUZ\b/i,
      /ALARMA/i,
      /DIRECCIONAL/i,
      /REVERSA/i,
      /CUARTO/i,
      /INTERMITENTE/i,
    ],
  },
  {
    theme: "lubrication",
    patterns: [/ENGRAS/i, /ACEITE/i, /NIVEL DE ACEITE/i, /LUBRIC/i, /PUNTOS DE LUBRICACIÓN/i],
  },
  {
    theme: "bodywork_access",
    patterns: [
      /CARROCER/i,
      /PUERTA/i,
      /CHAPA/i,
      /ESCALERA/i,
      /ASIENTO/i,
      /TAPICER/i,
      /ESCALON/i,
    ],
  },
  {
    theme: "visibility",
    patterns: [/CÁMARA/i, /CAMARA/i, /ESPEJO/i, /PARABRISA/i],
  },
  {
    theme: "cabin_comfort",
    patterns: [/AIRE ACONDICIONADO/i, /^CONTROL/i, /VENTANA/i, /ELEVADOR/i],
  },
  {
    theme: "tires",
    patterns: [/LLANTA/i],
  },
]

export function classifyIssueTheme(description: string | null | undefined): IssueThemeId {
  const core = normalizeIssueCoreItem(description ?? "")
  if (!core) return "other"

  for (const { theme, patterns } of THEME_PATTERNS) {
    if (patterns.some((p) => p.test(core))) return theme
  }
  return "other"
}

export function getThemeDef(themeId: IssueThemeId): IssueThemeDef {
  return ISSUE_THEMES[themeId]
}

export function allThemesSorted(): IssueThemeDef[] {
  return Object.values(ISSUE_THEMES).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function suggestPriorityFromThemeCount(unitCount: number): "Alta" | "Media" | "Baja" {
  if (unitCount >= 10) return "Alta"
  if (unitCount >= 5) return "Media"
  return "Baja"
}
