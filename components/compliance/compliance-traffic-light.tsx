'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComplianceTrafficLightProps {
  status: 'ok' | 'warning' | 'critical' | 'emergency'
  label?: string
  count?: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ComplianceTrafficLight({
  status,
  label,
  count,
  showLabel = true,
  size = 'md',
  className
}: ComplianceTrafficLightProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  }

  const statusConfig = {
    ok: {
      color: 'bg-green-500',
      borderColor: 'border-green-600',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      label: 'Cumplimiento OK',
      badgeVariant: 'default' as const,
      badgeClass: 'bg-green-100 text-green-800 border-green-300'
    },
    warning: {
      color: 'bg-yellow-500',
      borderColor: 'border-yellow-600',
      icon: Clock,
      iconColor: 'text-yellow-600',
      label: 'Advertencia',
      badgeVariant: 'outline' as const,
      badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    },
    critical: {
      color: 'bg-orange-500',
      borderColor: 'border-orange-600',
      icon: AlertTriangle,
      iconColor: 'text-orange-600',
      label: 'Crítico',
      badgeVariant: 'outline' as const,
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-300'
    },
    emergency: {
      color: 'bg-red-500',
      borderColor: 'border-red-600',
      icon: AlertCircle,
      iconColor: 'text-red-600',
      label: 'Emergencia',
      badgeVariant: 'destructive' as const,
      badgeClass: 'bg-red-100 text-red-800 border-red-300'
    }
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <div
          className={cn(
            sizeClasses[size],
            config.color,
            config.borderColor,
            'rounded-full border-2 shadow-sm flex items-center justify-center',
            status === 'emergency' && 'animate-pulse'
          )}
        >
          {status !== 'ok' && (
            <Icon
              className={cn(
                size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5',
                'text-white drop-shadow-sm'
              )}
            />
          )}
        </div>
      </div>
      {showLabel && (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-medium truncate">{label || config.label}</span>
          {count !== undefined && count > 0 && (
            <Badge variant={config.badgeVariant} className={cn(config.badgeClass, 'flex-shrink-0')}>
              {count}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

interface ComplianceTrafficLightWidgetProps {
  okCount: number
  warningCount: number
  criticalCount: number
  emergencyCount: number
  totalCount?: number
  className?: string
}

export function ComplianceTrafficLightWidget({
  okCount,
  warningCount,
  criticalCount,
  emergencyCount,
  totalCount,
  className
}: ComplianceTrafficLightWidgetProps) {
  const total = totalCount || okCount + warningCount + criticalCount + emergencyCount
  const complianceRate = total > 0 ? ((okCount / total) * 100).toFixed(1) : '100.0'

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Estado de Cumplimiento</CardTitle>
        <CardDescription>
          Vista general del estado de cumplimiento de activos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <ComplianceTrafficLight
              status="ok"
              count={okCount}
              size="md"
            />
            <p className="text-xs text-muted-foreground pl-7">
              Activos en cumplimiento
            </p>
          </div>
          <div className="space-y-2">
            <ComplianceTrafficLight
              status="warning"
              count={warningCount}
              size="md"
            />
            <p className="text-xs text-muted-foreground pl-7">
              Requieren atención
            </p>
          </div>
          <div className="space-y-2">
            <ComplianceTrafficLight
              status="critical"
              count={criticalCount}
              size="md"
            />
            <p className="text-xs text-muted-foreground pl-7">
              Críticos
            </p>
          </div>
          <div className="space-y-2">
            <ComplianceTrafficLight
              status="emergency"
              count={emergencyCount}
              size="md"
            />
            <p className="text-xs text-muted-foreground pl-7">
              Emergencia
            </p>
          </div>
        </div>
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Tasa de Cumplimiento</span>
            <Badge
              variant={parseFloat(complianceRate) >= 95 ? 'default' : 'destructive'}
              className={
                parseFloat(complianceRate) >= 95
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }
            >
              {complianceRate}%
            </Badge>
          </div>
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${complianceRate}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
