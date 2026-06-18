import type { SupabaseClient } from '@supabase/supabase-js'
import type { CuentaLitrosGap } from '@/lib/diesel-cuenta-litros-gaps'
import { buildDieselGapEmailHtml } from '@/lib/diesel/gap-email/email-copy'
import {
  fetchPlantRoleEmails,
  parseDieselGapCcOverrides,
  resolveDieselGapRecipients,
} from '@/lib/diesel/gap-email/recipients'
import type { WarehouseGapContext } from '@/lib/diesel/gap-email/load-warehouse-gaps'

function resolveAppUrl(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL
  if (explicit?.startsWith('http')) return explicit.replace(/\/$/, '')
  if (explicit) return `https://${explicit.replace(/^https?:\/\//, '')}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return undefined
}

export type DieselGapEmailDraft = {
  subject: string
  html: string
  to: string[]
  cc: string[]
  includedGapIds: string[]
  availableFindings: Array<{ findingKey: string; message: string }>
  warehouseName: string
  warehouseCode: string
  plantName: string
  plantCode: string | null
}

export async function buildDieselGapEmailDraft(
  admin: SupabaseClient,
  context: WarehouseGapContext,
  selectedGaps: CuentaLitrosGap[],
): Promise<DieselGapEmailDraft> {
  const roleEmails = await fetchPlantRoleEmails(admin, context.plantId)
  const extraCc = parseDieselGapCcOverrides(process.env.DIESEL_GAP_CC_OVERRIDES)
  const { to, cc } = resolveDieselGapRecipients(context.plantCode, roleEmails, extraCc)

  const appUrl = resolveAppUrl()

  const { subject, html } = buildDieselGapEmailHtml({
    warehouseName: context.warehouseName,
    warehouseCode: context.warehouseCode,
    plantName: context.plantName,
    plantCode: context.plantCode,
    gaps: selectedGaps,
    appUrl,
    warehouseId: context.warehouseId,
  })

  return {
    subject,
    html,
    to,
    cc,
    includedGapIds: selectedGaps.map((g) => g.id),
    availableFindings: context.significantGaps.map((g) => ({
      findingKey: g.id,
      message: `${g.short_label} · ${g.prev_anchor.transaction_id} → ${g.curr_anchor.transaction_id} · ${g.time_window_label}`,
    })),
    warehouseName: context.warehouseName,
    warehouseCode: context.warehouseCode,
    plantName: context.plantName,
    plantCode: context.plantCode,
  }
}
