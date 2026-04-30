import * as ExifReader from "exifreader"
import exifreaderPkg from "exifreader/package.json"
import type { DieselEvidenceImageMetadata } from "@/lib/photos/diesel-evidence-image-metadata"

const READ_BYTES = 128 * 1024
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

/**
 * Reads EXIF (and related groups) from the original image file before any re-encoding.
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

  try {
    const tags = await ExifReader.load(file, {
      expanded: true,
      length: READ_BYTES,
      excludeTags: { thumbnail: true },
    })

    const exif = (tags as { exif?: Record<string, unknown> }).exif
    const gps = (tags as { gps?: Record<string, unknown> }).gps
    const iptc = (tags as { iptc?: Record<string, unknown> }).iptc
    const xmp = (tags as { xmp?: Record<string, unknown> }).xmp

    const photoTaken =
      exif && typeof exif === "object"
        ? {
            raw: tagDescription((exif as Record<string, unknown>)["DateTimeOriginal"]),
            subSec: tagDescription((exif as Record<string, unknown>)["SubSecTimeOriginal"]),
            offset: tagDescription((exif as Record<string, unknown>)["OffsetTimeOriginal"]),
          }
        : null

    const hasPhotoTime =
      photoTaken && (photoTaken.raw !== null || photoTaken.subSec !== null || photoTaken.offset !== null)

    let latitude: number | null = null
    let longitude: number | null = null
    let altitude: number | null = null
    if (gps && typeof gps === "object") {
      const g = gps as Record<string, unknown>
      const lat = g["Latitude"]
      const lng = g["Longitude"]
      const alt = g["Altitude"]
      if (typeof lat === "number" && Number.isFinite(lat)) latitude = lat
      if (typeof lng === "number" && Number.isFinite(lng)) longitude = lng
      if (typeof alt === "number" && Number.isFinite(alt)) altitude = alt
    }
    const gpsBlock =
      latitude !== null || longitude !== null || altitude !== null
        ? { latitude, longitude, altitude }
        : null

    const camera = {
      make: exif ? tagDescription((exif as Record<string, unknown>)["Make"]) : null,
      model: exif ? tagDescription((exif as Record<string, unknown>)["Model"]) : null,
      software: exif ? tagDescription((exif as Record<string, unknown>)["Software"]) : null,
    }

    return {
      photoTaken: hasPhotoTime ? photoTaken : null,
      gps: gpsBlock,
      camera,
      exif: serializeExifTagMap(exif),
      iptc: serializeIptcMap(iptc),
      xmp: serializeXmpShallow(xmp),
      exifReaderVersion: (exifreaderPkg as { version?: string }).version ?? undefined,
      extractedAt,
    }
  } catch (e) {
    if (e instanceof ExifReader.errors.MetadataMissingError) {
      return {
        ...empty,
        exifError: "no_embedded_metadata",
      }
    }
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ...empty,
      exifError: truncate(msg),
    }
  }
}
