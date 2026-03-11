"use client"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const STAGE_HELP = `Flujo de aprobación en 3 etapas:
• Validación técnica: Gerente de Mantenimiento revisa y aprueba
• Viabilidad administrativa: Área Administrativa registra viabilidad
• Aprobación final: Gerencia General aprueba (montos altos)`

interface WorkflowStageBadgeProps {
  workflowStage: string
  reason?: string
  responsibleRole?: string
  canAct?: boolean
  className?: string
  showHelp?: boolean
}

export function WorkflowStageBadge({
  workflowStage,
  reason,
  responsibleRole,
  canAct,
  className,
  showHelp = true,
}: WorkflowStageBadgeProps) {
  const stageConfig: Record<string, { bg: string; border: string; text: string }> = {
    "Validación técnica": {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
    },
    "Viabilidad administrativa": {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
    },
    "Aprobación final": {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
    },
  }
  const config = stageConfig[workflowStage] ?? {
    bg: "bg-slate-100",
    border: "border-slate-200",
    text: "text-slate-600",
  }

  const tooltipContent = canAct
    ? reason ?? "Listo para tu aprobación"
    : responsibleRole
      ? `En espera de: ${responsibleRole}`
      : reason ?? "Verificando..."

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 font-medium",
                config.bg,
                config.border,
                config.text
              )}
            >
              {workflowStage || "Verificando..."}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
        {showHelp && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help shrink-0" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">{STAGE_HELP}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
