"use client"

import { useState } from "react"
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
import { Loader2 } from "lucide-react"
import type { CreateTireInput } from "@/types/tires"

interface CreateTireDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateTireDialog({ open, onOpenChange, onCreated }: CreateTireDialogProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<CreateTireInput>({
    brand: "",
    size: "",
    condition: "nueva",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/tires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al crear llanta")
      }
      setForm({ brand: "", size: "", condition: "nueva" })
      onOpenChange(false)
      onCreated()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar llanta</DialogTitle>
          <DialogDescription>
            Alta en catálogo / inventario de llantas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                value={form.model ?? ""}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="serial">DOT / Serie</Label>
              <Input
                id="serial"
                value={form.serial_number ?? ""}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Condición</Label>
              <Select
                value={form.condition}
                onValueChange={(v) => setForm({ ...form, condition: v as CreateTireInput["condition"] })}
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
            <div className="space-y-1">
              <Label htmlFor="cost">Costo compra</Label>
              <Input
                id="cost"
                type="number"
                min={0}
                step="0.01"
                value={form.purchase_cost ?? ""}
                onChange={(e) =>
                  setForm({ ...form, purchase_cost: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
