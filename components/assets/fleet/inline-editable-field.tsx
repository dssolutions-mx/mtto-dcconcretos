'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function stripThousands(s: string) {
  return s.replace(/,/g, '').replace(/^\s+|\s+$/g, '')
}

function formatThousandsInt(n: number): string {
  if (!Number.isFinite(n)) return ''
  return Math.round(n).toLocaleString('es-MX', { maximumFractionDigits: 0 })
}

export function InlineEditableField({
  label,
  value,
  field,
  assetId,
  canEdit,
  onSaved,
  type = 'text',
  suffix,
  min,
  max,
  displayFormat,
  className,
}: {
  label: string
  value: string
  field: string
  assetId: string
  canEdit: boolean
  onSaved: () => void
  type?: 'text' | 'number' | 'textarea'
  suffix?: string
  min?: number
  max?: number
  displayFormat?: 'integer-thousands'
  className?: string
}) {
  const [v, setV] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (type === 'number' && displayFormat === 'integer-thousands') {
      if (value === '') setV('')
      else {
        const n = Number(value)
        setV(Number.isFinite(n) ? formatThousandsInt(n) : value)
      }
    } else {
      setV(value)
    }
  }, [value, type, displayFormat])

  async function save() {
    if (!canEdit) return
    const comparable =
      type === 'number' && displayFormat === 'integer-thousands' ? stripThousands(v) : v
    if (comparable === value) return

    if (type === 'number') {
      const raw = displayFormat === 'integer-thousands' ? stripThousands(v) : v
      const num = Number(raw)
      if (raw !== '' && !Number.isFinite(num)) {
        toast.error('Valor numérico inválido')
        return
      }
      if (raw !== '' && min != null && num < min) {
        toast.error(`Mínimo: ${min}`)
        return
      }
      if (raw !== '' && max != null && num > max) {
        toast.error(`Máximo: ${max}`)
        return
      }
    }

    setSaving(true)
    try {
      const patch: Record<string, unknown> = {}
      if (type === 'number') {
        const raw = displayFormat === 'integer-thousands' ? stripThousands(v) : v
        patch[field] = raw === '' ? null : Number(raw)
      } else patch[field] = v
      const res = await fetch('/api/assets/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_ids: [assetId], patch }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Error')
      }
      toast.success('Guardado')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const dirty =
    type === 'number' && displayFormat === 'integer-thousands'
      ? stripThousands(v) !== value
      : v !== value

  const onBlurFormat =
    type === 'number' && displayFormat === 'integer-thousands'
      ? () => {
          const raw = stripThousands(v)
          if (raw === '') return
          const n = Number(raw)
          if (Number.isFinite(n)) setV(formatThousandsInt(n))
        }
      : undefined

  const inputEl =
    type === 'textarea' ? (
      <Textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        disabled={!canEdit}
        className={cn('min-h-[72px] font-mono text-xs', className)}
      />
    ) : (
      <Input
        type={type === 'number' && displayFormat !== 'integer-thousands' ? 'number' : 'text'}
        inputMode={type === 'number' ? 'numeric' : undefined}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={onBlurFormat}
        disabled={!canEdit}
        className={cn('min-w-0 flex-1 font-mono text-xs', className)}
      />
    )

  return (
    <div className={cn('space-y-1', className)}>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="flex gap-2 items-start">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {type !== 'textarea' ? (
            <>
              {inputEl}
              {suffix ? (
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{suffix}</span>
              ) : null}
            </>
          ) : (
            <div className="w-full">{inputEl}</div>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          disabled={!canEdit || saving || !dirty}
          onClick={save}
        >
          Guardar
        </Button>
      </div>
    </div>
  )
}
