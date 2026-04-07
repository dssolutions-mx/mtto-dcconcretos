"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { getIncidentEvidence } from "@/components/incidents/incident-utils"
import { getReporterName } from "@/components/incidents/incidents-list-utils"
import {
  getDaysSinceCreated,
  getPriorityInfo,
  getStatusInfo,
  normalizeStatus,
} from "@/components/incidents/incidents-status-utils"
import {
  groupIncidentsForIncidentesLookup,
  type IncidentAssetGroup,
} from "@/lib/incidents/incident-snapshot-grouping"
import {
  incidentAgeDaysForDashboard,
  isIncidentResolvedForDashboard,
} from "@/lib/incident-dashboard-metrics"
import {
  maxPackedIncidentContentPx,
  packIncidentRowIndices,
  PDF_INCIDENT_STACK_GAP_PX,
} from "@/lib/incidents/incident-pdf-pack"
import { waitForImagesInContainer } from "@/lib/incidents/generate-incident-snapshot-pdf"
import { cn } from "@/lib/utils"

const NAVY = "#1B365D"
const GREEN = "#00A64F"
const CHUNK = "w-[794px] max-w-[794px] bg-white box-border"

type FlatRow = {
  key: string
  group: IncidentAssetGroup
  incident: Record<string, unknown>
  idxInGroup: number
}

function formatSnapshotDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: es })
  } catch {
    return "—"
  }
}

function isResolvedForRow(status: string): boolean {
  return normalizeStatus(status) === "resolved"
}

function SectionBar({ children }: { children: ReactNode }) {
  return (
    <div className="py-1.5 px-3 mb-2 rounded" style={{ backgroundColor: NAVY }}>
      <h3 className="text-xs font-bold text-white leading-tight">{children}</h3>
    </div>
  )
}

