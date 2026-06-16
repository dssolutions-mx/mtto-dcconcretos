"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Loader2 } from "lucide-react"
import { previewInternalCode } from "@/lib/tires/identifier"
import { formatTirePrimaryId } from "@/lib/tires/display"
import type { CreateTireInput, TireIdRules } from "@/types/tires"

interface WarehouseOption {
  id: string
  name: string
  warehouse_code: string
}

interface CreateTireDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateTireDialog({ open, onOpenChange, onCreated }: CreateTireDialogProps) {
  const [loading, setLoading] = useState(false)
  const [idRules, setIdRules] = useState<TireIdRules>({})
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [form, setForm] = useState<CreateTireInput>({
    brand: "",
    size: "",
    condition: "nueva",
  })

  useEffect(() => {
    if (!open) return

    Promise.all([
      fetch("/api/tires/preview-code").then((r) => r.json()),
      fetch("/api/inventory/warehouses?is_active=true").then((r) => r.json()),
    ])
      .then(([previewData, warehouseData]) => {
        setIdRules(previewData.id_rules ?? {})
        setPreviewCode(previewData.preview_code ?? null)
        setWarehouses(warehouseData.warehouses ?? [])
      })
      .catch(() => {
        setIdRules({})
        setPreviewCode(null)
        setWarehouses([])
      })
  }, [open])

  const manualPreview = previewInternalCode({
    rules: idRules,
    plantCode: "P1",
    sequence: 1,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (idRules.dot_required && !form.serial_number?.trim()) {
      toast.error("DOT / serial es obligatorio según la configuración de flota")
      return
    }

    if (!idRules.auto_generate && !form.serial_number?.trim() && !form.internal_code?.trim()) {
      toast.error("Indique código interno o DOT / serial")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/tires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Error al crear llanta")
      }

      const tire = data.tire
      const assignedCode = formatTirePrimaryId(tire)
      toast.success(`Llanta registrada: ${assignedCode}`)

      setForm({ brand: "", size: "", condition: "nueva" })
      onOpenChange(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar llanta")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar llanta</DialogTitle>
          <DialogDescription>
            Alta en catálogo / inventario. Use dos identificadores distintos según su operación.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Identificación</h3>
              <p className="text-xs text-muted-foreground mt-1">
                El <strong>código interno</strong> es el ID operativo de su flota (almacén,
                montajes, reportes). El <strong>DOT / serial</strong> es el código del fabricante
                impreso en la pared lateral.
              </p>
            </div>

            {idRules.auto_generate ? (
              <div className="rounded-lg border bg-muted/40 px-3 py-2.5 space-y-1">
                <Label className="text-muted-foreground text-xs">Código interno (al guardar)</Label>
                <p className="font-mono text-sm font-medium">{previewCode ?? manualPreview}</p>
                <p className="text-xs text-muted-foreground">
                  Se asignará automáticamente según las reglas de flota.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="internal-code">Código interno *</Label>
                <Input
                  id="internal-code"
                  placeholder="Ej. DC-LL-P1-2026-00001"
                  value={form.internal_code ?? ""}
                  onChange={(e) => setForm({ ...form, internal_code: e.target.value })}
                  required={!form.serial_number?.trim()}
                />
                <p className="text-xs text-muted-foreground">
                  Obligatorio si no captura DOT y la auto-generación está desactivada.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="serial">
                DOT / serial del fabricante {idRules.dot_required ? "*" : "(opcional)"}
              </Label>
              <Input
                id="serial"
                placeholder="Ej. 0123 ABCD 4521"
                value={form.serial_number ?? ""}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                required={idRules.dot_required === true}
              />
              <p className="text-xs text-muted-foreground">
                Código legal del fabricante; no se auto-genera.
              </p>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Especificaciones</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="brand">Marca *</Label>
                <Input
                  id="brand"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="size">Medida *</Label>
                <Input
                  id="size"
                  placeholder="11R22.5"
                  value={form.size}
                  onChange={(e) => setForm({ ...form, size: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                value={form.model ?? ""}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Condición</Label>
              <Select
                value={form.condition}
                onValueChange={(v) =>
                  setForm({ ...form, condition: v as CreateTireInput["condition"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nueva">Nueva</SelectItem>
                  <SelectItem value="renovada">Renovada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Compra y almacén</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cost">Costo de compra</Label>
                <Input
                  id="cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.purchase_cost ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      purchase_cost: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="purchase-date">Fecha de compra</Label>
                <Input
                  id="purchase-date"
                  type="date"
                  value={form.purchase_date ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, purchase_date: e.target.value || undefined })
                  }
                />
              </div>
            </div>
            {warehouses.length > 0 && (
              <div className="space-y-1">
                <Label>Almacén</Label>
                <Select
                  value={form.warehouse_id ?? "__none__"}
                  onValueChange={(v) =>
                    setForm({ ...form, warehouse_id: v === "__none__" ? undefined : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar almacén" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.warehouse_code} — {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar llanta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
