/**
 * Group expanded cost detail entries so one manual adjustment appears as one row
 * with amounts per plant column (instead of one row per plant).
 */

export type CostDetailEntryWithPlant = {
  id: string
  description: string | null
  subcategory: string | null
  expense_subcategory?: string | null
  amount: number
  plantId?: string
  notes?: string | null
  is_bonus?: boolean
  is_cash_payment?: boolean
  is_distributed?: boolean
  distribution_method?: string | null
}

/** Derive parent adjustment id from API entry id (UUID, UUID-distId, or UUID-distId-dept). */
export function adjustmentIdFromEntryId(entryId: string): string {
  if (entryId === 'autoconsumo-plant_indirect_material_costs') return entryId
  let withoutSuffix = entryId
  if (withoutSuffix.endsWith('-dept')) withoutSuffix = withoutSuffix.slice(0, -'-dept'.length)
  else if (withoutSuffix.endsWith('-bu')) withoutSuffix = withoutSuffix.slice(0, -'-bu'.length)
  const parts = withoutSuffix.split('-')
  // Single UUID has 5 hyphen-separated segments
  if (parts.length <= 5) return withoutSuffix
  return parts.slice(0, 5).join('-')
}

export type GroupedCostLine = {
  rowKey: string
  label: string
  /** Extra context from the manual cost form (flags, notes, descriptions, etc.) */
  caption?: string
  amountsByPlant: Map<string, number>
}

type GroupMeta = {
  label: string
  amountsByPlant: Map<string, number>
  notes: Set<string>
  descriptions: Set<string>
  subcategories: Set<string>
  hasBonus: boolean
  hasCash: boolean
  distMethods: Set<string>
  adjustmentIds: Set<string>
}

function buildMergedLineCaption(
  primaryLabel: string,
  meta: Omit<GroupMeta, 'label' | 'amountsByPlant' | 'adjustmentIds'>
): string | undefined {
  const bits: string[] = []
  if (meta.hasBonus) bits.push('Bono')
  if (meta.hasCash) bits.push('Pago en efectivo')
  for (const m of meta.distMethods) {
    if (m === 'volume') bits.push('Distribución por volumen')
    else if (m === 'percentage') bits.push('Distribución por %')
    else if (m) bits.push('Distribuido')
  }
  for (const sc of meta.subcategories) {
    const t = sc.trim()
    if (t && t !== primaryLabel && !primaryLabel.includes(t)) {
      bits.push(t.length > 48 ? `${t.slice(0, 45)}…` : t)
    }
  }
  const descs = [...meta.descriptions].filter(d => {
    const t = d?.trim()
    return Boolean(t && t !== primaryLabel && !primaryLabel.includes(t))
  })
  for (const d of descs.slice(0, 4)) {
    const t = d.trim()
    bits.push(t.length > 72 ? `${t.slice(0, 69)}…` : t)
  }
  if (descs.length > 4) bits.push(`+${descs.length - 4} descripciones`)

  const notes = [...meta.notes].filter(Boolean)
  if (notes.length === 1) {
    const t = notes[0]
    bits.push(t.length > 120 ? `Notas: ${t.slice(0, 117)}…` : `Notas: ${t}`)
  } else if (notes.length > 1) {
    bits.push(`${notes.length} notas distintas`)
  }

  return bits.length ? bits.join(' · ') : undefined
}

/**
 * Composite labels from the API look like:
 * `{número}. {categoría principal} - {área/2ª} - {concepto/3ª}`.
 * The third segment is the distinguishing expense line; 2ª can repeat across rows.
 */
export type ExpensePathParts = {
  main: string
  second: string | null
  /** Remainder after 2ª (may include further " - " if the source had extra segments). */
  third: string | null
  /** Shown under a category header: `2ª - 3ª` or just `2ª` when there is no 3ª. */
  detailLabel: string
  hasNumberedMain: boolean
}

