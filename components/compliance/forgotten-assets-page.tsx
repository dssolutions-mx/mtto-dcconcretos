'use client'

import { ForgottenAssetsView } from './forgotten-assets-view'

export function ForgottenAssetsPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div id="forgotten-assets-header">
        <h1 className="text-3xl font-bold">Activos Olvidados</h1>
        <p className="text-muted-foreground mt-1">
          Activos sin checklists recientes o sin operador asignado
        </p>
      </div>
      <ForgottenAssetsView />
    </div>
  )
}
