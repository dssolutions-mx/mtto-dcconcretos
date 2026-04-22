'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { fleetFieldLabel } from '@/lib/fleet/field-labels'

export function HistorialTab({ assetId }: { assetId: string | null }) {
  const [rows, setRows] = useState<
    {
      id: string
      field: string
      before_value: string | null
      after_value: string | null
      created_at: string
    }[]
  >([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const q = assetId
        ? `/api/assets/audit-log?limit=40&asset_id=${encodeURIComponent(assetId)}`
        : '/api/assets/audit-log?limit=15'
      const res = await fetch(q)
      const j = await res.json()
      if (cancelled) return
      setRows(j.rows ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [assetId])

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Sin registros de auditoría recientes.</p>
    )
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded border border-border p-2 text-xs">
          <div className="flex justify-between gap-2 text-muted-foreground">
            <span>{fleetFieldLabel(r.field)}</span>
            <span>
              {format(new Date(r.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
            </span>
          </div>
          <div className="mt-1 break-all">
            <span className="text-destructive line-through">{r.before_value ?? '—'}</span>
            {' → '}
            <span className="text-foreground">{r.after_value ?? '—'}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
