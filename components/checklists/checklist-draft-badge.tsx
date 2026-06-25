"use client"

import { Badge } from "@/components/ui/badge"
import { Save } from "lucide-react"
import { scheduleHasVisibleDraft } from "@/lib/checklist/schedule-draft-display"

type ChecklistDraftBadgeProps = {
  schedule: {
    draft_payload?: unknown
    draft_updated_at?: string | null
  }
  className?: string
}

export function ChecklistDraftBadge({ schedule, className }: ChecklistDraftBadgeProps) {
  if (!scheduleHasVisibleDraft(schedule)) return null

  return (
    <Badge
      variant="outline"
      className={`gap-1 border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200 ${className ?? ''}`}
    >
      <Save className="h-3 w-3" />
      Borrador
    </Badge>
  )
}
