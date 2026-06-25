"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AssetPicker } from "./asset-picker"
import { AssigneePicker } from "./assignee-picker"
import { ExistingSchedulesAlert } from "./existing-schedules-alert"
import { PlantaAssetBadge } from "@/components/checklists/planta-asset-badge"
import { SchedulePreviewCard } from "./schedule-preview-card"
import type {
  MaintenanceInterval,
  MaintenancePlan,
  PendingSchedule,
  ScheduleAsset,
  SchedulePlant,
  ScheduleUser,
} from "./types"

type MaintenanceScheduleTabProps = {
  formData: {
    asset_id: string
    model_id: string
    frequency: string
    assigned_to: string
    maintenance_interval_id: string
    maintenance_plan_id: string
  }
  onChange: (field: string, value: unknown) => void
  assets: ScheduleAsset[]
  plants: SchedulePlant[]
  users: ScheduleUser[]
  maintenanceIntervals: MaintenanceInterval[]
  maintenancePlans: MaintenancePlan[]
  pendingSchedules: PendingSchedule[]
  loadingPending: boolean
  loadingIntervals: boolean
  loadingPlans: boolean
  loading?: boolean
}

export function MaintenanceScheduleTab({
  formData,
  onChange,
  assets,
  plants,
  users,
  maintenanceIntervals,
  maintenancePlans,
  pendingSchedules,
  loadingPending,
  loadingIntervals,
  loadingPlans,
  loading = false,
}: MaintenanceScheduleTabProps) {
  const selectedAsset =
    assets.find((asset) => asset.id === formData.asset_id) ?? null
  const selectedAssignee =
    users.find((user) => user.id === formData.assigned_to) ?? null

  const selectedInterval = maintenanceIntervals.find(
    (interval) => interval.id === formData.maintenance_interval_id
  )
  const selectedPlan = maintenancePlans.find(
    (plan) => plan.id === formData.maintenance_plan_id
  )

  return (
    <div className="space-y-4">
      <AssetPicker
        value={formData.asset_id}
        onValueChange={(value) => onChange("asset_id", value)}
        assets={assets}
        plants={plants}
        loading={loading}
        id="maintenanceAssetSelection"
      />

      {selectedAsset && !formData.model_id ? (
        <p className="text-sm text-muted-foreground">
          Cargando modelo del activo…
        </p>
      ) : null}

      {formData.asset_id ? (
        <ExistingSchedulesAlert
          pendingSchedules={pendingSchedules}
          loading={loadingPending}
        />
      ) : null}

      {formData.model_id && maintenancePlans.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="maintenancePlanSelection">Plan de mantenimiento</Label>
          <Select
            value={formData.maintenance_plan_id || "none"}
            onValueChange={(value) => onChange("maintenance_plan_id", value)}
          >
            <SelectTrigger id="maintenancePlanSelection">
              <SelectValue placeholder="Seleccionar plan de mantenimiento (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguno (checklist independiente)</SelectItem>
              {loadingPlans ? (
                <SelectItem value="loading" disabled>
                  Cargando planes…
                </SelectItem>
              ) : (
                maintenancePlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} — {plan.maintenance_intervals?.name || "Plan personalizado"}
                    {plan.next_due
                      ? ` (Próx: ${new Date(plan.next_due).toLocaleDateString("es-MX")})`
                      : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="frequencySelection">Frecuencia</Label>
        <Select
          value={formData.frequency}
          onValueChange={(value) => onChange("frequency", value)}
        >
          <SelectTrigger id="frequencySelection" className="sm:max-w-xs">
            <SelectValue placeholder="Seleccionar frecuencia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="diario">Diario</SelectItem>
            <SelectItem value="semanal">Semanal</SelectItem>
            <SelectItem value="mensual">Mensual</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Define qué plantillas se buscarán para el modelo del activo. Para operaciones de planta,
          use <span className="font-medium">diario</span> (puntualidad) o{" "}
          <span className="font-medium">mensual</span> (cierre de bono).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="maintenanceIntervalSelection">Intervalo de mantenimiento</Label>
        <Select
          value={formData.maintenance_interval_id || "none"}
          onValueChange={(value) => onChange("maintenance_interval_id", value)}
          disabled={loadingIntervals || maintenanceIntervals.length === 0}
        >
          <SelectTrigger id="maintenanceIntervalSelection">
            <SelectValue
              placeholder={
                loadingIntervals
                  ? "Cargando intervalos…"
                  : maintenanceIntervals.length === 0
                    ? "No hay intervalos para este modelo"
                    : "Seleccionar intervalo"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Ninguno (checklist independiente)</SelectItem>
            {loadingIntervals ? (
              <SelectItem value="loading" disabled>
                Cargando intervalos…
              </SelectItem>
            ) : (
              maintenanceIntervals.map((interval) => (
                <SelectItem key={interval.id} value={interval.id}>
                  {interval.name} ({interval.interval_value} horas)
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <AssigneePicker
        value={formData.assigned_to}
        onValueChange={(value) => onChange("assigned_to", value)}
        users={users}
        selectedAsset={selectedAsset}
        loading={loading}
        id="maintenanceTechnicianSelection"
      />

      {selectedAsset ? <PlantaAssetBadge asset={selectedAsset} /> : null}

      <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3 space-y-2">
        <p className="text-sm font-medium">Programación automática</p>
        <p className="text-sm text-muted-foreground">
          El sistema buscará plantillas para el modelo del activo y la frecuencia elegida
          {formData.maintenance_interval_id ? " con el intervalo de mantenimiento." : "."}
        </p>
      </div>

      <SchedulePreviewCard
        mode="maintenance"
        asset={selectedAsset}
        assignee={selectedAssignee}
        maintenanceFrequency={formData.frequency}
        maintenanceIntervalName={selectedInterval?.name ?? null}
        maintenancePlanName={selectedPlan?.name ?? null}
      />
    </div>
  )
}
