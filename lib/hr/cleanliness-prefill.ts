import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActorContext } from '@/lib/auth/server-authorization'
import {
  checkRHOwnershipAuthority,
  managedPlantIdsForProfile,
} from '@/lib/auth/server-authorization'
import { buildPlantOperationsRoster } from '@/lib/hr/plant-operations-roster'

export type CleanlinessPrefillAuthResult =
  | { allowed: true }
  | { allowed: false; status: 403; error: string }

/**
 * Same access rules as plant-operations-roster: roles that complete bonus_closure
 * may load weekly cleanliness prefill, scoped to their plant(s).
 */
export function canAccessCleanlinessPrefill(
  actor: ActorContext,
  plantId: string
): CleanlinessPrefillAuthResult {
  const rhOrGg =
    checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'

  const allowed =
    rhOrGg ||
    actor.profile.role === 'DOSIFICADOR' ||
    actor.profile.role === 'JEFE_PLANTA'

  if (!allowed) {
    return { allowed: false, status: 403, error: 'Forbidden' }
  }

  if (!rhOrGg) {
    if (actor.profile.role === 'DOSIFICADOR') {
      if (!actor.profile.plant_id || actor.profile.plant_id !== plantId) {
        return { allowed: false, status: 403, error: 'Forbidden' }
      }
    } else if (actor.profile.role === 'JEFE_PLANTA') {
      const managed = managedPlantIdsForProfile(actor.profile)
      if (!managed.includes(plantId)) {
        return { allowed: false, status: 403, error: 'Forbidden' }
      }
    }
  }

  return { allowed: true }
}

export function isCleanlinessSection(sectionTitle: string): boolean {
  if (!sectionTitle) return false

  const title = sectionTitle.toLowerCase().trim()
  const cleanlinessSectionTitles = [
    'verificación de limpieza',
    'verificacion de limpieza',
    'verificación de limpieza 1',
    'verificacion de limpieza 1',
    'limpieza',
    'cleanliness',
    'cleaning',
  ]

  return cleanlinessSectionTitles.includes(title)
}

function getItemScore(status: string): number {
  switch (status) {
    case 'pass':
      return 1.0
    case 'flag':
      return 0.5
    case 'fail':
      return 0.0
    default:
      return 1.0
  }
}

function getSectionStatus(items: Array<{ status?: string }>): 'pass' | 'fail' {
  if (items.length === 0) return 'pass'
  const totalScore = items.reduce(
    (sum, item) => sum + getItemScore(item.status ?? 'pass'),
    0
  )
  return totalScore / items.length >= 0.75 ? 'pass' : 'fail'
}

