"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Award, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { EvidenceCaptureSection } from "@/components/checklists/evidence-capture-section"
import {
  DEFAULT_BONUS_CLOSURE_CONFIG,
  buildInitialBonusClosureDecision,
  getBonusClosureSectionProgress,
  isBonusClosureSectionComplete,
  normalizeBonusClosureConfig,
} from "@/lib/checklist/bonus-closure-validation"
import {
  bonusClosureResourceKey,
  normalizeBonusClosureDecisionsForState,
  normalizeBonusClosureSectionForEmit,
} from "@/lib/checklist/bonus-closure-section-load"
import { monthlyClosureCountdown } from "@/lib/checklist/plant-operations-schedule"
import type {
  BonusClosureConfig,
  BonusClosureDecision,
  BonusClosureSectionData,
} from "@/types"
import { cn } from "@/lib/utils"

interface Operator {
  id: string
  nombre: string
  apellido: string
  employee_code?: string
  source?: "home_plant" | "asset_assignment" | "both"
}

interface PrefillRow {
  operator_id: string
  weekly_pass_rate: number
  evaluation_ids: string[]
}

interface BonusClosureSectionProps {
  sectionId: string
  sectionTitle: string
  config?: Partial<BonusClosureConfig>
  plantId?: string
  scheduledDay?: string | null
  onDataChange: (sectionId: string, data: BonusClosureSectionData) => void
  initialData?: BonusClosureSectionData
  disabled?: boolean
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

const BONUS_EVIDENCE_CONFIG = {
  min_photos: 0,
  max_photos: 4,
  categories: ["bono_limpieza", "bono_rechazado"],
  descriptions: {
    bono_limpieza: "Evidencia de cumplimiento de limpieza",
    bono_rechazado: "Evidencia de rechazo o incumplimiento",
  },
} as const

function parsePeriod(scheduledDay?: string | null): { year: number; month: number } {
  const key = scheduledDay ?? new Date().toISOString().slice(0, 10)
  const [yearStr, monthStr] = key.split("-")
  return {
    year: Number(yearStr) || new Date().getUTCFullYear(),
    month: Number(monthStr) || new Date().getUTCMonth() + 1,
  }
}

function formatPassRate(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

export function BonusClosureSection({
  sectionId,
  sectionTitle,
  config: configProp,
  plantId,
  scheduledDay,
  onDataChange,
  initialData,
  disabled = false,
}: BonusClosureSectionProps) {
  const config = useMemo(
    () => normalizeBonusClosureConfig(configProp ?? DEFAULT_BONUS_CLOSURE_CONFIG),
    [
      configProp?.bonus_type,
      configProp?.deadline_day,
      configProp?.suggest_eligibility_threshold,
    ]
  )
  const period = parsePeriod(scheduledDay)
  const scheduledMonthKey = `${period.year}-${String(period.month).padStart(2, "0")}-01`
  const resourceKey = bonusClosureResourceKey(plantId, period.year, period.month)

  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(false)
  const [prefillUnavailable, setPrefillUnavailable] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  const loadedResourceKeyRef = useRef<string | null>(null)
  const prefillEmittedRef = useRef(false)

  /** Parent-owned decisions — no local mirror, no emit/sync useEffects. */
  const decisions = useMemo(
    () =>
      normalizeBonusClosureDecisionsForState(
        period.year,
        period.month,
        initialData?.decisions ?? []
      ),
    [initialData?.decisions, period.year, period.month]
  )

  const emitSectionData = useCallback(
    (nextDecisions: BonusClosureDecision[]) => {
      const normalized = normalizeBonusClosureDecisionsForState(
        period.year,
        period.month,
        nextDecisions
      )
      onDataChange(
        sectionId,
        normalizeBonusClosureSectionForEmit({
          period_year: period.year,
          period_month: period.month,
          decisions: normalized,
        })
      )
    },
    [onDataChange, sectionId, period.year, period.month]
  )

  const countdown = monthlyClosureCountdown(scheduledMonthKey, {
    deadlineDay: config.deadline_day,
  })

  useEffect(() => {
    if (!plantId || !resourceKey) return
    if (loadedResourceKeyRef.current === resourceKey) return

    const abortController = new AbortController()
    const fetchKey = resourceKey
    const savedFromParent = initialData?.decisions?.length
      ? normalizeBonusClosureDecisionsForState(
          period.year,
          period.month,
          initialData.decisions
        )
      : null

    async function loadData() {
      setLoading(true)
      setPrefillUnavailable(false)
      try {
        const [opsRes, prefillRes] = await Promise.all([
          fetch(`/api/hr/plant-operations-roster?plant_id=${plantId}`, {
            signal: abortController.signal,
          }),
          fetch(
            `/api/hr/cleanliness-prefill?plant_id=${plantId}&year=${period.year}&month=${period.month}`,
            { signal: abortController.signal }
          ),
        ])

        if (abortController.signal.aborted) return

        if (!opsRes.ok) {
          const message =
            opsRes.status === 403
              ? "No tiene permisos para cargar el roster de operadores."
              : "No se pudo cargar el roster de operadores."
          toast.error(message)
          setOperators([])
          return
        }

        const opsJson = await opsRes.json()
        const ops: Operator[] = opsJson.operators ?? []

        let prefillMap = new Map<string, PrefillRow>()
        if (prefillRes.ok) {
          const prefillJson = await prefillRes.json()
          prefillMap = new Map<string, PrefillRow>(
            (prefillJson.operators ?? []).map((row: PrefillRow) => [row.operator_id, row])
          )
        } else {
          setPrefillUnavailable(true)
          toast.warning(
            "No se pudo cargar el prellenado de limpieza semanal. Puede definir elegibilidad manualmente."
          )
        }

        if (abortController.signal.aborted) return

        loadedResourceKeyRef.current = fetchKey
        setOperators(ops)

        if (savedFromParent?.length) {
          return
        }

        if (!prefillEmittedRef.current && ops.length > 0) {
          prefillEmittedRef.current = true
          const nextDecisions = ops.map((operator) =>
            buildInitialBonusClosureDecision(
              operator,
              prefillMap.get(operator.id),
              config
            )
          )
          emitSectionData(nextDecisions)
        }
      } catch (error) {
        if (abortController.signal.aborted) return
        console.error("Error loading bonus closure data:", error)
        toast.error("Error al cargar datos de cierre de bono. Intente de nuevo.")
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      abortController.abort()
    }
  }, [
    plantId,
    resourceKey,
    period.year,
    period.month,
    config.bonus_type,
    config.deadline_day,
    config.suggest_eligibility_threshold,
    emitSectionData,
    initialData?.decisions,
  ])

  const updateDecision = useCallback(
    (operatorId: string, patch: Partial<BonusClosureDecision>) => {
      const next = decisions.map((row) =>
        row.operator_id === operatorId ? { ...row, ...patch } : row
      )
      emitSectionData(next)
    },
    [decisions, emitSectionData]
  )

  const handleEligibleChange = useCallback(
    (operatorId: string, checked: boolean) => {
      const nextEligible = checked === true
      const current = decisions.find((row) => row.operator_id === operatorId)
      if ((current?.eligible === true) === nextEligible) {
        return
      }

      const next = decisions.map((row) =>
        row.operator_id === operatorId
          ? {
              ...row,
              eligible: nextEligible,
              ineligible_reason: nextEligible
                ? undefined
                : row.ineligible_reason?.trim() || "",
            }
          : row
      )
      emitSectionData(next)
    },
    [decisions, emitSectionData]
  )

  const handleEvidenceChange = useCallback(
    (
      operatorId: string,
      evidences: Array<{
        photo_url: string
        category: string
        description?: string
        photoId?: string
      }>
    ) => {
      updateDecision(operatorId, {
        evidence: evidences.map((item) => ({
          photo_url: item.photo_url,
          category: item.category,
          description: item.description,
          ...(item.photoId ? { photoId: item.photoId } : {}),
        })),
      })
    },
    [updateDecision]
  )

  const handleOperatorEvidenceChange = useCallback(
    (
      operatorSectionId: string,
      evidences: Array<{
        photo_url: string
        category: string
        description?: string
        photoId?: string
      }>
    ) => {
      const prefix = `${sectionId}-`
      if (!operatorSectionId.startsWith(prefix)) return
      const operatorId = operatorSectionId.slice(prefix.length)
      handleEvidenceChange(operatorId, evidences)
    },
    [sectionId, handleEvidenceChange]
  )

  const suggestedCount = decisions.filter((d) => d.system_suggested_eligible).length
  const sectionData: BonusClosureSectionData = {
    period_year: period.year,
    period_month: period.month,
    decisions,
  }
  const savedInDraftCount = decisions.filter(
    (d) => typeof d.eligible === "boolean"
  ).length
  const progress = getBonusClosureSectionProgress(sectionData, operators.length)
  const isComplete = isBonusClosureSectionComplete(sectionData, operators.length)

  const countdownLabel =
    countdown == null
      ? null
      : countdown > 0
        ? `Faltan ${countdown} día(s) para el cierre`
        : countdown === 0
          ? "Cierre vence hoy"
          : `Cierre vencido hace ${Math.abs(countdown)} día(s)`

  return (
    <Card className="mb-6 border-violet-200">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Award className="h-5 w-5 text-violet-600" />
          {sectionTitle}
          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
            Cierre de bono
          </Badge>
        </CardTitle>
        <CardDescription>
          Período: {MONTH_NAMES[period.month - 1]} {period.year}
          {countdownLabel ? ` · ${countdownLabel}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {prefillUnavailable ? (
          <Alert>
            <AlertDescription>
              Las evaluaciones semanales de limpieza no están disponibles. Las
              sugerencias de elegibilidad se omitieron; puede completar el cierre
              manualmente.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <div>
            <span className="text-muted-foreground">Operadores:</span>{" "}
            <span className="font-semibold">{operators.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Sugeridos elegibles:</span>{" "}
            <span className="font-semibold">{suggestedCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Guardados en borrador:</span>{" "}
            <span className="font-semibold">{savedInDraftCount}</span>
            {operators.length > 0 ? (
              <span className="text-muted-foreground"> / {operators.length}</span>
            ) : null}
          </div>
          <div>
            <span className="text-muted-foreground">Completos:</span>{" "}
            <span className="font-semibold">
              {progress.completed}/{progress.total}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando operadores y evaluaciones...
          </div>
        ) : operators.length === 0 ? (
          <Alert>
            <AlertDescription>
              No se encontraron operadores en esta planta
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-8" />
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-center">Evals. semanales</TableHead>
                  <TableHead className="text-center">Sugerencia</TableHead>
                  <TableHead className="text-center">Elegible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisions.map((decision) => {
                  const expanded = expandedRows[decision.operator_id] ?? false
                  const needsReason =
                    decision.eligible === false && !decision.ineligible_reason?.trim()
                  const isEligible = decision.eligible === true

                  return (
                    <React.Fragment key={decision.operator_id}>
                      <TableRow>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setExpandedRows((prev) => ({
                                ...prev,
                                [decision.operator_id]: !expanded,
                              }))
                            }
                            aria-label="Expandir fila"
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>{decision.operator_name}</div>
                          {decision.employee_code ? (
                            <span className="text-xs text-muted-foreground">
                              ({decision.employee_code})
                            </span>
                          ) : null}
                          {operators.find((op) => op.id === decision.operator_id)
                            ?.source === "asset_assignment" ? (
                            <span className="block text-xs text-muted-foreground">
                              Asignado
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {formatPassRate(decision.weekly_pass_rate)}
                          <span className="block text-xs text-muted-foreground">
                            {decision.evaluation_ids.length} eval.
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              decision.system_suggested_eligible
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-amber-300 bg-amber-50 text-amber-900"
                            )}
                          >
                            {decision.system_suggested_eligible ? "Sí" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Checkbox
                              checked={isEligible}
                              onCheckedChange={(checked) =>
                                handleEligibleChange(
                                  decision.operator_id,
                                  checked === true
                                )
                              }
                              disabled={disabled || loading}
                              aria-label={`Elegible — ${decision.operator_name}`}
                            />
                            <span className="text-xs text-muted-foreground">
                              {isEligible ? "Sí" : "No"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/20 p-4 space-y-4">
                            {!isEligible ? (
                              <div className="space-y-2">
                                <Label>
                                  Motivo de no elegibilidad{" "}
                                  <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                  value={decision.ineligible_reason ?? ""}
                                  onChange={(e) =>
                                    updateDecision(decision.operator_id, {
                                      ineligible_reason: e.target.value,
                                    })
                                  }
                                  placeholder="Explique por qué no es elegible para el bono..."
                                  rows={2}
                                  disabled={disabled}
                                  className={cn(needsReason && "border-destructive")}
                                />
                              </div>
                            ) : null}
                            <div className="space-y-2">
                              <Label>Evidencia (opcional)</Label>
                              <EvidenceCaptureSection
                                sectionId={`${sectionId}-${decision.operator_id}`}
                                sectionTitle={`Evidencia — ${decision.operator_name}`}
                                config={BONUS_EVIDENCE_CONFIG}
                                initialEvidences={decision.evidence}
                                onEvidenceChange={handleOperatorEvidenceChange}
                                disabled={disabled}
                                checklistId={`bonus-${sectionId}`}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {!isComplete && !loading ? (
          <Alert variant="destructive">
            <AlertDescription>
              <div>• Defina elegibilidad para todos los operadores</div>
              <div>• Los no elegibles requieren motivo</div>
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
