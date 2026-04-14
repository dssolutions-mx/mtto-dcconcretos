'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertCircle,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Label } from '@/components/ui/label'
import { getExpenseCategoryById, getExpenseCategoryDisplayName } from '@/lib/constants/expense-categories'

export type AdjustmentUpdate = {
  adjustmentId: string
  neverSynced: boolean
  adjustment: {
    id: string
    amount: number
    category: string
    description: string | null
    department: string | null
    expense_category: string | null
    expense_subcategory: string | null
    period_month: string
  }
  changes: Array<{
    plantId: string
    plantCode: string
    plantName: string
    originalVolume: number
    currentVolume: number
    volumeDiff: number
    originalAmount: number
    newAmount: number
    amountDiff: number
    neverSyncedRow?: boolean
  }>
  totalVolumeDiff: number
  totalAmountDiff: number
}

type DistributedBatchViewProps = {
  month: string
  /** Omit outer Card wrapper (e.g. inside Sheet on ingresos-gastos) */
  embedded?: boolean
  /** After successful batch-update */
  onBatchSuccess?: () => void
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

const formatNumber = (num: number, decimals: number = 2) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num)

function expenseCategoryLabel(expenseCategory: string | null): string | null {
  if (!expenseCategory) return null
  const cat = getExpenseCategoryById(expenseCategory)
  return cat ? getExpenseCategoryDisplayName(cat) : expenseCategory
}