export function calculateCleanlinessEvaluationByTemplate(
  completedItems: Array<{ item_id: string; status?: string; description?: string; notes?: string }> | null | undefined,
  cleanlinessItemIds: string[]
): {
  interior_status: 'pass' | 'fail'
  exterior_status: 'pass' | 'fail'
  interior_notes: string
  exterior_notes: string
  overall_score: number
  passed_both: boolean
} | null {
  if (!completedItems || !Array.isArray(completedItems) || cleanlinessItemIds.length === 0) {
    return null
  }

  const cleanlinessItems = completedItems.filter((item) =>
    cleanlinessItemIds.includes(item.item_id)
  )
  if (cleanlinessItems.length === 0) return null

  const interiorItems = cleanlinessItems.filter(
    (item) =>
      item.description?.toLowerCase().includes('interior') ||
      item.description?.toLowerCase().includes('cabina') ||
      item.description?.toLowerCase().includes('asientos') ||
      item.description?.toLowerCase().includes('espejo') ||
      item.description?.toLowerCase().includes('luz interior')
  )

  const exteriorItems = cleanlinessItems.filter(
    (item) =>
      item.description?.toLowerCase().includes('exterior') ||
      item.description?.toLowerCase().includes('carrocería') ||
      item.description?.toLowerCase().includes('llantas')
  )

  const generalItems = cleanlinessItems.filter(
    (item) =>
      item.description?.toLowerCase().includes('olla') ||
      (item.description?.toLowerCase().includes('limpi') &&
        !item.description?.toLowerCase().includes('interior') &&
        !item.description?.toLowerCase().includes('exterior'))
  )

  const allInteriorItems = [...interiorItems, ...generalItems]
  const allExteriorItems = [...exteriorItems, ...generalItems]

  let interiorStatus: 'pass' | 'fail' = 'pass'
  let exteriorStatus: 'pass' | 'fail' = 'pass'
  let interiorNotes = ''
  let exteriorNotes = ''

  if (allInteriorItems.length > 0) {
    interiorStatus = getSectionStatus(allInteriorItems)
    interiorNotes = allInteriorItems
      .filter((item) => item.status === 'fail' || item.status === 'flag')
      .map((item) => item.notes)
      .filter(Boolean)
      .join('; ')
  }
  if (allExteriorItems.length > 0) {
    exteriorStatus = getSectionStatus(allExteriorItems)
    exteriorNotes = allExteriorItems
      .filter((item) => item.status === 'fail' || item.status === 'flag')
      .map((item) => item.notes)
      .filter(Boolean)
      .join('; ')
  }
  if (allInteriorItems.length === 0 && allExteriorItems.length === 0) {
    const generalStatus = getSectionStatus(cleanlinessItems)
    const notes = cleanlinessItems
      .filter((item) => item.status === 'fail' || item.status === 'flag')
      .map((item) => item.notes)
      .filter(Boolean)
      .join('; ')
    interiorStatus = generalStatus
    exteriorStatus = generalStatus
    interiorNotes = notes
    exteriorNotes = notes
  }

  const totalScore = cleanlinessItems.reduce(
    (sum, item) => sum + getItemScore(item.status ?? 'pass'),
    0
  )
  const overallScore = Math.round((totalScore / cleanlinessItems.length) * 100)

  return {
    interior_status: interiorStatus,
    exterior_status: exteriorStatus,
    interior_notes: interiorNotes,
    exterior_notes: exteriorNotes,
    overall_score: overallScore,
    passed_both: interiorStatus === 'pass' && exteriorStatus === 'pass',
  }
}

export type OperatorCleanlinessPrefillRow = {
  operator_id: string
  operator_name: string
  employee_code?: string
  weekly_pass_rate: number
  evaluation_ids: string[]
  evaluations_total: number
  evaluations_passed: number
}

