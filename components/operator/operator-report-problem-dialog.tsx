"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Wrench, Droplets, Zap, AlertTriangle, Settings2, MoreHorizontal, Camera } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase"
import { EvidenceUpload, type EvidencePhoto } from "@/components/ui/evidence-upload"

export type OperatorAssignedAssetOption = {
  id: string
  name: string | null
  asset_id: string | null
}

const TYPE_OPTIONS: Array<{
  value: string
  label: string
  hint: string
  icon: typeof Wrench
}> = [
  { value: "Falla mecánica", label: "Falla mecánica", hint: "Motor, frenos…", icon: Wrench },
  { value: "Falla hidráulica", label: "Falla hidráulica", hint: "Bombas, mangueras…", icon: Droplets },
  { value: "Falla eléctrica", label: "Falla eléctrica", hint: "Luces, batería…", icon: Zap },
  { value: "Accidente", label: "Accidente", hint: "Golpe, choque…", icon: AlertTriangle },
  { value: "Mantenimiento", label: "Mantenimiento", hint: "Servicio, aceite…", icon: Settings2 },
  { value: "Otro", label: "Otro", hint: "Otro caso", icon: MoreHorizontal },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignedAssets: OperatorAssignedAssetOption[]
  reporterDisplayName: string
  onSuccess: () => void
}

export function OperatorReportProblemDialog({
  open,
  onOpenChange,
  assignedAssets,
  reporterDisplayName,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [type, setType] = useState("")
  const [description, setDescription] = useState("")
  const [photos, setPhotos] = useState<EvidencePhoto[]>([])
  const [showEvidenceDialog, setShowEvidenceDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const singleAsset = assignedAssets.length === 1 ? assignedAssets[0] : null

  useEffect(() => {
    if (!open) return
    if (singleAsset) {
      setSelectedAssetId(singleAsset.id)
    } else {
      setSelectedAssetId(null)
    }
    setType("")
    setDescription("")
    setPhotos([])
    setShowEvidenceDialog(false)
  }, [open, singleAsset])

  const canPickAsset = assignedAssets.length > 1

  const effectiveAssetId = useMemo(() => {
    if (singleAsset) return singleAsset.id
    return selectedAssetId
  }, [singleAsset, selectedAssetId])

  const handleSubmit = async () => {
    if (!effectiveAssetId) {
      toast({
        title: "Elige tu equipo",
        description: "Selecciona el camión o equipo donde pasó el problema.",
        variant: "destructive",
      })
      return
    }
    if (!type) {
      toast({
        title: "Elige el tipo",
        description: "Toca una de las opciones de arriba.",
        variant: "destructive",
      })
      return
    }
    if (!description.trim()) {
      toast({
        title: "Describe el problema",
        description: "Escribe qué pasó con tus palabras.",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)
      const supabase = createClient()
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error("Usuario no autenticado")

      const now = new Date().toISOString()
      const incidentData = {
        asset_id: effectiveAssetId,
        date: now,
        type,
        reported_by: reporterDisplayName || "Operador",
        reported_by_id: user.id,
        description: description.trim(),
        status: "Pendiente",
        documents:
          photos.length > 0 ? photos.map((p) => p.url).filter(Boolean) : null,
        created_by: user.id,
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("incident_history")
        .insert(incidentData)
        .select("id")
        .single()

      if (insertErr) throw new Error(insertErr.message)

      try {
        const woRes = await fetch("/api/work-orders/generate-from-incident", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incident_id: inserted.id,
            priority:
              type.toLowerCase().includes("accidente") ||
              type.toLowerCase().includes("crítica")
                ? "Alta"
                : "Media",
          }),
        })
        if (woRes.ok) {
          toast({
            title: "Listo",
            description: "Tu reporte quedó registrado y ya hay una orden de trabajo.",
          })
        } else {
          toast({
            title: "Reporte guardado",
            description: "Quedó registrado. Si no ves la orden, avisa a tu coordinador.",
          })
        }
      } catch {
        toast({
          title: "Reporte guardado",
          description: "Quedó registrado. Si no ves la orden, avisa a tu coordinador.",
        })
      }

      onOpenChange(false)
      onSuccess()
    } catch (e) {
      toast({
        title: "No se pudo enviar",
        description: e instanceof Error ? e.message : "Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Reportar problema</DialogTitle>
          <DialogDescription className="text-base">
            Solo unos pasos. Si puedes, agrega una foto del problema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {canPickAsset && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">¿Qué equipo?</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {assignedAssets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAssetId(a.id)}
                    className={cn(
                      "min-h-[52px] rounded-xl border-2 p-3 text-left transition-colors",
                      selectedAssetId === a.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-muted/50"
                    )}
                  >
                    <p className="text-lg font-bold tabular-nums">{a.asset_id ?? "—"}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-base font-semibold">¿Qué pasó?</Label>
            <p className="text-sm text-muted-foreground">Toca la opción que más se parezca</p>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const active = type === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      "flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-center transition-colors",
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-6 w-6 shrink-0" aria-hidden />
                    <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="op-problem-desc" className="text-base font-semibold">
              Cuéntanos más
            </Label>
            <p className="text-xs text-muted-foreground">
              Puedes hablar y luego corregir el texto, o escribir con tus palabras.
            </p>
            <Textarea
              id="op-problem-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ejemplo: truena el motor al arrancar, pierde aceite abajo del camión…"
              className="min-h-[120px] text-base"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-semibold">Foto (opcional)</Label>
            <Button
              type="button"
              variant="outline"
              className="min-h-[48px] w-full gap-2"
              onClick={() => setShowEvidenceDialog(true)}
            >
              <Camera className="h-5 w-5" />
              {photos.length > 0 ? `${photos.length} foto(s)` : "Agregar fotos"}
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px] w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-[48px] w-full sm:w-auto"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando…
              </>
            ) : (
              "Enviar reporte"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <EvidenceUpload
        open={showEvidenceDialog}
        onOpenChange={setShowEvidenceDialog}
        evidence={photos}
        setEvidence={setPhotos}
        context="incident"
        assetId={effectiveAssetId ?? undefined}
        title="Foto del problema"
        description="Sube una o más fotos del equipo o del daño."
      />
    </Dialog>
  )
}
