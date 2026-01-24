"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, TrendingDown, Package, DollarSign, Clock, Download } from "lucide-react"
import Link from "next/link"

interface LowStockAlert {
  stock_id: string
  part_id: string
  part_number: string
  part_name: string
  category: string
  warehouse_id: string
  warehouse_name: string
  warehouse_code: string
  plant_id: string
  plant_name: string
  current_quantity: number
  reserved_quantity: number
  available_quantity: number
  reorder_point: number
  min_stock_level: number
  average_unit_cost: number
  stock_status: string
}

interface StaleReservation {
  work_order_id: string
  work_order_number: string
  work_order_status: string
  work_order_description: string
  movement_id: string
  reserved_quantity: number
  reserved_since: string
  days_reserved: number
  part_number: string
  part_name: string
  warehouse_name: string
  plant_name: string
  requested_by: string
}

interface ValuationSummary {
  warehouse_id: string
  warehouse_name: string
  plant_name: string
  total_parts: number
  total_units: number
  total_value: number
  total_reserved_units: number
  reserved_value: number
}

export function InventoryReports() {
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])
  const [staleReservations, setStaleReservations] = useState<StaleReservation[]>([])
  const [valuation, setValuation] = useState<ValuationSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      
      // Fetch all reports in parallel
      const [lowStockRes, staleRes, valuationRes] = await Promise.all([
        fetch('/api/inventory/reports/low-stock'),
        fetch('/api/inventory/reports/stale-reservations'),
        fetch('/api/inventory/reports/valuation')
      ])

      const [lowStockData, staleData, valuationData] = await Promise.all([
        lowStockRes.json(),
        staleRes.json(),
        valuationRes.json()
      ])

      if (lowStockData.success) setLowStockAlerts(lowStockData.data || [])
      if (staleData.success) setStaleReservations(staleData.data || [])
      if (valuationData.success) setValuation(valuationData.data || [])
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'out_of_stock':
        return <Badge variant="destructive">Sin Stock</Badge>
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>
      case 'low':
        return <Badge variant="secondary">Bajo</Badge>
      default:
        return <Badge variant="default">OK</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando reportes...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs defaultValue="low-stock" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="low-stock">
          <AlertCircle className="mr-2 h-4 w-4" />
          Stock Bajo ({lowStockAlerts.length})
        </TabsTrigger>
        <TabsTrigger value="stale-reservations">
          <Clock className="mr-2 h-4 w-4" />
          Reservas Antiguas ({staleReservations.length})
        </TabsTrigger>
        <TabsTrigger value="valuation">
          <DollarSign className="mr-2 h-4 w-4" />
          Valuación
        </TabsTrigger>
      </TabsList>

      {/* Low Stock Alerts */}
      <TabsContent value="low-stock">
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Stock Bajo</CardTitle>
            <CardDescription>
              Partes por debajo del punto de reorden o sin stock
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lowStockAlerts.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay alertas de stock bajo</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número de Parte</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Almacén</TableHead>
                      <TableHead>Disponible</TableHead>
                      <TableHead>Punto Reorden</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockAlerts.map((alert) => (
                      <TableRow key={alert.stock_id}>
                        <TableCell className="font-mono text-sm">
                          {alert.part_number}
                        </TableCell>
                        <TableCell>{alert.part_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{alert.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{alert.warehouse_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {alert.plant_name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {alert.available_quantity} / {alert.current_quantity}
                        </TableCell>
                        <TableCell>{alert.reorder_point}</TableCell>
                        <TableCell>{getStatusBadge(alert.stock_status)}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/inventario/catalogo?part=${alert.part_id}`}>
                              Ver Detalles
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Stale Reservations */}
      <TabsContent value="stale-reservations">
        <Card>
          <CardHeader>
            <CardTitle>Reservas Antiguas (30+ días)</CardTitle>
            <CardDescription>
              Partes reservadas por órdenes de trabajo pendientes hace más de 30 días
            </CardDescription>
          </CardHeader>
          <CardContent>
            {staleReservations.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay reservas antiguas</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orden de Trabajo</TableHead>
                      <TableHead>Parte</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Almacén</TableHead>
                      <TableHead>Días Reservado</TableHead>
                      <TableHead>Solicitado por</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staleReservations.map((reservation) => (
                      <TableRow key={reservation.movement_id}>
                        <TableCell>
                          <div>
                            <Link 
                              href={`/ordenes/${reservation.work_order_id}`}
                              className="font-medium hover:underline"
                            >
                              {reservation.work_order_number}
                            </Link>
                            <div className="text-sm text-muted-foreground">
                              {reservation.work_order_status}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{reservation.part_name}</div>
                            <div className="text-sm text-muted-foreground font-mono">
                              {reservation.part_number}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{reservation.reserved_quantity}</TableCell>
                        <TableCell>
                          <div>
                            <div>{reservation.warehouse_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {reservation.plant_name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {reservation.days_reserved} días
                          </Badge>
                        </TableCell>
                        <TableCell>{reservation.requested_by}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/ordenes/${reservation.work_order_id}`}>
                              Ver Orden
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Valuation */}
      <TabsContent value="valuation">
        <Card>
          <CardHeader>
            <CardTitle>Valuación de Inventario</CardTitle>
            <CardDescription>
              Valor total del inventario por almacén
            </CardDescription>
          </CardHeader>
          <CardContent>
            {valuation.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay datos de valuación</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Almacén</TableHead>
                        <TableHead>Planta</TableHead>
                        <TableHead className="text-right">Total Partes</TableHead>
                        <TableHead className="text-right">Total Unidades</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">Unidades Reservadas</TableHead>
                        <TableHead className="text-right">Valor Reservado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {valuation.map((item) => (
                        <TableRow key={item.warehouse_id}>
                          <TableCell className="font-medium">
                            {item.warehouse_name}
                          </TableCell>
                          <TableCell>{item.plant_name}</TableCell>
                          <TableCell className="text-right">{item.total_parts}</TableCell>
                          <TableCell className="text-right">
                            {parseFloat(item.total_units.toString()).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            ${parseFloat(item.total_value.toString()).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {parseFloat(item.total_reserved_units.toString()).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            ${parseFloat(item.reserved_value.toString()).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Summary Card */}
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Resumen Global</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Almacenes</div>
                        <div className="text-2xl font-bold">{valuation.length}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Partes Únicas</div>
                        <div className="text-2xl font-bold">
                          {valuation.reduce((sum, v) => sum + v.total_parts, 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Valor Total Inventario</div>
                        <div className="text-2xl font-bold">
                          ${valuation.reduce((sum, v) => sum + parseFloat(v.total_value.toString()), 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Exportar Reporte
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
