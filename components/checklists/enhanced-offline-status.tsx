"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  Upload,
  Clock
} from "lucide-react"
import { toast } from "sonner"

interface PhotoStats {
  total: number
  uploaded: number
  pending: number
  failed: number
  totalSize: number
  compressedSize: number
}

interface EnhancedOfflineStatusProps {
  showDetails?: boolean
  className?: string
}

export function EnhancedOfflineStatus({ 
  showDetails = false, 
  className 
}: EnhancedOfflineStatusProps) {
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true)
  const [photoStats, setPhotoStats] = useState<PhotoStats>({
    total: 0,
    uploaded: 0,
    pending: 0,
    failed: 0,
    totalSize: 0,
    compressedSize: 0
  })
  const [photoService, setPhotoService] = useState<any>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  // Initialize photo service
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
    
    const handleOnline = () => {
      setIsOnline(true)
      toast.info("Conexión restablecida", {
        description: "Sincronizando datos pendientes..."
      })
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      toast.warning("Sin conexión", {
        description: "Los datos se guardarán localmente"
      })
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Listen for photo upload events
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handlePhotoEvent = (event: CustomEvent) => {
      const { status } = event.detail
      
      if (status === 'uploaded' || status === 'failed') {
        updatePhotoStats()
        if (status === 'uploaded') {
          setLastSync(new Date())
        }
      }
    }
    
    window.addEventListener('photo-upload-status', handlePhotoEvent as EventListener)
    
    return () => {
      window.removeEventListener('photo-upload-status', handlePhotoEvent as EventListener)
    }
  }, [])

  // Update photo statistics
  const updatePhotoStats = async () => {
    if (photoService) {
      try {
        const stats = await photoService.getUploadStats()
        setPhotoStats(stats)
      } catch (error) {
        console.error('Error getting photo stats:', error)
      }
    }
  }

  // Update stats periodically
  useEffect(() => {
    if (photoService) {
      updatePhotoStats()
      
      const interval = setInterval(updatePhotoStats, 10000) // Every 10 seconds
      return () => clearInterval(interval)
    }
  }, [photoService])

  const handleRetryUploads = async () => {
    if (!photoService) return
    
    try {
      await photoService.retryFailedUploads()
      toast.info("Reintentando subidas fallidas...")
      setTimeout(updatePhotoStats, 2000)
    } catch (error) {
      toast.error("Error al reintentar subidas")
    }
  }

  const getConnectionStatus = () => {
    if (isOnline) {
      return {
        icon: <Wifi className="h-4 w-4 text-green-500" />,
        text: "En línea",
        variant: "default" as const
      }
    } else {
      return {
        icon: <WifiOff className="h-4 w-4 text-red-500" />,
        text: "Sin conexión",
        variant: "destructive" as const
      }
    }
  }

  const getUploadProgress = () => {
    if (photoStats.total === 0) return 0
    return Math.round((photoStats.uploaded / photoStats.total) * 100)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const connectionStatus = getConnectionStatus()
  const uploadProgress = getUploadProgress()
  const hasPendingUploads = photoStats.pending > 0 || photoStats.failed > 0

  if (!showDetails && !hasPendingUploads && isOnline) {
    return null // Don't show anything if everything is fine and details not requested
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Basic status bar */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          {connectionStatus.icon}
          <span className="text-sm font-medium">{connectionStatus.text}</span>
          {lastSync && (
            <span className="text-xs text-muted-foreground">
              Última sync: {lastSync.toLocaleTimeString()}
            </span>
          )}
        </div>
        
        {hasPendingUploads && (
          <Badge variant={photoStats.failed > 0 ? "destructive" : "secondary"}>
            {photoStats.pending > 0 && `${photoStats.pending} pendientes`}
            {photoStats.failed > 0 && ` ${photoStats.failed} fallidas`}
          </Badge>
        )}
      </div>

      {/* Detailed status */}
      {showDetails && photoStats.total > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Estado de Fotos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso de subida</span>
                <span>{photoStats.uploaded}/{photoStats.total} ({uploadProgress}%)</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span>Subidas: {photoStats.uploaded}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-yellow-500" />
                <span>Pendientes: {photoStats.pending}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3 w-3 text-red-500" />
                <span>Fallidas: {photoStats.failed}</span>
              </div>
              <div className="flex items-center gap-2">
                <Upload className="h-3 w-3 text-blue-500" />
                <span>Compresión: {photoStats.totalSize > 0 ? Math.round((1 - photoStats.compressedSize / photoStats.totalSize) * 100) : 0}%</span>
              </div>
            </div>

            {/* Size information */}
            {photoStats.totalSize > 0 && (
              <div className="text-xs text-muted-foreground border-t pt-2">
                <p>Tamaño original: {formatBytes(photoStats.totalSize)}</p>
                <p>Tamaño comprimido: {formatBytes(photoStats.compressedSize)}</p>
                <p>Espacio ahorrado: {formatBytes(photoStats.totalSize - photoStats.compressedSize)}</p>
              </div>
            )}

            {/* Actions */}
            {photoStats.failed > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryUploads}
                className="w-full"
                disabled={!isOnline}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reintentar subidas fallidas
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Offline warning */}
      {!isOnline && (
        <Alert>
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            Modo sin conexión activo. Las fotos se guardan localmente y se subirán automáticamente 
            cuando se restablezca la conexión.
          </AlertDescription>
        </Alert>
      )}

      {/* Upload in progress notification */}
      {isOnline && photoStats.pending > 0 && (
        <Alert>
          <Upload className="h-4 w-4" />
          <AlertDescription>
            Subiendo {photoStats.pending} foto{photoStats.pending > 1 ? 's' : ''} en segundo plano...
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
} 