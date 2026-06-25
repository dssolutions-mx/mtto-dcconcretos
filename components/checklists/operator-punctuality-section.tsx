"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Clock, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import {
  DEFAULT_PUNCTUALITY_CONFIG,
  isPunctualitySectionComplete,
  normalizePunctualityConfig,
} from "@/lib/checklist/punctuality-validation"
import type { PunctualityConfig, PunctualitySectionData, PunctualityStatus } from "@/types"
import { cn } from "@/lib/utils"

interface Operator {
  id: string
  nombre: string
  apellido: string
  employee_code?: string
  source?: "home_plant" | "asset_assignment" | "both"
}

interface OperatorPunctualitySectionProps {
  sectionId: string
  sectionTitle: string
  config?: Partial<PunctualityConfig>
  plantId?: string
  onDataChange: (sectionId: string, data: PunctualitySectionData) => void
  initialData?: PunctualitySectionData
  disabled?: boolean
}

const STATUS_OPTIONS: Array<{
  value: PunctualityStatus
  label: string
  shortLabel: string
}> = [
  { value: "on_time", label: "Puntual", shortLabel: "Punt." },
  { value: "late", label: "Tarde", shortLabel: "Tarde" },
  { value: "absent", label: "Ausente", shortLabel: "Aus." },
]

function emptySectionData(): PunctualitySectionData {
  return { had_production: null, entries: [] }
}

