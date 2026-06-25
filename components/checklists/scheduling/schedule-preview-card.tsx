"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarClock, ClipboardList, Factory, UserRound } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExecutorRolesBadges } from "@/components/checklists/executor-roles-badges"
import { PlantaAssetBadge } from "@/components/checklists/planta-asset-badge"
import {
  collectSpecialSectionTypes,
  frequencyLabel,
  SPECIAL_SECTION_LABELS,
} from "./schedule-labels"
import { assetLabel } from "./asset-picker"
import type { ScheduleAsset, ScheduleTemplate, ScheduleUser } from "./types"

type SchedulePreviewCardProps = {
  mode: "manual" | "maintenance"
  template?: ScheduleTemplate | null
  asset?: ScheduleAsset | null
  assignee?: ScheduleUser | null
  scheduledDate?: Date | null
  maintenanceFrequency?: string
  maintenanceIntervalName?: string | null
  maintenancePlanName?: string | null
}

export function SchedulePreviewCard({
  mode,
  template,
  asset,
  assignee,
  scheduledDate,
  maintenanceFrequency,
  maintenanceIntervalName,
  maintenancePlanName,
}: SchedulePreviewCardProps) {
  const hasContent =
    asset ||
    template ||
    assignee ||
    scheduledDate ||
    maintenanceFrequency

  if (!hasContent) return null

  const specialTypes = collectSpecialSectionTypes(template?.checklist_sections)
  const assigneeName = assignee
    ? `${assignee.nombre ?? ""} ${assignee.apellido ?? ""}`.trim()
    : null

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Resumen antes de programar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {asset ? (
          <div className="flex items-start gap-2">
            <Factory className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">{assetLabel(asset)}</p>
              <div className="mt-1">
                <PlantaAssetBadge asset={asset} />
              </div>
            </div>
          </div>
        ) : null}

        {mode === "manual" && template ? (
          <div>
            <p className="font-medium">{template.name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{frequencyLabel(template.frequency)}</Badge>
              {template.equipment_models?.name ? (
                <Badge variant="outline">{template.equipment_models.name}</Badge>
              ) : null}
              {specialTypes.map((type) => (
                <Badge key={type} variant="outline" className="text-[10px]">
                  {SPECIAL_SECTION_LABELS[type] ?? type}
                </Badge>
              ))}
            </div>
            <ExecutorRolesBadges
              roles={template.executor_roles}
              className="mt-2 rounded-md border border-border/40 bg-background/60 px-2 py-2"
            />
          </div>
        ) : null}

        {mode === "maintenance" ? (
          <div className="space-y-1">
            <p>
              <span className="text-muted-foreground">Frecuencia: </span>
              <span className="font-medium">
                {frequencyLabel(maintenanceFrequency)}
              </span>
            </p>
            {maintenanceIntervalName ? (
              <p>
                <span className="text-muted-foreground">Intervalo: </span>
                <span className="font-medium">{maintenanceIntervalName}</span>
              </p>
            ) : null}
            {maintenancePlanName ? (
              <p>
                <span className="text-muted-foreground">Plan: </span>
                <span className="font-medium">{maintenancePlanName}</span>
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              El sistema buscará plantillas compatibles con el modelo del activo.
            </p>
          </div>
        ) : null}

        {scheduledDate ? (
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <span>
              Próxima ejecución:{" "}
              <span className="font-medium">
                {format(scheduledDate, "PPP", { locale: es })}
              </span>
            </span>
          </div>
        ) : null}

        {assigneeName ? (
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <span>
              Asignado a: <span className="font-medium">{assigneeName}</span>
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
