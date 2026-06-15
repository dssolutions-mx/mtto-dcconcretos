"use client"

import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FileDown, Loader2, MapPin, X } from "lucide-react"

const DISMISS_KEY = "offline_prepare_banner_dismissed"

interface OfflinePrepareBannerProps {
  onPrepare: () => void
  preparing?: boolean
  cachedCount?: number
}

export function OfflinePrepareBanner({
  onPrepare,
  preparing = false,
  cachedCount = 0,
}: OfflinePrepareBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(DISMISS_KEY) === "true"
  })

  if (dismissed) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true")
    setDismissed(true)
  }

  return (
    <Alert className="relative mb-4 border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/30">
      <MapPin className="h-4 w-4 text-blue-700 dark:text-blue-300" />
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 pr-6">
          <AlertTitle className="text-blue-900 dark:text-blue-100">
            ¿Vas a trabajar sin señal?
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            Antes de salir a campo, descarga tus checklists pendientes. Así podrás abrirlos y
            completarlos aunque pierdas conexión o recargues la página.
            {cachedCount > 0 && (
              <span className="mt-1 block text-xs opacity-90">
                {cachedCount} checklist{cachedCount !== 1 ? "s" : ""} ya descargado
                {cachedCount !== 1 ? "s" : ""}.
              </span>
            )}
          </AlertDescription>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="default"
            className="min-h-[44px] bg-blue-700 hover:bg-blue-800"
            onClick={onPrepare}
            disabled={preparing}
          >
            {preparing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            {preparing ? "Descargando…" : "Preparar offline"}
          </Button>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 text-blue-700 hover:text-blue-900"
        onClick={dismiss}
        aria-label="Cerrar aviso"
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  )
}