function IncidentPdfBlock({ row }: { row: FlatRow }) {
  const { group, incident, idxInGroup } = row
  const dateStr = (incident.date ?? incident.created_at) as string | undefined
  const status = String(incident.status ?? "")
  const resolved = isResolvedForRow(status)
  const rawForDays = dateStr && dateStr.trim() ? dateStr : String(incident.created_at ?? "")
  const days = rawForDays ? getDaysSinceCreated(rawForDays) : 0
  const statusLabel = getStatusInfo(status).label
  const priority = getPriorityInfo(status, days)
  const evidence = getIncidentEvidence({
    documents: incident.documents,
    id: typeof incident.id === "string" ? incident.id : undefined,
    created_at: incident.created_at as string | undefined,
  })
  const desc = String(incident.description ?? "—")
  const impact = incident.impact != null && String(incident.impact).trim() ? String(incident.impact) : null
  const resolution =
    incident.resolution != null && String(incident.resolution).trim() ? String(incident.resolution) : null
  const wo = incident.work_order_order_id ? String(incident.work_order_order_id) : null
  const tipo = incident.type ? String(incident.type) : "—"

  return (
    <>
      {idxInGroup === 0 ? (
        <div className="py-1.5 px-3 mb-3 rounded" style={{ backgroundColor: NAVY }}>
          <h2 className="text-sm font-bold text-white">
            {group.assetId ? (
              <>
                {group.assetCode}
                {group.assetFullName && group.assetFullName !== group.assetCode && (
                  <span className="font-normal text-white/90"> — {group.assetFullName}</span>
                )}
              </>
            ) : (
              <span className="font-normal">Sin activo</span>
            )}
          </h2>
        </div>
      ) : (
        <p
          className="mb-3 text-xs font-semibold text-gray-700 border-l-4 pl-3 py-1.5 bg-gray-50 rounded-r"
          style={{ borderColor: GREEN }}
        >
          Mismo activo: {group.assetCode}
          {group.assetFullName && group.assetFullName !== group.assetCode ? ` — ${group.assetFullName}` : ""}
        </p>
      )}

      <article
        className={cn(
          "rounded-lg bg-gray-50 p-3 border border-gray-200 border-l-4 border-l-gray-500",
          resolved && "opacity-95",
        )}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-b border-gray-200 pb-3 mb-3">
          <div className="space-y-1.5">
            <p>
              <span className="font-semibold text-gray-800">Fecha:</span> {formatSnapshotDate(dateStr)}
            </p>
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-gray-800">Estado:</span>
              <span className="rounded border border-gray-300 bg-white px-1.5 py-0 text-[10px] font-medium">
                {statusLabel}
              </span>
            </p>
            {!resolved ? (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-gray-800">Urgencia:</span>
                <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-900">
                  {priority.label} ({days} d)
                </span>
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <p>
              <span className="font-semibold text-gray-800">Tipo:</span> {tipo}
            </p>
            <p>
              <span className="font-semibold text-gray-800">OT:</span> {wo ? `#${wo}` : "—"}
            </p>
            <p className="leading-tight">
              <span className="font-semibold text-gray-800">Reportante:</span>{" "}
              <span className="text-gray-800">{getReporterName(incident)}</span>
            </p>
          </div>
        </div>

        <div className="mb-2">
          <SectionBar>Descripción</SectionBar>
          <p className="text-xs leading-relaxed text-gray-900 whitespace-pre-wrap px-0.5">{desc}</p>
        </div>

        {impact ? (
          <div className="mb-2">
            <SectionBar>Impacto</SectionBar>
            <p className="text-xs leading-relaxed text-gray-800 whitespace-pre-wrap px-0.5">{impact}</p>
          </div>
        ) : null}

        {resolution ? (
          <div className="mb-2">
            <SectionBar>Resolución</SectionBar>
            <p className="text-xs leading-relaxed text-gray-800 whitespace-pre-wrap px-0.5">{resolution}</p>
          </div>
        ) : null}

        {evidence.length > 0 ? (
          <div className="mt-2">
            <SectionBar>Fotos / evidencia</SectionBar>
            <div className="grid grid-cols-2 gap-2">
              {evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="flex h-[112px] items-center justify-center overflow-hidden rounded border border-gray-200 bg-white p-1"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ev.url}
                    alt=""
                    crossOrigin="anonymous"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </article>
    </>
  )
}

export type IncidentSnapshotPrintDocumentProps = {
  incidents: Record<string, unknown>[]
  assets: Record<string, unknown>[]
  filterSummaryLine: string
  generatedAt: Date
  /** When true, mount measurement + PDF layout and eventually call onReadyForPdf */
  active: boolean
  onReadyForPdf?: (rootEl: HTMLElement) => void
}

export const IncidentSnapshotPrintDocument = forwardRef<HTMLDivElement, IncidentSnapshotPrintDocumentProps>(
  function IncidentSnapshotPrintDocument(
    { incidents, assets, filterSummaryLine, generatedAt, active, onReadyForPdf },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement | null>(null)

    const setRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as MutableRefObject<HTMLDivElement | null>).current = node
      },
      [ref],
    )
    const grouped = useMemo(() => groupIncidentsForIncidentesLookup(incidents, assets), [incidents, assets])

    const flatRows: FlatRow[] = useMemo(() => {
      const rows: FlatRow[] = []
      for (const group of grouped) {
        group.incidents.forEach((incident, idxInGroup) => {
          const id =
            typeof incident.id === "string" ? incident.id : `g-${String(group.assetId)}-${idxInGroup}`
          rows.push({ key: id, group, incident, idxInGroup })
        })
      }
      return rows
    }, [grouped])

    const [chunkPlan, setChunkPlan] = useState<number[][] | null>(null)
    const measureRef = useRef<HTMLDivElement>(null)
    const readyFired = useRef(false)

    const openCount = incidents.filter((i) => !isIncidentResolvedForDashboard(String(i.status ?? ""))).length
    const criticalOpen = incidents.filter((i) => {
      if (isIncidentResolvedForDashboard(String(i.status ?? ""))) return false
      const d = incidentAgeDaysForDashboard(
        i.date as string | undefined,
        i.created_at as string | undefined,
        generatedAt.getTime(),
      )
      return d >= 7
    }).length

    useEffect(() => {
      if (!active) {
        setChunkPlan(null)
        readyFired.current = false
      }
    }, [active])

    useEffect(() => {
      if (!active) return
      if (chunkPlan !== null) return

      if (flatRows.length === 0) {
        setChunkPlan([])
        return
      }

      const el = measureRef.current
      if (!el) return

      let cancelled = false
      void (async () => {
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
        await waitForImagesInContainer(el)
        if (cancelled) return
        const nodes = [...el.querySelectorAll<HTMLElement>("[data-measure-incident]")]
        let packed: number[][]
        if (nodes.length === flatRows.length) {
          const heights = nodes.map((n) => n.getBoundingClientRect().height)
          const maxPx = maxPackedIncidentContentPx()
          packed = packIncidentRowIndices(heights, PDF_INCIDENT_STACK_GAP_PX, maxPx)
        } else {
          packed = flatRows.map((_, i) => [i])
        }
        if (!cancelled) setChunkPlan(packed)
      })()

      return () => {
        cancelled = true
      }
    }, [active, flatRows, chunkPlan])

    useEffect(() => {
      if (!active || !onReadyForPdf || chunkPlan === null) return
      if (readyFired.current) return
      const root = rootRef.current
      if (!root) return

      let cancelled = false
      void (async () => {
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
        await waitForImagesInContainer(root)
        if (cancelled) return
        readyFired.current = true
        onReadyForPdf(root)
      })()

      return () => {
        cancelled = true
      }
    }, [active, chunkPlan, onReadyForPdf])

    if (!active) return null

    if (flatRows.length === 0) {
      if (chunkPlan === null) return null
      return (
        <div ref={setRootRef} className={`${CHUNK} mx-auto`}>
          <div className="p-6 text-sm text-gray-600">Sin incidentes</div>
        </div>
      )
    }

    if (chunkPlan === null) {
      return (
        <div
          ref={measureRef}
          className="fixed -left-[9999px] top-0 z-[-1] w-[794px] pointer-events-none opacity-0"
          aria-hidden
        >
          <div className="flex flex-col gap-4">
            {flatRows.map((row) => (
              <div key={row.key} data-measure-incident>
                <IncidentPdfBlock row={row} />
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div
        ref={setRootRef}
        className={`print-container ${CHUNK} mx-auto`}
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        <div data-pdf-chunk className={`${CHUNK} p-8`}>
          <div className="dc-header flex items-stretch mb-5" style={{ borderBottom: `3px solid ${GREEN}` }}>
            <div className="w-28 shrink-0 flex items-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="DC Concretos"
                className="max-h-12 w-auto object-contain"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = "none"
                }}
              />
            </div>
            <div
              className="flex-1 flex flex-col justify-center text-right px-3 py-2"
              style={{ backgroundColor: NAVY }}
            >
              <p className="text-white font-bold text-xs uppercase tracking-wide">DC CONCRETOS, S.A. DE C.V.</p>
              <p className="text-white/90 text-[10px] mt-0.5">REP-INST-001 · Mantenimiento</p>
              <p className="text-base font-bold mt-0.5" style={{ color: GREEN }}>
                INSTANTÁNEO DE INCIDENTES
              </p>
            </div>
          </div>

          <div className="text-center mb-5">
            <h1 className="text-xl font-bold mb-1" style={{ color: NAVY }}>
              Listado filtrado
            </h1>
            <p className="text-xs px-1 leading-snug" style={{ color: GREEN }}>
              {filterSummaryLine}
            </p>
            <p className="text-[10px] text-gray-600 mt-1.5">
              {format(generatedAt, "dd/MM/yyyy HH:mm", { locale: es })} · {incidents.length} registro
              {incidents.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div
            className="grid grid-cols-3 gap-2 text-center rounded-lg border border-gray-200 bg-gray-50 p-3"
            style={{ borderLeftWidth: 4, borderLeftColor: NAVY }}
          >
            <div>
              <p className="text-lg font-bold tabular-nums" style={{ color: NAVY }}>
                {incidents.length}
              </p>
              <p className="text-[9px] font-medium uppercase text-gray-600">En listado</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums text-amber-700">{openCount}</p>
              <p className="text-[9px] font-medium uppercase text-gray-600">Abiertos</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums text-red-700">{criticalOpen}</p>
              <p className="text-[9px] font-medium uppercase text-gray-600">+7 días</p>
            </div>
          </div>
        </div>

        {chunkPlan.map((indices, ci) => (
          <div key={ci} data-pdf-chunk className={`${CHUNK} p-6`}>
            <div className="flex flex-col gap-4">
              {indices.map((idx) => (
                <IncidentPdfBlock key={flatRows[idx].key} row={flatRows[idx]} />
              ))}
            </div>
          </div>
        ))}

        <div data-pdf-chunk className={`${CHUNK} p-8`}>
          <div className="text-center pt-2" style={{ borderTop: `2px solid ${GREEN}` }}>
            <p className="font-bold text-sm" style={{ color: NAVY }}>
              DC Concretos, S.A. de C.V.
            </p>
            <p className="text-xs mt-0.5 italic" style={{ color: GREEN }}>
              &quot;Ayudando a concretar ideas&quot;
            </p>
          </div>
        </div>
      </div>
    )
  },
)

IncidentSnapshotPrintDocument.displayName = "IncidentSnapshotPrintDocument"
