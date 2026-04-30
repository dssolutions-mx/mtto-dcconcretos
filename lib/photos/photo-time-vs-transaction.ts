import type { DieselEvidenceImageMetadata } from "@/lib/photos/diesel-evidence-image-metadata"

/** Minutes — same order of magnitude as consumo backdating threshold in forms */
const ALIGN_MINUTES = 15
const REVIEW_MINUTES = 120

export type PhotoVsTransactionSeverity = "aligned" | "minor" | "major" | "unknown"

export type PhotoVsTransactionComparison = {
  severity: PhotoVsTransactionSeverity
  /** Signed: photo capture − transaction (minutes). Null if not computable */
  deltaMinutes: number | null
  transactionInstant: Date
  photoInstant: Date | null
  transactionLabel: string
  photoLabel: string | null
  /** Short note for UI */
  hint: string
}

/**
 * Parse EXIF `DateTimeOriginal` (+ optional subsec / offset) to a JS Date.
 * Offset uses ISO-8601 suffix when present; otherwise uses local runtime interpretation.
 */
export function parsePhotoTakenInstant(photoTaken: {
  raw: string | null
  subSec: string | null
  offset: string | null
}): Date | null {
  const raw = photoTaken.raw?.trim()
  if (!raw) return null
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  let isoLocal = `${y}-${mo}-${d}T${h}:${mi}:${s}`
  if (photoTaken.subSec?.trim() && /^\d{1,3}$/.test(photoTaken.subSec.trim())) {
    const frac = photoTaken.subSec.trim().padEnd(3, "0").slice(0, 3)
    isoLocal = `${isoLocal}.${frac}`
  }
  const off = photoTaken.offset?.trim()
  if (off && /^[+-]\d{2}:\d{2}$/.test(off)) {
    const inst = new Date(isoLocal + off)
    return Number.isNaN(inst.getTime()) ? null : inst
  }
  if (off && /^[+-]\d{2}$/.test(off)) {
    const inst = new Date(`${isoLocal}${off}:00`)
    return Number.isNaN(inst.getTime()) ? null : inst
  }
  const inst = new Date(isoLocal)
  return Number.isNaN(inst.getTime()) ? null : inst
}

export function comparePhotoTimeToTransaction(
  transactionDateIso: string,
  meta: DieselEvidenceImageMetadata | null | undefined
): PhotoVsTransactionComparison {
  const transactionInstant = new Date(transactionDateIso)
  const transactionLabel = Number.isNaN(transactionInstant.getTime())
    ? transactionDateIso
    : transactionInstant.toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      })

  const photoTaken = meta?.photoTaken
  if (!photoTaken?.raw) {
    return {
      severity: "unknown",
      deltaMinutes: null,
      transactionInstant,
      photoInstant: null,
      transactionLabel,
      photoLabel: null,
      hint: "La foto no incluye hora de captura EXIF (pantallazo o app que elimina metadatos).",
    }
  }

  const photoInstant = parsePhotoTakenInstant(photoTaken)
  const rawDisplay = [
    photoTaken.raw,
    photoTaken.offset ? `(UTC${photoTaken.offset.startsWith("-") || photoTaken.offset.startsWith("+") ? "" : "+"}${photoTaken.offset.replace(/^UTC/i, "")})` : null,
  ]
    .filter(Boolean)
    .join(" ")

  if (!photoInstant) {
    return {
      severity: "unknown",
      deltaMinutes: null,
      transactionInstant,
      photoInstant: null,
      transactionLabel,
      photoLabel: rawDisplay,
      hint: "No se pudo interpretar la marca de tiempo EXIF.",
    }
  }

  const photoLabel = photoInstant.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  const deltaMs = photoInstant.getTime() - transactionInstant.getTime()
  const deltaMinutes = Math.round(deltaMs / 60_000)
  const abs = Math.abs(deltaMinutes)

  let severity: PhotoVsTransactionSeverity
  if (abs <= ALIGN_MINUTES) severity = "aligned"
  else if (abs <= REVIEW_MINUTES) severity = "minor"
  else severity = "major"

  let hint: string
  if (severity === "aligned") {
    hint = "Registro y hora de captura de la foto coinciden en la práctica."
  } else if (severity === "minor") {
    hint = "Diferencia moderada: revisar si el operador ajustó fecha/hora del consumo o si la foto es de otra toma."
  } else {
    hint = "Gran discrepancia: posible error de captura, consumo fechado atrasado o foto reutilizada."
  }
  if (!photoTaken.offset) {
    hint += " La foto no trae offset EXIF; la comparación usa la hora local del dispositivo al interpretar la marca."
  }

  return {
    severity,
    deltaMinutes,
    transactionInstant,
    photoInstant,
    transactionLabel,
    photoLabel,
    hint,
  }
}

export function isDieselEvidenceImageMetadata(value: unknown): value is DieselEvidenceImageMetadata {
  if (!value || typeof value !== "object") return false
  const o = value as Record<string, unknown>
  return typeof o.extractedAt === "string" || o.photoTaken != null || o.exifError != null
}
