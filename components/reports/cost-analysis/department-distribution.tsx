'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Legend,
} from 'recharts'
import { formatCurrency, formatMonthLabel } from './formatters'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'

type Props = {
  data: CostAnalysisResponse
}

export function DepartmentDistribution({ data }: Props) {
  const months = data.months
  const lastMonth = months.length ? months[months.length - 1] : null

  const nominaBars = useMemo(() => {
    if (!lastMonth) return []
    const rows = data.byDepartment
      .filter(d => d.type === 'nomina')
      .map(d => ({
        name: d.department.length > 40 ? d.department.slice(0, 37) + '…' : d.department,
        fullName: d.department,
        total: d.monthlyTotals[lastMonth] || 0,
      }))
      .filter(r => r.total !== 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
    return rows
  }, [data.byDepartment, lastMonth])

  const nominaTrend = useMemo(() => {
    const depts = data.byDepartment.filter(d => d.type === 'nomina').slice(0, 6)
    return months.map(m => {
      const row: Record<string, string | number> = { month: formatMonthLabel(m) }
      depts.forEach(d => {
        const short = d.department.length > 14 ? d.department.slice(0, 12) + '…' : d.department
        row[short] = d.monthlyTotals[m] || 0
      })
      return row
    })
  }, [data.byDepartment, months])

  const lineKeys =
    data.byDepartment
      .filter(d => d.type === 'nomina')
      .slice(0, 6)
      .map(d => (d.department.length > 14 ? d.department.slice(0, 12) + '…' : d.department)) ?? []

  if (!lastMonth) return null

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Nómina por departamento ({formatMonthLabel(lastMonth)})</h3>
        {nominaBars.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos de nómina por departamento.</p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nominaBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickFormatter={v => formatCurrency(Number(v))} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(_, p: any) => p?.payload?.fullName || ''} />
                <Bar dataKey="total" name="Nómina" fill="hsl(35 90% 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Evolución nómina (top departamentos)</h3>
        {lineKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin series.</p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={nominaTrend} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (Number(v) >= 1e6 ? `${(Number(v) / 1e6).toFixed(1)}M` : `${Math.round(Number(v) / 1000)}k`)} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {lineKeys.map((k, i) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={['#b45309', '#0d9488', '#7c3aed', '#db2777', '#2563eb', '#ca8a04'][i % 6]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
