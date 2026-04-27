"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, FileDown } from "lucide-react"
import type { CompletedChecklistData } from "@/components/checklists/completado/types"
import {
  ChecklistEvidencePrintDocument,
  type ChecklistEvidencePdfRow,
  type ChecklistEvidencePdfOptions,
} from "@/components/checklists/checklist-evidence-print-document"
import { generateDomSnapshotPdf } from "@/lib/pdf/dom-snapshot-pdf"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"

type ChecklistEvidencePdfExportProps = {
  completedChecklistId: string
  /** When provided (e.g. from checklist detail page), skips checklist GET. */
  initialData?: CompletedChecklistData | null
  trigger?: React.ReactNode
}

const defaultOptions = (): ChecklistEvidencePdfOptions => ({
  includeItems: true,
  includeIssues: true,
  includePhotos: true,
  titleOverride: "",
})

export function ChecklistEvidencePdfExport({
  completedChecklistId,
  initialData = null,
  trigger,
}: ChecklistEvidencePdfExportProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CompletedChecklistData | null>(initialData)
  const [evidenceRows, setEvidenceRows] = useState<ChecklistEvidencePdfRow[]>([])
  const [options, setOptions] = useState<ChecklistEvidencePdfOptions>(() => defaultOptions())
  const [pdfGenerationId, setPdfGenerationId] = useState(0)
  const [pdfActive, setPdfActive] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    if (initialData) setData(initialData)
  }, [initialData])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        if (!initialData) {
          const res = await fetch(`/api/checklists/completed/${completedChecklistId}`)
          if (!res.ok) throw new Error("No se pudo cargar el checklist")
          const json = await res.json()
          if (!json.data || cancelled) return
          setData(json.data as CompletedChecklistData)
        }

        const evRes = await fetch(`/api/checklists/completed/${completedChecklistId}/evidence`)
        if (!evRes.ok) throw new Error("No se pudieron cargar evidencias fotográficas")
        const evJson = await evRes.json()
        if (!cancelled) setEvidenceRows((evJson.data ?? []) as ChecklistEvidencePdfRow[])
      } catch (e: unknown) {
        toast({
          title: "Error",
          description: e instanceof Error ? e.message : "No se pudieron cargar los datos del reporte",
          variant: "destructive",
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, completedChecklistId, initialData, toast])

  const filenameBase = useCallback(() => {
    const aid = data?.assets?.asset_id ?? "activo"
    const safe = String(aid).replace(/[^\w\-]+/g, "-").slice(0, 48)
    return `reporte-evidencias-${safe}-${format(new Date(), "yyyy-MM-dd-HHmm")}`
  }, [data])

  const handlePdfReady = useCallback(
    async (root: HTMLElement) => {
      try {
        await generateDomSnapshotPdf(root, filenameBase())
        toast({
          title: "PDF generado",
          description: "El reporte se descargó correctamente.",
        })
      } catch (err: unknown) {
        console.error(err)
        toast({
          title: "Error al generar PDF",
          description: err instanceof Error ? err.message : "Error desconocido",
          variant: "destructive",
        })
      } finally {
        setPdfBusy(false)
        setPdfActive(false)
      }
    },
    [filenameBase, toast],
  )

  const [reportGeneratedAt, setReportGeneratedAt] = useState(() => new Date())

  const startPdf = () => {
    if (!data) return
    setReportGeneratedAt(new Date())
    setPdfGenerationId((x) => x + 1)
    setPdfBusy(true)
    setPdfActive(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button" variant="outline" size="sm" className="cursor-pointer gap-2">
              <FileDown className="h-4 w-4 shrink-0" />
              Reporte evidencias PDF
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Personalizar reporte PDF</DialogTitle>
            <DialogDescription>
              Incluye las secciones que necesitas y descarga un PDF listo para archivo o auditoría (misma calidad que el
              reporte instantáneo de incidentes).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pdf-title">Título del documento (opcional)</Label>
              <Input
                id="pdf-title"
                placeholder={`Ej. Auditoría BP-04 · ${format(new Date(), "MMMM yyyy")}`}
                value={options.titleOverride ?? ""}
                onChange={(e) =>
                  setOptions((o) => ({
                    ...o,
                    titleOverride: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-3 rounded-lg border border-gray-100 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="opt-items"
                  checked={options.includeItems}
                  onCheckedChange={(v) =>
                    setOptions((o) => ({
                      ...o,
                      includeItems: v === true,
                    }))
                  }
                />
                <Label htmlFor="opt-items" className="font-normal cursor-pointer">
                  Incluir ítems evaluados y observaciones
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="opt-issues"
                  checked={options.includeIssues}
                  onCheckedChange={(v) =>
                    setOptions((o) => ({
                      ...o,
                      includeIssues: v === true,
                    }))
                  }
                />
                <Label htmlFor="opt-issues" className="font-normal cursor-pointer">
                  Incluir hallazgos / incidencias
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="opt-photos"
                  checked={options.includePhotos}
                  onCheckedChange={(v) =>
                    setOptions((o) => ({
                      ...o,
                      includePhotos: v === true,
                    }))
                  }
                />
                <Label htmlFor="opt-photos" className="font-normal cursor-pointer">
                  Incluir evidencias fotográficas por sección
                </Label>
              </div>
            </div>

            {evidenceRows.length === 0 && options.includePhotos ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                Este checklist no tiene fotos en la tabla de evidencias; el PDF solo mostrará la portada y lo demás que
                marques.
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              disabled={loading || !data || pdfBusy}
              onClick={startPdf}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando…
                </>
              ) : pdfBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando PDF…
                </>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Descargar PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pdfActive && data ? (
        <ChecklistEvidencePrintDocument
          key={pdfGenerationId}
          active={pdfActive}
          data={data}
          evidenceRows={evidenceRows}
          options={options}
          generatedAt={reportGeneratedAt}
          onReadyForPdf={handlePdfReady}
        />
      ) : null}
    </>
  )
}
