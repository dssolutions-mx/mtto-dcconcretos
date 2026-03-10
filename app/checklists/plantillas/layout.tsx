"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { PlantillasLayoutShell } from "@/components/checklists/plantillas-layout-shell"

function PlantillasLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const modelParam = searchParams?.get("model") ?? undefined

  return (
    <PlantillasLayoutShell preSelectedModelId={modelParam}>
      {children}
    </PlantillasLayoutShell>
  )
}

export default function PlantillasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      }
    >
      <PlantillasLayoutContent>{children}</PlantillasLayoutContent>
    </Suspense>
  )
}
