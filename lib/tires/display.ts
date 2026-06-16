import type { Tire } from '@/types/tires'

/** True when serial looks like a real DOT / sidewall code (not a placeholder). */
export function isMeaningfulDot(serial: string | null | undefined): boolean {
  if (!serial?.trim()) return false
  const s = serial.trim()
  if (s.length < 4) return false
  if (/^(.)\1+$/i.test(s)) return false
  return true
}

/** Primary fleet identifier shown in lists and detail sheets. */
export function formatTirePrimaryId(tire: Pick<Tire, 'internal_code' | 'serial_number' | 'brand' | 'size'>): string {
  if (tire.internal_code?.trim()) return tire.internal_code.trim()
  if (isMeaningfulDot(tire.serial_number)) return tire.serial_number!.trim()
  return `${tire.brand} ${tire.size}`.trim()
}

/** Secondary line (DOT) when it adds information beyond the primary ID. */
export function formatTireSecondaryDot(
  tire: Pick<Tire, 'internal_code' | 'serial_number'>
): string | null {
  if (!isMeaningfulDot(tire.serial_number)) return null
  const dot = tire.serial_number!.trim()
  if (tire.internal_code?.trim() && dot.toUpperCase() === tire.internal_code.trim().toUpperCase()) {
    return null
  }
  return dot
}

/** Dropdown / select label: ID · marca medida · DOT opcional. */
export function formatTireSelectOption(
  tire: Pick<Tire, 'internal_code' | 'serial_number' | 'brand' | 'size' | 'model'>
): string {
  const id = formatTirePrimaryId(tire)
  const spec = [tire.brand, tire.size].filter(Boolean).join(' ')
  const dot = formatTireSecondaryDot(tire)
  const parts = [id]
  if (spec && spec !== id) parts.push(spec)
  if (dot) parts.push(`DOT ${dot}`)
  return parts.join(' · ')
}
