"use client"

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw, Clock, MapPin, DollarSign, FileText, Droplet, Package, TrendingUp, Wrench } from 'lucide-react'

type AssetBasic = { id: string, code: string, name: string, plant: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: { id: string, code: string, name: string } | null
  startDate: string
  endDate: string
}

export function AssetDrilldownDialog({ open, onOpenChange, asset, startDate, endDate }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{
    asset: AssetBasic,
    diesel: any[],
    remisionesDaily: any[],
    maintenance: { purchase_orders: any[], additional_expenses: any[] }
  } | null>(null)

  // Format a plain ISO date (YYYY-MM-DD) without timezone conversion
  const formatISODate = (isoDate: string) => {
    if (!isoDate) return ''
    const base = isoDate.split('T')[0]
    const [y, m, d] = base.split('-')
    if (!y || !m || !d) return base
    return `${d}/${m}/${y}`
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value)
  }

  // Calculate KPI metrics
  const dieselKPIs = {
    totalTransactions: data?.diesel?.length || 0,
    totalLiters: (data?.diesel || []).reduce((sum: number, t: any) => sum + Number(t.quantity_liters || 0), 0),
    avgLitersPerTransaction: 0,
    totalCost: (data?.diesel || []).reduce((sum: number, t: any) => sum + (Number(t.quantity_liters || 0) * Number(t.unit_cost || 0)), 0)
  }
  dieselKPIs.avgLitersPerTransaction = dieselKPIs.totalTransactions > 0 ? dieselKPIs.totalLiters / dieselKPIs.totalTransactions : 0

  const remisionesKPIs = {
    totalDays: data?.remisionesDaily?.length || 0,
    totalRemisiones: (data?.remisionesDaily || []).reduce((sum: number, r: any) => sum + Number(r.remisiones_count || 0), 0),
    totalM3: (data?.remisionesDaily || []).reduce((sum: number, r: any) => sum + Number(r.concrete_m3 || 0), 0),
    totalSales: (data?.remisionesDaily || []).reduce((sum: number, r: any) => sum + Number(r.subtotal_amount || 0), 0)
  }

  const maintenanceKPIs = {
    totalPOs: data?.maintenance?.purchase_orders?.length || 0,
    totalPOCost: (data?.maintenance?.purchase_orders || []).reduce((sum: number, po: any) => sum + Number(po.final_amount || 0), 0),
    totalExpenses: data?.maintenance?.additional_expenses?.length || 0,
    totalExpensesCost: (data?.maintenance?.additional_expenses || []).reduce((sum: number, ae: any) => sum + Number(ae.amount || 0), 0),
    totalCost: 0
  }
  maintenanceKPIs.totalCost = maintenanceKPIs.totalPOCost + maintenanceKPIs.totalExpensesCost

  useEffect(() => {
    const load = async () => {
      if (!open || !asset) return
      setLoading(true)
      try {
        const params = new URLSearchParams({ startDate, endDate })
        const resp = await fetch(`/api/reports/gerencial/assets/${asset.id}/breakdown?${params}`)
        const json = await resp.json()
        setData(json)
      } catch (e) {
        console.error('Asset breakdown load error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, asset, startDate, endDate])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {asset ? `${asset.name} (${asset.code})` : 'Activo'}
          </DialogTitle>
          <DialogDescription>
            Desglose detallado: diésel, remisiones (por día) y mantenimiento
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs defaultValue="diesel" className="space-y-4">
            <TabsList>
              <TabsTrigger value="diesel">Diésel</TabsTrigger>
              <TabsTrigger value="remisiones">Remisiones</TabsTrigger>
              <TabsTrigger value="maintenance">Mantenimiento</TabsTrigger>
            </TabsList>

            <TabsContent value="diesel" className="space-y-4">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Transacciones</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{dieselKPIs.totalTransactions}</div>
                      <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Total Litros</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{formatNumber(dieselKPIs.totalLiters)}</div>
                      <Droplet className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Promedio por Tx</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{formatNumber(dieselKPIs.avgLitersPerTransaction)}</div>
                      <TrendingUp className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">litros/tx</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Costo Total</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(dieselKPIs.totalCost)}</div>
                      <DollarSign className="h-8 w-8 text-amber-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Detalle de Transacciones
                    {loading && <RefreshCw className="h-4 w-4 animate-spin ml-2" />}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Litros</TableHead>
                          <TableHead>Almacén</TableHead>
                          <TableHead className="text-right">Horómetro</TableHead>
                          <TableHead className="text-right">Kilómetros</TableHead>
                          <TableHead>Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data?.diesel || []).map((t: any) => (
                          <TableRow key={t.id}>
                            <TableCell>{new Date(t.transaction_date).toLocaleString('es-MX')}</TableCell>
                            <TableCell className="text-right font-semibold text-red-600">{Number(t.quantity_liters || 0).toFixed(1)}L</TableCell>
                            <TableCell>{t.diesel_warehouses?.name || 'N/A'}</TableCell>
                            <TableCell className="text-right">
                              {t.horometer_reading ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Clock className="h-3 w-3 text-blue-500" />
                                  <span>{Number(t.horometer_reading).toFixed(0)}h</span>
                                </div>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {t.kilometer_reading ? (
                                <div className="flex items-center justify-end gap-1">
                                  <MapPin className="h-3 w-3 text-green-500" />
                                  <span>{Number(t.kilometer_reading).toFixed(0)}km</span>
                                </div>
                              ) : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{t.notes || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="remisiones" className="space-y-4">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Días Activos</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{remisionesKPIs.totalDays}</div>
                      <Clock className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Total Remisiones</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{remisionesKPIs.totalRemisiones}</div>
                      <Package className="h-8 w-8 text-purple-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Volumen Total</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{formatNumber(remisionesKPIs.totalM3)}</div>
                      <TrendingUp className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">m³</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Ventas Totales</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(remisionesKPIs.totalSales)}</div>
                      <DollarSign className="h-8 w-8 text-green-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Detalle por Día</CardTitle>
                  <CardDescription>Remisiones diarias y volumen entregado</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Día</TableHead>
                          <TableHead className="text-right">Remisiones</TableHead>
                          <TableHead className="text-right">m³ Concreto</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data?.remisionesDaily || []).map((r: any, idx: number) => (
                          <TableRow key={`${r.day}-${idx}`}>
                            <TableCell>{formatISODate(r.day)}</TableCell>
                            <TableCell className="text-right">{(r.remisiones_count || 0).toLocaleString('es-MX')}</TableCell>
                            <TableCell className="text-right">{Number(r.concrete_m3 || 0).toFixed(1)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="text-xs">
                                ${Number(r.subtotal_amount || 0).toLocaleString('es-MX')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="maintenance" className="space-y-4">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Órdenes de Compra</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{maintenanceKPIs.totalPOs}</div>
                      <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Costo OCs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(maintenanceKPIs.totalPOCost)}</div>
                      <Wrench className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Gastos Adicionales</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold">{maintenanceKPIs.totalExpenses}</div>
                      <Package className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(maintenanceKPIs.totalExpensesCost)}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Costo Total</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(maintenanceKPIs.totalCost)}</div>
                      <DollarSign className="h-8 w-8 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Órdenes de Compra</CardTitle>
                  <CardDescription>Gastos asociados a órdenes de trabajo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Orden</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(data?.maintenance.purchase_orders || []).map((po: any) => (
                            <TableRow key={po.id}>
                              <TableCell className="font-mono text-xs">
                                <a href={`/compras/${po.id}`} target="_blank" rel="noopener noreferrer" className="underline">
                                  {po.order_id}
                                </a>
                              </TableCell>
                              <TableCell>{po.supplier}</TableCell>
                              <TableCell className="text-right font-semibold">${Number(po.amount || 0).toLocaleString('es-MX')}</TableCell>
                              <TableCell>
                                <Badge variant={po.status === 'validated' ? 'default' : 'secondary'} className="text-xs">{po.status}</Badge>
                              </TableCell>
                              <TableCell>{new Date(po.created_at).toLocaleDateString('es-MX')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead colSpan={3}>Gastos Adicionales</TableHead>
                          </TableRow>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(data?.maintenance.additional_expenses || []).map((ae: any) => (
                            <TableRow key={ae.id}>
                              <TableCell className="font-mono text-xs">{ae.id}</TableCell>
                              <TableCell>{new Date(ae.created_at).toLocaleDateString('es-MX')}</TableCell>
                              <TableCell className="text-right font-semibold text-orange-600">${Number(ae.amount || 0).toLocaleString('es-MX')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}


