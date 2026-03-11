"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { CompletedChecklistData, ChecklistSectionDefinition, ChecklistItemDefinition } from "./types"
import { CompletedChecklistHeader } from "./completed-checklist-header"
import { CompletedChecklistGeneralInfo } from "./completed-checklist-general-info"
import { CompletedChecklistResultsSummary } from "./completed-checklist-results-summary"
import { CompletedChecklistItemsBySection } from "./completed-checklist-items-by-section"
import { CompletedChecklistIssuesCard } from "./completed-checklist-issues-card"
import { CompletedChecklistExecutionInfo } from "./completed-checklist-execution-info"

export function CompletedChecklistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const checklistId = resolvedParams.id
  const router = useRouter()
  const [data, setData] = useState<CompletedChecklistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [operatorNames, setOperatorNames] = useState<Record<string, { nombre: string; apellido: string; employee_code?: string }>>({})

  useEffect(() => {
    const fetchCompletedChecklist = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/checklists/completed/${checklistId}`)
        if (!response.ok) throw new Error('Error al cargar los detalles del checklist')
        const result = await response.json()
        setData(result.data)
        if (result.data?.security_data) {
          const attendeeIds: string[] = []
          Object.values(result.data.security_data).forEach((sectionData: { attendees?: string[] }) => {
            if (sectionData.attendees?.length) attendeeIds.push(...sectionData.attendees)
          })
          if (attendeeIds.length > 0) {
            const res = await fetch(`/api/operators/register?ids=${[...new Set(attendeeIds)].join(',')}`)
            if (res.ok) {
              const operators = await res.json()
              const namesMap: Record<string, { nombre: string; apellido: string; employee_code?: string }> = {}
              operators.forEach((op: { id: string; nombre?: string; apellido?: string; employee_code?: string }) => {
                namesMap[op.id] = { nombre: op.nombre || '', apellido: op.apellido || '', employee_code: op.employee_code }
              })
              setOperatorNames(namesMap)
            }
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }
    if (checklistId) fetchCompletedChecklist()
  }, [checklistId])

  const formatDate = (dateString: string) =>
    format(new Date(dateString), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Cargando checklist..." text="Obteniendo detalles del checklist completado">
          <Button variant="outline" onClick={() => router.back()} className="cursor-pointer">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </DashboardHeader>
        <div className="space-y-4">
          <Card>
            <CardHeader><Skeleton className="h-8 w-64" /></CardHeader>
            <CardContent><Skeleton className="h-32 w-full" /></CardContent>
          </Card>
        </div>
      </DashboardShell>
    )
  }

  if (error || !data) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Error" text="No se pudo cargar el checklist">
          <Button variant="outline" onClick={() => router.back()} className="cursor-pointer">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </DashboardHeader>
        <Alert variant="destructive">
          <AlertDescription>{error || "Checklist no encontrado"}</AlertDescription>
        </Alert>
      </DashboardShell>
    )
  }

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

  const totalItems = uniqueSections.reduce((total, section) => {
    const securityDataForSection = section?.id ? data.security_data?.[section.id] : undefined
    const isSecuritySection = section.section_type === 'security_talk' || !!securityDataForSection
    if (section.section_type === 'checklist' || (!section.section_type && !isSecuritySection)) {
      const items = section.checklist_items as ChecklistItemDefinition[] | undefined
      return total + (items?.length ?? 0)
    }
    return total
  }, 0) || 0
  const passedItems = data.completed_items?.filter(i => i.status === 'pass').length || 0
  const flaggedItems = data.completed_items?.filter(i => i.status === 'flag').length || 0
  const failedItems = data.completed_items?.filter(i => i.status === 'fail').length || 0

  return (
    <DashboardShell className="checklist-module">
      <DashboardHeader
        heading={`Checklist: ${data.checklists?.name || 'Checklist'}`}
        text={`Detalles del checklist completado el ${formatDate(data.completion_date)}`}
      >
        <CompletedChecklistHeader assetId={data.asset_id} onBack={() => router.back()} />
      </DashboardHeader>

      <div className="space-y-6">
        <CompletedChecklistGeneralInfo data={data} formatDate={formatDate} />
        <CompletedChecklistResultsSummary totalItems={totalItems} passedItems={passedItems} flaggedItems={flaggedItems} failedItems={failedItems} />
        <div className="space-y-4">
          <CompletedChecklistItemsBySection data={data} operatorNames={operatorNames} />
        </div>
        {data.issues?.length ? <CompletedChecklistIssuesCard issues={data.issues} /> : null}
        <CompletedChecklistExecutionInfo data={data} formatDate={formatDate} />
      </div>
    </DashboardShell>
  )
}
