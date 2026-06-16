"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DepartmentSelector } from "@/components/ui/department-selector"
import { useToast } from "@/hooks/use-toast"
import type { IncidentRoutingRule } from "@/lib/incidents/incident-routing"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"

type PlantOption = { id: string; name: string; code?: string }

const EMPTY_FORM = {
  name: "",
  description: "",
  priority: "100",
  is_active: true,
  plant_id: "",
  match_incident_type: "",
  match_impact: "",
  match_description_contains: "",
  target_department_id: "",
  target_response_hours: "24",
}

export function RoutingRulesTab() {
  const { toast } = useToast()
  const [rules, setRules] = useState<IncidentRoutingRule[]>([])
  const [plants, setPlants] = useState<PlantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/incidents/routing-rules")
    if (res.ok) setRules(await res.json())
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadRules()
      try {
        const plantsRes = await fetch("/api/plants")
        if (plantsRes.ok) {
          const data = await plantsRes.json()
          setPlants(Array.isArray(data) ? data : data.plants ?? [])
        }
      } catch {
        // optional
      }
      setLoading(false)
    }
    void init()
  }, [loadRules])

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const startEdit = (rule: IncidentRoutingRule) => {
    setEditingId(rule.id)
    setForm({
      name: rule.name,
      description: rule.description ?? "",
      priority: String(rule.priority),
      is_active: rule.is_active,
      plant_id: rule.plant_id ?? "",
      match_incident_type: rule.match_incident_type ?? "",
      match_impact: rule.match_impact ?? "",
      match_description_contains: rule.match_description_contains ?? "",
      target_department_id: rule.target_department_id,
      target_response_hours: String(rule.target_response_hours),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.target_department_id) {
      toast({
        title: "Campos requeridos",
        description: "Nombre y departamento destino son obligatorios.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      priority: Number(form.priority) || 100,
      is_active: form.is_active,
      plant_id: form.plant_id || null,
      match_incident_type: form.match_incident_type.trim() || null,
      match_impact: form.match_impact.trim() || null,
      match_description_contains: form.match_description_contains.trim() || null,
      target_department_id: form.target_department_id,
      target_response_hours: Number(form.target_response_hours) || 24,
    }

    try {
      const res = editingId
        ? await fetch(`/api/incidents/routing-rules/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/incidents/routing-rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Error al guardar")
      }

      toast({ title: editingId ? "Regla actualizada" : "Regla creada" })
      resetForm()
      await loadRules()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo guardar",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta regla de ruteo?")) return
    const res = await fetch(`/api/incidents/routing-rules/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Regla eliminada" })
      if (editingId === id) resetForm()
      await loadRules()
    }
  }

  const toggleActive = async (rule: IncidentRoutingRule) => {
    const res = await fetch(`/api/incidents/routing-rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    if (res.ok) await loadRules()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando reglas…
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar regla" : "Nueva regla de ruteo"}</CardTitle>
          <CardDescription>
            Las reglas se evalúan por prioridad (menor número = mayor prioridad). La primera
            coincidencia asigna el departamento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Nombre</Label>
              <Input
                id="rule-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Fallas mecánicas → Mantenimiento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-desc">Descripción</Label>
              <Textarea
                id="rule-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rule-priority">Prioridad</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  min={0}
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-sla">SLA (horas)</Label>
                <Input
                  id="rule-sla"
                  type="number"
                  min={1}
                  value={form.target_response_hours}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, target_response_hours: e.target.value }))
                  }
                />
              </div>
            </div>
            <DepartmentSelector
              label="Departamento destino"
              required
              value={form.target_department_id}
              onValueChange={(v) => setForm((f) => ({ ...f, target_department_id: v }))}
              showPlantName
            />
            <div className="space-y-2">
              <Label>Planta (opcional)</Label>
              <Select
                value={form.plant_id || "__any__"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, plant_id: v === "__any__" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las plantas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Todas las plantas</SelectItem>
                  {plants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="match-type">Tipo de incidente (opcional)</Label>
              <Input
                id="match-type"
                value={form.match_incident_type}
                onChange={(e) => setForm((f) => ({ ...f, match_incident_type: e.target.value }))}
                placeholder="Ej. falla mecánica"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="match-impact">Impacto (opcional)</Label>
              <Input
                id="match-impact"
                value={form.match_impact}
                onChange={(e) => setForm((f) => ({ ...f, match_impact: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="match-desc">Descripción contiene (opcional)</Label>
              <Input
                id="match-desc"
                value={form.match_description_contains}
                onChange={(e) =>
                  setForm((f) => ({ ...f, match_description_contains: e.target.value }))
                }
                placeholder="Ej. hidráulica"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="rule-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="rule-active">Regla activa</Label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : editingId ? (
                  <Pencil className="mr-2 h-4 w-4" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {editingId ? "Actualizar" : "Crear regla"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas configuradas ({rules.length})</CardTitle>
          <CardDescription>
            Incidentes nuevos se enrutan automáticamente al insertarse (cuando la migración esté
            aplicada).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No hay reglas. Crea al menos una para habilitar el ruteo automático.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{rule.name}</span>
                        {!rule.is_active && (
                          <Badge variant="secondary" className="w-fit">
                            Inactiva
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{rule.departments?.name ?? "—"}</TableCell>
                    <TableCell>{rule.target_response_hours}h</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleActive(rule)}
                          title={rule.is_active ? "Desactivar" : "Activar"}
                        >
                          {rule.is_active ? "On" : "Off"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