function monthDateRangeUTC(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * Per-operator weekly cleanliness pass rate and evaluation ids for a plant + calendar month.
 */
export async function fetchOperatorCleanlinessPrefill(
  supabase: SupabaseClient,
  params: { plantId: string; year: number; month: number }
): Promise<OperatorCleanlinessPrefillRow[]> {
  const { plantId, year, month } = params
  const { start, end } = monthDateRangeUTC(year, month)

  const { data: plantAssets, error: assetsError } = await supabase
    .from('assets')
    .select('id')
    .eq('plant_id', plantId)
    .eq('status', 'operational')

  if (assetsError) {
    console.error('[cleanliness-prefill] assets', assetsError)
    return []
  }

  const assetIds = (plantAssets ?? []).map((a) => a.id).filter(Boolean)
  if (assetIds.length === 0) return []

  const { data: completedChecklists, error: checklistError } = await supabase
    .from('completed_checklists')
    .select(
      `
      id,
      asset_id,
      template_version_id,
      completion_date,
      completed_items,
      checklists!inner ( frequency )
    `
    )
    .in('asset_id', assetIds)
    .gte('completion_date', start)
    .lte('completion_date', end)
    .not('completed_items', 'is', null)
    .eq('checklists.frequency', 'semanal')

  if (checklistError) {
    console.error('[cleanliness-prefill] completed_checklists', checklistError)
    return []
  }

  const templateVersionIds = [
    ...new Set(
      (completedChecklists ?? [])
        .map((cc) => cc.template_version_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const cleanlinessItemsMap: Record<string, string[]> = {}

  if (templateVersionIds.length > 0) {
    const { data: templateVersions, error: templateError } = await supabase
      .from('checklist_template_versions')
      .select('id, sections')
      .in('id', templateVersionIds)

    if (templateError) {
      console.error('[cleanliness-prefill] template_versions', templateError)
    } else {
      for (const templateVersion of templateVersions ?? []) {
        const sections = templateVersion.sections as Array<{
          title?: string
          items?: Array<{ id: string }>
        }> | null
        if (!sections || !Array.isArray(sections)) continue

        const cleanlinessItemIds: string[] = []
        for (const section of sections) {
          if (!section.items || !Array.isArray(section.items)) continue
          if (isCleanlinessSection(section.title ?? '')) {
            for (const item of section.items) {
              cleanlinessItemIds.push(item.id)
            }
          }
        }
        if (cleanlinessItemIds.length > 0) {
          cleanlinessItemsMap[templateVersion.id] = cleanlinessItemIds
        }
      }
    }
  }

  const evaluationByAsset: Array<{
    evaluation_id: string
    asset_id: string
    passed: boolean
  }> = []

  for (const checklist of completedChecklists ?? []) {
    const templateVersionId = checklist.template_version_id
    if (!templateVersionId || !checklist.asset_id) continue

    const cleanlinessItemIds = cleanlinessItemsMap[templateVersionId] ?? []
    if (cleanlinessItemIds.length === 0) continue

    const evaluation = calculateCleanlinessEvaluationByTemplate(
      checklist.completed_items as Array<{
        item_id: string
        status?: string
        description?: string
      }>,
      cleanlinessItemIds
    )
    if (!evaluation) continue

    evaluationByAsset.push({
      evaluation_id: checklist.id,
      asset_id: checklist.asset_id,
      passed: evaluation.passed_both,
    })
  }

  const evalAssetIds = [...new Set(evaluationByAsset.map((e) => e.asset_id))]

  const operatorByAsset = new Map<
    string,
    { operator_id: string; operator_name: string; employee_code?: string }
  >()

  if (evalAssetIds.length > 0) {
    const { data: operatorAssignments, error: operatorError } = await supabase
      .from('asset_operators_full')
      .select(
        `
        asset_id,
        operator_id,
        assignment_type,
        operator_nombre,
        operator_apellido,
        employee_code,
        status
      `
      )
      .in('asset_id', evalAssetIds)
      .eq('status', 'active')

    if (operatorError) {
      console.error('[cleanliness-prefill] asset_operators_full', operatorError)
    } else {
      const grouped = new Map<string, typeof operatorAssignments>()
      for (const row of operatorAssignments ?? []) {
        if (!row.asset_id) continue
        if (!grouped.has(row.asset_id)) grouped.set(row.asset_id, [])
        grouped.get(row.asset_id)!.push(row)
      }

      for (const [assetId, rows] of grouped) {
        const primary = rows.find((r) => r.assignment_type === 'primary') ?? rows[0]
        if (!primary?.operator_id) continue
        const name =
          `${primary.operator_nombre ?? ''} ${primary.operator_apellido ?? ''}`.trim()
        operatorByAsset.set(assetId, {
          operator_id: primary.operator_id,
          operator_name: name || 'Operador',
          employee_code: primary.employee_code ?? undefined,
        })
      }
    }
  }

  const byOperator = new Map<
    string,
    {
      operator_name: string
      employee_code?: string
      evaluation_ids: string[]
      evaluations_passed: number
    }
  >()

  for (const row of evaluationByAsset) {
    const operator = operatorByAsset.get(row.asset_id)
    if (!operator) continue

    const existing = byOperator.get(operator.operator_id) ?? {
      operator_name: operator.operator_name,
      employee_code: operator.employee_code,
      evaluation_ids: [],
      evaluations_passed: 0,
    }
    existing.evaluation_ids.push(row.evaluation_id)
    if (row.passed) existing.evaluations_passed += 1
    byOperator.set(operator.operator_id, existing)
  }

  const rows = [...byOperator.entries()].map(([operator_id, stats]) => {
    const total = stats.evaluation_ids.length
    const weekly_pass_rate = total > 0 ? stats.evaluations_passed / total : 0
    return {
      operator_id,
      operator_name: stats.operator_name,
      employee_code: stats.employee_code,
      weekly_pass_rate,
      evaluation_ids: stats.evaluation_ids,
      evaluations_total: total,
      evaluations_passed: stats.evaluations_passed,
    }
  })

  const roster = await buildPlantOperationsRoster(supabase, plantId)
  const existingIds = new Set(rows.map((row) => row.operator_id))

  for (const op of roster) {
    if (existingIds.has(op.id)) continue
    rows.push({
      operator_id: op.id,
      operator_name: `${op.nombre} ${op.apellido}`.trim() || 'Operador',
      employee_code: op.employee_code,
      weekly_pass_rate: 0,
      evaluation_ids: [],
      evaluations_total: 0,
      evaluations_passed: 0,
    })
  }

  return rows.sort((a, b) => a.operator_name.localeCompare(b.operator_name, 'es'))
}
