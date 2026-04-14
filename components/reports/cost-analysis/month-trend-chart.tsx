'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency, formatMonthLabel } from './formatters'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'

type Props = {
  data: CostAnalysisResponse
  perM3: boolean
}

export function MonthTrendChart({ data, perM3 }: Props) {
  const months = data.months
  if (months.length === 0) return null

  const chartData = months.map(m => {
    const vol = data.summary.totalVolume[m] || 0
    const nom = data.summary.nomina[m] || 0
    const otr = data.summary.otrosIndirectos[m] || 0
    const tot = data.summary.totalCostoOp[m] || 0
    const div = perM3 && vol > 0 ? vol : 1
    return {
      month: formatMonthLabel(m),
      nomina: perM3 ? nom / div : nom,
      otrosIndirectos: perM3 ? otr / div : otr,
      totalCostoOp: perM3 ? tot / div : tot,
    }
  })

  const fmt = (v: number) => formatCurrency(v)

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)} />
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Legend />
          <Line type="monotone" dataKey="nomina" name="Nómina" stroke="#b45309" strokeWidth={2} dot={false} />
          <Line
            type="monotone"
            dataKey="otrosIndirectos"
            name="Otros indirectos"
            stroke="hsl(187 85% 40%)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="totalCostoOp"
            name={perM3 ? 'Costo op. / m³' : 'Costo op. total'}
            stroke="hsl(262 83% 48%)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
