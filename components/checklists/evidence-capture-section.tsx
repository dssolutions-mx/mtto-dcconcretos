"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Camera, 
  Upload, 
  X, 
  Image as ImageIcon, 
  Plus, 
  AlertTriangle, 
  CheckCircle,
  Eye,
  Trash2
} from "lucide-react"
import { toast } from "sonner"

interface EvidenceConfig {
  min_photos: number
  max_photos: number
  categories: string[]
  descriptions?: Record<string, string>
}

interface Evidence {
  id: string
  section_id: string
  category: string
  description: string
  photo_url: string
  sequence_order: number
  file?: File
}

interface EvidenceCaptureProps {
  sectionId: string
  sectionTitle: string
  config: EvidenceConfig
  onEvidenceChange: (sectionId: string, evidences: Evidence[]) => void
  disabled?: boolean
}

export function EvidenceCaptureSection({
  sectionId,
  sectionTitle,
  config,
  onEvidenceChange,
  disabled = false
}: EvidenceCaptureProps) {
  const [evidences, setEvidences] = useState<Evidence[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>(config.categories[0] || '')
  const [currentDescription, setCurrentDescription] = useState('')
  const [uploading, setUploading] = useState(false)

  // Validar si se cumplen los requisitos
  const validateRequirements = useCallback(() => {
    const errors: string[] = []
    const warnings: string[] = []

    config.categories.forEach(category => {
      const categoryCount = evidences.filter(e => e.category === category).length
      
      if (categoryCount < config.min_photos) {
        errors.push(`Se requieren al menos ${config.min_photos} fotos para "${category}"`)
      }
      
      if (categoryCount > config.max_photos) {
        warnings.push(`Se tienen ${categoryCount} fotos para "${category}" (máximo recomendado: ${config.max_photos})`)
      }
    })

    return { errors, warnings, isValid: errors.length === 0 }
  }, [evidences, config])

  // Subir foto
  const handlePhotoUpload = async (file: File) => {
    if (!selectedCategory) {
      toast.error('Seleccione una categoría primero')
      return
    }

    if (evidences.filter(e => e.category === selectedCategory).length >= config.max_photos) {
      toast.error(`Máximo ${config.max_photos} fotos permitidas para "${selectedCategory}"`)
      return
    }

    setUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'checklist-photos')
      
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error('Error al subir la foto')
      }
      
      const { url } = await response.json()
      
      const newEvidence: Evidence = {
        id: `evidence_${Date.now()}_${Math.random()}`,
        section_id: sectionId,
        category: selectedCategory,
        description: currentDescription || config.descriptions?.[selectedCategory] || '',
        photo_url: url,
        sequence_order: evidences.filter(e => e.category === selectedCategory).length + 1,
        file
      }
      
      const updatedEvidences = [...evidences, newEvidence]
      setEvidences(updatedEvidences)
      onEvidenceChange(sectionId, updatedEvidences)
      
      setCurrentDescription('')
      toast.success('Evidencia agregada exitosamente')
    } catch (error) {
      console.error('Error uploading evidence:', error)
      toast.error('Error al subir la evidencia')
    } finally {
      setUploading(false)
    }
  }

  // Eliminar evidencia
  const removeEvidence = (evidenceId: string) => {
    const updatedEvidences = evidences.filter(e => e.id !== evidenceId)
    setEvidences(updatedEvidences)
    onEvidenceChange(sectionId, updatedEvidences)
    toast.success('Evidencia eliminada')
  }

  // Ver imagen en tamaño completo
  const viewImage = (imageUrl: string) => {
    window.open(imageUrl, '_blank')
  }

  const { errors, warnings, isValid } = validateRequirements()
  const categoryCount = evidences.filter(e => e.category === selectedCategory).length

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-blue-600" />
          {sectionTitle}
        </CardTitle>
        <CardDescription>
          Capture evidencias fotográficas del estado del equipo según las categorías requeridas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumen de requisitos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600">Categorías</div>
            <div className="text-lg font-semibold text-gray-900">
              {config.categories.length}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600">Fotos por Categoría</div>
            <div className="text-lg font-semibold text-gray-900">
              {config.min_photos} - {config.max_photos}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-600">Total Capturadas</div>
            <div className="text-lg font-semibold text-gray-900">
              {evidences.length}
            </div>
          </div>
        </div>

        {/* Selección de categoría */}
        <div className="space-y-2">
          <Label>Categoría de Evidencia</Label>
          <div className="flex flex-wrap gap-2">
            {config.categories.map(category => {
              const categoryEvidences = evidences.filter(e => e.category === category)
              const isSelected = selectedCategory === category
              const isComplete = categoryEvidences.length >= config.min_photos
              
              return (
                <Button
                  key={category}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  disabled={disabled}
                  className={`relative ${isSelected ? 'bg-blue-600' : ''}`}
                >
                  {category}
                  <Badge 
                    variant={isComplete ? "default" : "secondary"}
                    className={`ml-2 ${isComplete ? 'bg-green-500' : 'bg-gray-400'}`}
                  >
                    {categoryEvidences.length}/{config.min_photos}
                  </Badge>
                  {isComplete && (
                    <CheckCircle className="h-3 w-3 text-green-500 absolute -top-1 -right-1" />
                  )}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Descripción opcional */}
        {selectedCategory && (
          <div className="space-y-2">
            <Label htmlFor="evidence-description">
              Descripción para "{selectedCategory}" (opcional)
            </Label>
            <Textarea
              id="evidence-description"
              placeholder={`Describa el estado observado en ${selectedCategory}...`}
              value={currentDescription}
              onChange={(e) => setCurrentDescription(e.target.value)}
              disabled={disabled}
              rows={2}
            />
            {config.descriptions?.[selectedCategory] && (
              <p className="text-xs text-gray-600">
                Sugerencia: {config.descriptions[selectedCategory]}
              </p>
            )}
          </div>
        )}

        {/* Captura de foto */}
        {selectedCategory && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Agregar Evidencia Fotográfica</Label>
              <Badge variant="outline">
                {categoryCount}/{config.max_photos} fotos en "{selectedCategory}"
              </Badge>
            </div>
            
            {categoryCount < config.max_photos ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Label
                  htmlFor={`evidence-upload-${sectionId}`}
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="flex items-center gap-2">
                    {uploading ? (
                      <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                    ) : (
                      <Camera className="h-5 w-5 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-600">
                      {uploading ? 'Subiendo...' : 'Tomar foto o seleccionar archivo'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    Categoría: {selectedCategory}
                  </span>
                </Label>
                <input
                  id={`evidence-upload-${sectionId}`}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={disabled || uploading}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handlePhotoUpload(e.target.files[0])
                    }
                  }}
                />
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Se alcanzó el límite máximo de fotos para "{selectedCategory}"
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Evidencias capturadas */}
        {evidences.length > 0 && (
          <div className="space-y-4">
            <Label>Evidencias Capturadas</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {evidences.map(evidence => (
                <Card key={evidence.id} className="overflow-hidden">
                  <div className="relative aspect-video">
                    <img
                      src={evidence.photo_url}
                      alt={`Evidencia ${evidence.category}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <Badge variant="secondary" className="text-xs">
                        {evidence.category}
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 w-6 p-0"
                        onClick={() => viewImage(evidence.photo_url)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-6 w-6 p-0"
                        onClick={() => removeEvidence(evidence.id)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {evidence.description && (
                    <CardContent className="p-2">
                      <p className="text-xs text-gray-600 truncate">
                        {evidence.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Validación de requisitos */}
        <div className="space-y-2">
          {errors.length > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {warnings.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <ul className="list-disc list-inside space-y-1">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {isValid && evidences.length > 0 && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                ✓ Todos los requisitos de evidencias están completos
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Resumen por categoría */}
        <div className="space-y-2">
          <Label>Resumen por Categoría</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {config.categories.map(category => {
              const categoryEvidences = evidences.filter(e => e.category === category)
              const isComplete = categoryEvidences.length >= config.min_photos
              
              return (
                <div
                  key={category}
                  className={`flex items-center justify-between p-2 rounded border ${
                    isComplete ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-medium">{category}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={isComplete ? "default" : "secondary"}>
                      {categoryEvidences.length}/{config.min_photos}
                    </Badge>
                    {isComplete && <CheckCircle className="h-4 w-4 text-green-600" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 