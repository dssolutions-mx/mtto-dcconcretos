"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { modelsApi } from "@/lib/api"
import { equipmentCategories, fuelTypes } from "@/lib/constants"
import { toast } from "@/components/ui/use-toast"
import { EquipmentModel, UpdateEquipmentModel } from "@/types"
import { Json } from "@/lib/database.types"

interface EquipmentModelEditFormProps {
  modelId: string;
}

interface SpecsGeneral {
  engineType?: string;
  power?: string;
  fuelType?: string;
  fuelCapacity?: string;
}

interface SpecsDimensions {
  length?: string;
  width?: string;
  height?: string;
  weight?: string;
  capacity?: string;
}

interface SpecsPerformance {
  maxSpeed?: string;
  maxLoad?: string;
  productivity?: string;
  operatingHours?: string;
}

interface Specifications {
  general?: SpecsGeneral;
  dimensions?: SpecsDimensions;
  performance?: SpecsPerformance;
}

export function EquipmentModelEditForm({ modelId }: EquipmentModelEditFormProps) {
  const router = useRouter()
  
  // Estados para manejar el formulario
  const [model, setModel] = useState<EquipmentModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [selectedFuelType, setSelectedFuelType] = useState<string>("")

  // Cargar datos del modelo existente
  useEffect(() => {
    async function loadModel() {
      try {
        setIsLoading(true)
        const modelData = await modelsApi.getById(modelId)
        
        if (modelData) {
          setModel(modelData)
          setSelectedCategory(modelData.category)
          
          // Extraer el tipo de combustible si existe en las especificaciones
          if (
            modelData.specifications && 
            typeof modelData.specifications === 'object' && 
            'general' in (modelData.specifications as any) && 
            (modelData.specifications as any).general && 
            'fuelType' in (modelData.specifications as any).general
          ) {
            setSelectedFuelType((modelData.specifications as any).general.fuelType as string)
          }
        }
      } catch (err) {
        console.error("Error al cargar el modelo:", err)
        setError(err instanceof Error ? err : new Error("Error al cargar datos del modelo"))
        
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar la información del modelo",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadModel()
  }, [modelId])

  // Función para actualizar el modelo
  const handleUpdateModel = async () => {
    try {
      setIsSubmitting(true)
      setError(null)

      // Obtener los valores del formulario
      const modelData: UpdateEquipmentModel = {
        name: (document.getElementById("modelName") as HTMLInputElement).value,
        manufacturer: (document.getElementById("manufacturer") as HTMLInputElement).value,
        category: selectedCategory,
        description: (document.getElementById("description") as HTMLTextAreaElement).value,
        year_introduced: Number((document.getElementById("yearIntroduced") as HTMLInputElement).value) || null,
        expected_lifespan: Number((document.getElementById("expectedLifespan") as HTMLInputElement).value) || null,
        specifications: {
          general: {
            engineType: (document.getElementById("engineType") as HTMLInputElement)?.value,
            power: (document.getElementById("power") as HTMLInputElement)?.value,
            fuelType: selectedFuelType,
            fuelCapacity: (document.getElementById("fuelCapacity") as HTMLInputElement)?.value,
          },
          dimensions: {
            length: (document.getElementById("length") as HTMLInputElement)?.value,
            width: (document.getElementById("width") as HTMLInputElement)?.value,
            height: (document.getElementById("height") as HTMLInputElement)?.value,
            weight: (document.getElementById("weight") as HTMLInputElement)?.value,
            capacity: (document.getElementById("capacity") as HTMLInputElement)?.value,
          },
          performance: {
            maxSpeed: (document.getElementById("maxSpeed") as HTMLInputElement)?.value,
            maxLoad: (document.getElementById("maxLoad") as HTMLInputElement)?.value,
            productivity: (document.getElementById("productivity") as HTMLInputElement)?.value,
            operatingHours: (document.getElementById("operatingHours") as HTMLInputElement)?.value,
          }
        } as Json
      }

      // Validar campos obligatorios
      if (!modelData.name || !modelData.manufacturer || !modelData.category) {
        throw new Error("Por favor completa los campos obligatorios: Nombre, Fabricante y Categoría")
      }

      console.log("Actualizando modelo:", modelData)
      
      // Actualizar el modelo en la base de datos
      const updatedModel = await modelsApi.update(modelId, modelData)
      
      console.log("Modelo actualizado con éxito:", updatedModel)
      
      toast({
        title: "Modelo actualizado",
        description: "El modelo de equipo ha sido actualizado correctamente",
      })
      
      // Redirigir a la página de detalles del modelo
      router.push(`/modelos/${modelId}`)
      router.refresh()
    } catch (err) {
      console.error("Error al actualizar el modelo:", err)
      setError(err instanceof Error ? err : new Error("Error al actualizar el modelo"))
      
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Error al actualizar el modelo",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!model) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          No se pudo cargar el modelo. Por favor, intenta nuevamente.
        </AlertDescription>
      </Alert>
    )
  }

  // Extraer valores de las especificaciones para mostrarlos en el formulario
  const specifications = model.specifications || {}
  const general = typeof specifications === 'object' && 'general' in (specifications as any) 
    ? (specifications as any).general || {} 
    : {}
  const dimensions = typeof specifications === 'object' && 'dimensions' in (specifications as any) 
    ? (specifications as any).dimensions || {} 
    : {}
  const performance = typeof specifications === 'object' && 'performance' in (specifications as any) 
    ? (specifications as any).performance || {} 
    : {}

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información del Modelo</CardTitle>
          <CardDescription>Modifica la información básica del modelo de equipo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="modelName">Nombre del Modelo</Label>
              <Input 
                id="modelName" 
                placeholder="Ej: CR-15" 
                defaultValue={model.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input 
                id="manufacturer" 
                placeholder="Ej: ConcreMix" 
                defaultValue={model.manufacturer}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <Select 
              value={selectedCategory} 
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {equipmentCategories.map((category: string) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea 
              id="description" 
              placeholder="Descripción general del modelo" 
              rows={3} 
              defaultValue={model.description || ''}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="yearIntroduced">Año de Introducción</Label>
              <Input 
                id="yearIntroduced" 
                type="number" 
                placeholder="Ej: 2020" 
                defaultValue={model.year_introduced || ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedLifespan">Vida Útil Esperada (años)</Label>
              <Input 
                id="expectedLifespan" 
                type="number" 
                placeholder="Ej: 10" 
                defaultValue={model.expected_lifespan || ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Especificaciones Técnicas</CardTitle>
          <CardDescription>Información detallada sobre las características técnicas del equipo</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="dimensions">Dimensiones</TabsTrigger>
              <TabsTrigger value="performance">Rendimiento</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="engineType">Tipo de Motor</Label>
                  <Input 
                    id="engineType" 
                    placeholder="Ej: Diésel 4 cilindros" 
                    defaultValue={general?.engineType || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="power">Potencia</Label>
                  <Input 
                    id="power" 
                    placeholder="Ej: 120 HP" 
                    defaultValue={general?.power || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuelType">Tipo de Combustible</Label>
                  <Select 
                    value={selectedFuelType} 
                    onValueChange={setSelectedFuelType}
                  >
                    <SelectTrigger id="fuelType">
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {fuelTypes.map((type: string) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fuelCapacity">Capacidad de Combustible</Label>
                  <Input 
                    id="fuelCapacity" 
                    placeholder="Ej: 200 L" 
                    defaultValue={general?.fuelCapacity || ''}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="dimensions" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="length">Longitud</Label>
                  <Input 
                    id="length" 
                    placeholder="Ej: 5.5 m" 
                    defaultValue={dimensions?.length || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="width">Ancho</Label>
                  <Input 
                    id="width" 
                    placeholder="Ej: 2.3 m" 
                    defaultValue={dimensions?.width || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Altura</Label>
                  <Input 
                    id="height" 
                    placeholder="Ej: 3.1 m" 
                    defaultValue={dimensions?.height || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Peso</Label>
                  <Input 
                    id="weight" 
                    placeholder="Ej: 5000 kg" 
                    defaultValue={dimensions?.weight || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacidad</Label>
                  <Input 
                    id="capacity" 
                    placeholder="Ej: 2.5 m³" 
                    defaultValue={dimensions?.capacity || ''}
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxSpeed">Velocidad Máxima</Label>
                  <Input 
                    id="maxSpeed" 
                    placeholder="Ej: 25 km/h" 
                    defaultValue={performance?.maxSpeed || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxLoad">Carga Máxima</Label>
                  <Input 
                    id="maxLoad" 
                    placeholder="Ej: 10000 kg" 
                    defaultValue={performance?.maxLoad || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productivity">Productividad</Label>
                  <Input 
                    id="productivity" 
                    placeholder="Ej: 50 m³/h" 
                    defaultValue={performance?.productivity || ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="operatingHours">Horas de Operación Recomendadas</Label>
                  <Input 
                    id="operatingHours" 
                    placeholder="Ej: 8000 h/año" 
                    defaultValue={performance?.operatingHours || ''}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/modelos/${modelId}`)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleUpdateModel}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 