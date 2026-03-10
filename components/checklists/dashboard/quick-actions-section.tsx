"use client"

import { Button } from "@/components/ui/button"
import { ClipboardCheck, Plus, FileDown, Loader2 } from "lucide-react"
import Link from "next/link"

interface QuickActionsSectionProps {
  canScheduleChecklists: boolean
  canCreateChecklists: boolean
  onPrepareOffline?: () => void
  preparingOffline?: boolean
  isOnline?: boolean
}

export function QuickActionsSection({
  canScheduleChecklists,
  canCreateChecklists,
  onPrepareOffline,
  preparingOffline = false,
  isOnline = true,
}: QuickActionsSectionProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {canScheduleChecklists && (
        <Button
          asChild
          size="default"
          className="bg-checklist-cta hover:bg-checklist-cta/90 text-white transition-colors duration-200 min-h-[44px]"
        >
          <Link href="/checklists/programar">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Programar
          </Link>
        </Button>
      )}
      {canCreateChecklists && (
        <Button asChild size="default" className="min-h-[44px]">
          <Link href="/checklists/crear">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Plantilla
          </Link>
        </Button>
      )}
      {onPrepareOffline && (
        <Button
          variant="outline"
          size="default"
          onClick={onPrepareOffline}
          disabled={preparingOffline || isOnline === false}
          className="hidden lg:inline-flex min-h-[44px]"
        >
          {preparingOffline ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          {preparingOffline ? "Preparando..." : "Preparar Offline"}
        </Button>
      )}
    </div>
  )
}
