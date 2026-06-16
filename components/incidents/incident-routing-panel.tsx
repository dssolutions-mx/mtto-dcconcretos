"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DepartmentSelector } from "@/components/ui/department-selector"
import { useToast } from "@/hooks/use-toast"
import {
  INCIDENT_PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type IncidentPipelineStage,
} from "@/lib/incidents/incident-routing"

type AssignmentState = {
  routing_department_id: string | null
  assigned_to_id: string | null
  pipeline_stage: IncidentPipelineStage
  department_name?: string | null
  assignee_name?: string | null
  target_response_hours?: number | null
  routed_at?: string | null
  sla_breached?: boolean
}

type ProfileOption = { id: string; nombre: string | null; apellido: string | null }

export function IncidentRoutingPanel({
  incidentId,
  plantId,
  initial,
  onUpdated,
}: {
  incidentId: string
  plantId?: string | null
  initial?: Partial<AssignmentState>
  onUpdated?: () => void
}) {
  const { toast } = useToast()
  const [state, setState] = useState<AssignmentState>({
    routing_department_id: initial?.routing_department_id ?? null,
    assigned_to_id: initial?.assigned_to_id ?? null,
    pipeline_stage: (initial?.pipeline_stage as IncidentPipelineStage) ?? "bandeja",
    department_name: initial?.department_name,
    assignee_name: initial?.assignee_name,
    target_response_hours: initial?.target_response_hours,
    routed_at: initial?.routed_at,
    sla_breached: initial?.sla_breached,
  })
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [saving, setSaving] = useState(false)
  const [routing, setRouting] = useState(false)

  useEffect(() => {
    setState({
      routing_department_id: initial?.routing_department_id ?? null,
      assigned_to_id: initial?.assigned_to_id ?? null,
      pipeline_stage: (initial?.pipeline_stage as IncidentPipelineStage) ?? "bandeja",
      department_name: initial?.department_name,
      assignee_name: initial?.assignee_name,
      target_response_hours: initial?.target_response_hours,
      routed_at: initial?.routed_at,
      sla_breached: initial?.sla_breached,
    })
  }, [
    incidentId,
    initial?.routing_department_id,
    initial?.assigned_to_id,
    initial?.pipeline_stage,
    initial?.target_response_hours,
    initial?.routed_at,
    initial?.sla_breached,
    initial?.department_name,
    initial?.assignee_name,
  ])

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("profiles")
          .select("id, nombre, apellido")
          .eq("is_active", true)
          .order("nombre")
        setProfiles(data ?? [])
      } catch {
        // optional
      }
    }
    void loadProfiles()
  }, [])

  const saveAssignment = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/incidents/${incidentId}/assignment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_department_id: state.routing_department_id,
          assigned_to_id: state.assigned_to_id,
          pipeline_stage: state.pipeline_stage,
          reason: "Actualización desde detalle de incidente",
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Error al guardar")
      }
      toast({ title: "Asignación actualizada" })
      onUpdated?.()
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

  const runAutoRoute = async () => {
    setRouting(true)
    try {
      const res = await fetch("/api/incidents/routed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident_ids: [incidentId] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Error al rutear")
      const result = data.results?.[0]
      if (result && !result.ok) throw new Error(result.error || "Sin regla coincidente")
      toast({ title: "Ruteo aplicado" })
      onUpdated?.()
    } catch (err) {
      toast({
        title: "Ruteo no aplicado",
        description: err instanceof Error ? err.message : "Verifica reglas activas y migración",
        variant: "destructive",
      })
    } finally {
      setRouting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Ruteo y responsabilidad</CardTitle>
          {state.sla_breached && <Badge variant="destructive">Fuera de SLA</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <DepartmentSelector
          label="Departamento"
          plantId={plantId ?? undefined}
          value={state.routing_department_id ?? undefined}
          onValueChange={(v) =>
            setState((s) => ({ ...s, routing_department_id: v || null }))
          }
          canonicalOnly
        />
        <div className="space-y-2">
          <Label>Responsable</Label>
          <Select
            value={state.assigned_to_id ?? "__none__"}
            onValueChange={(v) =>
              setState((s) => ({
                ...s,
                assigned_to_id: v === "__none__" ? null : v,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin asignar</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {`${p.nombre ?? ""} ${p.apellido ?? ""}`.trim() || p.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Etapa del pipeline</Label>
          <Select
            value={state.pipeline_stage}
            onValueChange={(v) =>
              setState((s) => ({ ...s, pipeline_stage: v as IncidentPipelineStage }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INCIDENT_PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {PIPELINE_STAGE_LABELS[stage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {state.target_response_hours != null && (
          <p className="text-xs text-muted-foreground">
            SLA: {state.target_response_hours}h
            {state.routed_at ? ` · Ruteado ${new Date(state.routed_at).toLocaleString("es-MX")}` : ""}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void saveAssignment()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
          <Button variant="outline" onClick={() => void runAutoRoute()} disabled={routing}>
            {routing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar ruteo automático
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
