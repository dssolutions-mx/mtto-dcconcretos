'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

type PlantVolume = {
  plantId: string
  plantCode: string
  plantName: string
  volumeM3: number
  percentage: number
  amount: number
  excluded: boolean
}

type VolumeDistributionViewProps = {
  month: string // YYYY-MM format
  totalAmount: number
  businessUnitId?: string | null // Optional: filter plants by business unit
  plants?: Array<{ id: string; name: string; code: string; business_unit_id: string }> // Optional: plants list to filter
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
  onDistributionsChange
}: VolumeDistributionViewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [plantVolumes, setPlantVolumes] = useState<PlantVolume[]>([])

  useEffect(() => {
    loadVolumes()
  }, [month, businessUnitId])

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

      // Calculate total volume from included plants
      const volumes = plants.map((plant: any) => ({
        plantId: plant.plant_id,
        plantCode: plant.plant_code,
        plantName: plant.plant_name,
        volumeM3: Number(plant.volumen_concreto || 0),
        percentage: 0,
        amount: 0,
        excluded: false
      }))

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Distribución por Volumen</Label>
        <div className="text-sm text-muted-foreground">
          Total: {formatNumber(totalVolume, 2)} m³
        </div>
      </div>

      <div className="space-y-3">
        {plantVolumes.map((plant) => (
          <Card key={plant.plantId} className={plant.excluded ? 'opacity-50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{plant.plantName}</div>
                      <div className="text-sm text-muted-foreground">
                        {plant.plantCode} • {formatNumber(plant.volumeM3, 2)} m³
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
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Porcentaje: {formatNumber(plant.percentage, 2)}%
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(plant.amount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Total Distribuido</span>
            <span className="font-bold text-lg">
              {formatCurrency(
                plantVolumes
                  .filter(v => !v.excluded)
                  .reduce((sum, v) => sum + v.amount, 0)
              )}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {includedVolumes.length} {includedVolumes.length === 1 ? 'planta incluida' : 'plantas incluidas'}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

