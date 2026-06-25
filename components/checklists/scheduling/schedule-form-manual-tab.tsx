"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { AssetPicker } from "./asset-picker"
import { TemplatePicker } from "./template-picker"
import { AssigneePicker } from "./assignee-picker"
import { ExistingSchedulesAlert } from "./existing-schedules-alert"
import { SchedulePreviewCard } from "./schedule-preview-card"
import type {
  PendingSchedule,
  ScheduleAsset,
  SchedulePlant,
  ScheduleTemplate,
  ScheduleUser,
} from "./types"

type ManualScheduleTabProps = {
  formData: {
    template_id: string
    asset_id: string
    scheduled_date: Date
    assigned_to: string
  }
  onChange: (field: string, value: unknown) => void
  templates: ScheduleTemplate[]
  assets: ScheduleAsset[]
  plants: SchedulePlant[]
  users: ScheduleUser[]
  pendingSchedules: PendingSchedule[]
  loadingPending: boolean
  loading?: boolean
}

export function ManualScheduleTab({
  formData,
  onChange,
  templates,
  assets,
  plants,
  users,
  pendingSchedules,
  loadingPending,
  loading = false,
}: ManualScheduleTabProps) {
  const selectedAsset =
    assets.find((asset) => asset.id === formData.asset_id) ?? null
  const selectedTemplate =
    templates.find((template) => template.id === formData.template_id) ?? null
  const selectedAssignee =
    users.find((user) => user.id === formData.assigned_to) ?? null

  return (
    <div className="space-y-4">
      <AssetPicker
        value={formData.asset_id}
        onValueChange={(value) => onChange("asset_id", value)}
        assets={assets}
        plants={plants}
        loading={loading}
        id="manualAssetSelection"
      />

      {formData.asset_id ? (
        <ExistingSchedulesAlert
          pendingSchedules={pendingSchedules}
          templateId={formData.template_id}
          loading={loadingPending}
        />
      ) : null}

      <TemplatePicker
        value={formData.template_id}
        onValueChange={(value) => onChange("template_id", value)}
        templates={templates}
        selectedAsset={selectedAsset}
        loading={loading}
        id="manualTemplateSelection"
      />

      <div className="space-y-2">
        <Label htmlFor="dateSelection">Fecha programada</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="dateSelection"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !formData.scheduled_date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.scheduled_date ? (
                format(formData.scheduled_date, "PPP", { locale: es })
              ) : (
                <span>Seleccionar fecha</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={formData.scheduled_date}
              onSelect={(date) => date && onChange("scheduled_date", date)}
              initialFocus
              locale={es}
            />
          </PopoverContent>
        </Popover>
      </div>

      <AssigneePicker
        value={formData.assigned_to}
        onValueChange={(value) => onChange("assigned_to", value)}
        users={users}
        selectedAsset={selectedAsset}
        loading={loading}
        id="manualTechnicianSelection"
      />

      <SchedulePreviewCard
        mode="manual"
        template={selectedTemplate}
        asset={selectedAsset}
        assignee={selectedAssignee}
        scheduledDate={formData.scheduled_date}
      />
    </div>
  )
}
