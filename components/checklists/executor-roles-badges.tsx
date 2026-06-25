"use client"

import { Badge } from "@/components/ui/badge"
import {
  EXECUTOR_ROLE_LABELS,
  type ChecklistExecutorRole,
  normalizeExecutorRoles,
} from "@/lib/checklist/executor-roles"

type Props = {
  roles?: string[] | null
  className?: string
}

export function ExecutorRolesBadges({ roles, className }: Props) {
  const normalized = normalizeExecutorRoles(roles)

  if (normalized.length === 0) return null

  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">
        Roles que pueden ejecutar
      </p>
      <div className="flex flex-wrap gap-1.5">
        {normalized.map((role) => (
          <Badge key={role} variant="secondary" className="text-[11px] font-medium">
            {EXECUTOR_ROLE_LABELS[role as ChecklistExecutorRole] ?? role}
          </Badge>
        ))}
      </div>
    </div>
  )
}
