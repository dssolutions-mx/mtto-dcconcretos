import type { DieselEvidenceImageMetadata } from "@/lib/photos/diesel-evidence-image-metadata"

/** Minutes — same order of magnitude as consumo backdating threshold in forms */
const ALIGN_MINUTES = 15
const REVIEW_MINUTES = 120
/** If EXIF is missing, accept `File.lastModified` when it is near the declared transaction (avoids ancient gallery files). */
const MAX_FILE_STAMP_VS_TX_MS = 14 * 24 * 60 * 60 * 1000

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
  /** Which clock was compared to the transaction */
  approximationSource?: "exif" | "file_last_modified" | "client_receive"
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
  const mExif = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  const mIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
  const m = mExif || mIso
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

function pickApproxWhenNoExifTime(
  meta: DieselEvidenceImageMetadata,
  transactionMs: number
): { instant: Date; source: "file_last_modified" | "client_receive" } | null {
  const fileIso = meta.fileLastModifiedAt
  if (fileIso) {
    const t = new Date(fileIso).getTime()
    if (!Number.isNaN(t) && new Date(t).getUTCFullYear() >= 2000) {
      if (Math.abs(t - transactionMs) <= MAX_FILE_STAMP_VS_TX_MS) {
        return { instant: new Date(t), source: "file_last_modified" }
      }
    }
  }
  const recv = meta.clientCaptureReceivedAt
  if (recv) {
    const t = new Date(recv).getTime()
    if (!Number.isNaN(t)) return { instant: new Date(t), source: "client_receive" }
  }
  return null
}

function buildDeltaComparison(
  transactionInstant: Date,
  transactionLabel: string,
  photoInstant: Date,
  approximationSource: "exif" | "file_last_modified" | "client_receive",
  hintExtra: string
): PhotoVsTransactionComparison {
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
  if (approximationSource === "exif") {
    if (severity === "aligned") {
      hint =
        "Registro y hora EXIF de la foto coinciden en la práctica. En una toma al momento, DateTimeOriginal / CreateDate en el archivo es el instante en que se disparó el obturador (o se creó el JPEG)."
    } else if (severity === "minor") {
      hint =
        "Diferencia moderada: revisar si el operador ajustó fecha/hora del consumo o si la foto es de otra toma. Con EXIF completo, esa marca es el momento de captura de la cámara."
    } else {
      hint =
        "Gran discrepancia: posible error de captura, consumo fechado atrasado o foto reutilizada. La marca EXIF refleja el instante en que la cámara generó la imagen."
    }
  } else if (approximationSource === "file_last_modified") {
    hint =
      "No hay fecha/hora EXIF legible en el archivo. Se usa la marca de última modificación del archivo que, al tomar la foto con la cámara del teléfono, suele ser el mismo instante en que se creó la imagen."
  } else {
    hint =
      "No hay fecha/hora EXIF legible. Se usa la hora en que el navegador recibió el archivo (justo después de cerrar la cámara), como aproximación al momento de la toma."
  }
  if (approximationSource !== "exif") {
    if (severity === "aligned") hint += " Coincide razonablemente con el registro."
    else if (severity === "minor") hint += " Diferencia moderada respecto al registro."
    else hint += " Gran discrepancia respecto al registro."
  }
  hint += hintExtra

  return {
    severity,
    deltaMinutes,
    transactionInstant,
    photoInstant,
    transactionLabel,
    photoLabel,
    hint,
    approximationSource,
  }
}

export function comparePhotoTimeToTransaction(
  transactionDateIso: string,
  meta: DieselEvidenceImageMetadata | null | undefined
): PhotoVsTransactionComparison {
  const transactionInstant = new Date(transactionDateIso)
  const transactionMs = transactionInstant.getTime()
  const transactionLabel = Number.isNaN(transactionMs)
    ? transactionDateIso
    : transactionInstant.toLocaleString("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
      })

  if (!meta || Number.isNaN(transactionMs)) {
    return {
      severity: "unknown",
      deltaMinutes: null,
      transactionInstant,
      photoInstant: null,
      transactionLabel,
      photoLabel: null,
      hint: "Sin metadatos de imagen para comparar.",
    }
  }

  const photoTaken = meta.photoTaken
  const offsetNote =
    photoTaken?.raw && !photoTaken.offset
      ? " La foto no trae offset EXIF; la comparación usa la hora local del dispositivo al interpretar la marca."
      : ""

  if (photoTaken?.raw) {
    const fromExif = parsePhotoTakenInstant(photoTaken)
    if (fromExif) {
      return buildDeltaComparison(transactionInstant, transactionLabel, fromExif, "exif", offsetNote)
    }
    const approx = pickApproxWhenNoExifTime(meta, transactionMs)
    if (approx) {
      return buildDeltaComparison(
        transactionInstant,
        transactionLabel,
        approx.instant,
        approx.source,
        ` La marca EXIF (${photoTaken.raw}) no fue interpretable; se usó ${
          approx.source === "file_last_modified" ? "la marca del archivo" : "la hora de recepción"
        } como respaldo.`
      )
    }
    return {
      severity: "unknown",
      deltaMinutes: null,
      transactionInstant,
      photoInstant: null,
      transactionLabel,
      photoLabel: photoTaken.raw,
      hint: "No se pudo interpretar la marca de tiempo EXIF ni un respaldo fiable.",
    }
  }

  const approx = pickApproxWhenNoExifTime(meta, transactionMs)
  if (approx) {
    return buildDeltaComparison(transactionInstant, transactionLabel, approx.instant, approx.source, "")
  }

  return {
    severity: "unknown",
    deltaMinutes: null,
    transactionInstant,
    photoInstant: null,
    transactionLabel,
    photoLabel: null,
    hint: "La foto no incluye hora de captura EXIF (pantallazo o app que elimina metadatos) ni una marca de archivo usable cerca de la fecha del consumo.",
  }
}

export function isDieselEvidenceImageMetadata(value: unknown): value is DieselEvidenceImageMetadata {
  if (!value || typeof value !== "object") return false
  const o = value as Record<string, unknown>
  return (
    typeof o.extractedAt === "string" ||
    o.photoTaken != null ||
    o.exifError != null ||
    typeof o.clientCaptureReceivedAt === "string" ||
    typeof o.fileLastModifiedAt === "string"
  )
}
