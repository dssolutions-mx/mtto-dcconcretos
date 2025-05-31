"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Gauge, MapPin, Clock, TrendingUp, AlertTriangle, Info } from "lucide-react"
import { toast } from "sonner"

interface EquipmentReadingsFormProps {
  assetId: string
  assetName: string
  maintenanceUnit: 'hours' | 'kilometers' | null
  currentHours: number | null
  currentKilometers: number | null
  onReadingsChange: (readings: {
    hours_reading?: number | null
    kilometers_reading?: number | null
  }) => void
  disabled?: boolean
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  current_hours: number
  current_kilometers: number
  maintenance_unit: string
  expected_hours?: {
    current_reading: number
    expected_reading: number
    average_daily_usage: number
    days_since_last_reading: number
  }
  expected_kilometers?: {
    current_reading: number
    expected_reading: number
    average_daily_usage: number
    days_since_last_reading: number
  }
}

export function EquipmentReadingsForm({
  assetId,
  assetName,
  maintenanceUnit,
  currentHours,
  currentKilometers,
  onReadingsChange,
  disabled = false
}: EquipmentReadingsFormProps) {
  const [hoursReading, setHoursReading] = useState<string>('')
  const [kilometersReading, setKilometersReading] = useState<string>('')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [showExpectedReadings, setShowExpectedReadings] = useState(false)

  // Formatear números para mostrar
  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return 'N/A'
    return num.toLocaleString()
  }

  // Validar lecturas en tiempo real
  const validateReadings = async () => {
    if (!hoursReading && !kilometersReading) {
      setValidation(null)
      return
    }

    setIsValidating(true)
    
    try {
      const response = await fetch('/api/checklists/validate-readings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          asset_id: assetId,
          hours_reading: hoursReading ? parseInt(hoursReading) : null,
          kilometers_reading: kilometersReading ? parseInt(kilometersReading) : null
        })
      })

      if (response.ok) {
        const result = await response.json()
        setValidation(result)
      }
    } catch (error) {
      console.error('Error validating readings:', error)
    } finally {
      setIsValidating(false)
    }
  }

  // Efecto para validar cuando cambian las lecturas
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateReadings()
    }, 500) // Debounce de 500ms

    return () => clearTimeout(timeoutId)
  }, [hoursReading, kilometersReading, assetId])

  // Efecto para notificar cambios al componente padre
  useEffect(() => {
    onReadingsChange({
      hours_reading: hoursReading ? parseInt(hoursReading) : null,
      kilometers_reading: kilometersReading ? parseInt(kilometersReading) : null
    })
  }, [hoursReading, kilometersReading, onReadingsChange])

  // Establecer valores iniciales sugeridos
  const setSuggestedValues = () => {
    if (validation?.expected_hours?.expected_reading) {
      setHoursReading(validation.expected_hours.expected_reading.toString())
    }
    if (validation?.expected_kilometers?.expected_reading) {
      setKilometersReading(validation.expected_kilometers.expected_reading.toString())
    }
  }

  const getPrimaryUnit = () => {
    return maintenanceUnit || 'hours'
  }

  const isHoursRequired = () => {
    return getPrimaryUnit() === 'hours'
  }

  const isKilometersRequired = () => {
    return getPrimaryUnit() === 'kilometers'
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-blue-600" />
          Lecturas del Equipo
        </CardTitle>
        <CardDescription>
          Ingrese las lecturas actuales del horómetro y/o odómetro para {assetName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Información actual del equipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600">Horas Actuales</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatNumber(currentHours)} h
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600">Kilómetros Actuales</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatNumber(currentKilometers)} km
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600">Unidad Principal</div>
            <Badge variant="outline" className="mt-1">
              {getPrimaryUnit() === 'hours' ? 'Horas' : 'Kilómetros'}
            </Badge>
          </div>
        </div>

        {/* Campos de entrada */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lectura de Horas */}
          <div className="space-y-2">
            <Label htmlFor="hours_reading" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Lectura del Horómetro
              {isHoursRequired() && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="hours_reading"
              type="number"
              min="0"
              placeholder={`Actual: ${formatNumber(currentHours)}`}
              value={hoursReading}
              onChange={(e) => setHoursReading(e.target.value)}
              disabled={disabled}
              className={`${
                validation?.errors?.some(error => error.includes('horas')) 
                  ? 'border-red-500' 
                  : validation && hoursReading ? 'border-green-500' : ''
              }`}
            />
            {validation?.expected_hours && (
              <div className="text-xs text-gray-600">
                Estimado: {formatNumber(validation.expected_hours.expected_reading)} h
                {validation.expected_hours.average_daily_usage > 0 && (
                  <span className="ml-2">
                    (Promedio: {validation.expected_hours.average_daily_usage.toFixed(1)} h/día)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Lectura de Kilómetros */}
          <div className="space-y-2">
            <Label htmlFor="kilometers_reading" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Lectura del Odómetro
              {isKilometersRequired() && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="kilometers_reading"
              type="number"
              min="0"
              placeholder={`Actual: ${formatNumber(currentKilometers)}`}
              value={kilometersReading}
              onChange={(e) => setKilometersReading(e.target.value)}
              disabled={disabled}
              className={`${
                validation?.errors?.some(error => error.includes('kilómetros')) 
                  ? 'border-red-500' 
                  : validation && kilometersReading ? 'border-green-500' : ''
              }`}
            />
            {validation?.expected_kilometers && (
              <div className="text-xs text-gray-600">
                Estimado: {formatNumber(validation.expected_kilometers.expected_reading)} km
                {validation.expected_kilometers.average_daily_usage > 0 && (
                  <span className="ml-2">
                    (Promedio: {validation.expected_kilometers.average_daily_usage.toFixed(1)} km/día)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Botón para valores sugeridos */}
        {(validation?.expected_hours?.expected_reading || validation?.expected_kilometers?.expected_reading) && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={setSuggestedValues}
              disabled={disabled}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Usar Valores Estimados
            </Button>
          </div>
        )}

        {/* Validación en tiempo real */}
        {isValidating && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            Validando lecturas...
          </div>
        )}

        {/* Errores de validación */}
        {validation?.errors && validation.errors.length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <ul className="list-disc list-inside space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Advertencias de validación */}
        {validation?.warnings && validation.warnings.length > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <Info className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <ul className="list-disc list-inside space-y-1">
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Información adicional */}
        {(hoursReading || kilometersReading) && validation?.valid && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-green-800 space-y-1">
              <div className="font-medium">✓ Lecturas válidas</div>
              {hoursReading && (
                <div>
                  Incremento de horas: +{parseInt(hoursReading) - (currentHours || 0)} h
                </div>
              )}
              {kilometersReading && (
                <div>
                  Incremento de kilómetros: +{parseInt(kilometersReading) - (currentKilometers || 0)} km
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recordatorio sobre unidad principal */}
        <div className="text-xs text-gray-600 text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
          <Info className="h-4 w-4 inline mr-1" />
          {isHoursRequired() && (
            <span>
              Este equipo se mantiene por <strong>horas de operación</strong>. 
              La lectura del horómetro es requerida para calcular el próximo mantenimiento.
            </span>
          )}
          {isKilometersRequired() && (
            <span>
              Este equipo se mantiene por <strong>kilometraje</strong>. 
              La lectura del odómetro es requerida para calcular el próximo mantenimiento.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 