import type { FleetConflictRow } from '@/types/fleet'

export type { FleetConflictRow }

export function conflictSeverityOrder(s: string): number {
  if (s === 'high') return 0
  if (s === 'medium') return 1
  return 2
}
