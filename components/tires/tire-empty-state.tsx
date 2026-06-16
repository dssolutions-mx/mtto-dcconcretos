'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CircleDot, Package, Settings, type LucideIcon } from 'lucide-react'
import type { TireUiRole } from '@/lib/tires/fleet-status'
import { cn } from '@/lib/utils'

export type TireEmptyStateVariant =
  | 'global'
  | 'asset-no-layout'
  | 'asset-no-stock'
  | 'asset-ready-to-mount'
  | 'asset-partial'
  | 'checklist-no-tires'

interface TireEmptyStateProps {
  variant: TireEmptyStateVariant
  role?: TireUiRole
  assetName?: string
  modelName?: string
  mountedCount?: number
  totalPositions?: number
  warehouseCount?: number
  onPrimaryAction?: () => void
  onSecondaryAction?: () => void
  primaryHref?: string
  secondaryHref?: string
  className?: string
}

type CopyConfig = {
  icon: LucideIcon
  title: string
  description: string
  primaryLabel: string
  secondaryLabel?: string
}

function getCopy(props: TireEmptyStateProps): CopyConfig {
  const {
    variant,
    role = 'supervisor',
    assetName,
    modelName,
    mountedCount = 0,
    totalPositions = 0,
    warehouseCount = 0,
  } = props

  if (variant === 'global') {
    if (role === 'mechanic') {
      return {
        icon: CircleDot,
        title: 'Aún no hay llantas configuradas',
        description:
          'Pida a su supervisor iniciar la configuración de llantas antes de registrar montajes o lecturas.',
        primaryLabel: 'Ir a activos',
        secondaryLabel: undefined,
      }
    }
    if (role === 'warehouse') {
      return {
        icon: Package,
        title: 'Comience la configuración de llantas',
        description:
          'Antes de registrar llantas, defina cómo se organizan en su flota. También puede recepcionar inventario si ya tiene stock.',
        primaryLabel: 'Iniciar asistente de configuración',
        secondaryLabel: 'Recepcionar desde OC',
      }
    }
    return {
      icon: Settings,
      title: 'Comience la configuración de llantas',
      description:
        'Antes de registrar llantas, defina cómo se organizan en su flota. Esto evita errores al montar y habilita el diagrama interactivo por activo.',
      primaryLabel: 'Iniciar asistente de configuración',
      secondaryLabel: 'Ver guía rápida',
    }
  }

  if (variant === 'asset-no-layout') {
    return {
      icon: Settings,
      title: 'Configure el layout de llantas',
      description: modelName
        ? `Asigne cuántas posiciones tiene ${assetName ?? 'este equipo'} (${modelName}) y cómo se nombran.`
        : 'Asigne cuántas posiciones tiene este equipo y cómo se nombran.',
      primaryLabel: 'Usar layout del modelo',
      secondaryLabel: 'Configurar flota',
    }
  }

  if (variant === 'asset-no-stock') {
    return {
      icon: Package,
      title: 'Sin llantas disponibles',
      description:
        'No hay llantas en almacén para este activo. Registre inventario o recepcione una OC.',
      primaryLabel: 'Ir a inventario',
      secondaryLabel: 'Registrar llanta',
    }
  }

  if (variant === 'asset-ready-to-mount') {
    return {
      icon: CircleDot,
      title: 'Listo para montar',
      description: `El layout está configurado. Hay ${warehouseCount} llanta${warehouseCount === 1 ? '' : 's'} en almacén. Seleccione una posición o use montaje asistido.`,
      primaryLabel: 'Montar llanta',
      secondaryLabel: undefined,
    }
  }

  if (variant === 'asset-partial') {
    return {
      icon: CircleDot,
      title: 'Montaje parcial',
      description: `${mountedCount} de ${totalPositions} posiciones ocupadas. Complete el montaje para habilitar lecturas en checklist.`,
      primaryLabel: 'Montar llanta',
      secondaryLabel: 'Ver posiciones vacías',
    }
  }

  return {
    icon: CircleDot,
    title: 'Este activo no tiene llantas montadas',
    description: 'Configure las llantas del activo para habilitar lecturas en checklist.',
    primaryLabel: 'Ir a configurar llantas',
    secondaryLabel: undefined,
  }
}

function ActionButton({
  label,
  href,
  onClick,
  variant = 'default',
}: {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'default' | 'outline'
}) {
  if (href) {
    return (
      <Button variant={variant} asChild>
        <Link href={href}>{label}</Link>
      </Button>
    )
  }
  return (
    <Button variant={variant} onClick={onClick}>
      {label}
    </Button>
  )
}

export function TireEmptyState(props: TireEmptyStateProps) {
  const copy = getCopy(props)
  const Icon = copy.icon

  const primaryHref =
    props.primaryHref ??
    (props.variant === 'global' && props.role === 'mechanic'
      ? '/activos'
      : props.variant === 'global'
        ? '/activos/llantas/configuracion'
        : props.variant === 'asset-no-stock'
          ? '/activos/llantas'
          : undefined)

  const secondaryHref =
    props.secondaryHref ??
    (props.variant === 'global' && props.role === 'warehouse'
      ? '/compras'
      : props.variant === 'global'
        ? undefined
        : props.variant === 'asset-no-layout'
          ? '/activos/llantas/configuracion'
          : undefined)

  return (
    <Card className={cn('border-dashed', props.className)}>
      <CardContent className="flex flex-col items-center gap-4 py-10 px-6 text-center sm:py-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="max-w-lg space-y-2">
          <h3 className="text-lg font-semibold">{copy.title}</h3>
          <p className="text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <ActionButton
            label={copy.primaryLabel}
            href={primaryHref}
            onClick={props.onPrimaryAction}
          />
          {copy.secondaryLabel && (
            <ActionButton
              label={copy.secondaryLabel}
              href={secondaryHref}
              onClick={props.onSecondaryAction}
              variant="outline"
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
