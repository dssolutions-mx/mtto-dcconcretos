"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import Link from "next/link"
import { Camera, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { EvidenceUpload, type EvidencePhoto } from "@/components/ui/evidence-upload"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase"
import type { AgendaWorkOrder } from "@/lib/agenda/agenda-utils"
import { taskKeyFromRequiredTask, type TaskCompletionRow } from "@/lib/work-orders/parse-completed-tasks"
import {
  getCurrentValue,
  getMaintenanceUnit,
  getRawModelMaintenanceUnit,
  getUnitDisplayName,
  type MaintenanceUnit,
} from "@/lib/utils/maintenance-units"
import { MaintenanceType } from "@/types"

interface MechanicCompleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrder: Pick<AgendaWorkOrder, "id" | "order_id" | "description"> | null
  onCompleted?: () => void
}

type RequiredTask = {
  id?: string | null
  description: string
  type?: string
}

type PartLine = {
  part_id: string
  name: string
  quantity: number
  unit_price: number
  total_price: number
}

type LoadedWorkOrder = {
  id: string
  order_id: string
  description: string | null
  type: string
  asset_id: string | null
  assigned_to: string | null
  maintenance_plan_id: string | null
  asset?: {
    id: string
    current_hours?: number | null
    current_kilometers?: number | null
    equipment_models?: { maintenance_unit?: string | null } | null
  } | null
}

