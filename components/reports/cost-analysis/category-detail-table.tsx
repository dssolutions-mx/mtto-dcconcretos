'use client'

import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatMonthLabel } from './formatters'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'

type Props = {
  data: CostAnalysisResponse
  expandedCategoryId: string | null
  onExpandedCategoryId: (id: string | null) => void
}

export function CategoryDetailTable({ data, expandedCategoryId, onExpandedCategoryId }: Props) {
  if (data.byCategory.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay gastos indirectos manuales por categoría en el periodo.</p>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[280px]">Categoría</TableHead>
            {data.months.map(m => (
              <TableHead key={m} className="text-right">
                {formatMonthLabel(m)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.byCategory.map(cat => {
            const open = expandedCategoryId === cat.categoryId
            return (
              <React.Fragment key={cat.categoryId}>
                <TableRow className="bg-muted/30">
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 -ml-2"
                      onClick={() => onExpandedCategoryId(open ? null : cat.categoryId)}
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {cat.categoryName}
                    </Button>
                  </TableCell>
                  {data.months.map(m => (
                    <TableCell key={m} className="text-right tabular-nums">
                      {formatCurrency(cat.monthlyTotals[m] || 0)}
                    </TableCell>
                  ))}
                </TableRow>
                {open &&
                  cat.subcategories.map(sub => (
                    <TableRow key={`${cat.categoryId}-${sub.name}`}>
                      <TableCell className="pl-10 text-muted-foreground">{sub.name}</TableCell>
                      {data.months.map(m => (
                        <TableCell key={m} className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(sub.monthlyTotals[m] || 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
