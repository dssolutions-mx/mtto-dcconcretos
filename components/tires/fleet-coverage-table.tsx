'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import {
  COVERAGE_STATUS_LABELS,
  type AssetCoverageRow,
  type AssetCoverageStatus,
} from '@/lib/tires/coverage'

const STATUS_VARIANT: Record<AssetCoverageStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ok: 'default',
  partial: 'outline',
  'no-layout': 'secondary',
  'no-model': 'destructive',
}

export function FleetCoverageTable() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<AssetCoverageRow[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/tires/coverage?${params}`)
      const data = await res.json()
      if (res.ok) setRows(data.coverage ?? [])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Estado de layout y montaje por activo
        </p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="no-layout">Sin layout</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="ok">Completo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activo</TableHead>
                <TableHead>Layout</TableHead>
                <TableHead>Montadas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No hay activos que coincidan con el filtro.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.asset_id}>
                    <TableCell>
                      <div className="font-medium">{row.asset_name}</div>
                      {row.model_name && (
                        <div className="text-xs text-muted-foreground">{row.model_name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.has_layout ? (
                        <span className="text-sm">✓ {row.total_positions} pos.</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">✗</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.has_layout
                        ? `${row.mounted_count}/${row.total_positions}`
                        : row.mounted_count > 0
                          ? `${row.mounted_count} mont.`
                          : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>
                        {COVERAGE_STATUS_LABELS[row.status]}
                      </Badge>
                      {row.orphaned_positions.length > 0 && (
                        <span className="ml-1 text-xs text-amber-600">⚠</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === 'no-layout' && row.model_id ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/modelos/${row.model_id}?tab=tires`}>
                            Asignar layout
                          </Link>
                        </Button>
                      ) : row.status === 'partial' ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/activos/${row.asset_id}/llantas`}>Completar</Link>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/activos/${row.asset_id}/llantas`}>Ver</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
