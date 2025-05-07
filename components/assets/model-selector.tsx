"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { modelsApi } from "@/lib/api"
import { EquipmentModel, EquipmentModelWithIntervals } from "@/types"

interface ModelSelectorProps {
  onModelSelect: (model: EquipmentModelWithIntervals | null) => void
}

export function ModelSelector({ onModelSelect }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [models, setModels] = useState<EquipmentModelWithIntervals[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Cargar los modelos al montar el componente
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true)
        const data = await modelsApi.getAll()
        
        // Convertir los modelos para incluir maintenanceIntervals
        const modelsWithIntervals: EquipmentModelWithIntervals[] = data.map((model: EquipmentModel) => ({
          ...model,
          maintenanceIntervals: [] // Por defecto, inicializamos con un array vacío
        }))
        
        setModels(modelsWithIntervals)
      } catch (err) {
        console.error("Error al cargar los modelos:", err)
        setError(err instanceof Error ? err : new Error("Error al cargar los modelos"))
      } finally {
        setLoading(false)
      }
    }

    fetchModels()
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : value ? (
            models.find((model) => model.id === value)?.name
          ) : (
            "Seleccionar modelo..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Buscar modelo..." />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-red-500">
                Error al cargar los modelos. Intente nuevamente.
              </div>
            ) : (
              <>
                <CommandEmpty>No se encontraron modelos.</CommandEmpty>
                <CommandGroup>
                  {models.map((model) => (
                    <CommandItem
                      key={model.id}
                      value={model.id}
                      onSelect={(currentValue) => {
                        const selectedModel = models.find((model) => model.id === currentValue) || null
                        setValue(currentValue === value ? "" : currentValue)
                        onModelSelect(selectedModel)
                        setOpen(false)
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === model.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.manufacturer} - {model.category}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
