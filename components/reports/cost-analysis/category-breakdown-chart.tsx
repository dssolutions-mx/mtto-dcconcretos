'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency, formatMonthLabel } from './formatters'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'

const PALETTE = [
  'hsl(220 70% 50%)',
  'hsl(142 70% 40%)',
  'hsl(38 92% 50%)',
  'hsl(340 75% 55%)',
  'hsl(187 85% 40%)',
  'hsl(262 83% 48%)',
  'hsl(24 95% 53%)',
  'hsl(280 65% 50%)',
  'hsl(160 60% 40%)',
  'hsl(200 80% 45%)',
  'hsl(48 96% 53%)',
  'hsl(320 70% 50%)',
  'hsl(174 72% 40%)',
  'hsl(12 76% 55%)',
]

type Props = {
  data: CostAnalysisResponse
  onCategoryClick?: (categoryId: string) => void
}

export function CategoryBreakdownChart({ data, onCategoryClick }: Props) {
  const { chartData, categoryIds } = useMemo(() => {
    const ids = data.byCategory.map(c => c.categoryId)
    const rows = data.months.map(m => {
      const row: Record<string, string | number> = { month: formatMonthLabel(m) }
      data.byCategory.forEach(c => {
        row[c.categoryId] = c.monthlyTotals[m] || 0
      })
      return row
    })
    return { chartData: rows, categoryIds: ids }
  }, [data])

  if (chartData.length === 0) return null

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {categoryIds.map((id, i) => {
            const meta = data.byCategory.find(c => c.categoryId === id)
            return (
              <Bar
                key={id}
                dataKey={id}
                name={meta?.categoryName || id}
                stackId="a"
                fill={PALETTE[i % PALETTE.length]}
                onClick={() => onCategoryClick?.(id)}
                cursor={onCategoryClick ? 'pointer' : 'default'}
              />
            )
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
