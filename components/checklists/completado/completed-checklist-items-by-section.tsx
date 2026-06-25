"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CheckCircle,
  AlertTriangle,
  User,
  Users,
  MessageSquare,
  Lightbulb,
  Camera,
  ExternalLink,
  Shield,
  Clock,
  Award,
  XCircle,
} from "lucide-react"
import { SecurityConfig } from "@/types"
import type { PunctualitySectionData, BonusClosureSectionData } from "@/types"
import type { CompletedChecklistData, CompletedItem, ChecklistSectionDefinition, ChecklistItemDefinition } from "./types"
import { CompletedItemRow } from "./completed-item-row"
import { CompletedTireReadingsSection } from "./completed-tire-readings-section"
import type { ChecklistTireReadingInput } from "@/lib/tires/checklist-readings"
import {
  buildItemDescriptionMap,
  getEffectiveTemplateItemId,
  getSectionChecklistItems,
  normalizeCompletedChecklistSections,
  resolveCompletedItemDescription,
  sortSectionsByOrder,
} from "@/lib/checklist/completed-checklist-display"

interface CompletedChecklistItemsBySectionProps {
  data: CompletedChecklistData
  operatorNames: Record<string, { nombre: string; apellido: string; employee_code?: string }>
}

const PUNCTUALITY_STATUS_LABELS: Record<string, string> = {
  on_time: "Puntual",
  late: "Tarde",
  absent: "Ausente",
}

function isPunctualityData(value: unknown): value is PunctualitySectionData {
  return Boolean(value && typeof value === "object" && "entries" in (value as object))
}

function isBonusClosureData(value: unknown): value is BonusClosureSectionData {
  return Boolean(value && typeof value === "object" && "decisions" in (value as object))
}

