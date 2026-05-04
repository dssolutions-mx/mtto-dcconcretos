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
  /**
   * When the in-app camera (`capture`) delivers a file with no usable EXIF time (common on mobile browsers).
   * ISO timestamp from the client clock when the `File` was received — approximates “momento de la toma”.
   */
  clientCaptureReceivedAt?: string
  /**
   * True when there is no usable EXIF date/time string; comparison uses file stamp and/or receive clock.
   */
  clientCaptureFallback?: boolean
  /**
   * `File.lastModified` as ISO (browser/OS). For a photo taken “now”, this often matches the capture instant
   * even when EXIF is stripped — closer than “received in JS” for many devices.
   */
  fileLastModifiedAt?: string
}
