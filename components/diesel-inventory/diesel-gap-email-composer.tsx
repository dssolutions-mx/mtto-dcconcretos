"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Mail, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

type PreviewFinding = { findingKey: string; message: string }

interface DieselGapEmailComposerProps {
  open: boolean
  onClose: () => void
  onSent?: (to: string[], cc: string[]) => void
  warehouseId: string
  warehouseLabel: string
  /** Pre-selected gap ids when opening from warehouse page */
  initialGapIds?: string[]
}

function ChipInput({
  label,
  values,
  onChange,
}: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
}) {
  const [draft, setDraft] = useState("")

  const add = () => {
    const v = draft.trim().toLowerCase()
    if (v && v.includes("@") && !values.includes(v)) {
      onChange([...values, v])
    }
    setDraft("")
  }

  const remove = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1 rounded-md border bg-background p-2 min-h-[42px]">
        {values.map((v, i) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
          >
            {v}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => remove(i)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="min-w-[160px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          placeholder="correo@ejemplo.com"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              add()
            }
          }}
        />
        {draft.trim() && (
          <button type="button" onClick={add} className="text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Enter o coma para agregar</p>
    </div>
  )
}

export function DieselGapEmailComposer({
  open,
  onClose,
  onSent,
  warehouseId,
  warehouseLabel,
  initialGapIds = [],
}: DieselGapEmailComposerProps) {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [subject, setSubject] = useState("")
  const [note, setNote] = useState("")
  const [to, setTo] = useState<string[]>([])
  const [cc, setCc] = useState<string[]>([])
  const [previewHtml, setPreviewHtml] = useState("")
  const [tab, setTab] = useState<"edit" | "preview">("edit")
  const [availableFindings, setAvailableFindings] = useState<PreviewFinding[]>([])
  const [selectedByKey, setSelectedByKey] = useState<Record<string, boolean>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const orderedSelectedKeys = availableFindings
    .filter((f) => selectedByKey[f.findingKey])
    .map((f) => f.findingKey)

  const applyPreviewJson = useCallback((json: Record<string, unknown>) => {
    setSubject((json.subject as string) ?? "")
    setPreviewHtml((json.html as string) ?? "")
    setTo((json.to as string[]) ?? [])
    setCc((json.cc as string[]) ?? [])
  }, [])

  const fetchPreview = useCallback(
    async (gapIds: string[]) => {
      const res = await fetch("/api/diesel/gap-notifications/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseId, gapIds }),
      })
      const json = (await res.json()) as Record<string, unknown>
      if (!res.ok || json.error) {
        throw new Error((json.error as string) || "preview_failed")
      }
      return json
    },
    [warehouseId],
  )

  useEffect(() => {
    if (!open) return

    let cancelled = false

    void (async () => {
      try {
        // Load all findings first so selection state stays in sync with the server.
        const json = await fetchPreview([])
        if (cancelled) return
        const findings = (json.availableFindings as PreviewFinding[] | undefined) ?? []
        setAvailableFindings(findings)

        const validInitialIds =
          initialGapIds.length > 0
            ? initialGapIds.filter((id) => findings.some((f) => f.findingKey === id))
            : findings.map((f) => f.findingKey)

        const initialSelection = Object.fromEntries(
          findings.map((f) => [f.findingKey, validInitialIds.includes(f.findingKey)]),
        )
        setSelectedByKey(initialSelection)

        const previewJson =
          validInitialIds.length > 0 && validInitialIds.length < findings.length
            ? await fetchPreview(validInitialIds)
            : json
        if (cancelled) return

        setSubject((previewJson.subject as string) ?? "")
        setPreviewHtml((previewJson.html as string) ?? "")
        setTo((previewJson.to as string[]) ?? [])
        setCc((previewJson.cc as string[]) ?? [])
      } catch {
        if (!cancelled) {
          toast.error("Error al cargar vista previa del correo")
          onClose()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, initialGapIds, onClose, fetchPreview])

  const schedulePreviewRefresh = useCallback(
    (gapIds: string[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        void (async () => {
          setRefreshing(true)
          try {
            const json = await fetchPreview(gapIds)
            applyPreviewJson(json)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo actualizar la vista previa")
          } finally {
            setRefreshing(false)
          }
        })()
      }, 350)
    },
    [fetchPreview, applyPreviewJson],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const toggleFinding = (findingKey: string, checked: boolean) => {
    const next = { ...selectedByKey, [findingKey]: checked }
    const ordered = availableFindings.filter((f) => next[f.findingKey]).map((f) => f.findingKey)
    if (ordered.length === 0) {
      toast.error("Debe quedar al menos un hueco seleccionado")
      return
    }
    setSelectedByKey(next)
    schedulePreviewRefresh(ordered)
  }

  const handleSend = async () => {
    if (to.length === 0) {
      toast.error('Agrega al menos un destinatario en "Para"')
      return
    }
    if (orderedSelectedKeys.length === 0) {
      toast.error("Selecciona al menos un hueco")
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/diesel/gap-notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId,
          gapIds: orderedSelectedKeys,
          subject,
          note,
          to,
          cc,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || "No se pudo enviar")
        return
      }
      toast.success("Correo enviado")
      onSent?.(json.to ?? to, json.cc ?? cc)
      onClose()
    } catch {
      toast.error("Error de red")
    } finally {
      setSending(false)
    }
  }

  const computedHtml = note.trim()
    ? `<blockquote style="border-left:4px solid #f59e0b;margin:0 0 16px 0;padding:8px 16px;background:#fffbeb;color:#92400e;font-style:italic">${note.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</blockquote>\n${previewHtml}`
    : previewHtml

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Notificar huecos cuenta litros — {warehouseLabel}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex border-b px-6">
              {(["edit", "preview"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    tab === t
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setTab(t)}
                >
                  {t === "edit" ? "Editar" : "Vista previa"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === "edit" ? (
                <div className="space-y-4 px-6 py-4">
                  <div className="space-y-1">
                    <Label>Asunto</Label>
                    <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </div>

                  {availableFindings.length > 0 ? (
                    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Huecos en este correo</Label>
                        {refreshing ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Desmarca los que no apliquen; el cuerpo del correo refleja solo los seleccionados.
                      </p>
                      <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                        {availableFindings.map((f, idx) => (
                          <li
                            key={`${f.findingKey}:${idx}`}
                            className="flex items-start gap-2 rounded border bg-background p-2 text-xs"
                          >
                            <Checkbox
                              id={`diesel-gap-finding-${idx}`}
                              checked={Boolean(selectedByKey[f.findingKey])}
                              onCheckedChange={(v) => toggleFinding(f.findingKey, v === true)}
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={`diesel-gap-finding-${idx}`}
                              className="cursor-pointer leading-snug"
                            >
                              {f.message}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <ChipInput label="Para" values={to} onChange={setTo} />
                  <ChipInput label="CC" values={cc} onChange={setCc} />

                  <div className="space-y-1">
                    <Label>Nota ejecutiva (opcional)</Label>
                    <Textarea
                      placeholder="Contexto o instrucciones adicionales. Aparecerá al inicio del correo destacada en amarillo."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <iframe
                  srcDoc={computedHtml}
                  sandbox="allow-same-origin"
                  className="h-full min-h-[400px] w-full border-0"
                  title="Vista previa del correo"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <Button variant="outline" onClick={onClose} disabled={sending}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={sending || to.length === 0}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar correo
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
