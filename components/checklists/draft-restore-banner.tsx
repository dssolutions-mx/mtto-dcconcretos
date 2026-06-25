"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Save } from "lucide-react"
import {
  formatDraftSavedAt,
  type DraftRestoreSource,
} from "@/lib/checklist/schedule-draft-display"

type DraftRestoreBannerProps = {
  savedAt: Date
  savedByName: string | null
  source: DraftRestoreSource
  onContinue: () => void
  onDiscard: () => void
  discarding?: boolean
}

function sourceHint(source: DraftRestoreSource): string {
  switch (source) {
    case 'server':
      return 'Hay un borrador guardado en el servidor.'
    case 'local':
      return 'Hay un borrador guardado en este dispositivo.'
    case 'both':
      return 'Hay borradores en el servidor y en este dispositivo.'
  }
}

export function DraftRestoreBanner({
  savedAt,
  savedByName,
  source,
  onContinue,
  onDiscard,
  discarding = false,
}: DraftRestoreBannerProps) {
  const when = formatDraftSavedAt(savedAt)
  const by = savedByName ? ` por ${savedByName}` : ''

  return (
    <Alert className="border-sky-200 bg-sky-50/80 dark:border-sky-900/50 dark:bg-sky-950/30">
      <Save className="h-4 w-4 text-sky-700 dark:text-sky-300" />
      <AlertTitle className="text-sky-900 dark:text-sky-100">
        Borrador guardado{when ? ` el ${when}` : ''}{by}
      </AlertTitle>
      <AlertDescription className="space-y-3 text-sky-800/90 dark:text-sky-200/90">
        <p>{sourceHint(source)} Puede continuar donde lo dejó o empezar de cero.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onContinue} disabled={discarding}>
            Continuar borrador
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDiscard}
            disabled={discarding}
            className="border-sky-300/70 bg-background/80"
          >
            Descartar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
