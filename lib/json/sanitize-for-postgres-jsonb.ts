/**
 * Recursively clean values destined for Postgres `jsonb` / JSON parameters.
 * PostgREST/Postgres reject some UTF-16 sequences (e.g. lone surrogates, NUL) that can appear
 * in EXIF/XMP strings from `diesel_evidence.metadata`.
 */
function sanitizeJsonString(s: string): string {
  let out = ""
  for (let i = 0; i < s.length; ) {
    const c = s.charCodeAt(i)
    if (c === 0) {
      i += 1
      continue
    }
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const low = s.charCodeAt(i + 1)
      if (low >= 0xdc00 && low <= 0xdfff) {
        out += s.slice(i, i + 2)
        i += 2
        continue
      }
    }
    if (c >= 0xd800 && c <= 0xdfff) {
      out += "\uFFFD"
      i += 1
      continue
    }
    out += s.charAt(i)
    i += 1
  }
  return out
}

export function sanitizeValueForPostgresJsonb(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value ?? null
  }
  const t = typeof value
  if (t === "string") {
    return sanitizeJsonString(value as string)
  }
  if (t === "number" || t === "boolean") {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValueForPostgresJsonb)
  }
  if (t === "object") {
    const o = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(o)) {
      out[sanitizeJsonString(key)] = sanitizeValueForPostgresJsonb(o[key])
    }
    return out
  }
  return null
}