export function parseExpenseCompositePath(full: string): ExpensePathParts {
  const raw = String(full || '').trim()
  const sep = ' - '
  const parts = raw
    .split(sep)
    .map(s => s.trim())
    .filter(s => s.length > 0)
  if (parts.length === 0) {
    return { main: raw, second: null, third: null, detailLabel: raw, hasNumberedMain: false }
  }
  const main = parts[0]
  const hasNumberedMain = /^\d+\./.test(main)
  if (!hasNumberedMain || parts.length === 1) {
    return { main: raw, second: null, third: null, detailLabel: raw, hasNumberedMain: false }
  }
  if (parts.length === 2) {
    return {
      main,
      second: parts[1],
      third: null,
      detailLabel: parts[1],
      hasNumberedMain: true,
    }
  }
  const second = parts[1]
  const third = parts.slice(2).join(sep)
  return {
    main,
    second,
    third,
    detailLabel: `${second} - ${third}`,
    hasNumberedMain: true,
  }
}

const normSeg = (s: string) => s.trim().replace(/\s+/g, ' ')

/** Department / área shown on the parent row (nómina paths are often a single label, e.g. "CALIDAD"). */
function nominaDeptAreaFromComposite(deptCompositeName: string): string {
  const raw = normSeg(deptCompositeName)
  const p = parseExpenseCompositePath(deptCompositeName)
  if (p.hasNumberedMain && p.detailLabel) {
    const first = p.detailLabel.split(' - ')[0]
    return normSeg(first || raw)
  }
  return raw
}

/** "NOMINA CALIDAD"–style lines that repeat the área and don't help tell movements apart. */
function isBoilerplateNominaLabel(text: string | undefined | null, deptArea: string): boolean {
  if (!text?.trim()) return true
  const t = normSeg(text).toUpperCase()
  const a = normSeg(deptArea).toUpperCase()
  if (a && t === a) return true
  if (a && (t === `NOMINA ${a}` || t === `NÓMINA ${a}`)) return true
  if (/^NOMINA\s+[A-ZÁÉÍÓÚÑ0-9]+$/i.test(normSeg(text)) && normSeg(text).length < 48) return true
  return false
}

/**
 * Short label for an expanded movement row: the parent row already shows `área - concepto`
 * from the composite path, so we avoid repeating the same subcategory in every child line.
 */
export function leafAdjustmentDisplayLabel(
  deptCompositeName: string,
  entry: CostDetailEntryWithPlant,
  lineCategory: 'nomina' | 'otros'
): string {
  const parsed = parseExpenseCompositePath(deptCompositeName)
  const pathSegments = new Set<string>()
  if (parsed.second) pathSegments.add(normSeg(parsed.second))
  if (parsed.third) pathSegments.add(normSeg(parsed.third))
  if (parsed.hasNumberedMain && parsed.detailLabel) {
    for (const part of parsed.detailLabel.split(' - ')) {
      const n = normSeg(part)
      if (n) pathSegments.add(n)
    }
  }

  const redundant = (t: string | undefined | null) => {
    if (!t?.trim()) return true
    return pathSegments.has(normSeg(t))
  }

  const desc = entry.description?.trim()
  const ex = entry as CostDetailEntryWithPlant & { expense_subcategory?: string | null }
  const exSub = ex.expense_subcategory?.trim()
  const sub = entry.subcategory?.trim()

  if (lineCategory === 'otros') {
    if (desc) {
      if (exSub && !redundant(exSub) && exSub !== desc) return `${exSub} · ${desc}`
      return desc
    }
    if (exSub && !redundant(exSub)) return exSub
    if (sub && !redundant(sub)) return sub
  } else {
    const area = nominaDeptAreaFromComposite(deptCompositeName)
    const notes = entry.notes?.trim()

    let candidate: string | null = null
    if (desc) {
      if (sub && !redundant(sub) && sub !== desc) candidate = `${sub} · ${desc}`
      else candidate = desc
    } else if (sub && !redundant(sub)) {
      candidate = sub
    }

    if (candidate && !isBoilerplateNominaLabel(candidate, area)) {
      return candidate
    }

    if (desc && candidate !== desc && !isBoilerplateNominaLabel(desc, area)) {
      return desc
    }

    if (notes) {
      return notes.length > 72 ? `${notes.slice(0, 69)}…` : notes
    }
    if (sub?.trim()) return sub.trim()
    if (desc?.trim()) return desc.trim()
    return 'Sin descripción'
  }

  if (sub?.trim()) return sub.trim()
  return 'Sin descripción'
}

export type DeptPathRenderGroup<T> =
  | { kind: 'single'; deptName: string; data: T }
  | {
      kind: 'category'
      mainLabel: string
      headerTotalsByPlant: Map<string, number>
      rows: Array<{ deptName: string; data: T; detailLabel: string }>
    }

