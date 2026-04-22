'use client'

import { Progress } from '@/components/ui/progress'

export function TrustMeter({ value }: { value: number | null }) {
  if (value == null) {
    return <p className="text-xs text-muted-foreground">Cargando…</p>
  }
  return (
    <div className="space-y-1 pt-1">
      <div className="flex justify-between text-xs">
        <span>Integridad / confianza</span>
        <span className="font-mono tabular-nums">{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  )
}
