"use client"

import { Card, CardContent } from "@/components/ui/card"
import { WifiOff } from "lucide-react"

export function AssetDetailOfflineBanner() {
  return (
    <Card className="mb-6 border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20 shadow-checklist-1">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <WifiOff className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-orange-800 dark:text-orange-200">
              Modo Offline Activo
            </p>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Algunos checklists pueden no estar disponibles para ejecución sin
              conexión.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
