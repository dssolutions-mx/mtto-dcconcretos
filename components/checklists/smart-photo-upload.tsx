"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Camera, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Loader2,
  WifiOff,
  Wifi
} from "lucide-react"
import { toast } from "sonner"

interface PhotoUploadResult {
  id: string
  preview: string
  status: 'stored' | 'uploading' | 'uploaded' | 'failed'
  progress?: number
  error?: string
  url?: string
}

interface SmartPhotoUploadProps {
  checklistId: string
  itemId: string
  currentPhotoUrl?: string | null
  onPhotoChange: (url: string | null, photoId?: string) => void
  disabled?: boolean
  category?: string
  className?: string
}

export function SmartPhotoUpload({
  checklistId,
  itemId,
  currentPhotoUrl,
  onPhotoChange,
  disabled = false,
  category,
  className
}: SmartPhotoUploadProps) {
  const [photo, setPhoto] = useState<PhotoUploadResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true)
  
  // Dynamic import of photo service to avoid SSR issues
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
      
      if (photo && photo.id === photoId) {
        setPhoto(prev => prev ? {
          ...prev,
          status: status as any,
          url: url || prev.url,
          error: error
        } : null)
        
        if (status === 'uploaded' && url) {
          onPhotoChange(url, photoId)
          toast.success("Foto subida exitosamente")
        } else if (status === 'failed') {
          toast.error(`Error al subir foto: ${error}`)
        }
      }
    }
    
    window.addEventListener('photo-upload-status', handleUploadStatus as EventListener)
    
    return () => {
      window.removeEventListener('photo-upload-status', handleUploadStatus as EventListener)
    }
  }, [photo, onPhotoChange])

  // Load existing photo if currentPhotoUrl is provided
  useEffect(() => {
    if (currentPhotoUrl && !photo) {
      setPhoto({
        id: `existing_${itemId}`,
        preview: currentPhotoUrl,
        status: 'uploaded',
        url: currentPhotoUrl
      })
    }
  }, [currentPhotoUrl, itemId, photo])

  const handlePhotoUpload = async (file: File) => {
    if (!photoService || disabled) return
    
    setUploading(true)
    
    try {
      // Store photo immediately with preview
      const result = await photoService.storePhoto(
        checklistId,
        itemId,
        file,
        {
          quality: 0.8,
          maxWidth: 1920,
          maxHeight: 1080,
          immediate: true, // Start upload immediately if online
          category
        }
      )
      
      setPhoto(result)
      
      // If we got an immediate upload URL, update parent
      if (result.url) {
        onPhotoChange(result.url, result.id)
      }
      
      // Show appropriate feedback
      if (isOnline) {
        toast.success("Foto guardada - subiendo en segundo plano", {
          description: "La foto se está subiendo automáticamente"
        })
      } else {
        toast.info("Foto guardada sin conexión", {
          description: "Se subirá automáticamente cuando vuelva la conexión"
        })
      }
      
    } catch (error) {
      console.error('Error storing photo:', error)
      toast.error("Error al procesar la foto")
    } finally {
      setUploading(false)
    }
  }

  const handleRetryUpload = async () => {
    if (!photoService || !photo) return
    
    try {
      await photoService.retryFailedUploads()
      toast.info("Reintentando subida...")
    } catch (error) {
      toast.error("Error al reintentar subida")
    }
  }

  const handleRemovePhoto = async () => {
    if (!photo) return
    
    if (photoService && photo.id.startsWith('photo_')) {
      await photoService.deletePhoto(photo.id)
    }
    
    setPhoto(null)
    onPhotoChange(null)
    toast.success("Foto eliminada")
  }

  const getStatusIcon = () => {
    if (!photo) return null
    
    switch (photo.status) {
      case 'stored':
        return isOnline ? 
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> :
          <WifiOff className="h-4 w-4 text-gray-500" />
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'uploaded':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusBadge = () => {
    if (!photo) return null
    
    switch (photo.status) {
      case 'stored':
        return (
          <Badge variant="secondary" className="text-xs">
            {isOnline ? 'En cola' : 'Sin conexión'}
          </Badge>
        )
      case 'uploading':
        return <Badge variant="secondary" className="text-xs">Subiendo...</Badge>
      case 'uploaded':
        return <Badge variant="default" className="text-xs bg-green-500">Subida</Badge>
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Error</Badge>
      default:
        return null
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <Label>Fotografía</Label>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <WifiOff className="h-4 w-4 text-gray-500" />
          )}
          {getStatusBadge()}
        </div>
      </div>

      {photo ? (
        <div className="space-y-3">
          {/* Photo preview */}
          <div className="relative">
            <img
              src={photo.preview || photo.url}
              alt="Foto capturada"
              className="w-full h-48 object-cover rounded-md border"
            />
            <div className="absolute top-2 right-2 flex gap-1">
              {getStatusIcon()}
              <Button
                variant="destructive"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleRemovePhoto}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Status information */}
          {photo.status === 'failed' && photo.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">Error: {photo.error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryUpload}
                  disabled={!isOnline}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {photo.status === 'stored' && !isOnline && (
            <Alert>
              <WifiOff className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Foto guardada localmente. Se subirá automáticamente cuando vuelva la conexión.
              </AlertDescription>
            </Alert>
          )}

          {photo.status === 'uploading' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription className="text-sm">
                Subiendo foto en segundo plano...
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Label
            htmlFor={`photo-upload-${itemId}`}
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
            {!isOnline && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Sin conexión - se guardará localmente
              </span>
            )}
          </Label>
          <input
            id={`photo-upload-${itemId}`}
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
      )}
    </div>
  )
} 