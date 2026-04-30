/**
 * Structured metadata persisted on `diesel_evidence.metadata` for consumption photos.
 * Built client-side from ExifReader (original file, before canvas re-encode).
 */
export type DieselEvidenceImageMetadata = {
  photoTaken: {
    raw: string | null
    subSec: string | null
    offset: string | null
  } | null
  gps: {
    latitude: number | null
    longitude: number | null
    altitude: number | null
  } | null
  camera: {
    make: string | null
    model: string | null
    software: string | null
  }
  exif: Record<string, string | number | null> | null
  iptc: Record<string, string | null> | null
  xmp: Record<string, string | number | boolean | null> | null
  /** Populated when upgrading the `exifreader` dependency */
  exifReaderVersion?: string
  extractedAt: string
  exifError?: string
}