function parseJsonArray<T>(raw: unknown): T[] {
  if (!raw) return []
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function normalizeParts(raw: unknown): PartLine[] {
  return parseJsonArray<Record<string, unknown>>(raw).map((part, index) => {
    const qty = Number(part.quantity) || 0
    const unit = Number(part.unit_price) || 0
    const name =
      String(part.name ?? part.part_name ?? part.description ?? "Repuesto").trim() ||
      "Repuesto"
    return {
      part_id: String(part.part_id ?? part.id ?? `part-${index}`),
      name,
      quantity: qty,
      unit_price: unit,
      total_price: Number(part.total_price) || qty * unit,
    }
  })
}

export function MechanicCompleteDialog({
  open,
  onOpenChange,
  workOrder,
  onCompleted,
}: MechanicCompleteDialogProps) {
  const { toast } = useToast()
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fullOrder, setFullOrder] = useState<LoadedWorkOrder | null>(null)
  const [requiredTasks, setRequiredTasks] = useState<RequiredTask[]>([])
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({})
  const [parts, setParts] = useState<PartLine[]>([])
  const [laborHours, setLaborHours] = useState("1")
  const [notes, setNotes] = useState("")
  const [equipmentHours, setEquipmentHours] = useState("")
  const [equipmentKilometers, setEquipmentKilometers] = useState("")
  const [maintenanceUnit, setMaintenanceUnit] = useState<MaintenanceUnit>("hours")
  const [rawMaintenanceUnit, setRawMaintenanceUnit] = useState("hours")
  const [completionEvidence, setCompletionEvidence] = useState<EvidencePhoto[]>([])
  const [showEvidenceDialog, setShowEvidenceDialog] = useState(false)

  const resetForm = useCallback(() => {
    setFullOrder(null)
    setRequiredTasks([])
    setCompletedTasks({})
    setParts([])
    setLaborHours("1")
    setNotes("")
    setEquipmentHours("")
    setEquipmentKilometers("")
    setCompletionEvidence([])
  }, [])

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const isPreventive = useMemo(() => {
    const t = String(fullOrder?.type ?? "").toLowerCase()
    return t === MaintenanceType.PREVENTIVE || t === "preventivo"
  }, [fullOrder?.type])

  const loadDetails = useCallback(async (woId: string) => {
    setLoadingDetails(true)
    try {
      const supabase = createClient()
      const { data: orderData, error } = await supabase
        .from("work_orders")
        .select(
          `id, order_id, description, type, asset_id, assigned_to, maintenance_plan_id,
           required_tasks, required_parts,
           asset:assets (id, current_hours, current_kilometers, equipment_models (maintenance_unit))`,
        )
        .eq("id", woId)
        .single()

      if (error || !orderData) throw new Error("No se pudo cargar la orden")

      setFullOrder(orderData as LoadedWorkOrder)

      const unit = getMaintenanceUnit(orderData.asset || {})
      const rawUnit =
        getRawModelMaintenanceUnit(orderData.asset?.equipment_models ?? orderData.asset) ??
        "hours"
      setMaintenanceUnit(unit)
      setRawMaintenanceUnit(rawUnit)

      if (orderData.asset) {
        const current = getCurrentValue(orderData.asset, unit)
        if (unit === "kilometers") {
          setEquipmentKilometers(String(current))
        } else {
          setEquipmentHours(String(current))
        }
        if (rawUnit === "both") {
          setEquipmentKilometers(String(Number(orderData.asset.current_kilometers) || 0))
        }
      }

      const tasks = parseJsonArray<RequiredTask>(orderData.required_tasks)
      setRequiredTasks(tasks)
      const initialCompleted: Record<string, boolean> = {}
      tasks.forEach((task, index) => {
        initialCompleted[taskKeyFromRequiredTask(task, index)] = false
      })
      setCompletedTasks(initialCompleted)

      let loadedParts = normalizeParts(orderData.required_parts)

      const { data: linkedPos } = await supabase
        .from("purchase_orders")
        .select("id, items, is_adjustment, actual_amount, total_amount")
        .eq("work_order_id", woId)
        .order("created_at", { ascending: true })

      const mainPo = (linkedPos ?? []).find((po) => !po.is_adjustment && po.items)
      if (mainPo?.items) {
        const poParts = normalizeParts(mainPo.items)
        if (poParts.length > 0) loadedParts = poParts
      }

      setParts(loadedParts)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo cargar la OT",
        variant: "destructive",
      })
      handleOpenChange(false)
    } finally {
      setLoadingDetails(false)
    }
  }, [toast])

  useEffect(() => {
    if (open && workOrder?.id) {
      void loadDetails(workOrder.id)
    }
  }, [open, workOrder?.id, loadDetails])

  const tasksDoneCount = Object.values(completedTasks).filter(Boolean).length
  const allTasksDone =
    requiredTasks.length === 0 || tasksDoneCount === requiredTasks.length

  const updatePartQuantity = (partId: string, qty: number) => {
    setParts((prev) =>
      prev.map((p) =>
        p.part_id === partId
          ? {
              ...p,
              quantity: qty,
              total_price: qty * p.unit_price,
            }
          : p,
      ),
    )
  }

  const validate = (): string | null => {
    if (!notes.trim()) return "Indique qué se realizó en el trabajo."
    if (requiredTasks.length > 0 && !allTasksDone) {
      return "Marque todas las tareas requeridas antes de completar."
    }
    if (isPreventive && fullOrder?.maintenance_plan_id) {
      const meter =
        maintenanceUnit === "kilometers"
          ? Number(equipmentKilometers) || 0
          : Number(equipmentHours) || 0
      if (meter <= 0) {
        return `Indique la lectura de ${getUnitDisplayName(maintenanceUnit)} del equipo.`
      }
    }
    for (const part of parts) {
      if (Number.isNaN(part.quantity) || part.quantity < 0) {
        return `Cantidad inválida para ${part.name}.`
      }
    }
    return null
  }

  const handleSave = async () => {
    if (!workOrder || !fullOrder) return
    const validationError = validate()
    if (validationError) {
      toast({
        title: "Falta información",
        description: validationError,
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const now = new Date()
      const labor = Number(laborHours) || 0
      const completionDate = now.toISOString()
      const partsUsed = parts.map((p) => ({
        part_id: p.part_id,
        name: p.name,
        quantity: p.quantity,
        unit_price: p.unit_price,
        total_price: p.total_price,
      }))
      const partsCost = partsUsed.reduce((s, p) => s + p.total_price, 0)

      const completedAtIso = completionDate
      const completedTasksPayload: TaskCompletionRow[] | null =
        requiredTasks.length > 0
          ? requiredTasks.map((task, index) => {
              const key = taskKeyFromRequiredTask(task, index)
              return {
                task_id: key,
                description: task.description,
                completed: completedTasks[key] === true,
                completed_at: completedTasks[key] === true ? completedAtIso : undefined,
              }
            })
          : null

      const equipmentHoursVal =
        maintenanceUnit === "hours" || rawMaintenanceUnit === "both"
          ? Number(equipmentHours) || null
          : null
      const equipmentKmVal =
        maintenanceUnit === "kilometers" || rawMaintenanceUnit === "both"
          ? Number(equipmentKilometers) || null
          : null

      const payload = {
        workOrderId: workOrder.id,
        completionData: {
          resolution_details: notes.trim(),
          technician_notes: notes.trim(),
          downtime_hours: 0,
          labor_hours: labor,
          labor_cost: 0,
          total_cost: partsCost,
          completion_date: completionDate,
          completion_time: format(now, "HH:mm"),
          parts_used: partsUsed,
          completed_tasks: completedTasksPayload ?? undefined,
          equipment_hours: equipmentHoursVal,
          equipment_kilometers: equipmentKmVal,
          completion_photos: completionEvidence.map((evidence) => ({
            url: evidence.url,
            description: evidence.description,
            category: evidence.category,
            uploaded_at: evidence.uploaded_at,
            bucket_path: evidence.bucket_path,
          })),
        },
        maintenanceHistoryData: fullOrder.asset_id
          ? {
              asset_id: fullOrder.asset_id,
              date: completionDate,
              type: fullOrder.type,
              description: fullOrder.description ?? workOrder.description,
              technician_id: fullOrder.assigned_to,
              labor_hours: labor,
              labor_cost: "0",
              parts: partsUsed.length > 0 ? partsUsed : null,
              total_cost: String(partsCost),
              work_order_id: workOrder.id,
              findings: notes.trim(),
              actions: notes.trim(),
              resolution_details: notes.trim(),
              technician_notes: notes.trim(),
              downtime_hours: 0,
              hours: equipmentHoursVal,
              kilometers: equipmentKmVal,
              completed_tasks: completedTasksPayload,
            }
          : null,
      }

      const res = await fetch("/api/maintenance/work-completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "No se pudo completar la orden")
      }

      toast({
        title: "Trabajo completado",
        description: `OT ${workOrder.order_id} registrada como completada.`,
      })
      onCompleted?.()
      handleOpenChange(false)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo completar",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (!workOrder) return null

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[min(90vh,720px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Completar trabajo</DialogTitle>
            <DialogDescription>
              OT {workOrder.order_id} — registro de campo con tareas, repuestos y evidencia.
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando orden…
            </div>
          ) : (
            <ScrollArea className="flex-1 min-h-0 px-6">
              <div className="space-y-5 py-2 pr-3">
                <p className="text-sm text-muted-foreground">{workOrder.description}</p>

                {requiredTasks.length > 0 && (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm font-medium">Tareas requeridas</Label>
                      <Badge variant={allTasksDone ? "default" : "secondary"}>
                        {tasksDoneCount}/{requiredTasks.length}
                      </Badge>
                    </div>
                    <ul className="space-y-2 rounded-lg border p-3">
                      {requiredTasks.map((task, index) => {
                        const key = taskKeyFromRequiredTask(task, index)
                        return (
                          <li key={key} className="flex items-start gap-3">
                            <Checkbox
                              id={`task-${key}`}
                              checked={completedTasks[key] ?? false}
                              onCheckedChange={(checked) =>
                                setCompletedTasks((prev) => ({
                                  ...prev,
                                  [key]: checked === true,
                                }))
                              }
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={`task-${key}`}
                              className="text-sm leading-snug cursor-pointer"
                            >
                              {task.description}
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )}

                {parts.length > 0 && (
                  <section className="space-y-2">
                    <Label className="text-sm font-medium">Repuestos utilizados</Label>
                    <ul className="space-y-2 rounded-lg border p-3">
                      {parts.map((part) => (
                        <li
                          key={part.part_id}
                          className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-sm flex-1 min-w-0 truncate">{part.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <Label htmlFor={`qty-${part.part_id}`} className="sr-only">
                              Cantidad
                            </Label>
                            <Input
                              id={`qty-${part.part_id}`}
                              type="number"
                              min={0}
                              step={1}
                              className="w-20 h-8"
                              value={part.quantity}
                              onChange={(e) =>
                                updatePartQuantity(part.part_id, Number(e.target.value) || 0)
                              }
                            />
                            <span className="text-xs text-muted-foreground w-8">uds</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {isPreventive && fullOrder?.maintenance_plan_id && (
                  <section className="space-y-2">
                    <Label className="text-sm font-medium">
                      Lectura del equipo ({getUnitDisplayName(maintenanceUnit)})
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(maintenanceUnit === "hours" || rawMaintenanceUnit === "both") && (
                        <div className="space-y-1">
                          <Label htmlFor="equip-hours" className="text-xs text-muted-foreground">
                            Horas
                          </Label>
                          <Input
                            id="equip-hours"
                            type="number"
                            min={0}
                            step={0.1}
                            value={equipmentHours}
                            onChange={(e) => setEquipmentHours(e.target.value)}
                          />
                        </div>
                      )}
                      {(maintenanceUnit === "kilometers" || rawMaintenanceUnit === "both") && (
                        <div className="space-y-1">
                          <Label htmlFor="equip-km" className="text-xs text-muted-foreground">
                            Kilómetros
                          </Label>
                          <Input
                            id="equip-km"
                            type="number"
                            min={0}
                            step={1}
                            value={equipmentKilometers}
                            onChange={(e) => setEquipmentKilometers(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <section className="space-y-2">
                  <Label htmlFor="labor-hours">Horas de trabajo</Label>
                  <Input
                    id="labor-hours"
                    type="number"
                    min={0}
                    step={0.5}
                    value={laborHours}
                    onChange={(e) => setLaborHours(e.target.value)}
                  />
                </section>

                <section className="space-y-2">
                  <Label htmlFor="completion-notes">¿Qué se realizó?</Label>
                  <Textarea
                    id="completion-notes"
                    rows={3}
                    placeholder="Descripción del trabajo realizado…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Evidencia fotográfica</Label>
                    <Badge variant="outline">{completionEvidence.length} foto(s)</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowEvidenceDialog(true)}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {completionEvidence.length > 0 ? "Gestionar fotos" : "Agregar fotos (opcional)"}
                  </Button>
                </section>

                <Separator />

                <p className="text-xs text-muted-foreground">
                  ¿Gastos adicionales, ajuste de OC o más detalle?{" "}
                  <Link
                    href={`/ordenes/${workOrder.id}/completar`}
                    className="text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    Formulario completo
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </p>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="px-6 py-4 border-t shrink-0 flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || loadingDetails}>
              {saving ? "Guardando…" : "Marcar completada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EvidenceUpload
        open={showEvidenceDialog}
        onOpenChange={setShowEvidenceDialog}
        evidence={completionEvidence}
        setEvidence={setCompletionEvidence}
        context="completion"
        workOrderId={workOrder.id}
        operatorSimple
      />
    </>
  )
}
