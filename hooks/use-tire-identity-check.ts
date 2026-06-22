'use client'

import { useEffect, useState } from 'react'
import { normalizeDotSerial } from '@/lib/tires/normalize-identity'
import { validateDotFormat } from '@/lib/tires/dot-validation'
import type { ExistingTireMatch } from '@/lib/tires/check-tire-identity'
import type { IdentityFeedback } from '@/lib/tires/identity-feedback'

const DEBOUNCE_MS = 400
const IDLE: IdentityFeedback = { status: 'idle' }

async function fetchIdentityCheck(params: {
  dot?: string
  internal_code?: string
  signal: AbortSignal
}): Promise<{ dot?: IdentityFeedback; internal_code?: IdentityFeedback }> {
  const search = new URLSearchParams()
  if (params.dot) search.set('dot', params.dot)
  if (params.internal_code) search.set('internal_code', params.internal_code)

  const res = await fetch(`/api/tires/check-identity?${search.toString()}`, {
    signal: params.signal,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'No se pudo verificar identidad')

  const mapField = (
    field: { state: string; message?: string; existing?: ExistingTireMatch } | null | undefined
  ): IdentityFeedback | undefined => {
    if (!field) return undefined
    if (field.state === 'duplicate') {
      return {
        status: 'duplicate',
        message: field.message,
        existing: field.existing,
      }
    }
    if (field.state === 'available') {
      return { status: 'available', message: field.message }
    }
    return IDLE
  }

  return {
    dot: mapField(data.dot),
    internal_code: mapField(data.internal_code),
  }
}

export function useTireIdentityCheck(options: {
  dot: string
  internalCode: string
  checkDot: boolean
  checkInternalCode: boolean
  enabled?: boolean
}) {
  const { dot, internalCode, checkDot, checkInternalCode, enabled = true } = options
  const [dotFeedback, setDotFeedback] = useState<IdentityFeedback>(IDLE)
  const [internalFeedback, setInternalFeedback] = useState<IdentityFeedback>(IDLE)

  useEffect(() => {
    if (!enabled) {
      setDotFeedback(IDLE)
      setInternalFeedback(IDLE)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const dotValue = dot.trim()
      const internalValue = internalCode.trim()

      let dotForApi: string | undefined
      if (checkDot && dotValue) {
        const format = validateDotFormat(dotValue)
        if (!format.valid) {
          setDotFeedback({
            status: format.severity === 'warning' ? 'warning' : 'invalid',
            message: format.message,
          })
        } else {
          dotForApi = normalizeDotSerial(dotValue)
        }
      } else {
        setDotFeedback(IDLE)
      }

      const internalForApi =
        checkInternalCode && internalValue ? internalValue.trim().toUpperCase() : undefined

      if (!internalForApi) {
        setInternalFeedback(IDLE)
      }

      if (!dotForApi && !internalForApi) {
        return
      }

      if (dotForApi) setDotFeedback({ status: 'checking' })
      if (internalForApi) setInternalFeedback({ status: 'checking' })

      try {
        const result = await fetchIdentityCheck({
          dot: dotForApi,
          internal_code: internalForApi,
          signal: controller.signal,
        })

        if (dotForApi) {
          setDotFeedback(result.dot ?? IDLE)
        }
        if (internalForApi) {
          setInternalFeedback(result.internal_code ?? IDLE)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        const message =
          error instanceof Error ? error.message : 'No se pudo verificar identidad'
        if (dotForApi) setDotFeedback({ status: 'invalid', message })
        if (internalForApi) setInternalFeedback({ status: 'invalid', message })
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [dot, internalCode, checkDot, checkInternalCode, enabled])

  return { dotFeedback, internalFeedback }
}
