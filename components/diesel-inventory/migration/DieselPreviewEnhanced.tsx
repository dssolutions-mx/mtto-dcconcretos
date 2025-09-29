"use client"

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { 
  CheckCircle, AlertTriangle, Clock, FileText, Filter, Droplets, Building2, Tags, Info,
  TrendingUp, TrendingDown, Activity, Gauge, Calendar, AlertCircle, PackageOpen, Fuel,
  Truck, Package, ChevronDown, ChevronRight
} from 'lucide-react'
import { PlantBatch, MeterReading } from '@/types/diesel'
import { useDieselStore } from '@/store/diesel-store'

type Props = {
  fileName?: string
}

export default function DieselPreviewEnhanced({ fileName }: Props) {
  const { plantBatches, selectPlantBatch, selectedPlantBatch } = useDieselStore()
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set())

  // Get selected batch or first batch
  const currentBatch = useMemo(() => {
    if (plantBatches.length === 0) return null
    if (selectedPlantBatch) {
      return plantBatches.find(b => b.batch_id === selectedPlantBatch) || plantBatches[0]
    }
    return plantBatches[0]
  }, [plantBatches, selectedPlantBatch])

  const toggleAsset = (assetCode: string) => {
    const next = new Set(expandedAssets)
    if (next.has(assetCode)) next.delete(assetCode)
    else next.add(assetCode)
    setExpandedAssets(next)
  }

  if (!currentBatch) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No hay datos procesados</AlertTitle>
        <AlertDescription>
          Los datos se organizarán automáticamente en lotes por planta una vez que se cargue el archivo.
        </AlertDescription>
      </Alert>
    )
  }

  const inventoryStatus = Math.abs(currentBatch.inventory_discrepancy) > 2 
    ? 'warning' 
    : 'ok'

  return (
    <div className="space-y-4">
      {/* Plant Batch Selector */}
      {plantBatches.length > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Seleccionar Planta:</span>
              <div className="flex gap-2 flex-wrap">
                {plantBatches.map(batch => (
                  <Button
                    key={batch.batch_id}
                    variant={currentBatch.batch_id === batch.batch_id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => selectPlantBatch(batch.batch_id)}
                  >
                    {batch.plant_code} - Almacén {batch.warehouse_number}
                    <Badge variant="secondary" className="ml-2">
                      {batch.total_rows}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resumen del Lote: {currentBatch.plant_code} - Almacén {currentBatch.warehouse_number}
          </CardTitle>
          <CardDescription>
            {fileName && `Archivo: ${fileName} • `}
            Período: {currentBatch.date_range.start?.toLocaleDateString('es-MX')} - {currentBatch.date_range.end?.toLocaleDateString('es-MX')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="font-bold text-2xl text-blue-600">{currentBatch.total_rows}</div>
              <div className="text-blue-700 text-xs">Total Registros</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="font-bold text-2xl text-green-600">{currentBatch.asset_consumptions}</div>
              <div className="text-green-700 text-xs">Consumos</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded">
              <div className="font-bold text-2xl text-purple-600">{currentBatch.fuel_receipts}</div>
              <div className="text-purple-700 text-xs">Entradas</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded">
              <div className="font-bold text-2xl text-amber-600">{currentBatch.adjustments}</div>
              <div className="text-amber-700 text-xs">Ajustes</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="font-bold text-2xl text-gray-600">{currentBatch.unique_assets.length}</div>
              <div className="text-gray-700 text-xs">Activos Únicos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Reconciliation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Reconciliación de Inventario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Inventario Inicial</div>
              <div className="text-2xl font-bold text-gray-900">
                {currentBatch.initial_inventory.toLocaleString('es-MX')} L
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Entradas
              </div>
              <div className="text-2xl font-bold text-green-600">
                +{currentBatch.total_litros_in.toLocaleString('es-MX')} L
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-red-600 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Salidas
              </div>
              <div className="text-2xl font-bold text-red-600">
                -{currentBatch.total_litros_out.toLocaleString('es-MX')} L
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Inventario Final</div>
              <div className="text-2xl font-bold text-gray-900">
                {currentBatch.final_inventory_computed.toLocaleString('es-MX')} L
              </div>
              {inventoryStatus === 'warning' && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  Discrepancia: {currentBatch.inventory_discrepancy.toFixed(1)}L
                </div>
              )}
            </div>
          </div>
          
          {inventoryStatus === 'warning' && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Discrepancia de Inventario Detectada</AlertTitle>
              <AlertDescription>
                El inventario calculado ({currentBatch.final_inventory_computed.toLocaleString('es-MX')}L) 
                difiere del inventario proporcionado en Smartsheet ({currentBatch.final_inventory_provided.toLocaleString('es-MX')}L) 
                por {Math.abs(currentBatch.inventory_discrepancy).toFixed(1)} litros.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Movement Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Desglose de Movimientos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 p-2 border rounded">
              <PackageOpen className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-xs text-gray-600">Aperturas</div>
                <div className="font-bold">{currentBatch.inventory_opening_row ? 1 : 0}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 border rounded">
              <Fuel className="h-4 w-4 text-purple-600" />
              <div>
                <div className="text-xs text-gray-600">Recepciones</div>
                <div className="font-bold">{currentBatch.fuel_receipts}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 border rounded">
              <Truck className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-xs text-gray-600">Consumos Asignados</div>
                <div className="font-bold">{currentBatch.asset_consumptions}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 border rounded">
              <Package className="h-4 w-4 text-amber-600" />
              <div>
                <div className="text-xs text-gray-600">Sin Asignar</div>
                <div className="font-bold">{currentBatch.unassigned_consumptions}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asset & Meter Summary */}
      <Tabs defaultValue="assets" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assets">
            Activos ({currentBatch.unique_assets.length})
          </TabsTrigger>
          <TabsTrigger value="meters">
            Lecturas de Medidores ({currentBatch.meter_readings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="space-y-3">
          <Card>
            <CardContent className="pt-6">
              {currentBatch.unmapped_assets.length > 0 && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Activos sin Mapear ({currentBatch.unmapped_assets.length})</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {currentBatch.unmapped_assets.map(asset => (
                        <Badge key={asset} variant="outline" className="bg-red-50">
                          {asset}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-2 text-sm">
                      Estos activos requieren mapeo manual en la siguiente pestaña.
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {currentBatch.unassigned_consumptions > 0 && (
                <Alert variant="default" className="mb-4 border-amber-300 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-700" />
                  <AlertTitle className="text-amber-900">
                    Salidas Sin Activo Asignado ({currentBatch.unassigned_consumptions})
                  </AlertTitle>
                  <AlertDescription className="text-amber-800">
                    <div className="mt-2 text-sm">
                      Se encontraron <strong>{currentBatch.unassigned_consumptions}</strong> salidas de combustible sin un código de activo asignado.
                      Estas salidas deben asignarse manualmente a un activo en la pestaña de <strong>Mapeo</strong> para mantener un control preciso del consumo.
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <div className="font-medium text-sm mb-2">Lista de Activos</div>
                {currentBatch.unique_assets.map(assetCode => {
                  const assetRows = currentBatch.rows.filter(r => r.unidad === assetCode)
                  const totalFuel = assetRows.reduce((sum, r) => sum + r.litros_cantidad, 0)
                  const readings = currentBatch.meter_readings.filter(m => m.asset_code === assetCode)
                  const hasWarnings = readings.some(r => r.has_warnings || r.has_errors)

                  return (
                    <div key={assetCode} className="border rounded p-3">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleAsset(assetCode)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedAssets.has(assetCode) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-mono font-medium">{assetCode}</span>
                          {hasWarnings && (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <Badge variant="secondary">{assetRows.length} consumos</Badge>
                          <span className="text-gray-600">{totalFuel.toLocaleString('es-MX')} L</span>
                        </div>
                      </div>

                      {expandedAssets.has(assetCode) && (
                        <div className="mt-3 pl-7 space-y-2 text-sm">
                          {readings.map((reading, idx) => (
                            <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 bg-gray-50 rounded">
                              <div>
                                <div className="text-xs text-gray-600">Fecha</div>
                                <div className="font-mono">{reading.reading_date.toLocaleDateString('es-MX')}</div>
                              </div>
                              {reading.horometer != null && (
                                <div>
                                  <div className="text-xs text-gray-600">Horómetro</div>
                                  <div className="font-mono">
                                    {reading.horometer.toLocaleString('es-MX')} hr
                                    {reading.horometer_delta != null && (
                                      <span className="text-xs text-green-600 ml-1">
                                        (+{reading.horometer_delta.toFixed(1)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              {reading.kilometer != null && (
                                <div>
                                  <div className="text-xs text-gray-600">Kilómetros</div>
                                  <div className="font-mono">
                                    {reading.kilometer.toLocaleString('es-MX')} km
                                    {reading.kilometer_delta != null && (
                                      <span className="text-xs text-green-600 ml-1">
                                        (+{reading.kilometer_delta.toFixed(0)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              <div>
                                <div className="text-xs text-gray-600">Combustible</div>
                                <div className="font-mono">{reading.fuel_consumed.toLocaleString('es-MX')} L</div>
                              </div>
                              {reading.validation_messages.length > 0 && (
                                <div className="col-span-full">
                                  {reading.validation_messages.map((msg, i) => (
                                    <div key={i} className="flex items-start gap-1 text-xs text-amber-700">
                                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                      {msg}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meters" className="space-y-3">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Activos con lecturas: {currentBatch.assets_with_meters.length} de {currentBatch.unique_assets.length}
                  </span>
                  {currentBatch.meter_readings.filter(m => m.has_warnings || m.has_errors).length > 0 && (
                    <Badge variant="outline" className="bg-amber-50">
                      {currentBatch.meter_readings.filter(m => m.has_warnings || m.has_errors).length} con avisos
                    </Badge>
                  )}
                </div>

                <Separator />

                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {currentBatch.meter_readings.map((reading, idx) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded border ${
                          reading.has_errors ? 'border-red-300 bg-red-50' : 
                          reading.has_warnings ? 'border-amber-300 bg-amber-50' : 
                          'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-mono font-medium">{reading.asset_code}</div>
                            <div className="text-xs text-gray-600">
                              {reading.reading_date.toLocaleDateString('es-MX')} • Fila #{reading.original_row_number}
                            </div>
                          </div>
                          {(reading.has_errors || reading.has_warnings) && (
                            <Badge variant={reading.has_errors ? 'destructive' : 'outline'} className="text-xs">
                              {reading.has_errors ? 'Error' : 'Aviso'}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                          {reading.horometer != null && (
                            <div>
                              <span className="text-gray-600">Horómetro:</span>
                              <span className="ml-1 font-mono">{reading.horometer.toFixed(1)} hr</span>
                              {reading.daily_hours_avg != null && (
                                <div className="text-xs text-gray-500">
                                  {reading.daily_hours_avg.toFixed(1)} hr/día
                                </div>
                              )}
                            </div>
                          )}
                          {reading.kilometer != null && (
                            <div>
                              <span className="text-gray-600">Km:</span>
                              <span className="ml-1 font-mono">{reading.kilometer.toFixed(0)} km</span>
                              {reading.daily_km_avg != null && (
                                <div className="text-xs text-gray-500">
                                  {reading.daily_km_avg.toFixed(0)} km/día
                                </div>
                              )}
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600">Combustible:</span>
                            <span className="ml-1 font-mono">{reading.fuel_consumed.toFixed(1)} L</span>
                          </div>
                          {reading.fuel_efficiency_per_hour != null && (
                            <div>
                              <span className="text-gray-600">Eficiencia:</span>
                              <span className="ml-1 font-mono">{reading.fuel_efficiency_per_hour.toFixed(2)} L/hr</span>
                            </div>
                          )}
                        </div>

                        {reading.validation_messages.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {reading.validation_messages.map((msg, i) => (
                              <div key={i} className="flex items-start gap-1 text-xs">
                                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-600" />
                                <span className="text-amber-900">{msg}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
