'use client'

import { useSavedViews } from '@/hooks/useSavedViews'
import type { FleetOrganizeLens, SavedViewConfig } from '@/types/fleet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Bookmark } from 'lucide-react'
import { toast } from 'sonner'

const DEFAULTS: { name: string; config: SavedViewConfig }[] = [
  { name: 'Operaciones (BU→Planta→Modelo)', config: { lens: 'bu-plant-model', density: 'normal' } },
  { name: 'Por fabricante', config: { lens: 'fabricante-modelo-planta', density: 'normal' } },
  { name: 'Por año', config: { lens: 'ano-modelo-planta', density: 'normal' } },
]

export function SavedViewsMenu({
  currentLens,
  onApplyConfig,
}: {
  currentLens: FleetOrganizeLens
  onApplyConfig: (c: SavedViewConfig) => void
}) {
  const { views, saveView } = useSavedViews()

  async function saveCurrent() {
    try {
      await saveView(`Vista ${new Date().toLocaleDateString('es')}`, {
        lens: currentLens,
        density: 'normal',
      })
      toast.success('Vista guardada')
    } catch {
      toast.error('No se pudo guardar')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <Bookmark className="mr-2 h-4 w-4" />
          Vistas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Predefinidas</DropdownMenuLabel>
        {DEFAULTS.map((d) => (
          <DropdownMenuItem key={d.name} onClick={() => onApplyConfig(d.config)}>
            {d.name}
          </DropdownMenuItem>
        ))}
        {views.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Guardadas</DropdownMenuLabel>
            {views.map((v) => (
              <DropdownMenuItem
                key={v.id}
                onClick={() => onApplyConfig(v.config as SavedViewConfig)}
              >
                {v.name}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={saveCurrent}>Guardar vista actual…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
