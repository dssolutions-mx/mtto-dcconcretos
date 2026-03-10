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
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Acciones rápidas">
      {canScheduleChecklists && (
        <Button
          asChild
          size="default"
          className="bg-checklist-cta hover:bg-checklist-cta/90 text-white transition-colors duration-200 min-h-[44px] px-5 cursor-pointer"
        >
          <Link href="/checklists/programar">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Programar checklists
          </Link>
        </Button>
      )}
      {canCreateChecklists && (
        <Button
          asChild
          variant="outline"
          size="default"
          className="min-h-[44px] px-5 cursor-pointer"
        >
          <Link href="/checklists/crear">
            <Plus className="mr-2 h-4 w-4" />
            Nueva plantilla
          </Link>
        </Button>
      )}
      {onPrepareOffline && (
        <Button
          variant="outline"
          size="default"
          onClick={onPrepareOffline}
          disabled={preparingOffline || isOnline === false}
          className="hidden lg:inline-flex min-h-[44px] cursor-pointer"
        >
          {preparingOffline ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          {preparingOffline ? "Preparando..." : "Preparar offline"}
        </Button>
      )}
    </div>
  )
}
