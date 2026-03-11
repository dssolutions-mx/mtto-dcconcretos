"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, ClipboardList } from "lucide-react"
import Link from "next/link"

interface CompletedChecklistHeaderProps {
  assetId: string
  onBack: () => void
}

export function CompletedChecklistHeader({ assetId, onBack }: CompletedChecklistHeaderProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onBack}
        className="cursor-pointer transition-colors duration-200"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>
      <Button variant="outline" size="sm" asChild className="cursor-pointer">
        <Link href={`/checklists/assets/${assetId}`} className="transition-colors duration-200">
          <ClipboardList className="mr-2 h-4 w-4" />
          Ver Checklist del Activo
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild className="cursor-pointer">
        <Link href={`/activos/${assetId}`} className="transition-colors duration-200">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Ver Activo
        </Link>
      </Button>
    </div>
  )
}
