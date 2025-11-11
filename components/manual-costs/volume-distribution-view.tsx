'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Loader2, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

type PlantVolume = {
  plantId: string
  plantCode: string
  plantName: string
  volumeM3: number
  percentage: number
  amount: number
  excluded: boolean
  // Original values (when editing)
  originalVolumeM3?: number
  originalPercentage?: number
  originalAmount?: number
}

type OriginalDistribution = {
  plantId: string
  volumeM3: number
  percentage: number
  amount: number
}

type VolumeDistributionViewProps = {
  month: string // YYYY-MM format
  totalAmount: number
  businessUnitId?: string | null // Optional: filter plants by business unit
  plants?: Array<{ id: string; name: string; code: string; business_unit_id: string }> // Optional: plants list to filter
  originalDistributions?: OriginalDistribution[] // Optional: original distributions when editing
  onDistributionsChange: (distributions: Array<{
    plantId: string
    percentage: number
    amount: number
    volumeM3: number
  }>) => void
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

const formatNumber = (num: number, decimals: number = 2) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num)

export function VolumeDistributionView({
  month,
  totalAmount,
  businessUnitId,
  plants: plantsProp,
  originalDistributions,
  onDistributionsChange
}: VolumeDistributionViewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plantVolumes, setPlantVolumes] = useState<PlantVolume[]>([])
  const isEditing = !!originalDistributions && originalDistributions.length > 0

  useEffect(() => {
    loadVolumes()
  }, [month, businessUnitId, originalDistributions])

  const loadVolumes = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/reports/gerencial/ingresos-gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month })
      })

      if (!resp.ok) {
        throw new Error('Failed to load volumes')
      }

      const data = await resp.json()
      let plants = data.plants || []

      // Filter plants by business unit if provided
      // The API response includes business_unit_id, so we can filter directly
      if (businessUnitId) {
        plants = plants.filter((plant: any) => plant.business_unit_id === businessUnitId)
        
        // If plantsProp is provided, also verify against it (double-check)
        if (plantsProp && plantsProp.length > 0) {
          const buPlantIds = new Set(plantsProp.filter(p => p.business_unit_id === businessUnitId).map(p => p.id))
          plants = plants.filter((plant: any) => buPlantIds.has(plant.plant_id))
        }
      }

      // Create a map of original distributions by plantId for quick lookup
      const originalMap = new Map<string, OriginalDistribution>()
      if (originalDistributions) {
        originalDistributions.forEach(orig => {
          originalMap.set(orig.plantId, orig)
        })
      }

      // Calculate total volume from included plants
      const volumes = plants.map((plant: any) => {
        const plantId = plant.plant_id
        const currentVolume = Number(plant.volumen_concreto || 0)
        const original = originalMap.get(plantId)
        
        return {
          plantId,
        plantCode: plant.plant_code,
        plantName: plant.plant_name,
          volumeM3: currentVolume,
          percentage: 0,
          amount: 0,
          excluded: false,
          // Store original values if available
          originalVolumeM3: original?.volumeM3,
          originalPercentage: original?.percentage,
          originalAmount: original?.amount
        }
      })

      // If editing, also include plants that were in original but not in current data
      if (originalDistributions) {
        const currentPlantIds = new Set(volumes.map(v => v.plantId))
        originalDistributions.forEach(orig => {
          if (!currentPlantIds.has(orig.plantId)) {
            // Find plant info from plantsProp if available
            const plantInfo = plantsProp?.find(p => p.id === orig.plantId)
            if (plantInfo) {
              volumes.push({
                plantId: orig.plantId,
                plantCode: plantInfo.code,
                plantName: plantInfo.name,
                volumeM3: 0, // No current volume
        percentage: 0,
        amount: 0,
                excluded: false,
                originalVolumeM3: orig.volumeM3,
                originalPercentage: orig.percentage,
                originalAmount: orig.amount
              })
            }
          }
        })
      }

      setPlantVolumes(volumes)
      calculateDistributions(volumes)
    } catch (err: any) {
      setError(err.message || 'Error al cargar volúmenes')
    } finally {
      setLoading(false)
    }
  }

  const calculateDistributions = (volumes: PlantVolume[]) => {
    const includedVolumes = volumes.filter(v => !v.excluded)
    const totalVolume = includedVolumes.reduce((sum, v) => sum + v.volumeM3, 0)

    if (totalVolume === 0) {
      // If no volume, distribute equally
      const equalPercentage = includedVolumes.length > 0 ? 100 / includedVolumes.length : 0
      const updated = volumes.map(v => {
        if (v.excluded) return v
        return {
          ...v,
          percentage: equalPercentage,
          amount: (totalAmount * equalPercentage) / 100
        }
      })
      setPlantVolumes(updated)
      notifyDistributions(updated)
      return
    }

    // Calculate percentages based on volume
    const updated = volumes.map(v => {
      if (v.excluded) {
        return { ...v, percentage: 0, amount: 0 }
      }
      const percentage = (v.volumeM3 / totalVolume) * 100
      const amount = (totalAmount * percentage) / 100
      return { ...v, percentage, amount }
    })

    setPlantVolumes(updated)
    notifyDistributions(updated)
  }

  const notifyDistributions = (volumes: PlantVolume[]) => {
    const distributions = volumes
      .filter(v => !v.excluded && v.volumeM3 > 0)
      .map(v => ({
        plantId: v.plantId,
        percentage: v.percentage,
        amount: v.amount,
        volumeM3: v.volumeM3
      }))
    onDistributionsChange(distributions)
  }

  const toggleExclude = (plantId: string) => {
    const updated = plantVolumes.map(v =>
      v.plantId === plantId ? { ...v, excluded: !v.excluded } : v
    )
    setPlantVolumes(updated)
    calculateDistributions(updated)
  }

  const includedVolumes = plantVolumes.filter(v => !v.excluded)
  const totalVolume = includedVolumes.reduce((sum, v) => sum + v.volumeM3, 0)
  const maxVolume = Math.max(...plantVolumes.map(v => v.volumeM3), 0)
  
  // Calculate original total if editing
  const originalTotalVolume = isEditing 
    ? (originalDistributions || []).reduce((sum, orig) => sum + orig.volumeM3, 0)
    : 0

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
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

  if (plantVolumes.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No se encontraron plantas con volumen de concreto para este mes.
        </AlertDescription>
      </Alert>
    )
  }

  // Helper to get change indicator
  const getVolumeChange = (current: number, original?: number) => {
    if (!original || original === 0) return null
    const diff = current - original
    const percentChange = (diff / original) * 100
    return { diff, percentChange }
  }

  const getAmountChange = (current: number, original?: number) => {
    if (!original) return null
    return current - original
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Distribución por Volumen
          {isEditing && (
            <Badge variant="outline" className="ml-2">
              Editando
            </Badge>
          )}
        </Label>
        <div className="flex items-center gap-4 text-sm">
          {isEditing && originalTotalVolume > 0 && (
            <div className="text-muted-foreground">
              Original: {formatNumber(originalTotalVolume, 2)} m³
            </div>
          )}
          <div className="text-muted-foreground">
            Actual: {formatNumber(totalVolume, 2)} m³
          </div>
        </div>
      </div>

      {isEditing && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Los volúmenes han cambiado desde la distribución original. 
            Se muestra una comparación entre los valores originales y los nuevos calculados.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {plantVolumes.map((plant) => {
          const volumeChange = getVolumeChange(plant.volumeM3, plant.originalVolumeM3)
          const amountChange = getAmountChange(plant.amount, plant.originalAmount)
          const hasChanges = isEditing && (volumeChange || amountChange)

          return (
            <Card 
              key={plant.plantId} 
              className={plant.excluded ? 'opacity-50' : hasChanges ? 'border-orange-200 dark:border-orange-800' : ''}
            >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                      <div className="flex-1">
                      <div className="font-medium">{plant.plantName}</div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <span>{plant.plantCode}</span>
                            {isEditing && plant.originalVolumeM3 !== undefined ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs">
                                  Volumen: {formatNumber(plant.originalVolumeM3, 2)} m³
                                </span>
                                {volumeChange && (
                                  <>
                                    {volumeChange.diff > 0 ? (
                                      <ArrowUp className="w-3 h-3 text-green-600" />
                                    ) : volumeChange.diff < 0 ? (
                                      <ArrowDown className="w-3 h-3 text-red-600" />
                                    ) : (
                                      <Minus className="w-3 h-3 text-muted-foreground" />
                                    )}
                                    <span className={`text-xs font-medium ${
                                      volumeChange.diff > 0 ? 'text-green-600' : 
                                      volumeChange.diff < 0 ? 'text-red-600' : 
                                      'text-muted-foreground'
                                    }`}>
                                      {volumeChange.diff > 0 ? '+' : ''}{formatNumber(volumeChange.diff, 2)} m³
                                      ({volumeChange.percentChange > 0 ? '+' : ''}{formatNumber(volumeChange.percentChange, 1)}%)
                                    </span>
                                  </>
                                )}
                                <span className="text-xs font-semibold">→</span>
                                <span className="text-xs font-medium">
                                  {formatNumber(plant.volumeM3, 2)} m³
                                </span>
                              </div>
                            ) : (
                              <span>• {formatNumber(plant.volumeM3, 2)} m³</span>
                            )}
                          </div>
                      </div>
                    </div>
                    <Switch
                      checked={!plant.excluded}
                      onCheckedChange={() => toggleExclude(plant.plantId)}
                    />
                  </div>
                  {!plant.excluded && maxVolume > 0 && (
                    <Progress
                      value={(plant.volumeM3 / maxVolume) * 100}
                      className="h-2"
                    />
                  )}
                  {!plant.excluded && (
                      <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Porcentaje: {formatNumber(plant.percentage, 2)}%
                            {isEditing && plant.originalPercentage !== undefined && (
                              <span className="ml-2 text-xs">
                                (Original: {formatNumber(plant.originalPercentage, 2)}%)
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            {isEditing && plant.originalAmount !== undefined && (
                              <>
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(plant.originalAmount)}
                                </span>
                                {amountChange && amountChange !== 0 && (
                                  <>
                                    {amountChange > 0 ? (
                                      <ArrowUp className="w-3 h-3 text-green-600" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3 text-red-600" />
                                    )}
                                    <span className={`text-xs font-medium ${
                                      amountChange > 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {amountChange > 0 ? '+' : ''}{formatCurrency(Math.abs(amountChange))}
                      </span>
                                  </>
                                )}
                                <span className="text-xs">→</span>
                              </>
                            )}
                      <span className="font-semibold">
                        {formatCurrency(plant.amount)}
                      </span>
                          </div>
                        </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          )
        })}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Total Distribuido</span>
              <div className="flex items-center gap-2">
                {isEditing && originalDistributions && (
                  <>
                    <span className="text-muted-foreground text-xs">
                      {formatCurrency(
                        originalDistributions.reduce((sum, orig) => sum + orig.amount, 0)
                      )}
                    </span>
                    <span className="text-xs">→</span>
                  </>
                )}
            <span className="font-bold text-lg">
              {formatCurrency(
                plantVolumes
                  .filter(v => !v.excluded)
                  .reduce((sum, v) => sum + v.amount, 0)
              )}
            </span>
          </div>
            </div>
            <div className="text-xs text-muted-foreground">
            {includedVolumes.length} {includedVolumes.length === 1 ? 'planta incluida' : 'plantas incluidas'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

