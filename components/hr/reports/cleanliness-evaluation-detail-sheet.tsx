'use client'

import { useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Truck,
  User,
  Users,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RhReportLoading } from './rh-report-states'
import {
  CleanlinessItemBadge,
  CleanlinessScoreBadge,
} from './cleanliness-status-badge'

interface EvaluationDetails {
  id: string
  asset_name: string
  asset_code: string
  technician_name: string
  completed_date: string
  checklist_name: string
  cleanliness_sections: Array<{
    title: string
    items: Array<{
      id: string
      description: string
      status: 'pass' | 'fail' | 'flag'
      notes?: string
    }>
  }>
  notes: string
  signature_data?: string
  evidence: Array<{
    id: string
    category: string
    description: string
    photo_url: string
    sequence_order: number
    created_at: string
  }>
  primary_operator_name?: string
  primary_operator_code?: string
  secondary_operator_name?: string
}

export function CleanlinessEvaluationDetailSheet({ reportId }: { reportId: string }) {
  const [evaluation, setEvaluation] = useState<EvaluationDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const fetchEvaluationDetails = async () => {
    if (!reportId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/hr/cleanliness-reports?evaluation_id=${reportId}`)
      if (!response.ok) throw new Error('No se pudo cargar la evaluación')
      const data = await response.json()
      setEvaluation(data.evaluation)
    } catch (err) {
      console.error('[cleanliness-detail]', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setEvaluation(null)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) void fetchEvaluationDetails()
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs sm:px-3 sm:text-sm">
          Ver detalle
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Evaluación de limpieza</SheetTitle>
          <SheetDescription>Evidencia y desglose por sección.</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="mt-8">
            <RhReportLoading rows={4} />
          </div>
        ) : error ? (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : evaluation ? (
          <div className="mt-6 space-y-6 pb-8">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{evaluation.asset_name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{evaluation.asset_code}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{evaluation.technician_name}</p>
                  <p className="text-xs text-muted-foreground">Técnico evaluador</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {evaluation.primary_operator_name || 'Sin asignar'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Operador
                    {evaluation.primary_operator_code
                      ? ` (${evaluation.primary_operator_code})`
                      : ''}
                  </p>
                  {evaluation.secondary_operator_name ? (
                    <p className="text-xs text-muted-foreground">
                      Secundario: {evaluation.secondary_operator_name}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium tabular-nums">
                    {new Date(evaluation.completed_date).toLocaleDateString('es-MX')}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {new Date(evaluation.completed_date).toLocaleTimeString('es-MX')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:col-span-2">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{evaluation.checklist_name}</p>
                  <p className="text-xs text-muted-foreground">Checklist semanal</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Desglose por sección</h3>
                <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Aprobado
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-600" />
                    Observación
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-600" />
                    Falló
                  </span>
                </div>
              </div>

              {evaluation.cleanliness_sections.map((section, sectionIndex) => (
                <div
                  key={sectionIndex}
                  className="overflow-hidden rounded-xl border border-border/60"
                >
                  <div className="border-b border-border/50 bg-muted/30 px-4 py-2.5">
                    <p className="text-sm font-medium">{section.title}</p>
                  </div>
                  <div className="divide-y divide-border/40">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{item.description}</p>
                          {item.notes ? (
                            <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
                          ) : null}
                        </div>
                        <div className="shrink-0">
                          <CleanlinessItemBadge status={item.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {evaluation.evidence.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Evidencia fotográfica</h3>
                {Object.entries(
                  evaluation.evidence.reduce(
                    (acc, ev) => {
                      const category = ev.category || 'General'
                      if (!acc[category]) acc[category] = []
                      acc[category].push(ev)
                      return acc
                    },
                    {} as Record<string, typeof evaluation.evidence>
                  )
                ).map(([category, evidenceItems]) => (
                  <div key={category} className="rounded-xl border border-border/60 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {category}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {evidenceItems.map((evidence) => (
                        <button
                          key={evidence.id}
                          type="button"
                          className="group space-y-2 text-left"
                          onClick={() => window.open(evidence.photo_url, '_blank')}
                        >
                          <div className="aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted/30">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={evidence.photo_url}
                              alt={evidence.description}
                              className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {evidence.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {evaluation.notes ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Notas generales</h3>
                <p className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  {evaluation.notes}
                </p>
              </div>
            ) : null}

            {evaluation.signature_data ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Firma del técnico</h3>
                <div className="rounded-xl border border-dashed border-border/80 p-4 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={evaluation.signature_data}
                    alt="Firma"
                    className="mx-auto max-h-24"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            No se pudieron cargar los detalles.
          </p>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function CleanlinessScoreInline({ score }: { score: number }) {
  return <CleanlinessScoreBadge score={score} />
}
