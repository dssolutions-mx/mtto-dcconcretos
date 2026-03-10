"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileText, Copy, Loader2 } from "lucide-react"
import { useChecklistTemplates } from "@/hooks/useChecklists"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface CreationEntryStepProps {
  preSelectedModelId?: string
  onFromScratch: () => void
}

export function CreationEntryStep({
  preSelectedModelId,
  onFromScratch,
}: CreationEntryStepProps) {
  const router = useRouter()
  const { templates, loading, fetchTemplates } = useChecklistTemplates()
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [duplicateName, setDuplicateName] = useState("")
  const [duplicateLoading, setDuplicateLoading] = useState(false)
  const [models, setModels] = useState<Array<{ id: string; name: string; manufacturer?: string }>>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState(preSelectedModelId || "")

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  useEffect(() => {
    const loadModels = async () => {
      setModelsLoading(true)
      try {
        const res = await fetch("/api/models")
        if (res.ok) {
          const data = await res.json()
          setModels(Array.isArray(data) ? data : [])
          if (preSelectedModelId && !selectedModelId) {
            setSelectedModelId(preSelectedModelId)
          }
        }
      } catch (err) {
        console.error("Error loading models:", err)
      } finally {
        setModelsLoading(false)
      }
    }
    loadModels()
  }, [preSelectedModelId])

  useEffect(() => {
    if (preSelectedModelId) {
      setSelectedModelId(preSelectedModelId)
    }
  }, [preSelectedModelId])

  const filteredTemplates = preSelectedModelId
    ? templates.filter((t) => t.model_id === preSelectedModelId)
    : templates

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  useEffect(() => {
    if (selectedTemplate) {
      setDuplicateName(`${selectedTemplate.name} (Copia)`)
    } else {
      setDuplicateName("")
    }
  }, [selectedTemplate])

  const handleFromTemplate = async () => {
    if (!selectedTemplateId || !duplicateName.trim()) {
      toast.error("Selecciona una plantilla y un nombre para la copia")
      return
    }
    if (!selectedModelId) {
      toast.error("Selecciona un modelo de equipo")
      return
    }
    const template = templates.find((t) => t.id === selectedTemplateId)
    if (!template) return
    const frequency = template.frequency || "mensual"

    setDuplicateLoading(true)
    try {
      const res = await fetch(`/api/checklists/templates/${selectedTemplateId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: duplicateName.trim(),
          description: template.description || "",
          frequency,
          model_id: selectedModelId,
          interval_id: template.interval_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Error al duplicar la plantilla")
      }
      const newId = data.template_id
      toast.success("Plantilla duplicada")
      router.push(`/checklists/${newId}/editar`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al duplicar")
    } finally {
      setDuplicateLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Elige cómo quieres empezar
      </p>
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30">
          <CardHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Empezar con plantilla vacía</CardTitle>
            <CardDescription>
              Crear desde cero. Ideal cuando diseñas un checklist nuevo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onFromScratch} className="w-full">
              Empezar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <Copy className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Copiar y modificar plantilla existente</CardTitle>
            <CardDescription>
              Usar una plantilla como base y adaptarla a tus necesidades.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Plantilla a copiar</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loading ? "Cargando..." : "Selecciona una plantilla"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredTemplates.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      No hay plantillas
                      {preSelectedModelId ? " para este modelo" : ""}
                    </div>
                  ) : (
                    filteredTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.equipment_models
                          ? ` (${t.equipment_models.manufacturer} ${t.equipment_models.name})`
                          : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedTemplateId && (
              <>
                <div className="space-y-2">
                  <Label>Nombre de la nueva plantilla</Label>
                  <Input
                    value={duplicateName}
                    onChange={(e) => setDuplicateName(e.target.value)}
                    placeholder="Nombre de la plantilla"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modelo de equipo</Label>
                  <Select
                    value={selectedModelId}
                    onValueChange={setSelectedModelId}
                    disabled={modelsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          modelsLoading
                            ? "Cargando..."
                            : "Seleccionar modelo"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.manufacturer})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <Button
              onClick={handleFromTemplate}
              disabled={
                !selectedTemplateId ||
                !duplicateName.trim() ||
                !selectedModelId ||
                duplicateLoading
              }
              className="w-full"
              variant="secondary"
            >
              {duplicateLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Duplicando...
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Usar esta plantilla
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
