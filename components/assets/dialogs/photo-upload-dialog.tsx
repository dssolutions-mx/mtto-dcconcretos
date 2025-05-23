"use client"

import React, { useState, useRef, useCallback, useMemo } from "react"
import { Camera, Upload, X, Check, Plus, Grid3X3, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface PhotoWithDescription {
  file: File
  preview: string
  description: string
  category?: string
}

interface PhotoUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  uploadedPhotos: PhotoWithDescription[]
  setUploadedPhotos: (photos: PhotoWithDescription[]) => void
}

const PREDEFINED_CATEGORIES = [
  { value: "frontal", label: "Vista Frontal", icon: "📷" },
  { value: "lateral", label: "Vista Lateral", icon: "↔️" },
  { value: "posterior", label: "Vista Posterior", icon: "🔄" },
  { value: "superior", label: "Vista Superior", icon: "⬆️" },
  { value: "motor", label: "Motor", icon: "⚙️" },
  { value: "compresor", label: "Compresor", icon: "🔧" },
  { value: "panel", label: "Panel de Control", icon: "🎛️" },
  { value: "conexiones", label: "Conexiones", icon: "🔌" },
  { value: "filtros", label: "Filtros", icon: "🚰" },
  { value: "lubricacion", label: "Sistema de Lubricación", icon: "🛢️" },
  { value: "refrigeracion", label: "Sistema de Refrigeración", icon: "❄️" },
  { value: "tablero", label: "Tablero Eléctrico", icon: "⚡" },
  { value: "placa", label: "Placa de Identificación", icon: "🏷️" },
  { value: "desgaste", label: "Desgaste/Daño", icon: "⚠️" },
  { value: "instalacion", label: "Instalación", icon: "🏗️" },
]

// Hook personalizado para debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useState(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  })

  return debouncedValue
}

