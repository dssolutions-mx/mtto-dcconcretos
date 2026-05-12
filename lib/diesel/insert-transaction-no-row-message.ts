/**
 * When INSERT succeeds but PostgREST returns no row in the response body (e.g. SELECT/RETURNING
 * hidden by RLS), `.single()` used to surface PGRST116 while the row was already committed.
 * Users retried and created duplicates. With `.maybeSingle()` we get `data: null` and must not retry blindly.
 */
export function dieselInsertReturnedNoRowDescription(productType: 'diesel' | 'urea'): string {
  const productLabel = productType === 'urea' ? 'urea' : 'diésel'
  return (
    `El servidor no devolvió la fila del movimiento de ${productLabel} (suele deberse a permisos de lectura). ` +
    `El movimiento puede haberse guardado. Abre Historial, confirma la última línea antes de intentar de nuevo, ` +
    `para no duplicar el registro.`
  )
}
