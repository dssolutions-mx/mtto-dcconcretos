'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatMonthLabel } from './formatters'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'

type SortKey = 'plantCode' | 'nomina' | 'otros' | 'totalOp' | 'volume' | 'costM3'

type Props = {
  data: CostAnalysisResponse
}

export function PlantComparisonTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('plantCode')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const lastMonth = data.months.length ? data.months[data.months.length - 1] : null

  const rows = useMemo(() => {
    return data.byPlant.map(p => {
      const series = data.months.map(m => ({
        m,
        t: p.totalCostoOp[m] || 0,
      }))
      const vol = lastMonth ? p.volume[lastMonth] || 0 : 0
      const tot = lastMonth ? p.totalCostoOp[lastMonth] || 0 : 0
      return {
        plantCode: p.plantCode,
        plantName: p.plantName,
        nomina: lastMonth ? p.nomina[lastMonth] || 0 : 0,
        otros: lastMonth ? p.otrosIndirectos[lastMonth] || 0 : 0,
        totalOp: tot,
        volume: vol,
        costM3: vol > 0 ? tot / vol : 0,
        sparkData: series,
      }
    })
  }, [data, lastMonth])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const copy = [...rows]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'plantCode':
          cmp = a.plantCode.localeCompare(b.plantCode, 'es')
          break
        case 'nomina':
          cmp = a.nomina - b.nomina
          break
        case 'otros':
          cmp = a.otros - b.otros
          break
        case 'totalOp':
          cmp = a.totalOp - b.totalOp
          break
        case 'volume':
          cmp = a.volume - b.volume
          break
        case 'costM3':
          cmp = a.costM3 - b.costM3
          break
      }
      return cmp * dir
    })
    return copy
  }, [rows, sortKey, sortDir])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir(k === 'plantCode' ? 'asc' : 'desc')
    }
  }

  const SortBtn = ({ k, children }: { k: SortKey; children: ReactNode }) => (
    <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 -ml-2" onClick={() => toggleSort(k)}>
      {children}
      {sortKey === k ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
    </Button>
  )

  if (!lastMonth) return null

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortBtn k="plantCode">Planta</SortBtn>
            </TableHead>
            <TableHead className="text-right">
              <SortBtn k="nomina">Nómina</SortBtn>
            </TableHead>
            <TableHead className="text-right">
              <SortBtn k="otros">Otros ind.</SortBtn>
            </TableHead>
            <TableHead className="text-right">
              <SortBtn k="totalOp">Costo op.</SortBtn>
            </TableHead>
            <TableHead className="text-right">
              <SortBtn k="volume">Volumen m³</SortBtn>
            </TableHead>
            <TableHead className="text-right">
              <SortBtn k="costM3">Costo / m³</SortBtn>
            </TableHead>
            <TableHead className="w-[100px]">Tendencia costo op.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(r => (
            <TableRow key={r.plantCode}>
              <TableCell className="font-medium">
                <div>{r.plantCode}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{r.plantName}</div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(r.nomina)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(r.otros)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(r.totalOp)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.volume.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(r.costM3)}</TableCell>
              <TableCell className="p-1">
                <div className="h-10 w-[88px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={r.sparkData}>
                      <Area type="monotone" dataKey="t" stroke="#7c3aed" fill="#c4b5fd" fillOpacity={0.35} strokeWidth={1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground p-2 border-t">
        {'Último mes en columnas:'} {formatMonthLabel(lastMonth)}
        {'. Mini gráfica: costo operativo por mes en el rango seleccionado.'}
      </p>
    </div>
  )
}
