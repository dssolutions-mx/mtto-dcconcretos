'use client'

import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'

type Props = {
  data: number[]
  stroke?: string
  fill?: string
  height?: number
  width?: number | string
}

/**
 * Minimalist sparkline — 88×40 by default. No axes, no grid, no tooltip.
 * Used inside KPI tiles and the plant matrix.
 */
export function Sparkline({ data, stroke = 'hsl(var(--primary))', fill, height = 36, width = '100%' }: Props) {
  const rows = data.map((value, i) => ({ i, value }))
  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 9)}`
  const actualFill = fill || stroke

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={actualFill} stopOpacity={0.35} />
              <stop offset="100%" stopColor={actualFill} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
