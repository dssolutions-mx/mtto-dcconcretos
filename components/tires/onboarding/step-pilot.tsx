'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CircleDot } from 'lucide-react'
import type { TireOnboardingScopePayload } from '@/types/tires'

interface PilotAsset {
  id: string
  name: string | null
  asset_id?: string | null
}

interface StepPilotProps {
  assets: PilotAsset[]
  scopePayload?: TireOnboardingScopePayload
  saving?: boolean
  onBack: () => void
  onComplete: () => Promise<void>
}

export function StepPilot({ assets, scopePayload, saving, onBack, onComplete }: StepPilotProps) {
  const pilotIds = scopePayload?.pilot_asset_ids ?? []
  const pilotAssets = assets.filter((a) => pilotIds.includes(a.id))
  const primaryPilot = pilotAssets[0]

  const displayName = (a: PilotAsset) =>
    a.name || a.asset_id || `Activo ${a.id.slice(0, 8)}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleDot className="h-5 w-5" />
          Piloto de montaje
        </CardTitle>
        <CardDescription>
          Valide el diagrama interactivo montando al menos una llanta en un activo piloto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {primaryPilot ? (
          <>
            <p className="text-sm text-muted-foreground">
              Activo piloto: <span className="font-medium text-foreground">{displayName(primaryPilot)}</span>
            </p>
            <Button asChild>
              <Link href={`/activos/${primaryPilot.id}/llantas`}>
                Abrir diagrama del activo
              </Link>
            </Button>
            {pilotAssets.length > 1 && (
              <ul className="text-sm text-muted-foreground space-y-1">
                {pilotAssets.slice(1).map((a) => (
                  <li key={a.id}>
                    <Link href={`/activos/${a.id}/llantas`} className="underline">
                      {displayName(a)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay activos piloto definidos. Vuelva al paso de alcance o elija un activo desde{' '}
            <Link href="/activos" className="underline">
              la lista de activos
            </Link>
            .
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={onBack} disabled={saving}>
            Anterior
          </Button>
          <Button onClick={() => onComplete()} disabled={saving}>
            Finalizar configuración inicial
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
