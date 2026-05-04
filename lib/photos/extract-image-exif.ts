import * as ExifReader from "exifreader"
import exifreaderPkg from "exifreader/package.json"
import type { DieselEvidenceImageMetadata } from "@/lib/photos/diesel-evidence-image-metadata"

/** First slice — was 128KiB; in-app camera / HEIC often need more for full EXIF */
const READ_BYTES_FIRST = 512 * 1024
const READ_BYTES_MID = 2 * 1024 * 1024
const READ_BYTES_MAX = 12 * 1024 * 1024
const MAX_FIELD_LEN = 2000
const MAX_MAP_KEYS = 100

function truncate(s: string): string {
  if (s.length <= MAX_FIELD_LEN) return s
  return `${s.slice(0, MAX_FIELD_LEN)}…`
}

function tagDescription(tag: unknown): string | null {
  if (!tag || typeof tag !== "object") return null
  const d = (tag as { description?: unknown }).description
  if (d === undefined || d === null) return null
  if (typeof d === "string") return truncate(d)
  if (typeof d === "number" || typeof d === "boolean") return String(d)
  if (Array.isArray(d)) return truncate(d.map(String).join(", "))
  return truncate(String(d))
}

function tagNumber(tag: unknown): number | null {
  if (!tag || typeof tag !== "object") return null
  const v = (tag as { value?: unknown }).value
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number" && v[1] !== 0) {
    return v[0] / v[1]
  }
  return null
}

/** Pick first usable camera/scene timestamp (in-app cameras often omit DateTimeOriginal). */
function pickPhotoTakenFields(exif: Record<string, unknown> | undefined): {
  raw: string | null
  subSec: string | null
  offset: string | null
} {
  if (!exif || typeof exif !== "object") {
    return { raw: null, subSec: null, offset: null }
  }
  const dateKeys = [
    "DateTimeOriginal",
    "DateTimeDigitized",
    "DateTime",
    "CreateDate",
  ] as const
  let raw: string | null = null
  for (const k of dateKeys) {
    raw = tagDescription(exif[k])
    if (raw) break
  }
  const subSec =
    tagDescription(exif["SubSecTimeOriginal"]) ??
    tagDescription(exif["SubSecTimeDigitized"])
  const offset =
    tagDescription(exif["OffsetTimeOriginal"]) ??
    tagDescription(exif["OffsetTimeDigitized"]) ??
    tagDescription(exif["OffsetTime"])
  return { raw, subSec, offset }
}

function hasPhotoTakenTime(photoTaken: {
  raw: string | null
  subSec: string | null
  offset: string | null
}): boolean {
  return photoTaken.raw != null || photoTaken.subSec != null || photoTaken.offset != null
}

/** Drop binary / huge fields; keep JSON-safe scalars for fraud forensics */
function serializeExifTagMap(
  section: Record<string, unknown> | undefined
): Record<string, string | number | null> | null {
  if (!section || typeof section !== "object") return null
  const out: Record<string, string | number | null> = {}
  let n = 0
  for (const [key, tag] of Object.entries(section)) {
    if (n >= MAX_MAP_KEYS) break
    if (key === "Thumbnail" || key.toLowerCase().includes("thumbnail")) continue
    if (!tag || typeof tag !== "object") continue
    if ("image" in tag || "base64" in tag) continue
    const desc = tagDescription(tag)
    const num = tagNumber(tag)
    if (desc !== null) {
      out[key] = desc
      n++
    } else if (num !== null) {
      out[key] = num
      n++
    }
  }
  return Object.keys(out).length ? out : null
}

function serializeIptcMap(section: Record<string, unknown> | undefined): Record<string, string | null> | null {
  if (!section || typeof section !== "object") return null
  const out: Record<string, string | null> = {}
  let n = 0
  for (const [key, tag] of Object.entries(section)) {
    if (n >= MAX_MAP_KEYS) break
    const s = tagDescription(tag)
    if (s !== null) {
      out[key] = s
      n++
    }
  }
  return Object.keys(out).length ? out : null
}

function serializeXmpShallow(section: Record<string, unknown> | undefined): Record<
  string,
  string | number | boolean | null
