'use client'

import { useState, useEffect } from 'react'
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
  XCircle,
  Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Label } from '@/components/ui/label'

type AdjustmentUpdate = {
  adjustmentId: string
  adjustment: {
    id: string
    amount: number
    category: string
    description: string | null
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
  }>
  totalVolumeDiff: number
  totalAmountDiff: number
}

type DistributedBatchViewProps = {
  month: string // YYYY-MM format
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

const formatNumber = (num: number, decimals: number = 2) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num)

export function DistributedBatchView({ month }: DistributedBatchViewProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsUpdate, setNeedsUpdate] = useState<AdjustmentUpdate[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadUpdates()
  }, [month])

  const loadUpdates = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/reports/gerencial/manual-costs/check-updates?month=${month}`)
      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Failed to check updates')
      }

      setNeedsUpdate(data.needsUpdate || [])
      // Auto-select all by default
      setSelectedIds(new Set(data.needsUpdate?.map((u: AdjustmentUpdate) => u.adjustmentId) || []))
    } catch (err: any) {
      setError(err.message || 'Error al cargar actualizaciones')
      toast({
        title: 'Error',
        description: err.message || 'Failed to load updates',
        variant: 'destructive'
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
        variant: 'destructive'
      })
      return
    }

    if (!confirm(`¿Estás seguro de actualizar ${selectedIds.size} ajuste(s)? Los volúmenes y montos se recalcularán automáticamente.`)) {
      return
    }

    setUpdating(true)
    try {
      const resp = await fetch('/api/reports/gerencial/manual-costs/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustmentIds: Array.from(selectedIds),
          month
        })
      })

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Failed to update')
      }

      const { summary } = data
      
      toast({
        title: 'Actualización completada',
        description: `${summary.successful} actualizado(s) exitosamente${summary.failed > 0 ? `, ${summary.failed} fallido(s)` : ''}`,
        variant: summary.failed > 0 ? 'destructive' : 'default'
      })

      // Reload updates
      await loadUpdates()
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update adjustments',
        variant: 'destructive'
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
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Todo está actualizado</p>
            <p className="text-sm text-muted-foreground">
              No hay ajustes distribuidos que requieran actualización de volúmenes para este mes.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const allSelected = selectedIds.size === needsUpdate.length && needsUpdate.length > 0
  const someSelected = selectedIds.size > 0 && selectedIds.size < needsUpdate.length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Actualizaciones de Distribución por Volumen</CardTitle>
              <CardDescription>
                {needsUpdate.length} ajuste(s) distribuido(s) requieren actualización debido a cambios en volúmenes
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadUpdates}
                disabled={loading || updating}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar Lista
              </Button>
              <Button
                onClick={handleBatchUpdate}
                disabled={updating || selectedIds.size === 0}
              >
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  ref={(el) => {
                    if (el) {
                      (el as any).indeterminate = someSelected
                    }
                  }}
                />
                <Label className="font-medium cursor-pointer">
                  Seleccionar todos ({selectedIds.size} de {needsUpdate.length})
                </Label>
              </div>
            </div>

            {/* Adjustments Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto Total</TableHead>
                    <TableHead className="text-right">Cambio Volumen</TableHead>
                    <TableHead className="text-right">Cambio Monto</TableHead>
                    <TableHead>Plantas Afectadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {needsUpdate.map((update) => {
                    const isSelected = selectedIds.has(update.adjustmentId)
                    const hasPositiveChange = update.totalAmountDiff > 0
                    const hasNegativeChange = update.totalAmountDiff < 0

                    return (
                      <TableRow
                        key={update.adjustmentId}
                        className={isSelected ? 'bg-muted/50' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleSelectOne(update.adjustmentId, checked === true)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={update.adjustment.category === 'nomina' ? 'default' : 'secondary'}>
                            {update.adjustment.category === 'nomina' ? 'Nómina' : 'Otros Indirectos'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {update.adjustment.description || '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(update.adjustment.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {update.totalVolumeDiff > 0 ? (
                              <ArrowUp className="w-4 h-4 text-green-600" />
                            ) : update.totalVolumeDiff < 0 ? (
                              <ArrowDown className="w-4 h-4 text-red-600" />
                            ) : null}
                            <span className={update.totalVolumeDiff > 0 ? 'text-green-600' : update.totalVolumeDiff < 0 ? 'text-red-600' : ''}>
                              {update.totalVolumeDiff > 0 ? '+' : ''}{formatNumber(update.totalVolumeDiff, 2)} m³
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {hasPositiveChange ? (
                              <ArrowUp className="w-4 h-4 text-green-600" />
                            ) : hasNegativeChange ? (
                              <ArrowDown className="w-4 h-4 text-red-600" />
                            ) : null}
                            <span className={hasPositiveChange ? 'text-green-600' : hasNegativeChange ? 'text-red-600' : ''}>
                              {hasPositiveChange ? '+' : ''}{formatCurrency(Math.abs(update.totalAmountDiff))}
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
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Expandable details */}
            {needsUpdate.map((update) => {
              if (!selectedIds.has(update.adjustmentId)) return null

              return (
                <Card key={`details-${update.adjustmentId}`} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      Detalles: {update.adjustment.description || update.adjustmentId}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {update.changes.map((change, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{change.plantName}</span>
                            <span className="text-muted-foreground">({change.plantCode})</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Volumen</div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs">{formatNumber(change.originalVolume, 2)} m³</span>
                                <span className="text-xs">→</span>
                                <span className="font-medium">{formatNumber(change.currentVolume, 2)} m³</span>
                                {change.volumeDiff !== 0 && (
                                  <span className={`text-xs ${change.volumeDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ({change.volumeDiff > 0 ? '+' : ''}{formatNumber(change.volumeDiff, 2)})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Monto</div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs">{formatCurrency(change.originalAmount)}</span>
                                <span className="text-xs">→</span>
                                <span className="font-medium">{formatCurrency(change.newAmount)}</span>
                                {change.amountDiff !== 0 && (
                                  <span className={`text-xs ${change.amountDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ({change.amountDiff > 0 ? '+' : ''}{formatCurrency(Math.abs(change.amountDiff))})
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
        </CardContent>
      </Card>
    </div>
  )
}

