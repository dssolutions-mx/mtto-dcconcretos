"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import type {
  CompletedChecklistData,
  ChecklistIssue,
  CompletedItem,
  ChecklistSectionDefinition,
} from "@/components/checklists/completado/types"
import { waitForImagesInContainer } from "@/lib/pdf/dom-snapshot-pdf"
import { cn } from "@/lib/utils"

const NAVY = "#1B365D"
const GREEN = "#00A64F"
const CHUNK = "w-[794px] max-w-[794px] bg-white box-border"

export type ChecklistEvidencePdfRow = {
  id: string
  section_id: string
  category: string | null
  description: string | null
  photo_url: string
  sequence_order: number
  section_title: string
}

export type ChecklistEvidencePdfOptions = {
  includeItems: boolean
  includeIssues: boolean
  includePhotos: boolean
  titleOverride?: string
}

function buildDescriptionMap(data: CompletedChecklistData): Map<string, string> {
  const itemIdToDescription = new Map<string, string>()
  const sections = data.checklists?.checklist_sections ?? []
  for (const section of sections) {
    const items = (section.checklist_items ?? (section as { items?: { id?: string; item_id?: string; description?: string }[] }).items) as
      | Array<{ id?: string; item_id?: string; description?: string }>
      | undefined
    if (!items) continue
    for (const item of items) {
      const desc = item?.description
      if (!desc) continue
      if (item.id) itemIdToDescription.set(item.id, desc)
      if (item.item_id) itemIdToDescription.set(item.item_id, desc)
    }
  }
  return itemIdToDescription
}

function getItemDescription(map: Map<string, string>, itemId: string, item?: CompletedItem): string {
  return map.get(itemId) ?? item?.description ?? `Ítem ${(itemId ?? "?").toString().slice(0, 8)}`
}

function statusLabel(status: string): string {
  switch (status) {
    case "pass":
      return "Correcto"
    case "flag":
      return "Atención"
    case "fail":
      return "Falla"
    default:
      return status || "—"
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "pass":
      return GREEN
    case "flag":
      return "#ca8a04"
    case "fail":
      return "#dc2626"
    default:
      return "#64748b"
  }
}

function groupEvidenceBySection(rows: ChecklistEvidencePdfRow[]): Map<string, ChecklistEvidencePdfRow[]> {
  const m = new Map<string, ChecklistEvidencePdfRow[]>()
  for (const row of rows) {
    const key = row.section_title || "General"
    if (!m.has(key)) m.set(key, [])
    m.get(key)!.push(row)
  }
  return m
}

function PdfStatusGlyph({ status }: { status?: string }) {
  switch (status) {
    case "pass":
      return <CheckCircle className="h-4 w-4 shrink-0" style={{ color: GREEN }} aria-hidden />
    case "flag":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
    case "fail":
      return <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
    default:
      return (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[10px] font-bold text-gray-400" aria-hidden>
          ?
        </span>
      )
  }
}

