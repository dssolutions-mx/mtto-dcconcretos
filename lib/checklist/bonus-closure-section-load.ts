import type {
  BonusClosureDecision,
  BonusClosureSectionData,
} from '@/types'

/** Stable cache key for roster + cleanliness prefill fetches. */
export function bonusClosureResourceKey(
  plantId: string | undefined | null,
  year: number,
  month: number
): string | null {
  if (!plantId) return null
  return `${plantId}:${year}:${month}`
}

/** Normalize payload so parent round-trips do not change serialization. */
export function normalizeBonusClosureSectionForEmit(
  data: BonusClosureSectionData
): BonusClosureSectionData {
  return {
    period_year: data.period_year,
    period_month: data.period_month,
    decisions: (data.decisions ?? []).map((decision) => {
      const eligible = decision.eligible === true
      const normalized: BonusClosureDecision = {
        operator_id: decision.operator_id,
        weekly_pass_rate: Number(decision.weekly_pass_rate) || 0,
        evaluation_ids: [...(decision.evaluation_ids ?? [])],
        system_suggested_eligible: Boolean(decision.system_suggested_eligible),
        eligible,
      }

      if (decision.operator_name) {
        normalized.operator_name = decision.operator_name
      }
      if (decision.employee_code) {
        normalized.employee_code = decision.employee_code
      }
      if (!eligible) {
        normalized.ineligible_reason = decision.ineligible_reason?.trim() ?? ''
      }
      if (decision.evidence?.length) {
        normalized.evidence = decision.evidence.map((item) => {
          const row: NonNullable<BonusClosureDecision['evidence']>[number] = {
            photo_url: item.photo_url,
            category: item.category,
          }
          if (item.description) row.description = item.description
          const photoId = (item as { photoId?: string }).photoId
          if (photoId) (row as { photoId?: string }).photoId = photoId
          return row
        })
      }

      return normalized
    }),
  }
}

/** Serialize section payload to dedupe parent onDataChange emissions. */
export function serializeBonusClosureSectionData(
  data: BonusClosureSectionData
): string {
  return JSON.stringify(normalizeBonusClosureSectionForEmit(data))
}
