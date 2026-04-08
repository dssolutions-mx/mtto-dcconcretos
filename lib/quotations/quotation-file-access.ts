/** App `createClient()` uses generated Database types; keep parameter loose for callers */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppSupabase = any

export const QUOTATIONS_STORAGE_BUCKET = 'quotations'

export type QuotationFileFields = {
  file_storage_path?: string | null
  file_url?: string | null
}

/**
 * Extract object path under the quotations bucket from a Supabase Storage URL.
 * Works for signed URLs even after the token has expired (path is still in the URL).
 */
export function extractQuotationsPathFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const u = url.trim()
  try {
    const signMatch = u.match(/\/storage\/v1\/object\/sign\/quotations\/([^?]+)/)
    if (signMatch?.[1]) {
      return decodeURIComponent(signMatch[1])
    }
    const publicMatch = u.match(/\/storage\/v1\/object\/public\/quotations\/([^?]+)/)
    if (publicMatch?.[1]) {
      return decodeURIComponent(publicMatch[1])
    }
  } catch {
    return null
  }
  return null
}

function normalizeStoragePathSegment(path: string): string {
  const t = path.trim()
  if (!t) return t
  try {
    if (/%[0-9A-Fa-f]{2}/.test(t)) {
      return decodeURIComponent(t)
    }
  } catch {
    /* ignore */
  }
  return t
}

export function resolveQuotationsObjectPath(q: QuotationFileFields): string | null {
  const trimmed = q.file_storage_path?.trim()
  if (trimmed) return normalizeStoragePathSegment(trimmed)
  const fromUrl = extractQuotationsPathFromUrl(q.file_url ?? undefined)
  return fromUrl ? normalizeStoragePathSegment(fromUrl) : null
}

export function quotationHasFile(q: QuotationFileFields): boolean {
  return Boolean(resolveQuotationsObjectPath(q) || q.file_url?.trim())
}

/**
 * Returns a fresh signed URL for our bucket, or an external http(s) URL as-is.
 */
export async function getSignedUrlForQuotationFile(
  supabase: AppSupabase,
  q: QuotationFileFields
): Promise<string | null> {
  const path = resolveQuotationsObjectPath(q)
  if (path) {
    const { data, error } = await supabase.storage
      .from(QUOTATIONS_STORAGE_BUCKET)
      .createSignedUrl(path, 3600 * 24 * 7)
    if (!error && data?.signedUrl) {
      return data.signedUrl
    }
  }

  const raw = q.file_url?.trim()
  if (!raw) return null
  // External link (not our quotations bucket URL)
  if (raw.startsWith('http') && !raw.includes('/object/sign/quotations/') && !raw.includes('/object/public/quotations/')) {
    return raw
  }
  return null
}

export async function openQuotationFileInNewTab(
  supabase: AppSupabase,
  q: QuotationFileFields
): Promise<boolean> {
  const url = await getSignedUrlForQuotationFile(supabase, q)
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return true
  }
  return false
}
