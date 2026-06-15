"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { ThemeBucket } from "@/lib/maintenance/planning-cockpit-metrics"
import type { InspectionCohortId } from "@/lib/incidents/inspection-cohort"

type CreateCampaignDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  themeBucket?: ThemeBucket
  cohortId?: InspectionCohortId
  plantId?: string
}

export function CreateCampaignDialog({
  open,
  onOpenChange,
  themeBucket,
  cohortId,
  plantId,
}: CreateCampaignDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [targetEnd, setTargetEnd] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const defaultName = themeBucket
    ? `Campaña — ${themeBucket.label}`
    : "Nueva campaña de mantenimiento"

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || defaultName,
          theme: themeBucket?.themeId,
          cohort_id: cohortId,
          plant_id: plantId,
          target_end: targetEnd || null,
          notes: notes || null,
          work_order_ids: themeBucket?.workOrderIds ?? [],
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Error al crear campaña")
      }
      const campaign = await res.json()
      toast({ title: "Campaña creada", description: campaign.name })
      onOpenChange(false)
      router.push(`/ordenes/campanas/${campaign.id}`)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo crear la campaña",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear campaña</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Nombre</Label>
            <Input
              id="campaign-name"
              placeholder={defaultName}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {themeBucket && (
            <p className="text-sm text-muted-foreground">
              Incluye {themeBucket.workOrderCount} OTs del tema {themeBucket.label}.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="target-end">Meta (fecha fin)</Label>
            <Input
              id="target-end"
              type="date"
              value={targetEnd}
              onChange={(e) => setTargetEnd(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Creando…" : "Crear campaña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
