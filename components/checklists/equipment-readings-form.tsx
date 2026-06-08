"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Gauge, MapPin, Clock, TrendingUp, AlertTriangle, Info, RefreshCw } from "lucide-react"
import type { VisibleMeters } from "@/lib/checklist/checklist-execution-helpers"
import {
  enrichEquipmentReadingsValidation,
  type EquipmentReadingsValidation,
} from "@/lib/checklist/equipment-readings-validation"
import {
  formatIntegerMeterReading,
  METER_INTEGER_ENTRY_HINT,
  parseIntegerMeterReading,
} from "@/lib/utils/meter-integer-input"

export type { EquipmentReadingsValidation }

interface EquipmentReadingsFormProps {
  assetId: string
  assetName: string
  visibleMeters: VisibleMeters
  currentHours: number | null
  currentKilometers: number | null
  initialReadings?: {
    hours_reading?: number | null
    kilometers_reading?: number | null
  }
  onReadingsChange: (readings: {
    hours_reading?: number | null
    kilometers_reading?: number | null
  }) => void
  onValidationChange?: (validation: EquipmentReadingsValidation | null) => void
  disabled?: boolean
}

function readingsToInputStrings(readings?: {
  hours_reading?: number | null
  kilometers_reading?: number | null
}) {
  return {
    hours:
      readings?.hours_reading != null && readings.hours_reading > 0
        ? String(readings.hours_reading)
        : "",
    kilometers:
      readings?.kilometers_reading != null && readings.kilometers_reading > 0
        ? String(readings.kilometers_reading)
        : "",
  }
}

