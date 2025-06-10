"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  Camera, 
  Upload, 
  X, 
  Image as ImageIcon, 
  Plus, 
  AlertTriangle, 
  CheckCircle,
  Eye,
  Trash2,
  Loader2,
  WifiOff,
  AlertCircle,
  RefreshCw,
  CheckCircle2
} from "lucide-react"
import { toast } from "sonner"

interface EvidenceConfig {
  min_photos: number
  max_photos: number
  categories: string[]
  descriptions?: Record<string, string>
}

interface SmartEvidence {
  id: string
  section_id: string
  category: string
  description: string
  photo_url: string
  preview?: string
  sequence_order: number
  status: 'stored' | 'uploading' | 'uploaded' | 'failed'
  error?: string
  photoId?: string
  file?: File
}

interface EvidenceCaptureProps {
  sectionId: string
  sectionTitle: string
  config: EvidenceConfig
  onEvidenceChange: (sectionId: string, evidences: SmartEvidence[]) => void
  disabled?: boolean
  checklistId?: string
}

export function EvidenceCaptureSection({
  sectionId,
  sectionTitle,
  config,
  onEvidenceChange,
  disabled = false,
  checklistId = 'evidence'
}: EvidenceCaptureProps) {
  const [evidences, setEvidences] = useState<SmartEvidence[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>(config.categories[0] || '')
  const [currentDescription, setCurrentDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true)
  
  // Dynamic import of photo service
  const [photoService, setPhotoService] = useState<any>(null)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@/lib/services/simple-photo-service').then(module => {
        setPhotoService(module.simplePhotoService)
      })
    }
  }, [])

  // Monitor online status
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Listen for photo upload status events
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleUploadStatus = (event: CustomEvent) => {
      const { photoId, status, url, error } = event.detail
      
      setEvidences(prev => prev.map(evidence => {
        if (evidence.photoId === photoId) {
          return {
            ...evidence,
            status: status as any,
            photo_url: url || evidence.photo_url,
            error: error
          }
        }
        return evidence
      }))
      
      if (status === 'uploaded') {
        toast.success("Evidencia subida exitosamente")
      } else if (status === 'failed') {
        toast.error(`Error al subir evidencia: ${error}`)
      }
    }
    
    window.addEventListener('photo-upload-status', handleUploadStatus as EventListener)
    
    return () => {
      window.removeEventListener('photo-upload-status', handleUploadStatus as EventListener)
    }
  }, [])

  // Update parent when evidences change
  useEffect(() => {
    onEvidenceChange(sectionId, evidences)
  }, [evidences, sectionId, onEvidenceChange])

  // Validar requisitos
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

  // Smart photo upload - ENHANCED VERSION
  const handlePhotoUpload = async (file: File) => {
    if (!photoService || !selectedCategory) {
      toast.error('Seleccione una categoría primero')
      return
    }

    if (evidences.filter(e => e.category === selectedCategory).length >= config.max_photos) {
      toast.error(`Máximo ${config.max_photos} fotos permitidas para "${selectedCategory}"`)
      return
    }

    setUploading(true)
    
    try {
      // Use smart photo service instead of direct upload
      const result = await photoService.storePhoto(
        checklistId,
        `${sectionId}_${selectedCategory}_${Date.now()}`,
        file,
        {
          quality: 0.8,
          maxWidth: 1920,
          maxHeight: 1080,
          immediate: true,
          category: selectedCategory
        }
      )
      
      const newEvidence: SmartEvidence = {
        id: `evidence_${Date.now()}_${Math.random()}`,
        section_id: sectionId,
        category: selectedCategory,
        description: currentDescription || config.descriptions?.[selectedCategory] || '',
        photo_url: result.url || result.preview,
        preview: result.preview,
        sequence_order: evidences.filter(e => e.category === selectedCategory).length + 1,
        status: result.status,
        photoId: result.id,
        file
      }
      
      setEvidences(prev => [...prev, newEvidence])
      setCurrentDescription('')
      
      // Enhanced feedback based on connection status
      if (isOnline) {
        toast.success("Evidencia guardada - subiendo en segundo plano", {
          description: "La evidencia se está subiendo automáticamente"
        })
      } else {
        toast.info("Evidencia guardada sin conexión", {
          description: "Se subirá automáticamente cuando vuelva la conexión"
        })
      }
      
    } catch (error) {
      console.error('Error storing evidence photo:', error)
      toast.error("Error al procesar la evidencia")
    } finally {
      setUploading(false)
    }
  }

  // Eliminar evidencia
  const removeEvidence = async (evidenceId: string) => {
    const evidence = evidences.find(e => e.id === evidenceId)
    if (evidence?.photoId && photoService) {
      await photoService.deletePhoto(evidence.photoId)
    }
    
    setEvidences(prev => prev.filter(e => e.id !== evidenceId))
    toast.success('Evidencia eliminada')
  }

  // Ver imagen
  const viewImage = (imageUrl: string) => {
    window.open(imageUrl, '_blank')
  }

  // Retry upload
  const retryUpload = async () => {
    if (!photoService) return
    
    try {
      await photoService.retryFailedUploads()
      toast.info("Reintentando subida...")
    } catch (error) {
      toast.error("Error al reintentar subida")
    }
  }

  const { errors, warnings, isValid } = validateRequirements()
  const categoryCount = evidences.filter(e => e.category === selectedCategory).length
  
  // Get upload statistics
  const getUploadStats = () => {
    const total = evidences.length
    const uploaded = evidences.filter(e => e.status === 'uploaded').length
    const uploading = evidences.filter(e => e.status === 'uploading').length
    const failed = evidences.filter(e => e.status === 'failed').length
    
    return { total, uploaded, uploading, failed }
  }

  const uploadStats = getUploadStats()
  const uploadProgress = uploadStats.total > 0 ? Math.round((uploadStats.uploaded / uploadStats.total) * 100) : 0

  const getStatusIcon = (evidence: SmartEvidence) => {
    switch (evidence.status) {
      case 'stored':
        return isOnline ? 
          <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> :
          <WifiOff className="h-3 w-3 text-gray-500" />
      case 'uploading':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
      case 'uploaded':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-500" />
      default:
        return null
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-blue-600" />
          {sectionTitle}
          {!isOnline && <WifiOff className="h-4 w-4 text-red-500" />}
        </CardTitle>
        <CardDescription>
          Capture evidencias fotográficas del estado del equipo según las categorías requeridas
          {!isOnline && " (Modo offline - las fotos se subirán automáticamente al volver la conexión)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* NEW: Upload progress and stats */}
        {evidences.length > 0 && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Estado de Evidencias</h4>
              <div className="flex items-center gap-2 text-xs">
                <span>{uploadStats.uploaded}/{uploadStats.total} subidas</span>
                {uploadStats.failed > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {uploadStats.failed} fallidas
                  </Badge>
                )}
                {uploadStats.uploading > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {uploadStats.uploading} subiendo
                  </Badge>
                )}
              </div>
            </div>
            <Progress value={uploadProgress} className="w-full h-2" />
          </div>
        )}

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

        {/* ENHANCED photo capture with smart upload */}
        {selectedCategory && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Agregar Evidencia Fotográfica</Label>
              <div className="flex items-center gap-2">
                {!isOnline && <WifiOff className="h-4 w-4 text-gray-500" />}
                <Badge variant="outline">
                  {categoryCount}/{config.max_photos} fotos en "{selectedCategory}"
                </Badge>
              </div>
            </div>
            
            {categoryCount < config.max_photos ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Label
                  htmlFor={`evidence-upload-${sectionId}`}
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="flex items-center gap-2">
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    ) : (
                      <Camera className="h-5 w-5 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-600">
                      {uploading ? 'Procesando...' : 'Tomar foto o seleccionar archivo'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Categoría: {selectedCategory}</div>
                    {!isOnline && (
                      <div className="flex items-center gap-1 text-orange-600">
                        <WifiOff className="h-3 w-3" />
                        Sin conexión - se guardará localmente
                      </div>
                    )}
                  </div>
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

        {/* ENHANCED evidence gallery with upload status */}
        {evidences.length > 0 && (
          <div className="space-y-4">
            <Label>Evidencias Capturadas</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {evidences.map(evidence => (
                <Card key={evidence.id} className="overflow-hidden">
                  <div className="relative aspect-video">
                    <img
                      src={evidence.preview || evidence.photo_url}
                      alt={`Evidencia ${evidence.category}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <Badge variant="secondary" className="text-xs">
                        {evidence.category}
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1">
                      {getStatusIcon(evidence)}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 w-6 p-0"
                        onClick={() => viewImage(evidence.photo_url)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      {evidence.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-6 p-0"
                          onClick={retryUpload}
                          disabled={!isOnline}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
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
                    
                    {/* NEW: Status overlay showing upload progress */}
                    {evidence.status !== 'uploaded' && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                        {evidence.status === 'stored' && !isOnline && 'Guardado offline'}
                        {evidence.status === 'stored' && isOnline && 'En cola'}
                        {evidence.status === 'uploading' && 'Subiendo...'}
                        {evidence.status === 'failed' && `Error: ${evidence.error || 'Fallo de subida'}`}
                      </div>
                    )}
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

        {/* ENHANCED category summary with upload status */}
        <div className="space-y-2">
          <Label>Resumen por Categoría</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {config.categories.map(category => {
              const categoryEvidences = evidences.filter(e => e.category === category)
              const isComplete = categoryEvidences.length >= config.min_photos
              const uploaded = categoryEvidences.filter(e => e.status === 'uploaded').length
              const pending = categoryEvidences.filter(e => e.status !== 'uploaded').length
              
              return (
                <div
                  key={category}
                  className={`flex items-center justify-between p-3 rounded border ${
                    isComplete ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-medium">{category}</span>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-600">
                      {uploaded}/{categoryEvidences.length} subidas
                    </div>
                    <Badge variant={isComplete ? "default" : "secondary"}>
                      {categoryEvidences.length}/{config.min_photos}
                    </Badge>
                    {isComplete && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {pending > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {pending} pendientes
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* NEW: Offline warning */}
        {!isOnline && evidences.length > 0 && (
          <Alert>
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              Modo sin conexión activo. Las evidencias se guardan localmente y se subirán automáticamente 
              cuando se restablezca la conexión.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
} 