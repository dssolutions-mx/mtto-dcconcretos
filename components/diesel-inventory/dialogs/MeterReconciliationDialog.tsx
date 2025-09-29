"use client"

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  AlertTriangle, Calendar, Gauge, TrendingUp, Check, X, SkipForward, Info
} from "lucide-react"
import { MeterConflict } from '@/types/diesel'
import { useDieselStore } from '@/store/diesel-store'

type Props = {
  open: boolean
  onClose: () => void
  onResolveAll: () => void
}

export function MeterReconciliationDialog({ open, onClose, onResolveAll }: Props) {
  const { meterConflicts, resolveMeterConflict, meterPreferences, setMeterPreferences } = useDieselStore()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [rememberChoice, setRememberChoice] = useState(false)

  const unresolved = meterConflicts.filter(c => c.resolution === 'pending')
  const current = unresolved[currentIndex]
  const hasMore = currentIndex < unresolved.length - 1

  const handleResolve = (resolution: MeterConflict['resolution']) => {
    if (!current) return

    resolveMeterConflict(current.asset_code, resolution)

    // Update preferences if user wants to remember
    if (rememberChoice && resolution !== 'pending') {
      if (resolution === 'use_diesel') {
        setMeterPreferences({ default_action: 'always_use_diesel' })
      } else if (resolution === 'keep_checklist') {
        setMeterPreferences({ default_action: 'always_keep_checklist' })
      }
    }

    // Move to next conflict or close
    if (hasMore) {
      setCurrentIndex(currentIndex + 1)
    } else {
      onResolveAll()
      onClose()
    }
  }

  if (!current) {
    return null
  }

  const daysDiff = current.checklist_date 
    ? Math.abs((current.diesel_date.getTime() - current.checklist_date.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Conflicto de Lectura de Medidor
          </DialogTitle>
          <DialogDescription>
            Se detectó una diferencia entre los datos de diesel y el checklist para el activo <strong className="font-mono">{current.asset_code}</strong>.
            Decide cuál lectura debe prevalecer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Conflicto {currentIndex + 1} de {unresolved.length}
            </span>
            <Badge variant="secondary">
              {unresolved.length - currentIndex - 1} restantes
            </Badge>
          </div>

          <Separator />

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Diesel Data */}
            <div className="p-4 border-2 border-blue-300 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-blue-100 rounded">
                  <Gauge className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-blue-900">Lectura de Diesel</div>
                  <div className="text-xs text-blue-700">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {current.diesel_date.toLocaleDateString('es-MX')}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {current.diesel_horometer != null && (
                  <div className="flex justify-between items-center p-2 bg-white rounded">
                    <span className="text-sm text-gray-600">Horómetro</span>
                    <span className="font-mono font-bold text-blue-900">
                      {current.diesel_horometer.toLocaleString('es-MX')} hrs
                    </span>
                  </div>
                )}
                {current.diesel_kilometer != null && (
                  <div className="flex justify-between items-center p-2 bg-white rounded">
                    <span className="text-sm text-gray-600">Kilómetros</span>
                    <span className="font-mono font-bold text-blue-900">
                      {current.diesel_kilometer.toLocaleString('es-MX')} km
                    </span>
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-2">
                  Fila #{current.diesel_row_number} del archivo de importación
                </div>
              </div>
            </div>

            {/* Checklist Data */}
            <div className="p-4 border-2 border-green-300 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-100 rounded">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="font-semibold text-green-900">Lectura de Checklist</div>
                  <div className="text-xs text-green-700">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {current.checklist_date?.toLocaleDateString('es-MX') || 'No disponible'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {current.checklist_horometer != null ? (
                  <div className="flex justify-between items-center p-2 bg-white rounded">
                    <span className="text-sm text-gray-600">Horómetro</span>
                    <span className="font-mono font-bold text-green-900">
                      {current.checklist_horometer.toLocaleString('es-MX')} hrs
                    </span>
                  </div>
                ) : (
                  <div className="p-2 bg-white rounded text-sm text-gray-500 italic">
                    Sin lectura de horómetro
                  </div>
                )}
                {current.checklist_kilometer != null ? (
                  <div className="flex justify-between items-center p-2 bg-white rounded">
                    <span className="text-sm text-gray-600">Kilómetros</span>
                    <span className="font-mono font-bold text-green-900">
                      {current.checklist_kilometer.toLocaleString('es-MX')} km
                    </span>
                  </div>
                ) : (
                  <div className="p-2 bg-white rounded text-sm text-gray-500 italic">
                    Sin lectura de kilómetros
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-2">
                  Fuente: {current.checklist_source}
                </div>
              </div>
            </div>
          </div>

          {/* Differences */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Análisis de Diferencias</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1 text-sm">
                {current.horometer_diff != null && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      Diferencia en horómetro: <strong>{Math.abs(current.horometer_diff).toFixed(1)} horas</strong>
                      {current.is_diesel_higher ? ' (diesel más alto)' : ' (checklist más alto)'}
                    </span>
                  </div>
                )}
                {current.kilometer_diff != null && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      Diferencia en kilómetros: <strong>{Math.abs(current.kilometer_diff).toFixed(0)} km</strong>
                      {current.is_diesel_higher ? ' (diesel más alto)' : ' (checklist más alto)'}
                    </span>
                  </div>
                )}
                {daysDiff != null && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {current.is_diesel_newer 
                        ? `La lectura de diesel es ${daysDiff.toFixed(0)} días más reciente`
                        : `La lectura de checklist es ${daysDiff.toFixed(0)} días más reciente`
                      }
                    </span>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Recommendation */}
          {current.is_diesel_newer && current.is_diesel_higher && (
            <Alert className="border-blue-300 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-900">Recomendación</AlertTitle>
              <AlertDescription className="text-blue-800">
                La lectura de diesel parece ser más reciente y tiene valores más altos, 
                lo cual es consistente con el uso normal del equipo. Se recomienda usar la lectura de diesel.
              </AlertDescription>
            </Alert>
          )}

          {/* Remember choice */}
          <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded">
            <Checkbox
              id="remember"
              checked={rememberChoice}
              onCheckedChange={(checked) => setRememberChoice(checked as boolean)}
            />
            <label
              htmlFor="remember"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Recordar mi decisión y aplicar a todos los conflictos restantes
            </label>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleResolve('skip')}
            className="w-full sm:w-auto"
          >
            <SkipForward className="mr-2 h-4 w-4" />
            Omitir este Activo
          </Button>
          <Button
            variant="outline"
            onClick={() => handleResolve('keep_checklist')}
            className="w-full sm:w-auto border-green-300 hover:bg-green-50"
          >
            <Check className="mr-2 h-4 w-4" />
            Mantener Checklist
          </Button>
          <Button
            onClick={() => handleResolve('use_diesel')}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            <Gauge className="mr-2 h-4 w-4" />
            Usar Lectura de Diesel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