export function EquipmentReadingsForm({
  assetId,
  assetName,
  visibleMeters,
  currentHours,
  currentKilometers,
  initialReadings,
  onReadingsChange,
  onValidationChange,
  disabled = false,
}: EquipmentReadingsFormProps) {
  const initialStrings = readingsToInputStrings(initialReadings)
  const [hoursReading, setHoursReading] = useState<string>(initialStrings.hours)
  const [kilometersReading, setKilometersReading] = useState<string>(initialStrings.kilometers)
  const [validation, setValidation] = useState<EquipmentReadingsValidation | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const showHours = visibleMeters === "hours" || visibleMeters === "both"
  const showKm = visibleMeters === "kilometers" || visibleMeters === "both"

  const parsedHours =
    showHours && hoursReading.trim() !== "" ? parseIntegerMeterReading(hoursReading) : null
  const parsedKm =
    showKm && kilometersReading.trim() !== "" ? parseIntegerMeterReading(kilometersReading) : null

  const validateReadings = useCallback(async () => {
    if (!parsedHours && !parsedKm) {
      setValidation(null)
      onValidationChange?.(null)
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
          hours_reading: parsedHours,
          kilometers_reading: parsedKm,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const enriched = enrichEquipmentReadingsValidation(result, {
          hours_reading: parsedHours,
          kilometers_reading: parsedKm,
        })
        setValidation(enriched)
        onValidationChange?.(enriched)
      } else {
        setValidation(null)
        onValidationChange?.(null)
      }
    } catch (error) {
      console.error("Error validating readings:", error)
      setValidation(null)
      onValidationChange?.(null)
    } finally {
      setIsValidating(false)
    }
  }, [assetId, parsedHours, parsedKm, onValidationChange])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void validateReadings()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [validateReadings])

  useEffect(() => {
    onReadingsChange({
      hours_reading: parsedHours,
      kilometers_reading: parsedKm,
    })
  }, [parsedHours, parsedKm, onReadingsChange])

  const setSuggestedValues = () => {
    if (validation?.expected_hours?.expected_reading && showHours) {
      setHoursReading(validation.expected_hours.expected_reading.toString())
    }
    if (validation?.expected_kilometers?.expected_reading && showKm) {
      setKilometersReading(validation.expected_kilometers.expected_reading.toString())
    }
  }

  const setCurrentAssetValues = () => {
    if (showHours && currentHours != null && currentHours > 0) {
      setHoursReading(String(Math.trunc(currentHours)))
    }
    if (showKm && currentKilometers != null && currentKilometers > 0) {
      setKilometersReading(String(Math.trunc(currentKilometers)))
    }
  }

  const readingsBelowCurrent =
    (showHours && parsedHours != null && currentHours != null && parsedHours < currentHours) ||
    (showKm && parsedKm != null && currentKilometers != null && parsedKm < currentKilometers)

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
        <Alert className="border-blue-200 bg-blue-50/80">
          <Info className="h-4 w-4 text-blue-700" />
          <AlertDescription className="text-blue-900 text-sm">
            Las lecturas deben ser <strong>iguales o mayores</strong> a las del activo en sistema.
            Si registró diesel u otro movimiento antes del checklist, use las lecturas actuales del tablero
            (no las del checklist anterior).
          </AlertDescription>
        </Alert>

        <div
          className={`grid grid-cols-1 gap-4 p-4 bg-gray-50 rounded-lg ${
            showHours && showKm ? "md:grid-cols-3" : "md:grid-cols-2"
          }`}
        >
          {showHours && (
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600">Horas en sistema</div>
              <div className="text-lg font-semibold text-gray-900 tabular-nums">
                {formatIntegerMeterReading(currentHours)} h
              </div>
            </div>
          )}
          {showKm && (
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600">Kilómetros en sistema</div>
              <div className="text-lg font-semibold text-gray-900 tabular-nums">
                {formatIntegerMeterReading(currentKilometers)} km
              </div>
            </div>
          )}
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600">Unidad principal</div>
            <Badge variant="outline" className="mt-1">
              {primaryLabel()}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={setCurrentAssetValues}
            disabled={disabled}
            className="text-blue-700 border-blue-200 hover:bg-blue-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Usar lecturas actuales del activo
          </Button>
          {(validation?.expected_hours?.expected_reading || validation?.expected_kilometers?.expected_reading) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={setSuggestedValues}
              disabled={disabled}
              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Usar valores estimados
            </Button>
          )}
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
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={`Mínimo: ${formatIntegerMeterReading(currentHours)} h`}
                value={hoursReading}
                onChange={(e) => setHoursReading(e.target.value)}
                disabled={disabled}
                className={`font-mono tabular-nums ${
                  validation?.errors?.some((error) => error.toLowerCase().includes("hora"))
                    ? "border-red-500"
                    : validation?.valid && hoursReading
                      ? "border-green-500"
                      : ""
                }`}
              />
              <p className="text-xs text-muted-foreground">{METER_INTEGER_ENTRY_HINT}</p>
              {validation?.expected_hours && (
                <div className="text-xs text-gray-600">
                  Estimado: {formatIntegerMeterReading(validation.expected_hours.expected_reading)} h
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
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={`Mínimo: ${formatIntegerMeterReading(currentKilometers)} km`}
                value={kilometersReading}
                onChange={(e) => setKilometersReading(e.target.value)}
                disabled={disabled}
                className={`font-mono tabular-nums ${
                  validation?.errors?.some(
                    (error) =>
                      error.toLowerCase().includes("kilómet") || error.toLowerCase().includes("kilomet")
                  )
                    ? "border-red-500"
                    : validation?.valid && kilometersReading
                      ? "border-green-500"
                      : ""
                }`}
              />
              <p className="text-xs text-muted-foreground">{METER_INTEGER_ENTRY_HINT}</p>
              {validation?.expected_kilometers && (
                <div className="text-xs text-gray-600">
                  Estimado: {formatIntegerMeterReading(validation.expected_kilometers.expected_reading)} km
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

        {isValidating && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
            Validando lecturas...
          </div>
        )}

        {readingsBelowCurrent && !validation?.errors.length && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-amber-900 text-sm">
              La lectura ingresada es menor que la del activo en sistema. Esto bloqueará el envío del checklist.
            </AlertDescription>
          </Alert>
        )}

        {validation?.errors && validation.errors.length > 0 && (
          <Alert variant="destructive" className="border-red-300 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-red-900">Lecturas no válidas</AlertTitle>
            <AlertDescription className="text-red-900 space-y-2">
              <ul className="list-disc list-inside space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
              {validation.hints.length > 0 && (
                <ul className="list-none space-y-1 pt-1 text-sm">
                  {validation.hints.map((hint, index) => (
                    <li key={index} className="flex gap-2">
                      <span aria-hidden>→</span>
                      <span>{hint}</span>
                    </li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        {validation?.warnings && validation.warnings.length > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <Info className="h-4 w-4 text-yellow-700" />
            <AlertTitle className="text-yellow-900">Revise antes de enviar</AlertTitle>
            <AlertDescription className="text-yellow-900 space-y-2">
              <ul className="list-disc list-inside space-y-1">
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
              {validation.hints
                .filter((hint) => !validation.errors.length)
                .map((hint, index) => (
                  <p key={index} className="text-sm">
                    → {hint}
                  </p>
                ))}
            </AlertDescription>
          </Alert>
        )}

        {(hoursReading || kilometersReading) && validation?.valid && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-sm text-green-800 space-y-1">
              <div className="font-medium">Lecturas válidas para enviar</div>
              {hoursReading && showHours && parsedHours != null && (
                <div>
                  Horas: {formatIntegerMeterReading(parsedHours)} h
                  {currentHours != null && (
                    <span className="text-green-700">
                      {' '}
                      ({parsedHours >= currentHours ? '+' : ''}
                      {parsedHours - currentHours} h vs sistema)
                    </span>
                  )}
                </div>
              )}
              {kilometersReading && showKm && parsedKm != null && (
                <div>
                  Kilómetros: {formatIntegerMeterReading(parsedKm)} km
                  {currentKilometers != null && (
                    <span className="text-green-700">
                      {' '}
                      ({parsedKm >= currentKilometers ? '+' : ''}
                      {parsedKm - currentKilometers} km vs sistema)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-600 text-center p-3 bg-muted/40 rounded-lg">
          <Info className="h-4 w-4 inline mr-1" />
          {visibleMeters === "hours" && (
            <span>
              Este equipo se mantiene por <strong>horas de operación</strong>.
            </span>
          )}
          {visibleMeters === "kilometers" && (
            <span>
              Este equipo se mantiene por <strong>kilometraje</strong>.
            </span>
          )}
          {visibleMeters === "both" && (
            <span>
              Ingrese <strong>ambas</strong> lecturas: horómetro y odómetro.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
