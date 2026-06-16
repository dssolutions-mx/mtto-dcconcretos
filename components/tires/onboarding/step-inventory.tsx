'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Package, Upload } from 'lucide-react'

interface StepInventoryProps {
  saving?: boolean
  onBack: () => void
  onComplete: (method: 'csv' | 'po' | 'manual' | 'skip') => Promise<void>
}

export function StepInventory({ saving, onBack, onComplete }: StepInventoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventario inicial</CardTitle>
        <CardDescription>
          Elija cómo cargar las primeras llantas en almacén. Puede combinar métodos en fases
          posteriores.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-6"
            asChild
          >
            <Link href="/activos/llantas/importar">
              <Upload className="h-6 w-6" />
              <span>Importar CSV</span>
              <span className="text-xs font-normal text-muted-foreground">
                Lote con validación
              </span>
            </Link>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-6"
            asChild
          >
            <Link href="/compras">
              <Package className="h-6 w-6" />
              <span>Recepcionar OC</span>
              <span className="text-xs font-normal text-muted-foreground">
                Desde compras
              </span>
            </Link>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-6"
            asChild
          >
            <Link href="/activos/llantas">
              <Package className="h-6 w-6" />
              <span>Registro manual</span>
              <span className="text-xs font-normal text-muted-foreground">
                Una por una
              </span>
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Anterior
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => onComplete('skip')}
            >
              Omitir por ahora
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => onComplete('csv')}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Marcar como iniciado
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
