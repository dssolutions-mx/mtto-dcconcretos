'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PendientesPanel() {
  const [conflicts, setConflicts] = useState<number>(0)
  const [dq, setDq] = useState<{ missing_model: number; missing_year: number }>({
    missing_model: 0,
    missing_year: 0,
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [cRes, dRes] = await Promise.all([
          fetch('/api/assets/conflicts'),
          fetch('/api/assets/data-quality'),
        ])
        const cj = await cRes.json()
        const dj = await dRes.json()
        if (cancelled) return
        setConflicts((cj.conflicts ?? []).length)
        setDq({
          missing_model: (dj.missing_model ?? []).length,
          missing_year: (dj.missing_model_year ?? []).length,
        })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const total = conflicts + dq.missing_model + dq.missing_year

  if (total === 0) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Sin pendientes de datos detectados.
      </div>
    )
  }

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
        <AlertTriangle className="h-4 w-4" />
        Pendientes · {total}
      </div>
      <ul className="space-y-1 text-xs">
        {conflicts > 0 && (
          <li className="flex justify-between gap-2">
            <span>Conflictos detectados</span>
            <span className="font-mono">{conflicts}</span>
          </li>
        )}
        {dq.missing_model > 0 && (
          <li className="flex justify-between gap-2">
            <span>Activos sin modelo</span>
            <span className="font-mono">{dq.missing_model}</span>
          </li>
        )}
        {dq.missing_year > 0 && (
          <li className="flex justify-between gap-2">
            <span>Modelos sin año (catálogo)</span>
            <span className="font-mono">{dq.missing_year}</span>
          </li>
        )}
      </ul>
      <Button variant="outline" size="sm" className="mt-2 w-full" asChild>
        <Link href="/activos/flota">Revisar en Flota</Link>
      </Button>
    </div>
  )
}
