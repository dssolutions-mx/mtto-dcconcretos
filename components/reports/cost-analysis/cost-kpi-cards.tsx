'use client'

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from './formatters'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'

type Props = {
  data: CostAnalysisResponse
  perM3: boolean
}

export function CostKpiCards({ data, perM3 }: Props) {
  const months = data.months
  if (months.length === 0) return null

  const last = months[months.length - 1]
  const prev = months.length > 1 ? months[months.length - 2] : null

  const volLast = data.summary.totalVolume[last] || 0
  const volPrev = prev ? data.summary.totalVolume[prev] || 0 : 0

  const nomina = data.summary.nomina[last] || 0
  const otros = data.summary.otrosIndirectos[last] || 0
  const totalOp = data.summary.totalCostoOp[last] || 0

  const nominaPrev = prev ? data.summary.nomina[prev] || 0 : null
  const otrosPrev = prev ? data.summary.otrosIndirectos[prev] || 0 : null
  const totalPrev = prev ? data.summary.totalCostoOp[prev] || 0 : null

  const costM3 = volLast > 0 ? totalOp / volLast : 0
  const costM3Prev = prev && volPrev > 0 ? (totalPrev ?? 0) / volPrev : null

  const deltaBlock = (current: number, previous: number | null, invertGood = true) => {
    if (previous === null) return null
    const delta = current - previous
    if (Math.abs(delta) < 0.01) {
      return <span className="text-xs text-muted-foreground">Sin cambio vs mes ant.</span>
    }
    const trend = delta > 0 ? 'up' : 'down'
    const good = invertGood ? delta < 0 : delta > 0
    return (
      <div className="mt-2 flex items-center gap-1">
        {trend === 'up' ? (
          <TrendingUp className={cn('h-3 w-3 shrink-0', good ? 'text-green-600' : 'text-amber-500')} />
        ) : (
          <TrendingDown className={cn('h-3 w-3 shrink-0', good ? 'text-green-600' : 'text-amber-500')} />
        )}
        <span
          className={cn('text-xs font-medium', good ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400')}
        >
          {delta > 0 ? '+' : '−'}
          {formatCurrency(Math.abs(delta))} vs mes ant.
        </span>
      </div>
    )
  }

  if (perM3) {
    const nU = volLast > 0 ? nomina / volLast : 0
    const oU = volLast > 0 ? otros / volLast : 0
    const nUP = prev && volPrev > 0 ? (nominaPrev ?? 0) / volPrev : null
    const oUP = prev && volPrev > 0 ? (otrosPrev ?? 0) / volPrev : null

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Nómina / m³</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(nU)}</p>
            {deltaBlock(nU, nUP)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Otros indirectos / m³</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(oU)}</p>
            {deltaBlock(oU, oUP)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Costo operativo / m³</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(costM3)}</p>
            {deltaBlock(costM3, costM3Prev)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Volumen concreto (m³)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {volLast.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
            </p>
            {prev !== null &&
              deltaBlock(volLast, volPrev, false) /* más volumen suele ser neutral/positivo para coste unitario */ }
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Nómina total</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(nomina)}</p>
          {deltaBlock(nomina, nominaPrev)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Otros indirectos</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(otros)}</p>
          {deltaBlock(otros, otrosPrev)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Costo operativo total</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalOp)}</p>
          {deltaBlock(totalOp, totalPrev)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Costo operativo / m³</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(costM3)}</p>
          {deltaBlock(costM3, costM3Prev)}
        </CardContent>
      </Card>
    </div>
  )
}