export function OperatorPunctualitySection({
  sectionId,
  sectionTitle,
  config: configProp,
  plantId,
  onDataChange,
  initialData,
  disabled = false,
}: OperatorPunctualitySectionProps) {
  const config = normalizePunctualityConfig(configProp ?? DEFAULT_PUNCTUALITY_CONFIG)
  const [operators, setOperators] = useState<Operator[]>([])
  const [loadingOperators, setLoadingOperators] = useState(false)
  const [hadProduction, setHadProduction] = useState<boolean | null>(
    initialData?.had_production ?? null
  )
  const [entries, setEntries] = useState<PunctualitySectionData["entries"]>(
    initialData?.entries ?? []
  )
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!plantId || hadProduction !== true) return
    void fetchOperators()
  }, [plantId, hadProduction])

  const fetchOperators = async () => {
    if (!plantId) return

    setLoadingOperators(true)
    try {
      const response = await fetch(
        `/api/hr/plant-operations-roster?plant_id=${plantId}`
      )
      if (response.ok) {
        const data = await response.json()
        setOperators(data.operators || [])
      }
    } catch (error) {
      console.error("Error fetching operators:", error)
    } finally {
      setLoadingOperators(false)
    }
  }

  const emitChange = useCallback(
    (
      nextProduction: boolean | null,
      nextEntries: PunctualitySectionData["entries"],
      operatorCount: number
    ) => {
      onDataChange(sectionId, {
        had_production: nextProduction,
        entries: nextEntries,
        operator_count: operatorCount,
      })
    },
    [onDataChange, sectionId]
  )

  useEffect(() => {
    const operatorCount = hadProduction === true ? operators.length : 0
    emitChange(hadProduction, entries, operatorCount)
  }, [hadProduction, entries, operators.length, emitChange])

  const handleProductionChange = (value: string) => {
    const next = value === "yes"
    setHadProduction(next)
    if (!next) {
      setEntries([])
      setExpandedNotes({})
    }
  }

  const handleStatusChange = (operatorId: string, status: PunctualityStatus) => {
    setEntries((prev) => {
      const existing = prev.find((entry) => entry.operator_id === operatorId)
      if (existing) {
        return prev.map((entry) =>
          entry.operator_id === operatorId ? { ...entry, status } : entry
        )
      }
      return [...prev, { operator_id: operatorId, status }]
    })
  }

  const handleNotesChange = (operatorId: string, notes: string) => {
    setEntries((prev) => {
      const existing = prev.find((entry) => entry.operator_id === operatorId)
      if (existing) {
        return prev.map((entry) =>
          entry.operator_id === operatorId
            ? { ...entry, notes: notes || undefined }
            : entry
        )
      }
      return [...prev, { operator_id: operatorId, status: "on_time", notes }]
    })
  }

  const getEntryForOperator = (operatorId: string) =>
    entries.find((entry) => entry.operator_id === operatorId)

  const showGrid = hadProduction === true
  const sectionData: PunctualitySectionData = {
    had_production: hadProduction,
    entries,
    operator_count: operators.length,
  }
  const isComplete = isPunctualitySectionComplete(
    sectionData,
    config,
    operators.length
  )

  return (
    <Card className="mb-6 border-sky-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-sky-600" />
          {sectionTitle}
          <Badge
            variant="outline"
            className="bg-sky-50 text-sky-700 border-sky-200"
          >
            Puntualidad
          </Badge>
        </CardTitle>
        <CardDescription>
          Registre la asistencia y puntualidad de los operadores del día
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {config.require_production_flag && (
          <div className="space-y-3">
            <Label className="text-base font-medium">
              ¿Hubo producción hoy? <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={hadProduction === true ? "default" : "outline"}
                className={cn(
                  "min-w-[5rem]",
                  hadProduction === true && "bg-sky-600 hover:bg-sky-700"
                )}
                onClick={() => handleProductionChange("yes")}
                disabled={disabled}
              >
                Sí
              </Button>
              <Button
                type="button"
                variant={hadProduction === false ? "default" : "outline"}
                className={cn(
                  "min-w-[5rem]",
                  hadProduction === false && "bg-slate-600 hover:bg-slate-700"
                )}
                onClick={() => handleProductionChange("no")}
                disabled={disabled}
              >
                No
              </Button>
            </div>
            {hadProduction === false && (
              <p className="text-sm text-muted-foreground">
                Sin producción hoy — no se requiere registrar asistencia.
              </p>
            )}
          </div>
        )}

        {showGrid && (
          <div className="space-y-3">
            <Label className="text-base font-medium">Asistencia de operadores</Label>

            {loadingOperators ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando operadores...
              </div>
            ) : operators.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No se encontraron operadores en esta planta
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="hidden md:block rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Operador</TableHead>
                        <TableHead className="text-center w-24">Puntual</TableHead>
                        <TableHead className="text-center w-24">Tarde</TableHead>
                        <TableHead className="text-center w-24">Ausente</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operators.map((operator) => {
                        const entry = getEntryForOperator(operator.id)
                        const notesOpen = expandedNotes[operator.id] ?? false
                        return (
                          <React.Fragment key={operator.id}>
                            <TableRow>
                              <TableCell className="font-medium">
                                <div>
                                  {operator.nombre} {operator.apellido}
                                  {operator.employee_code && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      ({operator.employee_code})
                                    </span>
                                  )}
                                </div>
                                {operator.source === "asset_assignment" ? (
                                  <span className="text-xs text-muted-foreground">
                                    Asignado
                                  </span>
                                ) : null}
                              </TableCell>
                              <TableCell colSpan={3} className="p-2">
                                <RadioGroup
                                  value={entry?.status ?? ""}
                                  onValueChange={(value) =>
                                    handleStatusChange(
                                      operator.id,
                                      value as PunctualityStatus
                                    )
                                  }
                                  className="grid grid-cols-3 gap-2"
                                  disabled={disabled}
                                >
                                  {STATUS_OPTIONS.map((option) => (
                                    <div
                                      key={option.value}
                                      className="flex flex-col items-center gap-1"
                                    >
                                      <span className="text-xs text-muted-foreground md:hidden">
                                        {option.label}
                                      </span>
                                      <div className="flex items-center justify-center gap-2">
                                        <RadioGroupItem
                                          value={option.value}
                                          id={`${sectionId}-${operator.id}-${option.value}-desktop`}
                                          aria-label={`${operator.nombre} — ${option.label}`}
                                        />
                                        <Label
                                          htmlFor={`${sectionId}-${operator.id}-${option.value}-desktop`}
                                          className="text-sm font-normal cursor-pointer hidden md:inline"
                                        >
                                          {option.label}
                                        </Label>
                                      </div>
                                    </div>
                                  ))}
                                </RadioGroup>
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    setExpandedNotes((prev) => ({
                                      ...prev,
                                      [operator.id]: !notesOpen,
                                    }))
                                  }
                                  aria-label="Notas"
                                >
                                  {notesOpen ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                            {notesOpen && (
                              <TableRow>
                                <TableCell colSpan={5} className="bg-muted/20">
                                  <Textarea
                                    value={entry?.notes ?? ""}
                                    onChange={(e) =>
                                      handleNotesChange(
                                        operator.id,
                                        e.target.value
                                      )
                                    }
                                    placeholder="Notas opcionales..."
                                    rows={2}
                                    disabled={disabled}
                                  />
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden space-y-3">
                  {operators.map((operator) => {
                    const entry = getEntryForOperator(operator.id)
                    const notesOpen = expandedNotes[operator.id] ?? false
                    return (
                      <div
                        key={operator.id}
                        className="rounded-lg border p-3 space-y-3 bg-card"
                      >
                        <div className="font-medium">
                          {operator.nombre} {operator.apellido}
                          {operator.employee_code && (
                            <span className="block text-xs text-muted-foreground">
                              {operator.employee_code}
                            </span>
                          )}
                          {operator.source === "asset_assignment" ? (
                            <span className="block text-xs text-muted-foreground">
                              Asignado
                            </span>
                          ) : null}
                        </div>
                        <RadioGroup
                          value={entry?.status ?? ""}
                          onValueChange={(value) =>
                            handleStatusChange(
                              operator.id,
                              value as PunctualityStatus
                            )
                          }
                          className="grid grid-cols-3 gap-2"
                          disabled={disabled}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <div
                              key={option.value}
                              className={cn(
                                "flex flex-col items-center gap-1 rounded-md border p-2",
                                entry?.status === option.value &&
                                  "border-sky-500 bg-sky-50"
                              )}
                            >
                              <RadioGroupItem
                                value={option.value}
                                id={`${sectionId}-${operator.id}-${option.value}-mobile`}
                              />
                              <Label
                                htmlFor={`${sectionId}-${operator.id}-${option.value}-mobile`}
                                className="text-xs font-normal cursor-pointer"
                              >
                                {option.shortLabel}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        <Collapsible
                          open={notesOpen}
                          onOpenChange={(open) =>
                            setExpandedNotes((prev) => ({
                              ...prev,
                              [operator.id]: open,
                            }))
                          }
                        >
                          <CollapsibleTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full justify-between px-0"
                            >
                              Notas opcionales
                              {notesOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <Textarea
                              value={entry?.notes ?? ""}
                              onChange={(e) =>
                                handleNotesChange(operator.id, e.target.value)
                              }
                              placeholder="Agregar nota..."
                              rows={2}
                              disabled={disabled}
                              className="mt-2"
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {!isComplete && (
          <Alert variant="destructive">
            <AlertDescription>
              {config.require_production_flag && hadProduction === null && (
                <div>• Indique si hubo producción hoy</div>
              )}
              {showGrid && operators.length > 0 && (
                <div>• Registre puntualidad para todos los operadores</div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

export { emptySectionData }