function EvaluatedItemRow({
  templateLabel,
  required,
  completion,
  descFallback,
}: {
  templateLabel: string
  required?: boolean
  completion: CompletedItem
  descFallback: string
}) {
  const accent = statusColor(completion.status)
  const title = templateLabel.trim() || descFallback
  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex gap-2.5 border-l-[4px] py-2.5 pl-3 pr-2" style={{ borderLeftColor: accent }}>
        <PdfStatusGlyph status={completion.status} />
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2 items-start">
            <p className="m-0 min-w-0 text-[12px] font-semibold leading-normal text-gray-900">{title}</p>
            <span
              className="shrink-0 justify-self-end rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ borderColor: accent, color: accent, backgroundColor: `${accent}14` }}
            >
              {statusLabel(completion.status)}
            </span>
            {required ? (
              <p className="col-span-2 m-0 text-[10px] font-medium leading-normal text-gray-600">Obligatorio en plantilla</p>
            ) : null}
          </div>
          {completion.notes?.trim() ? (
            <div className="mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Observaciones</span>
              <p className="mt-1 rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-[11px] leading-snug text-gray-800">
                {completion.notes}
              </p>
            </div>
          ) : null}
          {completion.photo_url ? (
            <div className="mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Evidencia en ítem</span>
              <div className="mt-1 inline-block overflow-hidden rounded border border-gray-200 bg-gray-50">
                <img src={completion.photo_url} alt="" className="max-h-36 max-w-[280px] object-contain" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ItemsEvaluatedBySectionPdf({
  data,
  descMap,
}: {
  data: CompletedChecklistData
  descMap: Map<string, string>
}) {
  const completed = data.completed_items ?? []
  const getCompletion = (itemId: string) => completed.find((c) => c.item_id === itemId)

  const sortedSections = [...(data.checklists?.checklist_sections ?? [])].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
  ) as ChecklistSectionDefinition[]

  const renderedItemIds = new Set<string>()
  const sectionBlocks: ReactNode[] = []

  for (const section of sortedSections) {
    if (section.section_type === "security_talk") continue

    const rawItems = (section.checklist_items ??
      (section as ChecklistSectionDefinition & { items?: unknown }).items) as
      | Array<{
          id?: string
          item_id?: string
          description?: string
          required?: boolean
          order_index?: number
        }>
      | undefined
    if (!rawItems?.length) continue

    const sortedItems = [...rawItems].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const rows: React.ReactNode[] = []

    for (const ti of sortedItems) {
      const tid = (ti.id ?? ti.item_id) as string | undefined
      if (!tid) continue
      const completion = getCompletion(tid)
      if (!completion) continue
      renderedItemIds.add(completion.item_id)
      const templateLabel = (ti.description ?? "").trim()
      rows.push(
        <EvaluatedItemRow
          key={`${section.id}-${tid}`}
          templateLabel={templateLabel}
          required={ti.required}
          completion={completion}
          descFallback={getItemDescription(descMap, completion.item_id, completion)}
        />,
      )
    }

    if (rows.length === 0) continue

    sectionBlocks.push(
      <div key={section.id} className="mb-4 last:mb-0">
        <div className="rounded-t-md border border-b-0 border-gray-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold leading-tight" style={{ color: NAVY }}>
            {section.title}
          </p>
        </div>
        <div className="space-y-2 rounded-b-md border border-gray-200 bg-white p-2.5">{rows}</div>
      </div>,
    )
  }

  const orphans = completed.filter((c) => c.item_id && !renderedItemIds.has(c.item_id))

  const orphanBlock =
    orphans.length > 0 ? (
      <div className="mb-0">
        <div className="rounded-t-md border border-b-0 border-gray-200 bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold leading-tight" style={{ color: NAVY }}>
            Ítems registrados (sin coincidencia en secciones)
          </p>
        </div>
        <div className="space-y-2 rounded-b-md border border-gray-200 bg-white p-2.5">
          {orphans.map((completion, idx) => (
            <EvaluatedItemRow
              key={completion.item_id ?? idx}
              templateLabel=""
              completion={completion}
              descFallback={getItemDescription(descMap, completion.item_id, completion)}
            />
          ))}
        </div>
      </div>
    ) : null

  if (sectionBlocks.length === 0 && !orphanBlock) return null

  return (
    <>
      {sectionBlocks}
      {orphanBlock}
    </>
  )
}

export function ChecklistEvidencePrintDocument({
  active,
  data,
  evidenceRows,
  options,
  generatedAt,
  onReadyForPdf,
}: {
  active: boolean
  data: CompletedChecklistData
  evidenceRows: ChecklistEvidencePdfRow[]
  options: ChecklistEvidencePdfOptions
  generatedAt: Date
  onReadyForPdf?: (root: HTMLElement) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const readyFired = useRef(false)

  const items = data.completed_items ?? []
  const passed = items.filter((i) => i.status === "pass").length
  const flagged = items.filter((i) => i.status === "flag").length
  const failed = items.filter((i) => i.status === "fail").length
  const descMap = buildDescriptionMap(data)

  const tech =
    data.profile?.nombre && data.profile?.apellido
      ? `${data.profile.nombre} ${data.profile.apellido}`.trim()
      : data.technician || "—"

  const title =
    (options.titleOverride?.trim() || "").length > 0
      ? options.titleOverride!.trim()
      : "Reporte de evidencias — checklist único"

  const issues = data.issues ?? []
  const sectionGroups = groupEvidenceBySection(evidenceRows)

  useEffect(() => {
    if (!active) {
      readyFired.current = false
    }
  }, [active])

  useEffect(() => {
    if (!active || !onReadyForPdf) return
    const root = rootRef.current
    if (!root) return
    if (readyFired.current) return

    let cancelled = false
    void (async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      await waitForImagesInContainer(root)
      if (cancelled || readyFired.current) return
      readyFired.current = true
      onReadyForPdf(root)
    })()

    return () => {
      cancelled = true
    }
  }, [active, onReadyForPdf, data, evidenceRows, options, generatedAt])

  if (!active) return null

  return (
    <div
      ref={rootRef}
      className="fixed -left-[9999px] top-0 z-[-1] pointer-events-none text-[13px] leading-snug"
      aria-hidden
    >
      <div data-pdf-chunk className={cn(CHUNK, "p-6")}>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-5" style={{ borderLeftWidth: 4, borderLeftColor: NAVY }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 mb-1">Mantenimiento preventivo</p>
          <h1 className="text-xl font-bold mb-2" style={{ color: NAVY }}>
            {title}
          </h1>
          <p className="text-xs px-1 leading-snug" style={{ color: GREEN }}>
            {data.checklists?.name ?? "Checklist"} · {data.assets?.name ?? "Activo"} ({data.assets?.asset_id ?? "—"})
          </p>
          <p className="text-[10px] text-gray-600 mt-2">
            {format(generatedAt, "dd/MM/yyyy HH:mm", { locale: es })} · Generado desde MantenPro
          </p>
        </div>

        <div
          className="grid grid-cols-4 gap-2 text-center rounded-lg border border-gray-200 bg-gray-50 p-3 mb-4"
          style={{ borderLeftWidth: 4, borderLeftColor: NAVY }}
        >
          <div>
            <p className="text-lg font-bold tabular-nums" style={{ color: NAVY }}>
              {passed}
            </p>
            <p className="text-[9px] font-medium uppercase text-gray-600">Correctos</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-amber-700">{flagged}</p>
            <p className="text-[9px] font-medium uppercase text-gray-600">Atención</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-red-700">{failed}</p>
            <p className="text-[9px] font-medium uppercase text-gray-600">Falla</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-gray-800">{items.length}</p>
            <p className="text-[9px] font-medium uppercase text-gray-600">Ítems</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs border border-gray-100 rounded-lg p-3">
          <div>
            <span className="font-semibold text-gray-500 uppercase text-[10px]">Completado</span>
            <p className="font-medium">{format(new Date(data.completion_date), "PPP HH:mm", { locale: es })}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-500 uppercase text-[10px]">Técnico</span>
            <p className="font-medium">{tech}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-500 uppercase text-[10px]">Ubicación</span>
            <p className="font-medium">{data.assets?.location ?? "—"}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-500 uppercase text-[10px]">Departamento</span>
            <p className="font-medium">{data.assets?.department ?? "—"}</p>
          </div>
        </div>

        {data.notes?.trim() ? (
          <div className="mt-4 rounded border border-dashed border-gray-300 p-3 text-xs bg-white">
            <span className="font-semibold text-gray-600">Notas generales:</span>
            <p className="mt-1 whitespace-pre-wrap text-gray-800">{data.notes}</p>
          </div>
        ) : null}
      </div>

      {options.includeIssues && issues.length > 0 ? (
        <div data-pdf-chunk className={cn(CHUNK, "p-6")}>
          <h2 className="text-sm font-bold mb-3 pb-2 border-b" style={{ color: NAVY }}>
            Hallazgos e incidencias ({issues.length})
          </h2>
          <div className="space-y-2">
            {issues.map((issue: ChecklistIssue) => (
              <div
                key={issue.id}
                className="rounded-md border border-red-200 bg-red-50/80 p-3 text-xs"
              >
                <p className="font-semibold text-red-900">{issue.description}</p>
                {issue.notes ? <p className="mt-1 text-red-800/90">{issue.notes}</p> : null}
                <p className="mt-2 text-[10px] text-red-700">
                  Estado: {issue.status ?? "—"}
                  {issue.work_order_id ? ` · OT: ${issue.work_order_id}` : ""}
                  {issue.resolved ? " · Resuelto" : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {options.includeItems && items.length > 0 ? (
        <div data-pdf-chunk className={cn(CHUNK, "p-6")}>
          <h2 className="mb-3 border-b pb-2 text-sm font-bold" style={{ color: NAVY }}>
            Ítems evaluados por sección
          </h2>
          <ItemsEvaluatedBySectionPdf data={data} descMap={descMap} />
        </div>
      ) : null}

      {options.includePhotos && evidenceRows.length > 0
        ? [...sectionGroups.entries()].map(([sectionTitle, rows]) => (
            <div key={sectionTitle} data-pdf-chunk className={cn(CHUNK, "p-6")}>
              <h2 className="text-sm font-bold mb-3 pb-2 border-b" style={{ color: NAVY }}>
                Evidencias fotográficas · {sectionTitle}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {rows.map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                    <div className="aspect-[4/3] bg-gray-100">
                      <img src={ev.photo_url} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="p-2 text-[10px] text-gray-700 space-y-0.5">
                      {ev.category ? (
                        <p>
                          <span className="font-semibold text-gray-900">{ev.category}</span>
                        </p>
                      ) : null}
                      {ev.description?.trim() ? <p>{ev.description}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        : null}
    </div>
  )
}
