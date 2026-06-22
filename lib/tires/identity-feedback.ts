import type { ExistingTireMatch } from '@/lib/tires/check-tire-identity'

export type IdentityFeedbackStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'duplicate'
  | 'invalid'
  | 'warning'

export interface IdentityFeedback {
  status: IdentityFeedbackStatus
  message?: string
  existing?: ExistingTireMatch
}
