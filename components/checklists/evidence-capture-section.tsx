"use client"

import { useState, useCallback, useEffect, useRef } from "react"
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
  CheckCircle2,
  Download,
  Wifi,
  HardDrive
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
  // Enhanced metadata for better tracking
  originalSize?: number
  compressedSize?: number
  compressionRatio?: number
  timestamp?: number
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
  
  // Enhanced photo service handling
  const [photoService, setPhotoService] = useState<any>(null)
  const [serviceReady, setServiceReady] = useState(false)
  
  // Local storage key for persistence
  const storageKey = `evidence-${checklistId}-${sectionId}`
  
  // Initialize photo service
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@/lib/services/simple-photo-service').then(module => {
        setPhotoService(module.simplePhotoService)
        setServiceReady(true)
        console.log('📸 Evidence photo service initialized')
      }).catch(error => {
        console.error('Failed to initialize photo service:', error)
        toast.error('Error al inicializar el servicio de fotos')
      })
    }
  }, [])

  // Enhanced online/offline monitoring
  // Keep selectedCategory valid when config.categories changes
  useEffect(() => {
    if (!config?.categories || config.categories.length === 0) {
      if (selectedCategory) setSelectedCategory('')
      return
    }
    if (!selectedCategory || !config.categories.includes(selectedCategory)) {
      setSelectedCategory(config.categories[0])
    }
  }, [config?.categories])

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleOnline = () => {
      setIsOnline(true)
      console.log('🌐 Evidence section back online - checking for pending uploads')
      
      // Trigger upload retry when back online
      if (photoService && serviceReady) {
        setTimeout(() => {
          photoService.retryFailedUploads()
          toast.success("Conexión restaurada - reintentando subidas de evidencias")
        }, 1000)
      }
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      console.log('📱 Evidence section offline - photos will be stored locally')
      toast.info("Sin conexión - las evidencias se guardarán localmente")
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [photoService, serviceReady])

  // Enhanced upload status listener with better error handling
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleUploadStatus = (event: CustomEvent) => {
      const { photoId, status, url, error, metadata } = event.detail
      
      setEvidences(prev => prev.map(evidence => {
        if (evidence.photoId === photoId) {
          return {
            ...evidence,
            status: status as any,
            photo_url: url || evidence.photo_url,
            error: error,
            ...(metadata && {
              originalSize: metadata.originalSize,
              compressedSize: metadata.compressedSize,
              compressionRatio: metadata.compressionRatio
            })
          }
        }
        return evidence
      }))
      
      // Enhanced feedback messages
      if (status === 'uploaded') {
        toast.success("✅ Evidencia subida exitosamente", {
          description: "La evidencia está ahora disponible en línea"
        })
      } else if (status === 'failed') {
        toast.error(`❌ Error al subir evidencia: ${error}`, {
          description: "La evidencia permanece guardada localmente"
        })
      } else if (status === 'stored') {
        toast.info("💾 Evidencia guardada localmente", {
          description: "Se subirá automáticamente cuando vuelva la conexión"
        })
      }
    }
    
    window.addEventListener('photo-upload-status', handleUploadStatus as EventListener)
    
    return () => {
      window.removeEventListener('photo-upload-status', handleUploadStatus as EventListener)
    }
  }, [])

  // Enhanced persistence - save evidences to localStorage
  useEffect(() => {
    if (evidences.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          evidences: evidences.map(e => ({
            ...e,
            file: undefined // Don't store file objects in localStorage
          })),
          timestamp: Date.now()
        }))
      } catch (error) {
        console.error('Failed to save evidences to localStorage:', error)
      }
    }
  }, [evidences, storageKey])

  // Load evidences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const data = JSON.parse(saved)
        // Only load if less than 24 hours old
        if (Date.now() - (data.timestamp || 0) < 24 * 60 * 60 * 1000) {
          setEvidences(data.evidences || [])
          console.log(`📂 Loaded ${data.evidences?.length || 0} evidences from localStorage`)
        }
      }
    } catch (error) {
      console.error('Failed to load evidences from localStorage:', error)
    }
  }, [storageKey])

  // Update parent when evidences change (use a ref to track if we should call on mount)
  const hasInitialized = useRef(false)
  
  useEffect(() => {
    if (!hasInitialized.current) {
      // On mount, only call if we have initial evidences
      if (evidences.length > 0) {
        onEvidenceChange(sectionId, evidences)
      }
      hasInitialized.current = true
    } else {
      // After mount, always call when evidences change
      onEvidenceChange(sectionId, evidences)
    }
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

  // Enhanced photo upload with better error handling and feedback
  const handlePhotoUpload = async (file: File) => {
    if (!serviceReady || !photoService) {
      toast.error('📸 Servicio de fotos no disponible - intente nuevamente')
      return
    }

    if (!selectedCategory) {
      toast.error('📂 Seleccione una categoría primero')
      return
    }

    if (evidences.filter(e => e.category === selectedCategory).length >= config.max_photos) {
      toast.error(`📊 Máximo ${config.max_photos} fotos permitidas para "${selectedCategory}"`)
      return
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('📏 Archivo muy grande - máximo 10MB permitido')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('📷 Solo se permiten archivos de imagen')
      return
    }

    setUploading(true)
    const originalSize = file.size
    
    try {
      // Enhanced photo service call with progress tracking
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
      
      const compressedSize = result.compressedSize || originalSize
      const compressionRatio = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0
      
      const newEvidence: SmartEvidence = {
        id: `evidence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        section_id: sectionId,
        category: selectedCategory,
        description: currentDescription || config.descriptions?.[selectedCategory] || '',
        photo_url: result.url || result.preview,
        preview: result.preview,
        sequence_order: evidences.filter(e => e.category === selectedCategory).length + 1,
        status: result.status,
        photoId: result.id,
        file,
        originalSize,
        compressedSize,
        compressionRatio,
        timestamp: Date.now()
      }
      
      setEvidences(prev => [...prev, newEvidence])
      setCurrentDescription('')
      
      // Enhanced feedback with compression info
      const compressionText = compressionRatio > 0 ? ` (${compressionRatio}% compresión)` : ''
      
      if (isOnline) {
        toast.success(`✅ Evidencia guardada - subiendo en segundo plano${compressionText}`, {
          description: "La evidencia se está subiendo automáticamente"
        })
      } else {
        toast.info(`💾 Evidencia guardada sin conexión${compressionText}`, {
          description: "Se subirá automáticamente cuando vuelva la conexión"
        })
      }
      
    } catch (error) {
      console.error('Error storing evidence photo:', error)
      toast.error("❌ Error al procesar la evidencia", {
        description: error instanceof Error ? error.message : "Error desconocido"
      })
    } finally {
      setUploading(false)
    }
  }

  // Enhanced evidence removal with cleanup
  const removeEvidence = async (evidenceId: string) => {
    const evidence = evidences.find(e => e.id === evidenceId)
    
    if (evidence?.photoId && photoService) {
      try {
        await photoService.deletePhoto(evidence.photoId)
        console.log(`🗑️ Deleted photo ${evidence.photoId} from storage`)
      } catch (error) {
        console.error('Error deleting photo from storage:', error)
      }
    }
    
    setEvidences(prev => prev.filter(e => e.id !== evidenceId))
    toast.success('🗑️ Evidencia eliminada', {
      description: 'La evidencia y sus archivos han sido eliminados'
    })
  }

  // Enhanced image viewing
  const viewImage = (evidence: SmartEvidence) => {
    // Use preview if available and main URL if uploaded
    const imageUrl = evidence.status === 'uploaded' && evidence.photo_url.startsWith('http') 
      ? evidence.photo_url 
      : evidence.preview || evidence.photo_url
      
    if (imageUrl) {
      window.open(imageUrl, '_blank')
    } else {
      toast.error('Imagen no disponible')
    }
  }

  // Enhanced retry functionality
  const retryUpload = async (evidenceId?: string) => {
    if (!photoService) return
    
    try {
      if (evidenceId) {
        // Retry specific evidence
        const evidence = evidences.find(e => e.id === evidenceId)
        if (evidence?.photoId) {
          await photoService.retrySpecificUpload(evidence.photoId)
          toast.info(`🔄 Reintentando subida de evidencia específica...`)
        }
      } else {
        // Retry all failed uploads
        await photoService.retryFailedUploads()
        toast.info("🔄 Reintentando todas las subidas fallidas...")
      }
    } catch (error) {
      console.error('Error retrying uploads:', error)
      toast.error("❌ Error al reintentar subida")
    }
  }

  // Get comprehensive upload statistics
  const getUploadStats = () => {
    const total = evidences.length
    const uploaded = evidences.filter(e => e.status === 'uploaded').length
    const uploading = evidences.filter(e => e.status === 'uploading').length
    const stored = evidences.filter(e => e.status === 'stored').length
    const failed = evidences.filter(e => e.status === 'failed').length
    
    const totalOriginalSize = evidences.reduce((sum, e) => sum + (e.originalSize || 0), 0)
    const totalCompressedSize = evidences.reduce((sum, e) => sum + (e.compressedSize || 0), 0)
    const totalCompressionSaved = totalOriginalSize - totalCompressedSize
    
    return { 
      total, 
      uploaded, 
      uploading, 
      stored, 
      failed,
      totalOriginalSize,
      totalCompressedSize,
      totalCompressionSaved
    }
  }

  const uploadStats = getUploadStats()
  const uploadProgress = uploadStats.total > 0 ? Math.round((uploadStats.uploaded / uploadStats.total) * 100) : 0

  // Enhanced status icon with tooltips
  const getStatusIcon = (evidence: SmartEvidence) => {
    switch (evidence.status) {
      case 'stored':
        return isOnline ? 
          <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> :
          <HardDrive className="h-3 w-3 text-gray-500" />
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

  const { errors, warnings, isValid } = validateRequirements()
  const categoryCount = evidences.filter(e => e.category === selectedCategory).length

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-blue-600" />
          {sectionTitle}
                     <div className="flex items-center gap-1">
             {isOnline ? (
               <Wifi className="h-4 w-4 text-green-500" />
             ) : (
               <WifiOff className="h-4 w-4 text-red-500" />
             )}
             {!serviceReady && (
               <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
             )}
           </div>
        </CardTitle>
        <CardDescription>
          Capture evidencias fotográficas del estado del equipo según las categorías requeridas
          {!isOnline && " (Modo offline - las fotos se subirán automáticamente al volver la conexión)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enhanced upload progress and stats */}
        {evidences.length > 0 && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Estado de Evidencias</h4>
              <div className="flex items-center gap-2 text-xs">
                <span>{uploadStats.uploaded}/{uploadStats.total} subidas</span>
                {uploadStats.stored > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {uploadStats.stored} locales
                  </Badge>
                )}
                {uploadStats.failed > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {uploadStats.failed} fallidas
                  </Badge>
                )}
                {uploadStats.uploading > 0 && (
                  <Badge variant="secondary" className="text-xs animate-pulse">
                    {uploadStats.uploading} subiendo
                  </Badge>
                )}
              </div>
            </div>
            <Progress value={uploadProgress} className="w-full h-2" />
            
            {/* Compression statistics */}
            {uploadStats.totalCompressionSaved > 0 && (
              <div className="text-xs text-green-600 flex items-center gap-1">
                <Download className="h-3 w-3" />
                Ahorro por compresión: {Math.round(uploadStats.totalCompressionSaved / 1024)}KB
              </div>
            )}
            
            {/* Retry all failed uploads button */}
            {uploadStats.failed > 0 && isOnline && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => retryUpload()}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reintentar subidas fallidas
              </Button>
            )}
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
                  className={`relative ${isComplete ? 'border-green-500' : ''}`}
                >
                  {category}
                  <Badge 
                    variant={isComplete ? "default" : "secondary"} 
                    className="ml-2 text-xs"
                  >
                    {categoryEvidences.length}
                  </Badge>
                  {isComplete && (
                    <CheckCircle className="h-3 w-3 text-green-500 absolute -top-1 -right-1 bg-white rounded-full" />
                  )}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Description input */}
        {selectedCategory && (
          <div className="space-y-2">
            <Label htmlFor="evidence-description">
              Descripción para "{selectedCategory}" (opcional)
            </Label>
            <Textarea
              id="evidence-description"
              placeholder={`Describa el estado observado en "${selectedCategory}"`}
              value={currentDescription}
              onChange={(e) => setCurrentDescription(e.target.value)}
              disabled={disabled}
              rows={2}
            />
          </div>
        )}

        {/* Photo upload section */}
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
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
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
                      {uploading ? 'Procesando y comprimiendo...' : 'Tomar foto o seleccionar archivo'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Categoría: {selectedCategory}</div>
                    <div>Máximo 10MB • Se comprimirá automáticamente</div>
                    {!isOnline && (
                      <div className="flex items-center gap-1 text-orange-600">
                        <HardDrive className="h-3 w-3" />
                        Sin conexión - se guardará localmente
                      </div>
                    )}
                    {!serviceReady && (
                      <div className="flex items-center gap-1 text-blue-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Inicializando servicio de fotos...
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
                  disabled={disabled || uploading || !serviceReady}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handlePhotoUpload(e.target.files[0])
                      e.target.value = '' // Reset input
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

        {/* Enhanced evidence gallery with comprehensive status information */}
        {evidences.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Evidencias Capturadas</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {evidences.map(evidence => (
                <div 
                  key={evidence.id} 
                  className="relative group border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square relative">
                    <img
                      src={evidence.preview || evidence.photo_url}
                      alt={`Evidencia ${evidence.category}`}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Status and action overlay */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      {getStatusIcon(evidence)}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => viewImage(evidence)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      {evidence.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => retryUpload(evidence.id)}
                          disabled={!isOnline}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeEvidence(evidence.id)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Status overlay at bottom */}
                    {evidence.status !== 'uploaded' && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                        {evidence.status === 'stored' && !isOnline && 'Guardado offline'}
                        {evidence.status === 'stored' && isOnline && 'En cola'}
                        {evidence.status === 'uploading' && 'Subiendo...'}
                        {evidence.status === 'failed' && `Error: ${evidence.error || 'Fallo de subida'}`}
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced evidence info */}
                  <div className="p-2 text-xs space-y-1">
                    <div className="font-medium text-gray-700">
                      {evidence.category}
                    </div>
                    {evidence.description && (
                      <div className="text-gray-500 line-clamp-2">
                        {evidence.description}
                      </div>
                    )}
                    {evidence.compressionRatio && evidence.compressionRatio > 0 && (
                      <div className="text-green-600 flex items-center gap-1">
                        <Download className="h-2 w-2" />
                        {evidence.compressionRatio}% compresión
                      </div>
                    )}
                    {evidence.timestamp && (
                      <div className="text-gray-400">
                        {new Date(evidence.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation feedback */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {errors.map((error, index) => (
                  <div key={index}>• {error}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {warnings.map((warning, index) => (
                  <div key={index}>• {warning}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Success feedback */}
        {isValid && evidences.length > 0 && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              ✅ Todos los requisitos de evidencia han sido cumplidos
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
} 