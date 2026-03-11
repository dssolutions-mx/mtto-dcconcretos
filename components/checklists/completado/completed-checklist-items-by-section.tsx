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
} from "lucide-react"
import { SecurityConfig } from "@/types"
import type { CompletedChecklistData, CompletedItem, ChecklistSectionDefinition, ChecklistItemDefinition } from "./types"
import { CompletedItemRow } from "./completed-item-row"

interface CompletedChecklistItemsBySectionProps {
  data: CompletedChecklistData
  operatorNames: Record<string, { nombre: string; apellido: string; employee_code?: string }>
}

export function CompletedChecklistItemsBySection({ data, operatorNames }: CompletedChecklistItemsBySectionProps) {
  const allSections = (data.checklists?.checklist_sections ?? []) as ChecklistSectionDefinition[]
  const uniqueSections = allSections.reduce<ChecklistSectionDefinition[]>((acc, section) => {
    if (!section) return acc
    const sectionTypeKey = section.section_type ?? (section.id && data.security_data?.[section.id] ? 'security_talk' : 'checklist')
    const key = `${sectionTypeKey}::${section.title ?? section.id ?? acc.length}`
    if (!acc.some(existing => {
      const existingTypeKey = existing.section_type ?? (existing.id && data.security_data?.[existing.id] ? 'security_talk' : 'checklist')
      return `${existingTypeKey}::${existing.title ?? existing.id ?? 'unknown'}` === key
    })) acc.push(section)
    return acc
  }, [])

  // Build description map from all sections - support both id and item_id (version format)
  const itemIdToDescription = new Map<string, string>()
  for (const section of uniqueSections) {
    const items = (section.checklist_items ?? (section as any).items) as Array<{ id?: string; item_id?: string; description?: string }> | undefined
    if (items) for (const item of items) {
      const desc = item?.description
      if (desc) {
        if (item?.id) itemIdToDescription.set(item.id, desc)
        if (item?.item_id) itemIdToDescription.set(item.item_id, desc)
      }
    }
  }
  const getDescription = (itemId: string, item?: CompletedItem) =>
    itemIdToDescription.get(itemId) ?? item?.description ?? `Item ${(itemId ?? '?').toString().slice(0, 8)}`
  const getItemCompletionData = (itemId: string): CompletedItem | null =>
    data.completed_items?.find(item => item.item_id === itemId) || null
  const getEffectiveItemId = (item: { id?: string; item_id?: string }) => item?.id ?? item?.item_id

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

  if (uniqueSections.length === 0) return renderFallbackItemsCard()

  const displayedItemIds = new Set<string>()
  const sectionCards = [...uniqueSections]
    .sort((a, b) => a.order_index - b.order_index)
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

      const items = (section.checklist_items ?? (section as any).items) as Array<ChecklistItemDefinition & { item_id?: string }> | undefined
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
