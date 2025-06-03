"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, AlertTriangle, Clock, CheckCircle, Zap } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface QuickAction {
  id: string
  title: string
  description?: string
  href: string
  icon: React.ReactNode
  variant?: "default" | "destructive" | "outline" | "secondary"
  badge?: {
    count: number
    variant?: "default" | "destructive" | "outline" | "secondary"
  }
  urgent?: boolean
}

interface QuickActionsProps {
  title?: string
  actions: QuickAction[]
  className?: string
  compact?: boolean
}

export function QuickActions({ 
  title = "Acciones Rápidas", 
  actions, 
  className,
  compact = false 
}: QuickActionsProps) {
  if (actions.length === 0) return null

  if (compact) {
    return (
      <div className={cn(
        "flex flex-wrap gap-2 relative",
        "z-page-content",
        className
      )}>
        {actions.map((action) => (
          <Button
            key={action.id}
            asChild
            variant={action.variant || "outline"}
            size="sm"
            className={cn(
              "relative",
              "z-page-content",
              action.urgent && "border-orange-300 bg-orange-50 hover:bg-orange-100"
            )}
          >
            <Link href={action.href}>
              {action.icon}
              <span className="ml-2">{action.title}</span>
              {action.badge && action.badge.count > 0 && (
                <Badge 
                  variant={action.badge.variant || "destructive"}
                  className="ml-2 h-5 px-1.5 text-xs"
                >
                  {action.badge.count}
                </Badge>
              )}
            </Link>
          </Button>
        ))}
      </div>
    )
  }

  return (
    <Card className={cn("relative z-page-content", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            asChild
            variant={action.variant || "outline"}
            className={cn(
              "w-full justify-start h-auto p-3 relative z-page-content",
              action.urgent && "border-orange-300 bg-orange-50 hover:bg-orange-100"
            )}
          >
            <Link href={action.href}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {action.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-medium flex items-center gap-2">
                      {action.title}
                      {action.urgent && (
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                      )}
                    </div>
                    {action.description && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {action.description}
                      </div>
                    )}
                  </div>
                </div>
                {action.badge && action.badge.count > 0 && (
                  <Badge 
                    variant={action.badge.variant || "destructive"}
                    className="flex-shrink-0"
                  >
                    {action.badge.count}
                  </Badge>
                )}
              </div>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}

// Pre-configured action types for common use cases
export const commonActions = {
  createAsset: (urgent = false): QuickAction => ({
    id: "create-asset",
    title: "Registrar Activo",
    description: "Agregar un nuevo activo al sistema",
    href: "/activos/crear",
    icon: <Plus className="h-4 w-4" />,
    variant: "default" as const,
    urgent
  }),
  
  createWorkOrder: (urgent = false): QuickAction => ({
    id: "create-work-order",
    title: "Nueva Orden de Trabajo",
    description: "Crear una nueva orden de trabajo",
    href: "/ordenes/crear",
    icon: <Plus className="h-4 w-4" />,
    variant: "default" as const,
    urgent
  }),
  
  pendingApprovals: (count: number): QuickAction => ({
    id: "pending-approvals",
    title: "Aprobar Órdenes",
    description: "Órdenes de compra pendientes de aprobación",
    href: "/compras?tab=pending",
    icon: <Clock className="h-4 w-4" />,
    variant: "outline" as const,
    badge: { count, variant: "destructive" as const },
    urgent: count > 0
  }),
  
  overdueChecklists: (count: number): QuickAction => ({
    id: "overdue-checklists",
    title: "Checklists Vencidos",
    description: "Checklists que debieron completarse",
    href: "/checklists?filter=overdue",
    icon: <AlertTriangle className="h-4 w-4" />,
    variant: "destructive" as const,
    badge: { count, variant: "destructive" as const },
    urgent: count > 0
  }),
  
  upcomingMaintenance: (count: number): QuickAction => ({
    id: "upcoming-maintenance",
    title: "Mantenimiento Próximo",
    description: "Mantenimientos programados próximos",
    href: "/calendario",
    icon: <Clock className="h-4 w-4" />,
    variant: "outline" as const,
    badge: { count, variant: "default" as const },
    urgent: count > 5
  }),
  
  completedWorkOrders: (count: number): QuickAction => ({
    id: "completed-work-orders",
    title: "Órdenes Completadas",
    description: "Órdenes de trabajo completadas hoy",
    href: "/ordenes?status=completed",
    icon: <CheckCircle className="h-4 w-4" />,
    variant: "outline" as const,
    badge: { count, variant: "secondary" as const }
  })
} 