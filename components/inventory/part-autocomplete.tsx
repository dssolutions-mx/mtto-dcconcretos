"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, Package, Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AddPartDialog } from "./add-part-dialog"

export interface PartSuggestion {
  id: string
  part_number: string
  name: string
  description?: string
  default_unit_cost?: number
  unit_of_measure?: string
  category?: string
}

interface PartAutocompleteProps {
  value: string
  onSelect: (part: PartSuggestion | null) => void
  onManualEntry?: (text: string) => void // Callback when user types manually (not from catalog)
  placeholder?: string
  className?: string
  disabled?: boolean
  showPartNumber?: boolean
  autoFocus?: boolean
  allowManualEntry?: boolean // Allow typing parts not in catalog
}

export function PartAutocomplete({
  value,
  onSelect,
  onManualEntry,
  placeholder = "Buscar por nombre o número de parte...",
  className,
  disabled = false,
  showPartNumber = true,
  autoFocus = false,
  allowManualEntry = true
}: PartAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<PartSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPart, setSelectedPart] = useState<PartSuggestion | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update search query when value prop changes
  useEffect(() => {
    setSearchQuery(value)
  }, [value])

  // Search for parts when query changes
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    setIsLoading(true)
    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/inventory/parts/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await response.json()
        
        if (data.success && data.parts) {
          setSuggestions(data.parts.map((part: any) => ({
            id: part.id,
            part_number: part.part_number || '',
            name: part.name || '',
            description: part.description,
            default_unit_cost: part.default_unit_cost,
            unit_of_measure: part.unit_of_measure,
            category: part.category
          })))
          setOpen(true)
        } else {
          setSuggestions([])
        }
      } catch (error) {
        console.error('Error searching parts:', error)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 300) // 300ms debounce

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchQuery])

  const handleSelect = (part: PartSuggestion) => {
    setSelectedPart(part)
    setSearchQuery(part.name)
    setOpen(false)
    onSelect(part)
  }

  const handlePartCreated = (part: {
    id: string
    part_number: string
    name: string
    description?: string
    default_unit_cost?: number
    unit_of_measure?: string
    category?: string
  }) => {
    // Convert created part to PartSuggestion format
    const newPart: PartSuggestion = {
      id: part.id,
      part_number: part.part_number,
      name: part.name,
      description: part.description,
      default_unit_cost: part.default_unit_cost,
      unit_of_measure: part.unit_of_measure,
      category: part.category
    }
    
    // Automatically select the newly created part
    handleSelect(newPart)
    setShowAddDialog(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchQuery(newValue)
    setSelectedPart(null)
    
    // If user clears the input, clear selection
    if (!newValue) {
      onSelect(null)
      setOpen(false)
      if (onManualEntry) {
        onManualEntry('')
      }
    } else if (allowManualEntry && onManualEntry) {
      // Allow manual entry - notify parent that user is typing manually
      onManualEntry(newValue)
    }
  }

  // Handle when user presses Enter or clicks outside without selecting
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && allowManualEntry && searchQuery && !selectedPart) {
      // User pressed Enter without selecting - treat as manual entry
      e.preventDefault()
      setOpen(false)
      if (onManualEntry) {
        onManualEntry(searchQuery)
      }
    }
  }

  const handleInputFocus = () => {
    // Open popover if we have suggestions or if user is typing
    if (suggestions.length > 0 || searchQuery.length >= 2) {
      setOpen(true)
    }
  }

  const displayValue = selectedPart 
    ? (showPartNumber && selectedPart.part_number ? `${selectedPart.part_number} - ${selectedPart.name}` : selectedPart.name)
    : searchQuery

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            value={displayValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            className={cn("w-full", className)}
            disabled={disabled}
            autoFocus={autoFocus}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {!isLoading && selectedPart && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Don't close if clicking on the input
          if (inputRef.current?.contains(e.target as Node)) {
            e.preventDefault()
          }
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput 
            value={searchQuery} 
            onValueChange={(value) => {
              setSearchQuery(value)
              setSelectedPart(null)
            }}
            placeholder="Buscar partes..."
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-4 text-center space-y-3">
                {searchQuery.length < 2 ? (
                  <p>Escribe al menos 2 caracteres para buscar</p>
                ) : isLoading ? (
                  <p>Buscando...</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      No se encontró en catálogo
                    </p>
                    {allowManualEntry && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Puedes escribir manualmente y presionar Enter
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            setShowAddDialog(true)
                          }}
                          className="w-full"
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          Agregar al Catálogo
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CommandEmpty>
            {suggestions.length > 0 && (
              <CommandGroup>
                {suggestions.map((part) => (
                  <CommandItem
                    key={part.id}
                    value={`${part.part_number} ${part.name}`}
                    onSelect={() => {
                      handleSelect(part)
                    }}
                    onMouseDown={(e) => {
                      // Prevent input blur when clicking
                      e.preventDefault()
                    }}
                    className="cursor-pointer"
                  >
                  <div className="flex items-start gap-2 w-full">
                    <Package className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{part.name}</div>
                      {part.part_number && (
                        <div className="text-xs text-muted-foreground">
                          #{part.part_number}
                        </div>
                      )}
                      {part.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {part.description}
                        </div>
                      )}
                      {part.default_unit_cost !== undefined && part.default_unit_cost !== null && (
                        <div className="text-xs text-green-600 font-medium mt-1">
                          ${part.default_unit_cost.toFixed(2)} {part.unit_of_measure || 'unidad'}
                        </div>
                      )}
                    </div>
                  </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {/* Show "Add to Catalog" option when no results and user has typed */}
            {!isLoading && searchQuery.length >= 2 && suggestions.length === 0 && allowManualEntry && (
              <CommandGroup>
                <div className="p-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault()
                      setShowAddDialog(true)
                      setOpen(false)
                    }}
                    className="w-full"
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    Agregar "{searchQuery}" al Catálogo
                  </Button>
                </div>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
      
      {/* Add Part Dialog */}
      <AddPartDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open)
          // If closing without creating, keep the search query
          if (!open) {
            // Dialog closed - user can continue typing manually
          }
        }}
        initialName={searchQuery}
        initialPartNumber={""}
        onPartCreated={handlePartCreated}
      />
    </Popover>
  )
}
