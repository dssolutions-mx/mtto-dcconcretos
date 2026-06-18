import type { SupabaseClient } from '@supabase/supabase-js'
import type { CuentaLitrosGap } from '@/lib/diesel-cuenta-litros-gaps'

export type GapEvidencePhoto = {
  id: string
  transactionId: string
  transactionCode: string
  photoUrl: string
  description: string | null
  category: string | null
  anchor: 'prev' | 'curr' | 'interval'
}

type TxMeta = { code: string; gapId: string; anchor: GapEvidencePhoto['anchor'] }

export async function loadGapEvidenceByGapId(
  admin: SupabaseClient,
  gaps: CuentaLitrosGap[],
): Promise<Map<string, GapEvidencePhoto[]>> {
  const txMeta = new Map<string, TxMeta[]>()

  for (const gap of gaps) {
    const add = (txId: string, code: string, anchor: TxMeta['anchor']) => {
      const list = txMeta.get(txId) ?? []
      list.push({ code, gapId: gap.id, anchor })
      txMeta.set(txId, list)
    }
    add(gap.prev_anchor.tx_id, gap.prev_anchor.transaction_id, 'prev')
    add(gap.curr_anchor.tx_id, gap.curr_anchor.transaction_id, 'curr')
    for (const tx of gap.transactions_in_interval) {
      add(tx.id, tx.transaction_id, 'interval')
    }
  }

  const txIds = [...txMeta.keys()]
  const result = new Map<string, GapEvidencePhoto[]>()
  if (txIds.length === 0) return result

  const { data, error } = await admin
    .from('diesel_evidence')
    .select('id, transaction_id, photo_url, description, category')
    .in('transaction_id', txIds)
    .order('created_at', { ascending: true })

  if (error || !data) return result

  for (const row of data) {
    if (!row.photo_url?.trim()) continue
    for (const meta of txMeta.get(row.transaction_id) ?? []) {
      const photo: GapEvidencePhoto = {
        id: row.id,
        transactionId: row.transaction_id,
        transactionCode: meta.code,
        photoUrl: row.photo_url.trim(),
        description: row.description,
        category: row.category,
        anchor: meta.anchor,
      }
      const list = result.get(meta.gapId) ?? []
      list.push(photo)
      result.set(meta.gapId, list)
    }
  }

  return result
}

export function collectUniqueEvidencePhotos(
  evidenceByGapId: Map<string, GapEvidencePhoto[]>,
): GapEvidencePhoto[] {
  const seen = new Set<string>()
  const photos: GapEvidencePhoto[] = []
  for (const list of evidenceByGapId.values()) {
    for (const photo of list) {
      if (seen.has(photo.id)) continue
      seen.add(photo.id)
      photos.push(photo)
    }
  }
  return photos
}
