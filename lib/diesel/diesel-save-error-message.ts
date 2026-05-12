type PostgrestLike = {
  message: string
  details: string
  hint: string
  code: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function readStringField(r: Record<string, unknown>, key: string): string {
  const v = r[key]
  return typeof v === "string" ? v : ""
}

/**
 * PostgREST / Supabase errors are usually `PostgrestError` (extends Error) or a plain object.
 * Do not require `message` to be present: some paths expose `code` + `details` only.
 */
function extractPostgrestLike(error: unknown): PostgrestLike | null {
  if (!isRecord(error)) return null
  const message = readStringField(error, "message")
  const details = readStringField(error, "details")
  const hint = readStringField(error, "hint")
  const code = readStringField(error, "code")
  if (!message && !details && !hint && !code) return null
  return { message, details, hint, code }
}

function fallbackTechnicalSummary(error: unknown): string {
  if (error === undefined || error === null) {
    return "La operación falló sin mensaje del servidor. Cierra sesión, vuelve a entrar e intenta de nuevo."
  }
  if (typeof error === "string") return error
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  const pg = extractPostgrestLike(error)
  if (pg) {
    const parts = [pg.code, pg.message, pg.details, pg.hint].filter((p) => p && p.trim())
    if (parts.length) return parts.join(" — ")
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
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
  const pg = extractPostgrestLike(error)
  const message = pg?.message ?? (error instanceof Error ? error.message : "")
  const details = pg?.details ?? ""
  const hint = pg?.hint ?? ""
  const code = pg?.code ?? ""
  const combined = `${message} ${details} ${hint}`.toLowerCase()

  if (code === "PGRST116" || combined.includes("cannot coerce the result to a single json object")) {
    const zero =
      details.toLowerCase().includes("0 rows") ||
      message.toLowerCase().includes("0 rows") ||
      combined.includes("contains 0 rows")
    if (zero) {
      return (
        "El servidor no devolvió la fila creada (0 filas). Suele deberse a permisos (RLS): el consumo " +
        "pudo guardarse pero tu usuario no puede leerlo, o el insert fue bloqueado de forma silenciosa. " +
        "Actualiza la página, verifica tu rol y planta, o contacta a coordinación."
      )
    }
    return (
      "La consulta devolvió más de un resultado cuando se esperaba uno. " +
      "Contacta a soporte con la hora del intento."
    )
  }

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

  if (error instanceof TypeError && combined.includes("fetch")) {
    return "No hay conexión estable con el servidor. Revisa tu red e intenta de nuevo."
  }

  const trimmed = message.trim()
  if (trimmed) return trimmed

  const fb = fallbackTechnicalSummary(error).trim()
  if (fb && fb !== "{}") return fb

  return "Error desconocido"
}

/** True when Postgres rejected JSON/JSONB for invalid Unicode escapes (common with EXIF/XMP blobs). */
export function isPostgresUnicodeJsonError(error: unknown): boolean {
  const pg = extractPostgrestLike(error)
  const combined = `${pg?.message ?? ""} ${pg?.details ?? ""} ${pg?.hint ?? ""}`.toLowerCase()
  const code = pg?.code ?? ""
  return (
    code === "22P05" ||
    combined.includes("unsupported unicode escape") ||
    combined.includes("invalid unicode escape")
  )
}
