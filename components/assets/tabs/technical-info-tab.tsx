"use client"

import { Control } from "react-hook-form"
import { Camera, Pencil, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DateInput } from "@/components/ui/date-input"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { EvidencePhoto } from "@/components/ui/evidence-upload"

interface FormValues {
  assetId: string
  name: string
  serialNumber: string
  location: string
  department: string
  purchaseDate: Date
  installationDate?: Date
  initialHours: string
  currentHours: string
  initialKilometers?: string
  currentKilometers?: string
  status: string
  notes?: string
  warrantyExpiration?: Date
  isNew: boolean
  registrationInfo?: string
}

interface TechnicalInfoTabProps {
  control: Control<FormValues>
  uploadedPhotos: EvidencePhoto[]
  setUploadedPhotos: (photos: EvidencePhoto[]) => void
  setPhotoUploadOpen: (open: boolean) => void
}

export function TechnicalInfoTab({
  control,
  uploadedPhotos,
  setUploadedPhotos,
  setPhotoUploadOpen,
}: TechnicalInfoTabProps) {
  const removePhoto = (index: number) => {
    const newPhotos = [...uploadedPhotos]
    newPhotos.splice(index, 1)
    setUploadedPhotos(newPhotos)
  }

  const editPhotoDescription = (index: number) => {
    const newDescription = prompt(
      "Ingrese nueva descripción:", 
      uploadedPhotos[index].description
    )
    if (newDescription !== null && newDescription.trim() !== "") {
      const updatedPhotos = [...uploadedPhotos]
      updatedPhotos[index] = { 
        ...uploadedPhotos[index], 
        description: newDescription.trim() 
      }
      setUploadedPhotos(updatedPhotos)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información Técnica</CardTitle>
        <CardDescription>Detalles técnicos y especificaciones del activo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="initialHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Horas Iniciales de Operación</FormLabel>
                <FormControl>
                  <Input type="number" min="0" {...field} />
                </FormControl>
                <FormDescription>Horas de operación al momento de la adquisición</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="currentHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Horas Actuales de Operación</FormLabel>
                <FormControl>
                  <Input type="number" min="0" {...field} />
                </FormControl>
                <FormDescription>Horas actuales de operación del equipo</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="initialKilometers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kilómetros Iniciales de Operación</FormLabel>
                <FormControl>
                  <Input type="number" min="0" {...field} />
                </FormControl>
                <FormDescription>Kilómetros de operación al momento de la adquisición</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="currentKilometers"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kilómetros Actuales de Operación</FormLabel>
                <FormControl>
                  <Input type="number" min="0" {...field} />
                </FormControl>
                <FormDescription>Kilómetros actuales de operación del equipo</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="installationDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de Instalación</FormLabel>
                <FormControl>
                  <DateInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="dd/mm/aaaa"
                  />
                </FormControl>
                <FormDescription>Fecha en que el equipo fue instalado</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="warrantyExpiration"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de Expiración de Garantía</FormLabel>
                <FormControl>
                  <DateInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="dd/mm/aaaa"
                  />
                </FormControl>
                <FormDescription>Fecha en que expira la garantía del equipo</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas Adicionales</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Información adicional sobre el activo"
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Fotografías del Equipo</Label>
            {uploadedPhotos.length > 0 && (
              <Badge variant="outline">
                {uploadedPhotos.length} foto{uploadedPhotos.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          
          {uploadedPhotos.length > 0 ? (
            <div className="space-y-4">
              {/* Group photos by category */}
              {Object.entries(
                uploadedPhotos.reduce((acc, photo, index) => {
                  const category = (photo as any).category || 'Sin categoría'
                  if (!acc[category]) {
                    acc[category] = []
                  }
                  acc[category].push({ ...photo, originalIndex: index })
                  return acc
                }, {} as Record<string, (EvidencePhoto & { originalIndex: number })[]>)
              ).map(([category, photos]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{category}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {photos.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {photos.map((photo) => (
                      <div key={photo.originalIndex} className="relative border rounded-lg overflow-hidden group">
                        <img
                          src={photo.url || "/placeholder.svg"}
                          alt={photo.description || `Foto ${photo.originalIndex + 1}`}
                          className="w-full h-32 object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white p-2">
                          <p className="text-xs font-medium truncate" title={photo.description}>
                            {photo.description || `Foto ${photo.originalIndex + 1}`}
                          </p>
                        </div>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-white/90 text-gray-700 hover:bg-white"
                            onClick={() => editPhotoDescription(photo.originalIndex)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={() => removePhoto(photo.originalIndex)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay fotografías del equipo</p>
              <p className="text-sm">Use el botón de abajo para agregar fotos</p>
            </div>
          )}
          
          <div
            className="border border-dashed rounded-lg p-4 flex flex-col items-center justify-center min-h-[100px] cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setPhotoUploadOpen(true)}
          >
            <Camera className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Agregar fotografías</p>
            <p className="text-xs text-muted-foreground">Suba múltiples fotos y clasifíquelas</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 