function sortKeyNumberedMain(main: string): number {
  const m = main.match(/^(\d+)\./)
  return m ? parseInt(m[1], 10) : 99999
}

/** Groups rows that share the same `N. categoría principal` into one header + child lines. */
export function buildDeptPathRenderGroups<T extends { totalsByPlant: Map<string, number> }>(
  pairs: Array<[string, T]>
): DeptPathRenderGroup<T>[] {
  const byMain = new Map<string, Array<[string, T]>>()
  const nonNumbered: Array<[string, T]> = []

  for (const [deptName, data] of pairs) {
    const p = parseExpenseCompositePath(deptName)
    if (p.hasNumberedMain) {
      const list = byMain.get(p.main) ?? []
      list.push([deptName, data])
      byMain.set(p.main, list)
    } else {
      nonNumbered.push([deptName, data])
    }
  }

  const out: DeptPathRenderGroup<T>[] = []

  const sortedMains = Array.from(byMain.keys()).sort(
    (a, b) => sortKeyNumberedMain(a) - sortKeyNumberedMain(b) || a.localeCompare(b, 'es')
  )

  for (const main of sortedMains) {
    const list = byMain.get(main)!
    list.sort((a, b) => {
      const da = parseExpenseCompositePath(a[0]).detailLabel
      const db = parseExpenseCompositePath(b[0]).detailLabel
      return da.localeCompare(db, 'es') || a[0].localeCompare(b[0], 'es')
    })
    if (list.length === 1) {
      out.push({ kind: 'single', deptName: list[0][0], data: list[0][1] })
    } else {
      const headerTotalsByPlant = new Map<string, number>()
      const rows = list.map(([deptName, data]) => {
        for (const [pid, amt] of data.totalsByPlant) {
          headerTotalsByPlant.set(pid, (headerTotalsByPlant.get(pid) || 0) + amt)
        }
        return {
          deptName,
          data,
          detailLabel: parseExpenseCompositePath(deptName).detailLabel,
        }
      })
      out.push({ kind: 'category', mainLabel: main, headerTotalsByPlant, rows })
    }
  }

  nonNumbered.sort((a, b) => a[0].localeCompare(b[0], 'es'))
  for (const [deptName, data] of nonNumbered) {
    out.push({ kind: 'single', deptName, data })
  }

  return out
}

/**
 * When the parent row already shows per-plant totals for a single consolidated concept,
 * expanding would repeat the same numbers — feels like "the main row twice".
 */
export function isGroupedDetailRedundant(
  lines: GroupedCostLine[],
  parentTotalsByPlant: Map<string, number>,
  plantIds: string[],
  epsilon = 0.01
): boolean {
  if (lines.length !== 1) return false
  const line = lines[0]
  for (const pid of plantIds) {
    const a = line.amountsByPlant.get(pid) || 0
    const b = parentTotalsByPlant.get(pid) || 0
    if (Math.abs(a - b) > epsilon) return false
  }
  return true
}

export type CostDetailGroupOptions = {
  /**
   * `semantic` (default): one row per distinct expense line (category + subcategory / description).
   * `adjustment`: one row per manual adjustment (UUID).
   * `display-label`: merge rows that share the same visible title from `leafAdjustmentDisplayLabel`
   * (best for nómina / otros when many movements repeat the same label).
   */
  strategy?: 'semantic' | 'adjustment' | 'display-label'
  /** Required for semantic grouping: distinguishes nómina vs otros indirectos line keys. */
  lineCategory?: 'nomina' | 'otros'
  /** How to order lines in the drill-down (default: by label). */
  sortDetailLines?: 'label' | 'amount-desc'
  /** Parent path for the expanded department row; required for `display-label`. */
  deptCompositeName?: string
}

/**
 * Stable key for "what this row represents" in management views — not necessarily one DB row.
 */
