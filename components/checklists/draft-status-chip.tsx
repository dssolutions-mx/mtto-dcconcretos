"use client"

import { Badge } from "@/components/ui/badge"
import { Cloud, CloudOff, Loader2, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DRAFT_SYNC_STATUS_LABEL,
  type DraftSyncStatus,
} from "@/lib/checklist/schedule-draft-display"

type DraftStatusChipProps = {
  status: DraftSyncStatus
  className?: string
}

export function DraftStatusChip({ status, className }: DraftStatusChipProps) {
  if (status === 'none') return null

  const label = DRAFT_SYNC_STATUS_LABEL[status]
  const Icon =
    status === 'saving'
      ? Loader2
      : status === 'local_only'
        ? CloudOff
        : status === 'synced'
          ? Cloud
          : Save

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-normal text-xs",
        status === 'saving' && "border-muted-foreground/30 text-muted-foreground",
        status === 'synced' && "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
        status === 'server_draft' && "border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
        status === 'local_only' && "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
        className
      )}
    >
      <Icon
        className={cn("h-3 w-3 shrink-0", status === 'saving' && "animate-spin")}
      />
      {label}
    </Badge>
  )
}
