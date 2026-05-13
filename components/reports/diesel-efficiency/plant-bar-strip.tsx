'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { EfficiencyRow } from './types'

type Props = {
  rows: EfficiencyRow[]
  plantNames: Record<string, string>
  selectedPlant: string | null
  onSelectPlant: (plantId: string | null) => void
}

export function PlantBarStrip({ rows, plantNames, selectedPlant, onSelectPlant }: Props) {
  const byPlant: Record<string, number> = {}
  for (const r of rows) {
    const pid = r.plant_id ?? 'sin-planta'
    byPlant[pid] = (byPlant[pid] ?? 0) + (r.total_liters ?? 0)
  }

  const data = Object.entries(byPlant)
    .map(([pid, liters]) => ({
      plantId: pid,
      name: plantNames[pid] ?? pid.slice(0, 8),
      liters,
    }))
    .sort((a, b) => b.liters - a.liters)
    .slice(0, 8)

  if (data.length === 0) return null

  return (
    <div className="bg-white border border-stone-900/[0.08] rounded-lg px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-3">
        Litros por planta — clic para filtrar
      </p>
      <ResponsiveContainer width="100%" height={72}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fontSize: 11, fill: '#78716C', fontFamily: 'inherit' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v: unknown) => [
              typeof v === 'number'
                ? v.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' L'
                : '',
              'Litros',
            ]}
            contentStyle={{
              fontSize: 12,
              border: '1px solid rgba(28,25,23,0.1)',
              borderRadius: 6,
              boxShadow: 'none',
              background: '#fff',
              fontFamily: 'inherit',
            }}
            cursor={{ fill: 'rgba(28,25,23,0.03)' }}
          />
          <Bar
            dataKey="liters"
            radius={[0, 3, 3, 0]}
            cursor="pointer"
            onClick={(entry: unknown) => {
              const e = entry as { plantId?: string }
              if (e.plantId) onSelectPlant(selectedPlant === e.plantId ? null : e.plantId)
            }}
          >
            {data.map((entry) => (
              <Cell
                key={entry.plantId}
                fill={
                  selectedPlant === null || selectedPlant === entry.plantId
                    ? '#B45309'
                    : '#E7E5E4'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
