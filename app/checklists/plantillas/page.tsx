"use client"

import { usePlantillasModelContext } from "@/components/checklists/plantillas-layout-shell"
import { PlantillasModelSelector } from "@/components/checklists/plantillas-model-selector"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Factory } from "lucide-react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { TemplatesTab } from "@/components/checklists/tabs/templates-tab"

export default function PlantillasPage() {
  const { selectedModel, handleModelChange, models, loading } = usePlantillasModelContext()

  if (!selectedModel) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Factory className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">Selecciona un modelo</h3>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Elige un modelo del selector para gestionar sus plantillas de checklist.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-8 min-h-0">
      {/* Compact header: model selector + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <PlantillasModelSelector
          value={selectedModel}
          onChange={handleModelChange}
          models={models}
          loading={loading}
          placeholder="Modelo de equipo"
        />
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/modelos/${selectedModel.id}`}>Ver detalles del modelo</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/checklists/plantillas/crear?model=${selectedModel.id}`}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva plantilla
            </Link>
          </Button>
        </div>
      </div>

      {/* Templates content */}
      <Card className="flex-1 min-h-0">
        <CardContent className="p-6 md:p-8">
          <TemplatesTab model={selectedModel} />
        </CardContent>
      </Card>
    </div>
  )
}
