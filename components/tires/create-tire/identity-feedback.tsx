'use client'

import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IdentityFeedback } from '@/lib/tires/identity-feedback'

interface IdentityFieldFeedbackProps {
  feedback: IdentityFeedback
  className?: string
}

export function IdentityFieldFeedback({ feedback, className }: IdentityFieldFeedbackProps) {
  if (feedback.status === 'idle') return null

  const isChecking = feedback.status === 'checking'
  const isSuccess = feedback.status === 'available'
  const isDuplicate = feedback.status === 'duplicate'
  const isWarning = feedback.status === 'warning'
  const isError = feedback.status === 'invalid' || isDuplicate

  const Icon = isChecking
    ? Loader2
    : isSuccess
      ? CheckCircle2
      : isWarning
        ? AlertTriangle
        : XCircle

  return (
    <div
      className={cn(
        'flex items-start gap-1.5 text-xs',
        isChecking && 'text-muted-foreground',
        isSuccess && 'text-emerald-600 dark:text-emerald-400',
        isWarning && 'text-amber-600 dark:text-amber-400',
        isError && 'text-destructive',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', isChecking && 'animate-spin')} />
      <div className="space-y-0.5">
        <p>{feedback.message ?? (isChecking ? 'Verificando…' : '')}</p>
        {feedback.existing && (
          <Link
            href={feedback.existing.href}
            className="text-primary underline-offset-2 hover:underline"
          >
            Ver llanta {feedback.existing.label}
          </Link>
        )}
      </div>
    </div>
  )
}

export function identityInputInvalid(feedback: IdentityFeedback): boolean {
  return feedback.status === 'duplicate' || feedback.status === 'invalid'
}
