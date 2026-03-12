"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useAuthZustand } from "@/hooks/use-auth-zustand"

/**
 * Renders "Nueva OT" only when the current user has create access to work_orders.
 * Used in the /ordenes page header.
 */
export function WorkOrderCreateButton() {
  const { profile, hasCreateAccess } = useAuthZustand()
  const role = profile?.business_role ?? profile?.role ?? null
  const canCreate = role ? hasCreateAccess("work_orders") : false

  if (!canCreate) {
    return null
  }

  return (
    <Button asChild>
      <Link href="/ordenes/crear">
        <Plus className="mr-2 h-4 w-4" />
        Nueva OT
      </Link>
    </Button>
  )
}
