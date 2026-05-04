"use client"

import { useState, useEffect, useRef, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Camera,
  Images,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  WifiOff,
} from "lucide-react"
import { toast } from "sonner"
import type { DieselEvidenceImageMetadata } from "@/lib/photos/diesel-evidence-image-metadata"

interface PhotoUploadResult {
  id: string
  preview: string
  status: 'stored' | 'uploading' | 'uploaded' | 'failed'
  progress?: number
  error?: string
  url?: string
  evidenceImageMetadata?: DieselEvidenceImageMetadata | null
}

interface SmartPhotoUploadProps {
  checklistId: string
  itemId: string
  currentPhotoUrl?: string | null
  onPhotoChange: (
    url: string | null,
    photoId?: string,
    evidenceImageMetadata?: DieselEvidenceImageMetadata | null
  ) => void
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
  
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

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
      const { photoId, status, url, error, evidenceImageMetadata } = event.detail
      
      if (photo && photo.id === photoId) {
        setPhoto(prev => prev ? {
          ...prev,
          status: status as any,
          url: url || prev.url,
          error: error,
          evidenceImageMetadata: evidenceImageMetadata ?? prev.evidenceImageMetadata
        } : null)
        
        if (status === 'uploaded' && url) {
          onPhotoChange(url, photoId, evidenceImageMetadata ?? null)
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

  const handlePhotoUpload = async (file: File, captureSource: "camera" | "gallery") => {
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
          category,
          captureSource,
        }
      )
      
      setPhoto(result)
      
      // If we got an immediate upload URL, update parent
      if (result.url) {
        onPhotoChange(result.url, result.id, result.evidenceImageMetadata ?? null)
      }
      
      // Show appropriate feedback
      if (isOnline) {
        toast.success("Foto guardada - subiendo en segundo plano", {
          description: "La foto se est? subiendo autom?ticamente"
        })
      } else {
        toast.info("Foto guardada sin conexi?n", {
          description: "Se subir? autom?ticamente cuando vuelva la conexi?n"
        })
      }
      
    } catch (error) {
      console.error('Error storing photo:', error)
      toast.error("Error al procesar la foto")
    } finally {
      setUploading(false)
    }
  }

  const handleCameraFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void handlePhotoUpload(file, "camera")
    }
    e.target.value = ""
  }

  const handleGalleryFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void handlePhotoUpload(file, "gallery")
    }
    e.target.value = ""
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
    onPhotoChange(null, undefined, null)
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
            {isOnline ? 'En cola' : 'Sin conexi?n'}
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
        <Label>Fotograf?a</Label>
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
                Foto guardada localmente. Se subir? autom?ticamente cuando vuelva la conexi?n.
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
        <div className="space-y-3 rounded-lg border-2 border-dashed border-gray-300 p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="default"
              className="min-h-[52px] w-full gap-2"
              disabled={disabled || uploading}
              onClick={() => cameraInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              ) : (
                <Camera className="h-5 w-5 shrink-0" />
              )}
              Tomar foto
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[52px] w-full gap-2"
              disabled={disabled || uploading}
              onClick={() => galleryInputRef.current?.click()}
            >
              <Images className="h-5 w-5 shrink-0" />
              Galer?a
            </Button>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            disabled={disabled || uploading}
            onChange={handleCameraFileChange}
          />
          <input
            ref={galleryInputRef}
            id={`photo-gallery-${itemId}`}
            type="file"
            accept="image/*"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            disabled={disabled || uploading}
            onChange={handleGalleryFileChange}
          />
          {!isOnline && (
            <p className="flex items-center justify-center gap-1 text-center text-xs text-gray-500">
              <WifiOff className="h-3 w-3 shrink-0" />
              Sin conexi?n - se guardar? localmente
            </p>
          )}
        </div>
      )}
    </div>
  )
} 