function semanticGroupKey(entry: CostDetailEntryWithPlant, lineCategory: 'nomina' | 'otros'): string {
  if (entry.id === 'autoconsumo-plant_indirect_material_costs') {
    return 'autoconsumo:plant_indirect_material_costs'
  }
  if (lineCategory === 'nomina') {
    const bits = [entry.description?.trim() || '', entry.subcategory?.trim() || ''].filter(Boolean)
    if (bits.length) return `nomina:${bits.join('\u001f')}`
    return `nomina:adj:${adjustmentIdFromEntryId(entry.id)}`
  }
  const ex = entry as CostDetailEntryWithPlant & { expense_category?: string | null; expense_subcategory?: string | null }
  const cat = ex.expense_category?.trim() || '_'
  const line =
    ex.expense_subcategory?.trim() ||
    entry.subcategory?.trim() ||
    entry.description?.trim() ||
    ''
  if (line) return `otros:${cat}\u001f${line}`
  return `otros:${cat}\u001fadj:${adjustmentIdFromEntryId(entry.id)}`
}

export function groupCostDetailEntriesByAdjustment(
  entries: CostDetailEntryWithPlant[],
  labelFor: (e: CostDetailEntryWithPlant) => string,
  options?: CostDetailGroupOptions
): GroupedCostLine[] {
  const strategy = options?.strategy ?? 'semantic'
  const lineCategory = options?.lineCategory ?? 'otros'
  const deptComposite = options?.deptCompositeName

  const groups = new Map<string, GroupMeta>()

  for (const entry of entries) {
    let groupKey: string
    if (strategy === 'adjustment') {
      groupKey = adjustmentIdFromEntryId(entry.id)
    } else if (strategy === 'display-label' && deptComposite) {
      const lbl = leafAdjustmentDisplayLabel(deptComposite, entry, lineCategory)
      const normalized = normSeg(lbl).toLowerCase()
      groupKey = `${lineCategory}:dl:${normalized}`
    } else {
      groupKey = semanticGroupKey(entry, lineCategory)
    }

    const plantId = entry.plantId || 'unknown'
    const resolvedLabel =
      strategy === 'display-label' && deptComposite
        ? leafAdjustmentDisplayLabel(deptComposite, entry, lineCategory)
        : labelFor(entry)

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        label: resolvedLabel,
        amountsByPlant: new Map(),
        notes: new Set(),
        descriptions: new Set(),
        subcategories: new Set(),
        hasBonus: false,
        hasCash: false,
        distMethods: new Set(),
        adjustmentIds: new Set(),
      })
    }
    const g = groups.get(groupKey)!
    const next = (g.amountsByPlant.get(plantId) || 0) + entry.amount
    g.amountsByPlant.set(plantId, next)
    g.adjustmentIds.add(adjustmentIdFromEntryId(entry.id))

    const nextLabel = resolvedLabel
    if (strategy === 'display-label' && deptComposite) {
      if (nextLabel) g.label = nextLabel
    } else if (nextLabel && nextLabel !== 'Sin descripción') {
      g.label = nextLabel
    }
    if (entry.description?.trim()) g.descriptions.add(entry.description.trim())
    if (entry.subcategory?.trim()) g.subcategories.add(entry.subcategory.trim())
    const exSub = (entry as CostDetailEntryWithPlant & { expense_subcategory?: string | null }).expense_subcategory
    if (exSub?.trim()) g.subcategories.add(exSub.trim())
    if (entry.notes?.trim()) g.notes.add(entry.notes.trim())
    if (entry.is_bonus) g.hasBonus = true
    if (entry.is_cash_payment) g.hasCash = true
    if (entry.is_distributed && entry.distribution_method) {
      g.distMethods.add(entry.distribution_method)
    }
  }

  const rows = Array.from(groups.entries()).map(([rowKey, v]) => {
    const label = v.label || 'Sin descripción'
    const { label: _l, amountsByPlant, adjustmentIds, ...meta } = v
    let caption = buildMergedLineCaption(label, meta)
    const nAdj = adjustmentIds.size
    if (nAdj > 1) {
      const suffix = `${nAdj} movimientos consolidados`
      caption = caption ? `${caption} · ${suffix}` : suffix
    }
    return {
      rowKey,
      label,
      caption,
      amountsByPlant,
    }
  })

  if (options?.sortDetailLines === 'amount-desc') {
    rows.sort((a, b) => {
      const sa = [...a.amountsByPlant.values()].reduce((s, n) => s + n, 0)
      const sb = [...b.amountsByPlant.values()].reduce((s, n) => s + n, 0)
      return sb - sa || a.label.localeCompare(b.label, 'es')
    })
  } else {
    rows.sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }

  return rows
}
