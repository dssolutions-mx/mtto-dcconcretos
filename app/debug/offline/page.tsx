"use client"

import { OfflineDebugConsole } from "@/components/checklists/offline-debug-console"

export default function OfflineDebugPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Debug Offline</h1>
        <p className="text-muted-foreground mt-2">
          Herramientas de debugging para el sistema offline de checklists y órdenes de trabajo.
        </p>
      </div>
      
      <OfflineDebugConsole />
    </div>
  )
} 