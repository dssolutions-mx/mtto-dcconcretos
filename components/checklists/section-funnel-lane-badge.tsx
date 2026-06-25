"use client"

import { Badge } from "@/components/ui/badge"
import type { SectionFunnelInput } from "@/lib/checklist/section-funnel"
import { getFunnelLaneLabel } from "@/lib/checklist/checklist-completion-progress"
import { getSectionFunnelLane } from "@/lib/checklist/section-funnel"
import { cn } from "@/lib/utils"

interface SectionFunnelLaneBadgeProps {
  section: SectionFunnelInput
  className?: string
}

export function SectionFunnelLaneBadge({
  section,
  className,
}: SectionFunnelLaneBadgeProps) {
  const lane = getSectionFunnelLane(section)

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs shrink-0 font-normal",
        lane === "operations_evaluation"
          ? "bg-sky-50 text-sky-700 border-sky-200"
          : "bg-muted/50 text-muted-foreground",
        className
      )}
    >
      {getFunnelLaneLabel(lane)}
    </Badge>
  )
}
