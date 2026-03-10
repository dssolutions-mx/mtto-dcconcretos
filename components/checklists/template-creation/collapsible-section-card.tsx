"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

const SECTION_TYPE_LABELS: Record<string, string> = {
  checklist: "Checklist",
  evidence: "Evidencia",
  cleanliness_bonus: "Limpieza",
  security_talk: "Seguridad",
}

interface CollapsibleSectionCardProps {
  section: {
    title: string
    section_type?: string
    items: unknown[]
  }
  sectionIndex: number
  totalSections: number
  expanded: boolean
  onToggle: (open: boolean) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  children: React.ReactNode
}

export function CollapsibleSectionCard({
  section,
  sectionIndex,
  totalSections,
  expanded,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
  children,
}: CollapsibleSectionCardProps) {
  const sectionType = section.section_type || "checklist"
  const itemCount = section.items?.length ?? 0
  const typeLabel = SECTION_TYPE_LABELS[sectionType] ?? "Checklist"

  const cardBorderClass =
    sectionType === "evidence"
      ? "border-blue-200 bg-blue-50/50"
      : sectionType === "cleanliness_bonus"
        ? "border-green-200 bg-green-50/50"
        : sectionType === "security_talk"
          ? "border-orange-200 bg-orange-50/50"
          : ""

  return (
    <Card className={cn(cardBorderClass)}>
      <Collapsible open={expanded} onOpenChange={(open) => onToggle(open)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex flex-1 items-center gap-3 text-left outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                aria-expanded={expanded}
                aria-label={expanded ? "Contraer sección" : "Expandir sección"}
              >
                <span
                  className={cn(
                    "transition-transform",
                    expanded && "rotate-180"
                  )}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="font-semibold truncate">
                  {section.title || `Sección ${sectionIndex + 1}`}
                </span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {itemCount} {itemCount === 1 ? "ítem" : "ítems"}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs shrink-0 bg-muted/50"
                >
                  {typeLabel}
                </Badge>
              </button>
            </CollapsibleTrigger>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveUp()
                }}
                disabled={sectionIndex === 0}
                aria-label="Mover sección arriba"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveDown()
                }}
                disabled={sectionIndex >= totalSections - 1}
                aria-label="Mover sección abajo"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                aria-label="Eliminar sección"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