> | null {
  if (!section || typeof section !== "object") return null
  const out: Record<string, string | number | boolean | null> = {}
  let n = 0
  for (const [key, tag] of Object.entries(section)) {
    if (n >= MAX_MAP_KEYS) break
    if (!tag || typeof tag !== "object") continue
    const desc = tagDescription(tag)
    if (desc !== null) {
      out[key] = desc
      n++
    }
  }
  return Object.keys(out).length ? out : null
}

function buildMetadataFromExpandedTags(
  tags: Record<string, unknown>,
  extractedAt: string
): DieselEvidenceImageMetadata {
  const exif = tags.exif as Record<string, unknown> | undefined
  const gps = tags.gps as Record<string, unknown> | undefined
  const iptc = tags.iptc as Record<string, unknown> | undefined
  const xmp = tags.xmp as Record<string, unknown> | undefined

  const photoTaken = pickPhotoTakenFields(exif)

  let latitude: number | null = null
  let longitude: number | null = null
  let altitude: number | null = null
  if (gps && typeof gps === "object") {
    const lat = gps["Latitude"]
    const lng = gps["Longitude"]
    const alt = gps["Altitude"]
    if (typeof lat === "number" && Number.isFinite(lat)) latitude = lat
    if (typeof lng === "number" && Number.isFinite(lng)) longitude = lng
    if (typeof alt === "number" && Number.isFinite(alt)) altitude = alt
  }
  const gpsBlock =
    latitude !== null || longitude !== null || altitude !== null
      ? { latitude, longitude, altitude }
      : null

  const camera = {
    make: exif ? tagDescription(exif["Make"]) : null,
    model: exif ? tagDescription(exif["Model"]) : null,
    software: exif ? tagDescription(exif["Software"]) : null,
  }

  return {
    photoTaken: hasPhotoTakenTime(photoTaken) ? photoTaken : null,
    gps: gpsBlock,
    camera,
    exif: serializeExifTagMap(exif),
    iptc: serializeIptcMap(iptc),
    xmp: serializeXmpShallow(xmp),
    exifReaderVersion: (exifreaderPkg as { version?: string }).version ?? undefined,
    extractedAt,
  }
}

function uniqueSortedLengths(fileSize: number): number[] {
  const candidates = [
    Math.min(READ_BYTES_FIRST, fileSize),
    Math.min(READ_BYTES_MID, fileSize),
    Math.min(READ_BYTES_MAX, fileSize),
    fileSize,
  ].filter((n) => n > 0)
  return [...new Set(candidates)].sort((a, b) => a - b)
}

/**
 * Reads EXIF (and related groups) from the original image file before any re-encoding.
 * Retries with larger byte windows when DateTime is missing (common for HEIC / camera blobs).
 * Never throws — failures become `exifError` / partial nulls so uploads still proceed.
 */
export async function extractDieselEvidenceMetadata(file: File): Promise<DieselEvidenceImageMetadata> {
  const extractedAt = new Date().toISOString()
  const empty: DieselEvidenceImageMetadata = {
    photoTaken: null,
    gps: null,
    camera: { make: null, model: null, software: null },
    exif: null,
    iptc: null,
    xmp: null,
    extractedAt,
  }

  let best: DieselEvidenceImageMetadata = { ...empty, extractedAt }
  const lengths = uniqueSortedLengths(file.size)

  for (const length of lengths) {
    try {
      const tags = (await ExifReader.load(file, {
        expanded: true,
        length,
        excludeTags: { thumbnail: true },
      })) as unknown as Record<string, unknown>

      const candidate = buildMetadataFromExpandedTags(tags, extractedAt)
      best = candidate
      if (candidate.photoTaken?.raw) {
        return candidate
      }
    } catch (e) {
      if (e instanceof ExifReader.errors.MetadataMissingError) {
        continue
      }
      const msg = e instanceof Error ? e.message : String(e)
      return {
        ...empty,
        extractedAt,
        exifError: truncate(msg),
      }
    }
  }

  if (!best.photoTaken?.raw && !best.exifError) {
    best = { ...best, exifError: "no_embedded_metadata" }
  }
  return best
}
