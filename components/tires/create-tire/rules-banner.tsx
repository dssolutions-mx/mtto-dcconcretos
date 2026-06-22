'use client'

import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { describeFleetIdRules } from '@/lib/tires/create-tire-form'
import type { TireIdRules } from '@/types/tires'

interface CreateTireRulesBannerProps {
  idRules: TireIdRules
  previewCode: string | null
}

export function CreateTireRulesBanner({ idRules, previewCode }: CreateTireRulesBannerProps) {
  const lines = describeFleetIdRules(idRules, previewCode)
  const showSettingsHint =
    !idRules.auto_generate && !idRules.dot_required && !idRules.internal_prefix?.trim()

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-2 text-sm">
      <p className="font-medium text-foreground">Reglas de su flota</p>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {lines.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
      {showSettingsHint && (
        <p className="text-xs text-muted-foreground">
          <Link
            href="/activos/llantas/ajustes"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <Settings2 className="h-3 w-3" />
            Configurar reglas de identificación
          </Link>
        </p>
      )}
    </div>
  )
}
