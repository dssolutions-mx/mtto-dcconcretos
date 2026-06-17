/** Normaliza RFC para comparación y almacenamiento (mayúsculas, sin espacios). */
export function normalizeSupplierRfc(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "")
}

const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

export function isValidSupplierRfc(value: string): boolean {
  const normalized = normalizeSupplierRfc(value)
  return RFC_PATTERN.test(normalized)
}
