"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import {
  formatSlaTargetMatchSummary,
  type IncidentSlaTarget,
  type SlaTargetInput,
} from "@/lib/incidents/incident-sla-targets"
import { SlaTargetFormDialog } from "@/components/incidents/sla-targets/sla-target-form-dialog"

type PlantOption = { id: string; name: string; code?: string }

export function SlaTargetsAdmin() {
  const { toast } = useToast()
  const [targets, setTargets] = useState<IncidentSlaTarget[]>([])
  const [plants, setPlants] = useState<PlantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState<IncidentSlaTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IncidentSlaTarget | null>(null)

  const loadTargets = useCallback(async () => {
    const response = await fetch("/api/incidents/sla-targets")
    if (response.ok) {
      setTargets(await response.json())
      return
    }
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || "Error al cargar objetivos SLA")
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        await loadTargets()
        const plantsResponse = await fetch("/api/plants")
        if (plantsResponse.ok) {
          const data = await plantsResponse.json()
          setPlants(Array.isArray(data) ? data : data.plants ?? [])
        }
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "No se pudieron cargar los objetivos",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [loadTargets, toast])

  const openCreateDialog = () => {
    setEditingTarget(null)
    setDialogOpen(true)
  }

  const openEditDialog = (target: IncidentSlaTarget) => {
    setEditingTarget(target)
    setDialogOpen(true)
  }

  const handleSubmit = async (payload: SlaTargetInput) => {
    setSaving(true)
    try {
      const response = editingTarget
        ? await fetch(`/api/incidents/sla-targets/${editingTarget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/incidents/sla-targets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Error al guardar")
      }

      toast({ title: editingTarget ? "Objetivo actualizado" : "Objetivo creado" })
      setDialogOpen(false)
      setEditingTarget(null)
      await loadTargets()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (target: IncidentSlaTarget) => {
    const response = await fetch(`/api/incidents/sla-targets/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !target.is_active }),
    })

    if (response.ok) {
      await loadTargets()
      return
    }

    const data = await response.json().catch(() => ({}))
    toast({
      title: "Error",
      description: data.error || "No se pudo cambiar el estado",
      variant: "destructive",
    })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const response = await fetch(`/api/incidents/sla-targets/${deleteTarget.id}`, {
      method: "DELETE",
    })

    if (response.ok) {
      toast({ title: "Objetivo eliminado" })
      setDeleteTarget(null)
      await loadTargets()
      return
    }

    const data = await response.json().catch(() => ({}))
    toast({
      title: "Error",
      description: data.error || "No se pudo eliminar",
      variant: "destructive",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando objetivos SLA…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/reportes/incidentes-sla">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al tablero SLA
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Objetivos SLA de incidencias</h1>
          <p className="text-muted-foreground mt-1">
            Políticas configurables de tiempos de atención, programación y resolución.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo objetivo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Políticas configuradas ({targets.length})</CardTitle>
          <CardDescription>
            Se evalúan por prioridad ascendente. La primera coincidencia activa define los objetivos
            del incidente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {targets.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No hay objetivos SLA. Crea al menos uno para personalizar el cumplimiento.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Criterios</TableHead>
                  <TableHead>Atención</TableHead>
                  <TableHead>Programación</TableHead>
                  <TableHead>Resolución</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell>{target.priority}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{target.name}</span>
                        {!target.is_active && (
                          <Badge variant="secondary" className="w-fit">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {formatSlaTargetMatchSummary(target)}
                    </TableCell>
                    <TableCell>{target.target_ack_hours}h</TableCell>
                    <TableCell>{target.target_schedule_hours}h</TableCell>
                    <TableCell>{target.target_resolve_hours}h</TableCell>
                    <TableCell>
                      <Switch
                        checked={target.is_active}
                        onCheckedChange={() => void toggleActive(target)}
                        aria-label={`Activar ${target.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(target)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(target)}
                          title="Eliminar"
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

      <SlaTargetFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingTarget(null)
        }}
        target={editingTarget}
        plants={plants}
        saving={saving}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar objetivo SLA?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente la política &quot;{deleteTarget?.name}&quot;. Esta acción
              no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
