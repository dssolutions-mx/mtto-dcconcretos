"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { useEquipmentModels } from "@/hooks/useSupabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Factory, Loader2, Plus } from "lucide-react"
import Link from "next/link"
import { EquipmentModel } from "@/types"

interface PlantillasModelContextValue {
  selectedModel: EquipmentModel | null
  setSelectedModel: (model: EquipmentModel | null) => void
  handleModelChange: (model: EquipmentModel | null) => void
  models: EquipmentModel[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const PlantillasModelContext = createContext<PlantillasModelContextValue | null>(null)

export function usePlantillasSelectedModel() {
  const ctx = useContext(PlantillasModelContext)
  return ctx?.selectedModel ?? null
}

export function usePlantillasModelContext() {
  const ctx = useContext(PlantillasModelContext)
  if (!ctx) throw new Error("usePlantillasModelContext must be used within PlantillasLayoutShell")
  return ctx
}

interface PlantillasLayoutShellProps {
  children: React.ReactNode
  /** Optional model ID to pre-select (e.g. from template being viewed) */
  preSelectedModelId?: string
}

export function PlantillasLayoutShell({
  children,
  preSelectedModelId,
}: PlantillasLayoutShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const modelParam = searchParams?.get("model")
  const { models, loading, error, refetch } = useEquipmentModels()
  const [selectedModel, setSelectedModel] = useState<EquipmentModel | null>(null)

  const modelToSelect = preSelectedModelId || modelParam

  useEffect(() => {
    if (models.length > 0) {
      if (modelToSelect) {
        const found = models.find((m) => m.id === modelToSelect)
        if (found) {
          setSelectedModel(found)
          return
        }
      }
      if (!selectedModel) {
        setSelectedModel(models[0])
      }
    }
  }, [models, modelToSelect, selectedModel])

  const handleModelChange = (model: EquipmentModel | null) => {
    setSelectedModel(model)
    if (!model) return
    const sp = new URLSearchParams(searchParams?.toString() || "")
    sp.set("model", model.id)
    const path = pathname || "/checklists/plantillas"
    router.replace(`${path}?${sp.toString()}`)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <p>Cargando modelos y plantillas...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="bg-red-50 text-red-800 p-4 rounded-md dark:bg-red-950/30 dark:text-red-200">
            <p className="font-medium">Error al cargar modelos</p>
            <p className="text-sm">{error.message}</p>
            <Button onClick={() => refetch()} variant="outline" className="mt-4">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (models.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Factory className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No hay modelos de equipos</h3>
          <p className="text-sm text-muted-foreground text-center mt-1 mb-4">
            Primero necesitas crear modelos de equipos para poder gestionar sus plantillas de checklist.
          </p>
          <Button asChild>
            <Link href="/modelos/crear">
              <Plus className="mr-2 h-4 w-4" />
              Crear modelo de equipo
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <PlantillasModelContext.Provider
      value={{
        selectedModel,
        setSelectedModel,
        handleModelChange,
        models,
        loading,
        error,
        refetch,
      }}
    >
      {children}
    </PlantillasModelContext.Provider>
  )
}
