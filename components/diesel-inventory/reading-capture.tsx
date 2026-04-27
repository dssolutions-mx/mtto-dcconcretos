"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, TrendingUp, CheckCircle2, Info } from "lucide-react"
import {
  formatIntegerMeterReading,
  METER_INTEGER_ENTRY_HINT,
  parseIntegerMeterReading,
} from "@/lib/utils/meter-integer-input"

interface ReadingCaptureProps {
  assetId: string
  assetName: string
  maintenanceUnit: string // 'hours', 'kilometers', or 'both'
  currentHours: number | null
  currentKilometers: number | null
  onReadingsChange: (readings: {
    hours_reading?: number | null
    kilometers_reading?: number | null
  }) => void
  disabled?: boolean
}

export function ReadingCapture({
  assetId,
  assetName,
  maintenanceUnit,
  currentHours,
  currentKilometers,
  onReadingsChange,
  disabled = false
}: ReadingCaptureProps) {
  const [hoursReading, setHoursReading] = useState<string>("")
  const [kilometersReading, setKilometersReading] = useState<string>("")
  const [hoursValid, setHoursValid] = useState<boolean | null>(null)
  const [kilometersValid, setKilometersValid] = useState<boolean | null>(null)

  // Always show both fields for diesel consumption
  const showHours = true
  const showKilometers = true

  /* eslint-disable react-hooks/set-state-in-effect -- validity flags derived from controlled inputs (same pattern as before parse fix) */
  // Validate hours reading
  useEffect(() => {
    if (!showHours || hoursReading.trim() === "") {
      setHoursValid(null)
      return
    }

    const reading = parseIntegerMeterReading(hoursReading)
    if (reading === null) {
      setHoursValid(false)
      return
    }

    // Check if reading is valid compared to current
    if (currentHours !== null) {
      // Reading should be greater than or equal to current (or slightly less for meter reset)
      if (reading < currentHours - 100) {
        // Allow small decreases for meter reset, but flag large ones
        setHoursValid(false)
        return
      }
      
      if (reading < currentHours) {
        // Warning but not invalid - might be meter reset
        setHoursValid(null)
        return
      }

      // Check for unrealistic jump (> 10,000 hours)
      if (reading - currentHours > 10000) {
        setHoursValid(false)
        return
      }
    }

    setHoursValid(true)
  }, [hoursReading, currentHours, showHours])

  // Validate kilometers reading
  useEffect(() => {
    if (!showKilometers || kilometersReading.trim() === "") {
      setKilometersValid(null)
      return
    }

    const reading = parseIntegerMeterReading(kilometersReading)
    if (reading === null) {
      setKilometersValid(false)
      return
    }

    // Check if reading is valid compared to current
    if (currentKilometers !== null) {
      // Reading should be greater than or equal to current
      if (reading < currentKilometers - 1000) {
        // Allow small decreases for meter reset
        setKilometersValid(false)
        return
      }
      
      if (reading < currentKilometers) {
        // Warning but not invalid - might be meter reset
        setKilometersValid(null)
        return
      }

      // Check for unrealistic jump (> 100,000 km)
      if (reading - currentKilometers > 100000) {
        setKilometersValid(false)
        return
      }
    }

    setKilometersValid(true)
  }, [kilometersReading, currentKilometers, showKilometers])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Notify parent of readings
  useEffect(() => {
    const readings: {
      hours_reading?: number | null
      kilometers_reading?: number | null
    } = {}

    if (showHours) {
      const hours =
        hoursReading.trim() === "" ? null : parseIntegerMeterReading(hoursReading)
      readings.hours_reading = hours
    }

    if (showKilometers) {
      const km =
        kilometersReading.trim() === "" ? null : parseIntegerMeterReading(kilometersReading)
      readings.kilometers_reading = km
    }

    onReadingsChange(readings)
  }, [hoursReading, kilometersReading, showHours, showKilometers])

  const getHoursIncrement = () => {
    if (!hoursReading || currentHours === null) return null
    const reading = parseIntegerMeterReading(hoursReading)
    if (reading === null) return null
    return reading - currentHours
  }

  const getKilometersIncrement = () => {
    if (!kilometersReading || currentKilometers === null) return null
    const reading = parseIntegerMeterReading(kilometersReading)
    if (reading === null) return null
    return reading - currentKilometers
  }

  return (
    <div className="space-y-4">
      {/* Info alert */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800">
          <strong>Lecturas del activo</strong>
          <br />
          Registra la lectura actual del horómetro/odómetro del equipo.
          {(currentHours !== null || currentKilometers !== null) && (
            <span className="block mt-1">
              Estas lecturas se actualizarán en el sistema después del consumo.
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Hours input */}
      {showHours && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="hours-reading" className="text-base">
              Horómetro (Horas)
            </Label>
            {currentHours !== null && (
              <Badge variant="outline" className="text-xs tabular-nums">
                Actual: {formatIntegerMeterReading(currentHours)}h
              </Badge>
            )}
          </div>

          <div className="relative">
            <Input
              id="hours-reading"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={
                currentHours !== null
                  ? `Mayor a ${formatIntegerMeterReading(currentHours)}`
                  : "Ej: 5000"
              }
              value={hoursReading}
              onChange={(e) => setHoursReading(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault()
                }
              }}
              disabled={disabled}
              className={`h-12 text-base font-mono tabular-nums ${
                hoursValid === false ? 'border-red-500' : 
                hoursValid === true ? 'border-green-500' : ''
              }`}
            />
            {hoursValid === true && (
              <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500" />
            )}
            {hoursValid === false && (
              <AlertTriangle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-500" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{METER_INTEGER_ENTRY_HINT}</p>

          {/* Increment display */}
          {hoursReading && currentHours !== null && (
            <div className="flex items-center gap-2 text-sm">
              {getHoursIncrement() !== null && (
                <>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className={`font-medium ${
                    (getHoursIncrement() ?? 0) < 0 ? 'text-orange-600' : 'text-blue-600'
                  }`}>
                    {getHoursIncrement()! >= 0 ? '+' : ''}
                    {formatIntegerMeterReading(getHoursIncrement()!)} horas
                  </span>
                </>
              )}
            </div>
          )}

          {/* Validation messages */}
          {hoursValid === false && (
            <p className="text-sm text-red-600">
              ⚠️ La lectura parece incorrecta. Verifica el horómetro del equipo.
            </p>
          )}
          {hoursValid === null &&
            hoursReading &&
            currentHours !== null &&
            parseIntegerMeterReading(hoursReading) != null &&
            parseIntegerMeterReading(hoursReading)! < currentHours && (
            <p className="text-sm text-orange-600">
              ⚠️ La lectura es menor a la actual. ¿Se reinició el horómetro?
            </p>
          )}
        </div>
      )}

      {/* Kilometers input */}
      {showKilometers && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="km-reading" className="text-base">
              Odómetro (Kilómetros)
            </Label>
            {currentKilometers !== null && (
              <Badge variant="outline" className="text-xs tabular-nums">
                Actual: {formatIntegerMeterReading(currentKilometers)}km
              </Badge>
            )}
          </div>

          <div className="relative">
            <Input
              id="km-reading"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={
                currentKilometers !== null
                  ? `Mayor a ${formatIntegerMeterReading(currentKilometers)}`
                  : "Ej: 50000"
              }
              value={kilometersReading}
              onChange={(e) => setKilometersReading(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault()
                }
              }}
              disabled={disabled}
              className={`h-12 text-base font-mono tabular-nums ${
                kilometersValid === false ? 'border-red-500' : 
                kilometersValid === true ? 'border-green-500' : ''
              }`}
            />
            {kilometersValid === true && (
              <CheckCircle2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500" />
            )}
            {kilometersValid === false && (
              <AlertTriangle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-500" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{METER_INTEGER_ENTRY_HINT}</p>

          {/* Increment display */}
          {kilometersReading && currentKilometers !== null && (
            <div className="flex items-center gap-2 text-sm">
              {getKilometersIncrement() !== null && (
                <>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className={`font-medium ${
                    (getKilometersIncrement() ?? 0) < 0 ? 'text-orange-600' : 'text-blue-600'
                  }`}>
                    {getKilometersIncrement()! >= 0 ? '+' : ''}
                    {formatIntegerMeterReading(getKilometersIncrement()!)} km
                  </span>
                </>
              )}
            </div>
          )}

          {/* Validation messages */}
          {kilometersValid === false && (
            <p className="text-sm text-red-600">
              ⚠️ La lectura parece incorrecta. Verifica el odómetro del equipo.
            </p>
          )}
          {kilometersValid === null &&
            kilometersReading &&
            currentKilometers !== null &&
            parseIntegerMeterReading(kilometersReading) != null &&
            parseIntegerMeterReading(kilometersReading)! < currentKilometers && (
            <p className="text-sm text-orange-600">
              ⚠️ La lectura es menor a la actual. ¿Se reinició el odómetro?
            </p>
          )}
        </div>
      )}

      {/* Skip option for assets without meters */}
      {(currentHours === null && currentKilometers === null) && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Este activo no tiene lecturas registradas.</strong>
            <br />
            Puedes omitir las lecturas si el equipo no tiene horómetro u odómetro.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

