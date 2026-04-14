'use client'

import { BarChart3, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

type Props = {
  volumeStaleCount: number
  onOpenVolumeSheet: () => void
}

export function IngresosGastosActions({ volumeStaleCount, onOpenVolumeSheet }: Props) {
  const router = useRouter()

  return (
    <div className="flex flex-wrap gap-2">
      {volumeStaleCount > 0 && (
        <Button variant="default" onClick={onOpenVolumeSheet}>
          Sincronizar volúmenes ({volumeStaleCount})
        </Button>
      )}
      <Button variant="outline" onClick={() => router.push('/reportes/gerencial/analisis-costos')}>
        <BarChart3 className="mr-2 h-4 w-4" />
        Análisis de Costos
      </Button>
      <Button variant="outline" onClick={() => router.push('/reportes/gerencial/manual-costs')}>
        <Settings className="mr-2 h-4 w-4" />
        Gestionar Costos Manuales
      </Button>
    </div>
  )
}
