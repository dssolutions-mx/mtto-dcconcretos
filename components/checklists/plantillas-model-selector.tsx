"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import Link from "next/link"
import { EquipmentModel } from "@/types"

interface PlantillasModelSelectorProps {
  value: EquipmentModel | null
  onChange: (model: EquipmentModel | null) => void
  models: EquipmentModel[]
  loading?: boolean
  placeholder?: string
  className?: string
}

export function PlantillasModelSelector({
  value,
  onChange,
  models,
  loading = false,
  placeholder = "Modelo de equipo",
  className,
}: PlantillasModelSelectorProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("min-w-[200px] justify-between", className)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          ) : value ? (
            <span className="truncate">{value.name}</span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar modelo..." />
          <CommandList>
            <CommandEmpty>No se encontraron modelos.</CommandEmpty>
            <CommandGroup>
              {models.map((model) => (
                <CommandItem
                  key={model.id}
                  value={`${model.name} ${model.manufacturer} ${model.category}`}
                  onSelect={() => {
                    onChange(model)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value?.id === model.id ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex flex-col">
                    <span>{model.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {model.manufacturer} · {model.category}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
            <Link href="/checklists">
              ← Volver a checklists
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