export function CompletedChecklistItemsBySection({ data, operatorNames }: CompletedChecklistItemsBySectionProps) {
  const sections = sortSectionsByOrder(
    normalizeCompletedChecklistSections(
      (data.checklists?.checklist_sections ?? []) as ChecklistSectionDefinition[]
    )
  )

  const itemIdToDescription = buildItemDescriptionMap(sections)
  const getDescription = (itemId: string, item?: CompletedItem) =>
    resolveCompletedItemDescription(itemId, item, itemIdToDescription)
  const getItemCompletionData = (itemId: string): CompletedItem | null =>
    data.completed_items?.find(item => item.item_id === itemId) || null
  const getEffectiveItemId = getEffectiveTemplateItemId

  const renderFallbackItemsCard = () => {
    const items = data.completed_items ?? []
    if (items.length === 0) {
      return (
        <div className="text-center text-muted-foreground p-8">
          <p>No se encontraron elementos completados.</p>
          <p className="text-sm mt-2">Este checklist no contiene datos de evaluación.</p>
        </div>
      )
    }
    return (
      <Card className="shadow-checklist-2">
        <CardHeader>
          <CardTitle className="text-lg">Elementos Evaluados</CardTitle>
          <CardDescription>Items completados en este checklist</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((item, index) => (
              <CompletedItemRow key={item.item_id || index} item={item} description={getDescription(item.item_id, item)} />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (sections.length === 0) return renderFallbackItemsCard()

  const displayedItemIds = new Set<string>()
  const sectionCards = sections
    .map((section) => {
      const securityData = section?.id ? data.security_data?.[section.id] : undefined
      const hasAttendeeList = Array.isArray(securityData?.attendees) && securityData?.attendees.length > 0
      const baseConfig: SecurityConfig = section.security_config || {
        mode: hasAttendeeList ? 'plant_manager' : 'operator',
        require_attendance: true,
        require_topic: true,
        require_reflection: true,
        allow_evidence: Array.isArray(securityData?.evidence) && securityData?.evidence.length > 0
      }
      const isSecuritySection = section.section_type === 'security_talk' || !!securityData
      const isPlantManagerMode = baseConfig.mode === 'plant_manager' || (!section.security_config && hasAttendeeList)

      if (section.section_type === 'tire_readings') {
        const snapshot = (data.tire_readings_snapshot ?? []) as ChecklistTireReadingInput[]
        return (
          <CompletedTireReadingsSection
            key={section.id || `tire-${section.title}`}
            sectionTitle={section.title || 'Lecturas de llantas'}
            config={section.tire_readings_config}
            readings={snapshot}
          />
        )
      }

      const plantOpsData = section?.id ? data.plant_operations_data?.[section.id] : undefined

      if (section.section_type === 'operator_punctuality' || (plantOpsData && isPunctualityData(plantOpsData))) {
        if (!plantOpsData || !isPunctualityData(plantOpsData)) return null
        return (
          <Card key={section.id || `punctuality-${section.title}`} className="border-sky-200 bg-sky-50/50 shadow-checklist-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-sky-600" aria-hidden />
                {section.title || 'Puntualidad de operadores'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.punctuality_config?.require_production_flag !== false && (
                <div className="flex items-center gap-2 text-sm">
                  {plantOpsData.had_production === true ? (
                    <CheckCircle className="h-4 w-4 text-green-600" aria-hidden />
                  ) : plantOpsData.had_production === false ? (
                    <XCircle className="h-4 w-4 text-gray-400" aria-hidden />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
                  )}
                  <span>
                    {plantOpsData.had_production === true
                      ? 'Hubo producción en el día'
                      : plantOpsData.had_production === false
                        ? 'No hubo producción en el día'
                        : 'Producción no registrada'}
                  </span>
                </div>
              )}
              {plantOpsData.entries?.length ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Registro por operador</div>
                  <ul className="space-y-2">
                    {plantOpsData.entries.map((entry) => {
                      const op = operatorNames[entry.operator_id]
                      const name = op
                        ? `${op.nombre} ${op.apellido}${op.employee_code ? ` (${op.employee_code})` : ''}`
                        : `Operador ${entry.operator_id.substring(0, 8)}…`
                      return (
                        <li key={entry.operator_id} className="rounded-md border bg-background/80 px-3 py-2 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{name}</span>
                            <span className="text-muted-foreground">
                              {PUNCTUALITY_STATUS_LABELS[entry.status] ?? entry.status}
                            </span>
                          </div>
                          {entry.notes?.trim() ? (
                            <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{entry.notes}</p>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin registros de puntualidad</p>
              )}
            </CardContent>
          </Card>
        )
      }

      if (section.section_type === 'bonus_closure' || (plantOpsData && isBonusClosureData(plantOpsData))) {
        if (!plantOpsData || !isBonusClosureData(plantOpsData)) return null
        const monthLabel = plantOpsData.period_month && plantOpsData.period_year
          ? `${String(plantOpsData.period_month).padStart(2, '0')}/${plantOpsData.period_year}`
          : null
        return (
          <Card key={section.id || `bonus-${section.title}`} className="border-violet-200 bg-violet-50/50 shadow-checklist-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5 text-violet-600" aria-hidden />
                {section.title || 'Cierre de bono'}
                {monthLabel ? (
                  <span className="text-sm font-normal text-muted-foreground">— {monthLabel}</span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {plantOpsData.decisions?.length ? (
                <div className="space-y-3">
                  {plantOpsData.decisions.map((decision) => {
                    const op = operatorNames[decision.operator_id]
                    const name = decision.operator_name
                      ?? (op ? `${op.nombre} ${op.apellido}` : `Operador ${decision.operator_id.substring(0, 8)}…`)
                    return (
                      <div key={decision.operator_id} className="rounded-md border bg-background/80 px-3 py-3 text-sm space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{name}</span>
                          <span className={decision.eligible ? 'text-green-700' : 'text-red-700'}>
                            {decision.eligible ? 'Elegible' : 'No elegible'}
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          Cumplimiento semanal: {Math.round((decision.weekly_pass_rate ?? 0) * 100)}%
                          {decision.system_suggested_eligible != null && (
                            <span className="ml-2">
                              (sugerencia: {decision.system_suggested_eligible ? 'elegible' : 'no elegible'})
                            </span>
                          )}
                        </div>
                        {!decision.eligible && decision.ineligible_reason?.trim() ? (
                          <p className="text-muted-foreground whitespace-pre-wrap">{decision.ineligible_reason}</p>
                        ) : null}
                        {decision.evidence?.length ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                            {decision.evidence.map((evidence, idx) => (
                              <div key={idx} className="relative">
                                <img src={evidence.photo_url} alt={`Evidencia ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
                                <a href={evidence.photo_url} target="_blank" rel="noopener noreferrer" className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded">
                                  <ExternalLink className="h-3 w-3" aria-hidden />
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin decisiones de bono registradas</p>
              )}
            </CardContent>
          </Card>
        )
      }

      if (isSecuritySection) {
        if (!securityData) return null
        const config = baseConfig
        return (
          <Card key={section.id || `security-${section.title}`} className="border-orange-200 bg-orange-50/50 shadow-checklist-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-orange-600" aria-hidden />
                {section.title || 'Charla de seguridad'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {config.require_attendance && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      {isPlantManagerMode ? <Users className="h-4 w-4" aria-hidden /> : <User className="h-4 w-4" aria-hidden />}
                      {isPlantManagerMode ? 'Asistentes' : 'Asistencia'}
                    </div>
                    {isPlantManagerMode ? (
                      securityData.attendees?.length ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-muted-foreground mb-2">
                            {securityData.attendees.length} operador{securityData.attendees.length > 1 ? 'es' : ''} asistieron:
                          </div>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {securityData.attendees.map((operatorId: string) => {
                              const op = operatorNames[operatorId]
                              return (
                                <li key={operatorId} className="flex items-center gap-2">
                                  {op ? <><span>{op.nombre} {op.apellido}</span>{op.employee_code && <span className="text-gray-500">({op.employee_code})</span>}</> : <span className="text-gray-400">Cargando operador {operatorId.substring(0, 8)}...</span>}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No hay asistentes registrados</div>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <CheckCircle className={`h-4 w-4 ${securityData.attendance === true ? 'text-green-600' : 'text-gray-400'}`} aria-hidden />
                        <span className="text-sm">{securityData.attendance === true ? 'Asistió a la charla' : securityData.attendance === false ? 'No asistió' : 'No registrado'}</span>
                      </div>
                    )}
                  </div>
                )}
                {securityData.topic && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><MessageSquare className="h-4 w-4" aria-hidden />Tema Cubierto</div>
                    <p className="text-sm bg-muted p-3 rounded-md">{securityData.topic}</p>
                  </div>
                )}
                {securityData.reflection && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Lightbulb className="h-4 w-4" aria-hidden />Reflexión</div>
                    <p className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">{securityData.reflection}</p>
                  </div>
                )}
                {securityData.evidence?.length ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Camera className="h-4 w-4" aria-hidden />Evidencia Fotográfica</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {securityData.evidence.map((evidence: { photo_url: string }, idx: number) => (
                        <div key={idx} className="relative">
                          <img src={evidence.photo_url} alt={`Evidencia ${idx + 1}`} className="w-full h-32 object-cover rounded border" />
                          <a href={evidence.photo_url} target="_blank" rel="noopener noreferrer" className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded cursor-pointer">
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )
      }

      const items = getSectionChecklistItems(section) as Array<ChecklistItemDefinition & { item_id?: string }>
      const completedSectionItems = items
        ?.filter(item => {
          const eid = getEffectiveItemId(item)
          return eid && getItemCompletionData(eid)
        })
        ?.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      if (!completedSectionItems?.length) return null

      completedSectionItems.forEach(item => {
        const eid = getEffectiveItemId(item)
        if (eid) displayedItemIds.add(eid)
      })

      return (
        <Card key={section.id} className="shadow-checklist-2">
          <CardHeader><CardTitle className="text-lg">{section.title}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedSectionItems.map((item) => {
                const eid = getEffectiveItemId(item)
                const completionData = eid ? getItemCompletionData(eid) : null
                if (!completionData) return null
                const desc = item.description ?? itemIdToDescription.get(eid) ?? getDescription(eid, completionData)
                return (
                  <CompletedItemRow key={eid} item={completionData} description={desc} />
                )
              })}
            </div>
          </CardContent>
        </Card>
      )
    })
    .filter(Boolean)

  // Show any completed_items not placed in sections (ID mismatch, version drift, etc.)
  const orphanedItems = (data.completed_items ?? []).filter(ci => ci.item_id && !displayedItemIds.has(ci.item_id))

  if (sectionCards.length === 0 && (data.completed_items?.length ?? 0) > 0) return renderFallbackItemsCard()
  if (sectionCards.length === 0) return renderFallbackItemsCard()

  return (
    <>
      {sectionCards}
      {orphanedItems.length > 0 && (
        <Card className="shadow-checklist-2">
          <CardHeader>
            <CardTitle className="text-lg">Otros elementos evaluados</CardTitle>
            <CardDescription>Items completados que no se pudieron asignar a una sección</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orphanedItems.map((item, index) => (
                <CompletedItemRow key={item.item_id || index} item={item} description={getDescription(item.item_id, item)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
