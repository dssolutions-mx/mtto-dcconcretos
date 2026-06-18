import type { SupabaseClient } from '@supabase/supabase-js'
import type { GapEvidencePhoto } from '@/lib/diesel/gap-email/load-gap-evidence'

export const DIESEL_EVIDENCE_BUCKET = 'diesel-evidence'

export function evidenceContentId(photoId: string): string {
  return `gap-evidence-${photoId}`
}

export function extractDieselEvidenceStoragePath(photoUrl: string): string | null {
  const u = photoUrl.trim()
  if (!u) return null

  if (!/^https?:\/\//i.test(u)) {
    return u.replace(/^\/+/, '')
  }

  try {
    const patterns = [
      /\/storage\/v1\/object\/public\/diesel-evidence\/([^?]+)/,
      /\/storage\/v1\/object\/sign\/diesel-evidence\/([^?]+)/,
      /\/storage\/v1\/object\/authenticated\/diesel-evidence\/([^?]+)/,
    ]
    for (const pattern of patterns) {
      const match = u.match(pattern)
      if (match?.[1]) return decodeURIComponent(match[1])
    }
  } catch {
    return null
  }

  return null
}

export function guessEvidenceImageType(url: string, headerType: string | null): string {
  if (headerType?.startsWith('image/')) return headerType
  const lower = url.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

export async function downloadGapEvidenceImageBytes(
  admin: SupabaseClient,
  photoUrl: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const trimmed = photoUrl.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) return null
    const buffer = Buffer.from(match[2], 'base64')
    return buffer.length > 0 ? { buffer, contentType: match[1] } : null
  }

  const path = extractDieselEvidenceStoragePath(trimmed)
  if (path) {
    const { data, error } = await admin.storage.from(DIESEL_EVIDENCE_BUCKET).download(path)
    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer())
      if (buffer.length > 0) {
        return { buffer, contentType: guessEvidenceImageType(path, data.type || null) }
      }
    }
  }

  try {
    const res = await fetch(trimmed)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0) return null
    return {
      buffer,
      contentType: guessEvidenceImageType(trimmed, res.headers.get('content-type')),
    }
  } catch {
    return null
  }
}

export async function buildPreviewEvidenceImageSrcMap(
  admin: SupabaseClient,
  photos: GapEvidencePhoto[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const photo of photos) {
    const result = await downloadGapEvidenceImageBytes(admin, photo.photoUrl)
    if (!result) continue
    map.set(photo.id, `data:${result.contentType};base64,${result.buffer.toString('base64')}`)
  }
  return map
}
