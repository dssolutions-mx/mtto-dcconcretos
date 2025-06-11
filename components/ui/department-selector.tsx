"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Department, Plant } from "@/types"
import { Users, Building } from "lucide-react"

interface DepartmentSelectorProps {
  value?: string
  onValueChange: (departmentId: string) => void
  plantId?: string
  placeholder?: string
  label?: string
  description?: string
  required?: boolean
  className?: string
  showPlantName?: boolean
}

export function DepartmentSelector({
  value,
  onValueChange,
  plantId,
  placeholder = "Seleccionar departamento",
  label,
  description,
  required = false,
  className,
  showPlantName = false
}: DepartmentSelectorProps) {
  const [departments, setDepartments] = useState<(Department & { plant?: Plant })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        
        let query = supabase
          .from('departments')
          .select(`
            *,
            plants(name, code)
          `)
          .order('name')

        if (plantId) {
          query = query.eq('plant_id', plantId)
        }

        const { data, error } = await query

        if (error) throw error

        setDepartments(data || [])
      } catch (err) {
        console.error('Error fetching departments:', err)
        setError('Error al cargar los departamentos')
      } finally {
        setLoading(false)
      }
    }

    fetchDepartments()
  }, [plantId])

  // Group departments by plant if showing multiple plants
  const groupedDepartments = departments.reduce((acc, dept) => {
    const plantName = dept.plant?.name || 'Sin planta'
    if (!acc[plantName]) {
      acc[plantName] = []
    }
    acc[plantName].push(dept)
    return acc
  }, {} as Record<string, Department[]>)

  if (loading) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <Select disabled>
          <SelectTrigger className={className}>
            <SelectValue placeholder="Cargando departamentos..." />
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

  if (departments.length === 0) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <Select disabled>
          <SelectTrigger className={className}>
            <SelectValue placeholder={plantId ? "No hay departamentos en esta planta" : "No hay departamentos disponibles"} />
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
          {showPlantName && !plantId && Object.keys(groupedDepartments).length > 1 ? (
            // Show grouped by plant
            Object.entries(groupedDepartments).map(([plantName, plantDepartments]) => (
              <div key={plantName}>
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground border-b">
                  <Building className="w-3 h-3 inline mr-1" />
                  {plantName}
                </div>
                {plantDepartments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <div className="flex items-center gap-2">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span>{dept.name}</span>
                      {dept.code && (
                        <span className="text-xs text-muted-foreground">({dept.code})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))
          ) : (
            // Show flat list
            departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                <div className="flex items-center gap-2">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <span>{dept.name}</span>
                  {dept.code && (
                    <span className="text-xs text-muted-foreground">({dept.code})</span>
                  )}
                  {showPlantName && dept.plant?.name && (
                    <span className="text-xs text-muted-foreground">- {dept.plant.name}</span>
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
interface DepartmentSelectorFieldProps {
  control: any
  name: string
  plantId?: string
  label?: string
  description?: string
  placeholder?: string
  required?: boolean
  className?: string
  showPlantName?: boolean
}

export function DepartmentSelectorField({
  control,
  name,
  plantId,
  label = "Departamento",
  description = "Seleccione el departamento donde se encuentra el activo",
  placeholder = "Seleccionar departamento",
  required = false,
  className,
  showPlantName = false
}: DepartmentSelectorFieldProps) {
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
            <DepartmentSelector
              value={field.value}
              onValueChange={field.onChange}
              plantId={plantId}
              placeholder={placeholder}
              className={className}
              showPlantName={showPlantName}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
} 