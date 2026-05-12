type PostgrestLike = {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string | null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function asPostgrestLike(error: unknown): PostgrestLike | null {
  if (!isRecord(error)) return null
  const message = error.message
  if (typeof message !== "string") return null
  return {
    message,
    details: typeof error.details === "string" ? error.details : null,
    hint: typeof error.hint === "string" ? error.hint : null,
    code: typeof error.code === "string" ? error.code : null,
  }
}

/** Which diesel UI flow failed — tunes operator-facing copy (entries do not use horómetro checks). */
export type DieselSaveOperation = "entry" | "consumption" | "adjustment"

/**
 * Maps common Postgres / PostgREST failures on diesel saves to operator-readable Spanish.
 */
export function describeDieselSaveError(
  error: unknown,
  operation: DieselSaveOperation = "consumption"
): string {
  const pg = asPostgrestLike(error)
  const message = pg?.message ?? (error instanceof Error ? error.message : "")
  const details = pg?.details ?? ""
  const hint = pg?.hint ?? ""
  const code = pg?.code ?? ""
  const combined = `${message} ${details} ${hint}`.toLowerCase()

  if (
    code === "42501" ||
    combined.includes("row-level security") ||
    combined.includes("violates row-level security policy")
  ) {
    return (
      "No tienes permiso para registrar este movimiento en la planta o almacén seleccionado. " +
      "Confirma que tu usuario tenga planta correcta y un rol autorizado (por ejemplo dosificador o coordinador en esa planta)."
    )
  }

  if (code === "23503" || combined.includes("foreign key constraint")) {
    return (
      "Algún dato no coincide con el catálogo (planta, almacén o producto). " +
      "Actualiza la página, vuelve a elegir unidad de negocio, planta y almacén, e intenta de nuevo."
    )
  }

  if (code === "23514" || combined.includes("check constraint")) {
    if (combined.includes("diesel_transactions_check1")) {
      const wrongFlow =
        operation === "entry"
          ? " Este mensaje no aplica a entradas de combustible; si lo ves al registrar una entrega, contacta a soporte con captura. "
          : " "
      return (
        "En consumos de equipo con horómetro, la lectura debe ser mayor o igual al último consumo " +
        "registrado en un día anterior (zona horaria de la planta)." +
        wrongFlow +
        "Si el contador se reinició o la lectura es correcta pero menor, contacta a mantenimiento."
      )
    }
    if (combined.includes("diesel_transactions_check2")) {
      return (
        "En consumos con odómetro, el kilometraje debe ser mayor o igual al último consumo " +
        "registrado en un día anterior. Si hay reinicio de odómetro o error de captura, contacta a mantenimiento."
      )
    }
  }

  if (
    code === "22P05" ||
    combined.includes("unsupported unicode escape") ||
    combined.includes("invalid unicode escape")
  ) {
    if (operation === "entry") {
      return (
        "La base de datos rechazó datos adjuntos a la evidencia (por ejemplo metadatos JSON). " +
        "Vuelve a subir las fotos; si persiste, intenta desde otro dispositivo o navegador."
      )
    }
    return (
      "Los metadatos de la foto (EXIF/XMP) contienen caracteres que la base de datos no admite. " +
      "Vuelve a tomar la foto o prueba con otra cámara; si sigue fallando, registra el consumo " +
      "sin foto de display o sin metadatos."
    )
  }

  return message || "Error desconocido"
}

/** True when Postgres rejected JSON/JSONB for invalid Unicode escapes (common with EXIF/XMP blobs). */
export function isPostgresUnicodeJsonError(error: unknown): boolean {
  const pg = asPostgrestLike(error)
  const combined = `${pg?.message ?? ""} ${pg?.details ?? ""} ${pg?.hint ?? ""}`.toLowerCase()
  const code = pg?.code ?? ""
  return (
    code === "22P05" ||
    combined.includes("unsupported unicode escape") ||
    combined.includes("invalid unicode escape")
  )
}
