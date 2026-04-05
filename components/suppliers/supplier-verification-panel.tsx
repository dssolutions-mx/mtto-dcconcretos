"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { evaluateSupplierVerification } from "@/lib/suppliers/verification-rules"
import type { Supplier } from "@/types/suppliers"
import type { SupplierVerificationAction } from "@/types/suppliers"
import { CheckCircle2, ClipboardList, History, Loader2, XCircle } from "lucide-react"

interface VerificationEventRow {
  id: string
  action: string
  notes: string | null
  created_at: string
  checklist_snapshot: unknown
}

interface SupplierVerificationPanelProps {
  supplierId: string
  supplier: Supplier
  certificationsCount: number
  primaryContactCount: number
  workHistoryCountLast365d: number
  canWrite: boolean
  onAfterChange: () => void
}

export function SupplierVerificationPanel({
  supplierId,
  supplier,
  certificationsCount,
  primaryContactCount,
  workHistoryCountLast365d,
  canWrite,
  onAfterChange,
}: SupplierVerificationPanelProps) {
  const { toast } = useToast()
  const [notes, setNotes] = useState("")
  const [events, setEvents] = useState<VerificationEventRow[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [pending, setPending] = useState(false)

  const evaluation = useMemo(
    () =>
      evaluateSupplierVerification({
        supplier,
        certificationsCount,
        primaryContactCount,
        workHistoryCountLast365d,
      }),
    [supplier, certificationsCount, primaryContactCount, workHistoryCountLast365d]
  )

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/verification`)
      const data = await res.json()
      if (res.ok) setEvents(data.events || [])
    } catch {
      /* ignore */
    } finally {
      setLoadingEvents(false)
    }
  }, [supplierId])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const runAction = async (action: SupplierVerificationAction) => {
    setPending(true)
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: notes.trim() || undefined,
          checklist_snapshot:
            action === "certify"
              ? {
                  passedCount: evaluation.passedCount,
                  totalCount: evaluation.totalCount,
                  checks: evaluation.checks,
                }
              : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: "No se pudo completar",
          description: data.error || "Error",
          variant: "destructive",
        })
        return
      }
      toast({ title: "Listo", description: "Cambio registrado." })
      setNotes("")
      onAfterChange()
      loadEvents()
    } catch {
      toast({ title: "Error de red", variant: "destructive" })
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="border-sky-200/80 bg-sky-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="w-5 h-5 text-sky-700" />
          Verificación de expediente
        </CardTitle>
        <CardDescription>
          Requisitos antes de certificar; cada acción queda en el historial de auditoría.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Progreso</span>
          <Badge variant={evaluation.allRequiredPass ? "default" : "secondary"}>
            {evaluation.passedCount}/{evaluation.totalCount}
          </Badge>
          {evaluation.allRequiredPass ? (
            <span className="text-sm text-green-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Listo para certificar
            </span>
          ) : (
            <span className="text-sm text-amber-700 flex items-center gap-1">
              <XCircle className="w-4 h-4" /> Completa los requisitos pendientes
            </span>
          )}
        </div>

        <ul className="space-y-2">
          {evaluation.checks.map((c) => (
            <li
              key={c.id}
              className={`flex items-start gap-2 text-sm rounded-md border px-3 py-2 ${
                c.pass ? "bg-green-50/80 border-green-200" : "bg-amber-50/80 border-amber-200"
              }`}
            >
              {c.pass ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              )}
              <div>
                <span className="font-medium">{c.label}</span>
                {c.detail && <p className="text-xs text-muted-foreground mt-0.5">{c.detail}</p>}
              </div>
            </li>
          ))}
        </ul>

        {canWrite && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas internas (opcional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo de rechazo, observaciones de revisión…"
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {supplier.status === "active" && (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !evaluation.allRequiredPass}
                  onClick={() => runAction("certify")}
                >
                  {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Certificar proveedor
                </Button>
              )}
              {supplier.status === "pending" && (
                <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => runAction("activate")}>
                  Marcar activo
                </Button>
              )}
              {supplier.status !== "pending" && supplier.status !== "blacklisted" && (
                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => runAction("reject")}>
                  Volver a pendiente
                </Button>
              )}
              {supplier.status === "active_certified" && (
                <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => runAction("revoke_certification")}>
                  Revocar certificación
                </Button>
              )}
            </div>
          </>
        )}

        <Separator />

        <div>
          <div className="flex items-center gap-2 mb-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Historial de auditoría</span>
          </div>
          {loadingEvents ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
              {events.map((ev) => (
                <li key={ev.id} className="border rounded-md p-2 bg-background">
                  <div className="flex justify-between gap-2">
                    <Badge variant="outline">{ev.action}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString("es-MX")}
                    </span>
                  </div>
                  {ev.notes && <p className="text-xs mt-1 text-muted-foreground">{ev.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