function identificationLine(update: AdjustmentUpdate): string {
  const parts: string[] = []
  if (update.adjustment.category === 'nomina' && update.adjustment.department) {
    parts.push(update.adjustment.department)
  }
  if (update.adjustment.category === 'otros_indirectos') {
    const ec = expenseCategoryLabel(update.adjustment.expense_category)
    if (ec) parts.push(ec)
    if (update.adjustment.expense_subcategory) parts.push(update.adjustment.expense_subcategory)
  }
  if (update.adjustment.description) parts.push(update.adjustment.description)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function DistributedBatchView({
  month,
  embedded = false,
  onBatchSuccess,
}: DistributedBatchViewProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsUpdate, setNeedsUpdate] = useState<AdjustmentUpdate[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadUpdates()
  }, [month])

  const grouped = useMemo(() => {
    const nomina = needsUpdate.filter(u => u.adjustment.category === 'nomina')
    const otros = needsUpdate.filter(u => u.adjustment.category === 'otros_indirectos')
    return { nomina, otros }
  }, [needsUpdate])

  const loadUpdates = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/reports/gerencial/manual-costs/check-updates?month=${month}`)
      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Failed to check updates')
      }

      const list = (data.needsUpdate || []) as AdjustmentUpdate[]
      setNeedsUpdate(list)
      setSelectedIds(new Set(list.map(u => u.adjustmentId)))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar actualizaciones'
      setError(message)
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(needsUpdate.map(u => u.adjustmentId)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const handleBatchUpdate = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: 'Selección requerida',
        description: 'Por favor selecciona al menos un ajuste para actualizar',
        variant: 'destructive',
      })
      return
    }

    if (
      !confirm(
        `¿Estás seguro de actualizar ${selectedIds.size} ajuste(s)? Los volúmenes y montos se recalcularán automáticamente.`
      )
    ) {
      return
    }

    setUpdating(true)
    try {
      const resp = await fetch('/api/reports/gerencial/manual-costs/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustmentIds: Array.from(selectedIds),
          month,
        }),
      })

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Failed to update')
      }

      const { summary } = data

      toast({
        title: 'Actualización completada',
        description: `${summary.successful} actualizado(s) exitosamente${summary.failed > 0 ? `, ${summary.failed} fallido(s)` : ''}`,
        variant: summary.failed > 0 ? 'destructive' : 'default',
      })

      await loadUpdates()
      onBatchSuccess?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update adjustments'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (needsUpdate.length === 0) {
    const empty = (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <p className="text-lg font-medium mb-2">Todo está actualizado</p>
        <p className="text-sm text-muted-foreground">
          No hay ajustes distribuidos por volumen que requieran sincronización para este mes.
        </p>
      </div>
    )
    if (embedded) {
      return <div className="py-4">{empty}</div>
    }
    return (
      <Card>
        <CardContent className="pt-6">{empty}</CardContent>
      </Card>
    )
  }

  const allSelected = selectedIds.size === needsUpdate.length && needsUpdate.length > 0
  const someSelected = selectedIds.size > 0 && selectedIds.size < needsUpdate.length

  const renderRow = (update: AdjustmentUpdate) => {
    const isSelected = selectedIds.has(update.adjustmentId)
    const hasPositiveChange = update.totalAmountDiff > 0
    const hasNegativeChange = update.totalAmountDiff < 0

    return (
      <TableRow key={update.adjustmentId} className={isSelected ? 'bg-muted/50' : ''}>
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={checked => handleSelectOne(update.adjustmentId, checked === true)}
          />
        </TableCell>
        <TableCell>
          {update.neverSynced ? (
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
              Nunca sincronizado
            </Badge>
          ) : (
            <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400">
              Volumen desactualizado
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={update.adjustment.category === 'nomina' ? 'default' : 'secondary'}>
            {update.adjustment.category === 'nomina' ? 'Nómina' : 'Otros indirectos'}
          </Badge>
        </TableCell>
        <TableCell className="max-w-[200px]">
          <div className="text-sm font-medium truncate" title={identificationLine(update)}>
            {identificationLine(update)}
          </div>
          {update.adjustment.category === 'nomina' && update.adjustment.department && (
            <div className="text-xs text-muted-foreground">Depto: {update.adjustment.department}</div>
          )}
        </TableCell>
        <TableCell className="max-w-[140px] truncate text-sm text-muted-foreground">
          {update.adjustment.description || '—'}
        </TableCell>
        <TableCell className="text-right font-medium">{formatCurrency(update.adjustment.amount)}</TableCell>
        <TableCell className="text-right">
          {update.neverSynced ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-amber-700 dark:text-amber-400">Sin volumen registrado</span>
              <span className="text-xs text-muted-foreground">
                → {formatNumber(update.totalVolumeDiff, 2)} m³ (actual)
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              {update.totalVolumeDiff > 0 ? (
                <ArrowUp className="w-4 h-4 text-green-600" />
              ) : update.totalVolumeDiff < 0 ? (
                <ArrowDown className="w-4 h-4 text-red-600" />
              ) : null}
              <span
                className={
                  update.totalVolumeDiff > 0
                    ? 'text-green-600'
                    : update.totalVolumeDiff < 0
                      ? 'text-red-600'
                      : ''
                }
              >
                {update.totalVolumeDiff > 0 ? '+' : ''}
                {formatNumber(update.totalVolumeDiff, 2)} m³
              </span>
            </div>
          )}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            {hasPositiveChange ? (
              <ArrowUp className="w-4 h-4 text-green-600" />
            ) : hasNegativeChange ? (
              <ArrowDown className="w-4 h-4 text-red-600" />
            ) : null}
            <span
              className={
                hasPositiveChange ? 'text-green-600' : hasNegativeChange ? 'text-red-600' : ''
              }
            >
              {hasPositiveChange ? '+' : ''}
              {formatCurrency(Math.abs(update.totalAmountDiff))}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {update.changes.slice(0, 3).map((change, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {change.plantCode}
              </Badge>
            ))}
            {update.changes.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{update.changes.length - 3} más
              </Badge>
            )}
          </div>
        </TableCell>
      </TableRow>
    )
  }

  const sectionHeader = (title: string, rows: AdjustmentUpdate[]) => {
    if (rows.length === 0) return null
    const subtotal = rows.reduce((s, u) => s + Number(u.adjustment.amount || 0), 0)
    return (
      <TableRow className="bg-muted/80 hover:bg-muted/80">
        <TableCell colSpan={9} className="font-semibold text-sm py-2">
          {title}{' '}
          <span className="text-muted-foreground font-normal">
            ({rows.length}) — subtotal {formatCurrency(subtotal)}
          </span>
        </TableCell>
      </TableRow>
    )
  }

  const toolbar = (
    <div className="flex items-center justify-end gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={loadUpdates} disabled={loading || updating}>
        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Actualizar Lista
      </Button>
      <Button onClick={handleBatchUpdate} disabled={updating || selectedIds.size === 0}>
        {updating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Actualizando...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Actualizar Seleccionados ({selectedIds.size})
          </>
        )}
      </Button>
    </div>
  )

  const body = (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            ref={el => {
              if (el) {
                ;(el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = someSelected
              }
            }}
          />
          <Label className="font-medium cursor-pointer">
            Seleccionar todos ({selectedIds.size} de {needsUpdate.length})
          </Label>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Estado</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Identificación</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Monto total</TableHead>
              <TableHead className="text-right">Volumen</TableHead>
              <TableHead className="text-right">Δ Monto</TableHead>
              <TableHead>Plantas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectionHeader('Nómina', grouped.nomina)}
            {grouped.nomina.map(renderRow)}
            {sectionHeader('Otros indirectos', grouped.otros)}
            {grouped.otros.map(renderRow)}
          </TableBody>
        </Table>
      </div>

      {needsUpdate.map(update => {
        if (!selectedIds.has(update.adjustmentId)) return null
        const titleParts = [
          identificationLine(update),
          update.adjustment.description,
        ].filter(Boolean)
        return (
          <Card key={`details-${update.adjustmentId}`} className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                Detalle: {titleParts.length ? titleParts.join(' — ') : update.adjustmentId}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {update.changes.map((change, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 bg-muted/30 rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{change.plantName}</span>
                      <span className="text-muted-foreground">({change.plantCode})</span>
                      {change.neverSyncedRow && (
                        <Badge variant="outline" className="text-xs">
                          Sin volumen guardado
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Volumen</div>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          <span className="text-xs">
                            {change.neverSyncedRow ? '—' : `${formatNumber(change.originalVolume, 2)} m³`}
                          </span>
                          <span className="text-xs">→</span>
                          <span className="font-medium">{formatNumber(change.currentVolume, 2)} m³</span>
                          {!change.neverSyncedRow && change.volumeDiff !== 0 && (
                            <span
                              className={`text-xs ${change.volumeDiff > 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                              ({change.volumeDiff > 0 ? '+' : ''}
                              {formatNumber(change.volumeDiff, 2)})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Monto</div>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          <span className="text-xs">{formatCurrency(change.originalAmount)}</span>
                          <span className="text-xs">→</span>
                          <span className="font-medium">{formatCurrency(change.newAmount)}</span>
                          {change.amountDiff !== 0 && (
                            <span
                              className={`text-xs ${change.amountDiff > 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                              ({change.amountDiff > 0 ? '+' : ''}
                              {formatCurrency(Math.abs(change.amountDiff))})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  if (embedded) {
    return (
      <div className="space-y-4">
        {toolbar}
        {body}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Actualizaciones de Distribución por Volumen</CardTitle>
            <CardDescription>
              {needsUpdate.length} ajuste(s) distribuido(s) requieren sincronización de volúmenes
            </CardDescription>
          </div>
          {toolbar}
        </div>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
