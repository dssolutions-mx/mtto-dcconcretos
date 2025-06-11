"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Plant, BusinessUnit } from "@/types"
import { Building, MapPin } from "lucide-react"

interface PlantSelectorProps {
  value?: string
  onValueChange: (plantId: string) => void
  placeholder?: string
  label?: string
  description?: string
  required?: boolean
  className?: string
  includeBusinessUnit?: boolean
}

export function PlantSelector({
  value,
  onValueChange,
  placeholder = "Seleccionar planta",
  label,
  description,
  required = false,
  className,
  includeBusinessUnit = true
}: PlantSelectorProps) {
  const [plants, setPlants] = useState<(Plant & { business_unit?: BusinessUnit })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPlants = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        
        let query = supabase
          .from('plants')
          .select('*')
          .eq('status', 'active')
          .order('name')

        if (includeBusinessUnit) {
          query = supabase
            .from('plants')
            .select(`
              *,
              business_units(*)
            `)
            .eq('status', 'active')
            .order('name')
        }

        const { data, error } = await query

        if (error) throw error

        setPlants(data || [])
      } catch (err) {
        console.error('Error fetching plants:', err)
        setError('Error al cargar las plantas')
      } finally {
        setLoading(false)
      }
    }

    fetchPlants()
  }, [includeBusinessUnit])

  const groupedPlants = plants.reduce((acc, plant) => {
    const businessUnitName = plant.business_unit?.name || 'Sin unidad de negocio'
    if (!acc[businessUnitName]) {
      acc[businessUnitName] = []
    }
    acc[businessUnitName].push(plant)
    return acc
  }, {} as Record<string, Plant[]>)

  if (loading) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <Select disabled>
          <SelectTrigger className={className}>
            <SelectValue placeholder="Cargando plantas..." />
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <Select disabled>
          <SelectTrigger className={className}>
            <SelectValue placeholder={error} />
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {includeBusinessUnit && Object.keys(groupedPlants).length > 1 ? (
            // Show grouped by business unit
            Object.entries(groupedPlants).map(([businessUnit, businessPlants]) => (
              <div key={businessUnit}>
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground border-b">
                  <Building className="w-3 h-3 inline mr-1" />
                  {businessUnit}
                </div>
                {businessPlants.map((plant) => (
                  <SelectItem key={plant.id} value={plant.id}>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span>{plant.name}</span>
                      {plant.location && (
                        <span className="text-xs text-muted-foreground">({plant.location})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))
          ) : (
            // Show flat list
            plants.map((plant) => (
              <SelectItem key={plant.id} value={plant.id}>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span>{plant.name}</span>
                  {plant.location && (
                    <span className="text-xs text-muted-foreground">({plant.location})</span>
                  )}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

// Form field wrapper for react-hook-form integration
interface PlantSelectorFieldProps {
  control: any
  name: string
  label?: string
  description?: string
  placeholder?: string
  required?: boolean
  className?: string
  includeBusinessUnit?: boolean
}

export function PlantSelectorField({
  control,
  name,
  label = "Planta",
  description = "Seleccione la planta donde se encuentra el activo",
  placeholder = "Seleccionar planta",
  required = false,
  className,
  includeBusinessUnit = true
}: PlantSelectorFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <PlantSelector
              value={field.value}
              onValueChange={field.onChange}
              placeholder={placeholder}
              className={className}
              includeBusinessUnit={includeBusinessUnit}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
} 