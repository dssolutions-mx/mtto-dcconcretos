"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Gauge, MapPin, Clock, TrendingUp, AlertTriangle, Info } from "lucide-react"
import type { VisibleMeters } from "@/lib/checklist/checklist-execution-helpers"

interface EquipmentReadingsFormProps {
  assetId: string
  assetName: string
  visibleMeters: VisibleMeters
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
  visibleMeters,
  currentHours,
  currentKilometers,
  onReadingsChange,
  disabled = false,
}: EquipmentReadingsFormProps) {
  const [hoursReading, setHoursReading] = useState<string>("")
  const [kilometersReading, setKilometersReading] = useState<string>("")
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const showHours = visibleMeters === "hours" || visibleMeters === "both"
  const showKm = visibleMeters === "kilometers" || visibleMeters === "both"

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return "N/A"
    return num.toLocaleString()
  }

  const validateReadings = async () => {
    const hPayload = showHours && hoursReading ? parseInt(hoursReading, 10) : null
    const kPayload = showKm && kilometersReading ? parseInt(kilometersReading, 10) : null

    if (!hPayload && !kPayload) {
      setValidation(null)
      return
    }

    setIsValidating(true)

    try {
      const response = await fetch("/api/checklists/validate-readings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asset_id: assetId,
          hours_reading: hPayload,
          kilometers_reading: kPayload,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setValidation(result)
      }
    } catch (error) {
      console.error("Error validating readings:", error)
    } finally {
      setIsValidating(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateReadings()
    }, 500)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validateReadings closes over latest inputs
  }, [hoursReading, kilometersReading, assetId, showHours, showKm])

  useEffect(() => {
    onReadingsChange({
      hours_reading: showHours && hoursReading ? parseInt(hoursReading, 10) : null,
      kilometers_reading: showKm && kilometersReading ? parseInt(kilometersReading, 10) : null,
    })
  }, [hoursReading, kilometersReading, onReadingsChange, showHours, showKm])

  const setSuggestedValues = () => {
    if (validation?.expected_hours?.expected_reading && showHours) {
      setHoursReading(validation.expected_hours.expected_reading.toString())
    }
    if (validation?.expected_kilometers?.expected_reading && showKm) {
      setKilometersReading(validation.expected_kilometers.expected_reading.toString())
    }
  }

  const primaryLabel = () => {
    if (visibleMeters === "both") return "Horas y kilómetros"
    if (visibleMeters === "kilometers") return "Kilómetros"
    return "Horas"
  }

  const isHoursRequired = () => showHours && (visibleMeters === "hours" || visibleMeters === "both")
  const isKilometersRequired = () => showKm && (visibleMeters === "kilometers" || visibleMeters === "both")

  if (visibleMeters === "none") {
    return null
  }

  return (
    <Card id="checklist-field-equipment-readings" className="mb-6 scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-blue-600" />
          Lecturas del Equipo
        </CardTitle>
        <CardDescription>
          {visibleMeters === "both"
            ? `Ingrese horómetro y odómetro para ${assetName}`
            : `Ingrese la lectura actual para ${assetName}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className={`grid grid-cols-1 gap-4 p-4 bg-gray-50 rounded-lg ${
            showHours && showKm ? "md:grid-cols-3" : "md:grid-cols-2"
          }`}
        >
          {showHours && (
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600">Horas Actuales</div>
              <div className="text-lg font-semibold text-gray-900">{formatNumber(currentHours)} h</div>
            </div>
          )}
          {showKm && (
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600">Kilómetros Actuales</div>
              <div className="text-lg font-semibold text-gray-900">{formatNumber(currentKilometers)} km</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600">Unidad principal</div>
            <Badge variant="outline" className="mt-1">
              {primaryLabel()}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {showHours && (
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
                  validation?.errors?.some((error) => error.toLowerCase().includes("hora"))
                    ? "border-red-500"
                    : validation && hoursReading
                      ? "border-green-500"
                      : ""
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
          )}

          {showKm && (
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
                  validation?.errors?.some(
                    (error) =>
                      error.toLowerCase().includes("kilómet") || error.toLowerCase().includes("kilomet")
                  )
                    ? "border-red-500"
                    : validation && kilometersReading
                      ? "border-green-500"
                      : ""
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
          )}
        </div>

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

        {isValidating && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
            Validando lecturas...
          </div>
        )}

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

        {(hoursReading || kilometersReading) && validation?.valid && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-green-800 space-y-1">
              <div className="font-medium">✓ Lecturas válidas</div>
              {hoursReading && showHours && (
                <div>
                  Incremento de horas: +{parseInt(hoursReading, 10) - (currentHours || 0)} h
                </div>
              )}
              {kilometersReading && showKm && (
                <div>
                  Incremento de kilómetros: +{parseInt(kilometersReading, 10) - (currentKilometers || 0)} km
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-600 text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
          <Info className="h-4 w-4 inline mr-1" />
          {visibleMeters === "hours" && (
            <span>
              Este equipo se mantiene por <strong>horas de operación</strong>. La lectura del horómetro es necesaria
              para el seguimiento del mantenimiento.
            </span>
          )}
          {visibleMeters === "kilometers" && (
            <span>
              Este equipo se mantiene por <strong>kilometraje</strong>. La lectura del odómetro es necesaria para el
              seguimiento del mantenimiento.
            </span>
          )}
          {visibleMeters === "both" && (
            <span>
              Ingrese <strong>ambas</strong> lecturas: horómetro y odómetro (mezcladoras, camiones, etc.).
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
