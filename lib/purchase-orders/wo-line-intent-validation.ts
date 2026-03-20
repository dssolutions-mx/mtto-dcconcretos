export type WoLineSourceIntent = 'inventory' | 'mixed' | 'purchase'

export type LineFulfill = { fulfill_from?: 'inventory' | 'purchase' | null }

function effectiveFulfill(line: LineFulfill): 'inventory' | 'purchase' {
  return line.fulfill_from === 'inventory' ? 'inventory' : 'purchase'
}

/**
 * Hard validation: global intent from the OT wizard must not contradict line-level fulfill_from.
 */
export function getIntentVersusLinesErrors(
  intent: WoLineSourceIntent | null | undefined,
  lines: LineFulfill[]
): string[] {
  if (!intent || lines.length === 0) return []

  const inv = lines.filter((l) => effectiveFulfill(l) === 'inventory').length
  const pur = lines.filter((l) => effectiveFulfill(l) === 'purchase').length

  if (intent === 'inventory' && pur > 0) {
    return [
      'Indicaste “Surtir todo desde almacén” al inicio, pero hay partidas marcadas como compra a proveedor. Ajusta el origen por línea o vuelve al paso anterior y elija Combinado o Todo por compra.',
    ]
  }

  if (intent === 'purchase' && inv > 0) {
    return [
      'Indicaste “Todo por compra” al inicio, pero hay partidas con surtido desde almacén. Ajusta el origen por línea o vuelve al paso anterior y elija Combinado o Surtir todo desde almacén.',
    ]
  }

  return []
}

/**
 * Soft hint when “Combinado” was chosen but all lines agree on one source.
 */
export function getIntentVersusLinesSoftWarning(
  intent: WoLineSourceIntent | null | undefined,
  lines: LineFulfill[]
): string | null {
  if (intent !== 'mixed' || lines.length === 0) return null

  const inv = lines.filter((l) => effectiveFulfill(l) === 'inventory').length
  const pur = lines.filter((l) => effectiveFulfill(l) === 'purchase').length

  if (inv > 0 && pur === 0) {
    return 'Elegiste “Combinado”, pero todas las partidas están en surtido desde almacén. Si es correcto, puedes continuar; si no, cambia el paso anterior a “Todo desde almacén” para mayor claridad.'
  }
  if (pur > 0 && inv === 0) {
    return 'Elegiste “Combinado”, pero todas las partidas son compra a proveedor. Si es correcto, puedes continuar; si no, cambia el paso anterior a “Todo por compra”.'
  }

  return null
}
