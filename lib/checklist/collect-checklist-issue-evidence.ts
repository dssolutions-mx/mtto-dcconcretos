import type { SupabaseClient } from '@supabase/supabase-js'

export type ChecklistEvidencePhoto = {
  url: string
  description: string
  category: string
  uploaded_at: string
}

export type ChecklistIssueEvidencePayload = {
  /** Distinct image URLs for `incident_history.documents` */
  documentUrls: string[]
  /** Rich rows for `work_orders.creation_photos` */
  creationPhotos: ChecklistEvidencePhoto[]
}

function dedupePhotos(photos: ChecklistEvidencePhoto[]): ChecklistEvidencePhoto[] {
  const seen = new Set<string>()
  const out: ChecklistEvidencePhoto[] = []
  for (const p of photos) {
    const u = p.url.trim()
    if (!u || seen.has(u)) continue
    seen.add(u)
    out.push({ ...p, url: u })
  }
  return out
}

/**
 * Resolves checklist_evidence rows for a failed item: photos from the item's section plus
 * any section with `section_type = 'evidence'`. If that yields no allowed sections (edge case),
 * includes all evidence saved for the completed checklist.
 */
export async function collectChecklistIssueEvidencePayload(
  supabase: SupabaseClient,
  params: { completedChecklistId: string; itemId: string }
): Promise<ChecklistIssueEvidencePayload> {
  const uploadedAt = new Date().toISOString()
  const documentUrls: string[] = []
  const creationPhotos: ChecklistEvidencePhoto[] = []

  const { data: completed, error: completedError } = await supabase
    .from('completed_checklists')
    .select('checklist_id')
    .eq('id', params.completedChecklistId)
    .single()

  if (completedError || !completed?.checklist_id) {
    return { documentUrls, creationPhotos }
  }

  const templateId = completed.checklist_id

  const { data: itemRow } = await supabase
    .from('checklist_items')
    .select('section_id')
    .eq('id', params.itemId)
    .maybeSingle()

  const itemSectionId = itemRow?.section_id ?? null

  const { data: evidenceSectionRows } = await supabase
    .from('checklist_sections')
    .select('id')
    .eq('checklist_id', templateId)
    .eq('section_type', 'evidence')

  const evidenceSectionIds = (evidenceSectionRows ?? []).map((r) => r.id)
  const hasEvidenceSections = evidenceSectionIds.length > 0

  const { data: evidenceRows, error: evidenceError } = await supabase
    .from('checklist_evidence')
    .select('photo_url, description, category, section_id')
    .eq('completed_checklist_id', params.completedChecklistId)

  if (evidenceError || !evidenceRows?.length) {
    return { documentUrls, creationPhotos }
  }

  const useAllEvidence =
    !itemSectionId &&
    !hasEvidenceSections

  for (const row of evidenceRows) {
    const url = row.photo_url?.trim()
    if (!url) continue

    if (useAllEvidence) {
      creationPhotos.push({
        url,
        description: (row.description ?? '').trim(),
        category: (row.category ?? 'checklist_evidence').trim() || 'checklist_evidence',
        uploaded_at: uploadedAt,
      })
      continue
    }

    const sid = row.section_id
    const inItemSection = itemSectionId && sid === itemSectionId
    const inEvidenceSection = sid && evidenceSectionIds.includes(sid)
    if (inItemSection || inEvidenceSection) {
      creationPhotos.push({
        url,
        description: (row.description ?? '').trim(),
        category: (row.category ?? 'checklist_evidence').trim() || 'checklist_evidence',
        uploaded_at: uploadedAt,
      })
    }
  }

  const uniquePhotos = dedupePhotos(creationPhotos)
  return {
    documentUrls: uniquePhotos.map((p) => p.url),
    creationPhotos: uniquePhotos,
  }
}

/** Normalize per-item photo from corrective dialog payload */
export function normalizeIssueItemPhotoUrl(
  issue: { photo_url?: string | null; photo?: string | { url?: string } | null }
): string | null {
  const raw = issue.photo_url ?? issue.photo
  if (!raw) return null
  if (typeof raw === 'string') return raw.trim() || null
  if (typeof raw === 'object' && raw.url) return String(raw.url).trim() || null
  return null
}

export function mergeIssuePhotoWithChecklistEvidence(args: {
  issuePhotoUrl: string | null
  /** Shown on work order creation_photos for the per-item capture */
  issueDescription?: string | null
  evidence: ChecklistIssueEvidencePayload
  uploadedAt?: string
}): { documentUrls: string[]; creationPhotos: ChecklistEvidencePhoto[] } {
  const uploadedAt = args.uploadedAt ?? new Date().toISOString()
  const creationPhotos: ChecklistEvidencePhoto[] = []

  if (args.issuePhotoUrl?.trim()) {
    const u = args.issuePhotoUrl.trim()
    creationPhotos.push({
      url: u,
      description: (args.issueDescription ?? '').trim(),
      category: 'checklist_item',
      uploaded_at: uploadedAt,
    })
  }

  for (const p of args.evidence.creationPhotos) {
    creationPhotos.push(p)
  }

  const merged = dedupePhotos(creationPhotos)
  return {
    documentUrls: merged.map((p) => p.url),
    creationPhotos: merged,
  }
}
