"use client"

import { useState, type ReactNode } from "react"
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
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type ComboboxOption = {
  value: string
  label: string
  keywords?: string
  description?: string
  badge?: ReactNode
  disabled?: boolean
  group?: string
}

type SearchableComboboxProps = {
  value: string
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  loading?: boolean
  disabled?: boolean
  className?: string
  id?: string
  footer?: ReactNode
}

export function SearchableCombobox({
  value,
  onValueChange,
  options,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  emptyMessage = "Sin resultados.",
  loading = false,
  disabled = false,
  className,
  id,
  footer,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  const grouped = options.reduce<Record<string, ComboboxOption[]>>((acc, option) => {
    const key = option.group ?? ""
    if (!acc[key]) acc[key] = []
    acc[key].push(option)
    return acc
  }, {})

  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "" && b !== "") return -1
    if (b === "" && a !== "") return 1
    return a.localeCompare(b, "es")
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className={cn("w-full justify-between font-normal", className)}
        >
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </span>
          ) : selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{selected.label}</span>
              {selected.badge}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,420px)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[min(60vh,320px)]">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {groupKeys.map((groupKey, index) => (
              <div key={groupKey || "default"}>
                {index > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading={groupKey || undefined}>
                  {grouped[groupKey].map((option) => (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.keywords ?? ""}`}
                      disabled={option.disabled}
                      onSelect={() => {
                        if (option.disabled) return
                        onValueChange(option.value)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-2">
                          <span className="truncate">{option.label}</span>
                          {option.badge}
                        </span>
                        {option.description ? (
                          <span className="text-xs text-muted-foreground truncate">
                            {option.description}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
        {footer ? <div className="border-t p-2">{footer}</div> : null}
      </PopoverContent>
    </Popover>
  )
}
