'use client'

import type { BonusPaySheetRow, BonusTrafficLight } from '@/types/bonus-decision-hub'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function TrafficLightBadge({ light }: { light: BonusTrafficLight }) {
  const config: Record<
    BonusTrafficLight,
    { label: string; className: string }
  > = {
    green: { label: 'Verde', className: 'bg-green-100 text-green-800 border-green-200' },
    yellow: { label: 'Amarillo', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    red: { label: 'Rojo', className: 'bg-red-100 text-red-800 border-red-200' },
    gray: { label: 'Sin datos', className: 'bg-muted text-muted-foreground' },
  }

  const { label, className } = config[light]
  return (
    <Badge variant="outline" className={cn('gap-1.5', className)}>
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          light === 'green' && 'bg-green-600',
          light === 'yellow' && 'bg-yellow-500',
          light === 'red' && 'bg-red-600',
          light === 'gray' && 'bg-muted-foreground/50'
        )}
        aria-hidden
      />
      {label}
    </Badge>
  )
}

export function RecommendationBadge({
  recommendation,
}: {
  recommendation: BonusPaySheetRow['system_recommendation']
}) {
  if (recommendation === 'eligible') {
    return <Badge className="bg-green-100 text-green-800">Apto</Badge>
  }
  if (recommendation === 'ineligible') {
    return <Badge variant="destructive">No apto</Badge>
  }
  return <Badge variant="secondary">Pendiente</Badge>
}

export function ClosureBadge({ value }: { value: boolean | null }) {
  if (value === true) return <Badge className="bg-green-100 text-green-800">Sí</Badge>
  if (value === false) return <Badge variant="destructive">No</Badge>
  return <Badge variant="outline">Pendiente</Badge>
}

export function formatPct(value: number | null): string {
  if (value == null) return '—'
  return `${value}%`
}

export const MONTH_OPTIONS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]