export function PhotoUploadDialog({
  open,
  onOpenChange,
  uploadedPhotos,
  setUploadedPhotos,
}: PhotoUploadDialogProps) {
  const [pendingPhotos, setPendingPhotos] = useState<PhotoWithDescription[]>([])
  const [customCategory, setCustomCategory] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      
      const newPhotos = files.map((file) => {
        const preview = URL.createObjectURL(file)
        
        return {
          file,
          preview,
          description: `${file.name.split('.')[0]}`,
          category: undefined,
        }
      })
      
      setPendingPhotos(prev => [...prev, ...newPhotos])
    }
    
    // Reset the input
    if (e.target) {
      e.target.value = ""
    }
  }, [])

  const updatePhotoCategory = useCallback((index: number, category: string) => {
    setPendingPhotos(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], category }
      return updated
    })
  }, [])

  const updatePhotoDescription = useCallback((index: number, description: string) => {
    setPendingPhotos(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], description }
      return updated
    })
  }, [])

  const removePhoto = useCallback((index: number) => {
    setPendingPhotos(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleSavePhotos = useCallback(() => {
    // Only save photos that have both description and category
    const validPhotos = pendingPhotos.filter(photo => 
      photo.description.trim() && photo.category
    )
    
    if (validPhotos.length === 0) {
      return
    }

    setUploadedPhotos([...uploadedPhotos, ...validPhotos])
    setPendingPhotos([])
    onOpenChange(false)
  }, [pendingPhotos, uploadedPhotos, setUploadedPhotos, onOpenChange])

  const handleClose = useCallback(() => {
    setPendingPhotos([])
    setCustomCategory("")
    onOpenChange(false)
  }, [onOpenChange])

  const getCategoryInfo = useCallback((categoryValue: string) => {
    const predefined = PREDEFINED_CATEGORIES.find(c => c.value === categoryValue)
    if (predefined) {
      return predefined
    }
    return { value: categoryValue, label: categoryValue, icon: "📋" }
  }, [])

  const canSave = useMemo(() => 
    pendingPhotos.length > 0 && pendingPhotos.every(photo => 
      photo.description.trim() && photo.category
    ), [pendingPhotos])

  const completedPhotosCount = useMemo(() => 
    pendingPhotos.filter(p => p.category && p.description.trim()).length, 
    [pendingPhotos])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Gestión de Fotografías del Activo
          </DialogTitle>
          <DialogDescription>
            Suba múltiples fotografías y clasifíquelas según el área o componente del equipo
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="upload" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Subir Fotos</TabsTrigger>
              <TabsTrigger value="classify">
                Clasificar ({pendingPhotos.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="flex-1 space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Subir Fotografías</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Seleccione múltiples archivos o arrastre y suelte aquí
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    size="lg"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Seleccionar Archivos
                  </Button>
                </div>
              </div>

              {pendingPhotos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Fotos seleccionadas ({pendingPhotos.length})
                    </Label>
                    <div className="flex gap-1">
                      <Button
                        variant={viewMode === "grid" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === "list" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className={cn(
                    "grid gap-2 max-h-60 overflow-y-auto",
                    viewMode === "grid" ? "grid-cols-4" : "grid-cols-1"
                  )}>
                    {pendingPhotos.map((photo, index) => (
                      <PhotoPreview
                        key={`${photo.file.name}-${index}`}
                        photo={photo}
                        index={index}
                        viewMode={viewMode}
                        onRemove={removePhoto}
                      />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="classify" className="flex-1 space-y-4 overflow-hidden">
              {pendingPhotos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay fotos para clasificar</p>
                  <p className="text-sm">Suba algunas fotos primero</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Clasificar Fotografías</h3>
                    <Badge variant="outline">
                      {completedPhotosCount} / {pendingPhotos.length} listas
                    </Badge>
                  </div>

                  <div className="grid gap-4">
                    {pendingPhotos.map((photo, index) => (
                      <PhotoClassificationCard
                        key={`${photo.file.name}-${index}`}
                        photo={photo}
                        index={index}
                        updatePhotoCategory={updatePhotoCategory}
                        updatePhotoDescription={updatePhotoDescription}
                        getCategoryInfo={getCategoryInfo}
                        customCategory={customCategory}
                        setCustomCategory={setCustomCategory}
                      />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSavePhotos}
            disabled={!canSave}
          >
            <Check className="mr-2 h-4 w-4" />
            Guardar Fotografías ({completedPhotosCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Componente optimizado para vista previa de fotos
const PhotoPreview = React.memo(function PhotoPreview({ 
  photo, 
  index, 
  viewMode, 
  onRemove 
}: {
  photo: PhotoWithDescription
  index: number
  viewMode: "grid" | "list"
  onRemove: (index: number) => void
}) {
  const handleRemove = useCallback(() => {
    onRemove(index)
  }, [index, onRemove])

  return (
    <div className={cn(
      "relative border rounded overflow-hidden",
      viewMode === "list" && "flex items-center gap-3 p-2"
    )}>
      <img
        src={photo.preview}
        alt={`Preview ${index + 1}`}
        className={cn(
          "object-cover",
          viewMode === "grid" ? "w-full h-20" : "w-16 h-16 flex-shrink-0"
        )}
      />
      <Button
        variant="destructive"
        size="sm"
        className="absolute top-1 right-1 h-6 w-6 p-0"
        onClick={handleRemove}
      >
        <X className="h-3 w-3" />
      </Button>
      {viewMode === "list" && (
        <div className="flex-1 space-y-1">
          <p className="text-xs font-medium truncate">{photo.file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(photo.file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
      )}
    </div>
  )
})

// Componente optimizado para la tarjeta de clasificación
const PhotoClassificationCard = React.memo(function PhotoClassificationCard({
  photo,
  index,
  updatePhotoCategory,
  updatePhotoDescription,
  getCategoryInfo,
  customCategory,
  setCustomCategory
}: {
  photo: PhotoWithDescription
  index: number
  updatePhotoCategory: (index: number, category: string) => void
  updatePhotoDescription: (index: number, description: string) => void
  getCategoryInfo: (categoryValue: string) => { value: string; label: string; icon: string }
  customCategory: string
  setCustomCategory: (value: string) => void
}) {
  const categoryInfo = photo.category ? getCategoryInfo(photo.category) : null
  const isComplete = photo.category && photo.description.trim()

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updatePhotoDescription(index, e.target.value)
  }, [index, updatePhotoDescription])

  const handleCategoryChange = useCallback((value: string) => {
    updatePhotoCategory(index, value)
  }, [index, updatePhotoCategory])

  const handleCustomCategoryKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (customCategory.trim()) {
        updatePhotoCategory(index, customCategory.trim())
        setCustomCategory("")
      }
    }
  }, [customCategory, index, updatePhotoCategory, setCustomCategory])

  const handleAddCustomCategory = useCallback(() => {
    if (customCategory.trim()) {
      updatePhotoCategory(index, customCategory.trim())
      setCustomCategory("")
    }
  }, [customCategory, index, updatePhotoCategory, setCustomCategory])

  return (
    <Card className={cn(
      "transition-colors",
      isComplete ? "border-green-200 bg-green-50" : "border-muted"
    )}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="relative">
            <img
              src={photo.preview}
              alt={`Photo ${index + 1}`}
              className="w-20 h-20 object-cover rounded border"
            />
            {isComplete && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                <Check className="h-3 w-3" />
              </div>
            )}
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="space-y-2">
              <Label className="text-sm">Descripción</Label>
              <Input
                value={photo.description}
                onChange={handleDescriptionChange}
                placeholder="Ej: Vista frontal del motor principal"
                className="text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">Categoría</Label>
              <div className="flex gap-2">
                <Select
                  value={photo.category || ""}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex items-center gap-2">
                          <span>{category.icon}</span>
                          <span>{category.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Input
                    placeholder="Categoría personalizada"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-40"
                    onKeyDown={handleCustomCategoryKeyDown}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddCustomCategory}
                    disabled={!customCategory.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {categoryInfo && (
                <Badge variant="secondary" className="w-fit">
                  {categoryInfo.icon} {categoryInfo.label}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}) 