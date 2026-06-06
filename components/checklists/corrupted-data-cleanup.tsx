"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Trash2, AlertTriangle, RefreshCw } from "lucide-react"
import { toast } from "sonner"

// Global function for console access
if (typeof window !== 'undefined') {
  (window as any).cleanCorruptedData = async () => {
    try {
      const { offlineClient } = await import('@/lib/offline/offline-client')
      const result = await offlineClient.cleanCorruptedData()
      console.log('🧹 Manual cleanup completed:', result)
      return result
    } catch (error) {
      console.error('❌ Manual cleanup failed:', error)
      return { indexedDB: 0, localStorage: 0 }
    }
  }
}

interface CorruptedDataCleanupProps {
  variant?: "destructive" | "outline" | "secondary" | "ghost"
  size?: "sm" | "default" | "lg"
  showText?: boolean
}

export function CorruptedDataCleanup({ 
  variant = "outline", 
  size = "sm", 
  showText = true 
}: CorruptedDataCleanupProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [lastCleanup, setLastCleanup] = useState<{ indexedDB: number, localStorage: number } | null>(null)

  const handleCleanup = async () => {
    setCleaning(true)
    
    try {
      // Import the offline client dynamically
      const { offlineClient } = await import('@/lib/offline/offline-client')

      // Clean corrupted data
      const result = await offlineClient.cleanCorruptedData()
      
      setLastCleanup(result)
      
      const totalCleaned = result.indexedDB + result.localStorage
      
      if (totalCleaned > 0) {
        toast.success(`🧹 Limpieza completada`, {
          description: `Se eliminaron ${totalCleaned} elementos corruptos (${result.indexedDB} IndexedDB, ${result.localStorage} localStorage)`,
          duration: 5000
        })
      } else {
        toast.info("✨ No se encontraron datos corruptos", {
          description: "El cache está limpio",
          duration: 3000
        })
      }
      
      setIsOpen(false)
      
      // Reload the page after cleanup to refresh the state
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
    } catch (error) {
      console.error('Error during cleanup:', error)
      toast.error("Error durante la limpieza", {
        description: "Por favor intente nuevamente",
        duration: 5000
      })
    } finally {
      setCleaning(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} className="gap-2">
          <Trash2 className="h-4 w-4" />
          {showText && "Limpiar Datos Corruptos"}
          {lastCleanup && (
            <Badge variant="secondary" className="ml-1">
              {lastCleanup.indexedDB + lastCleanup.localStorage}
            </Badge>
          )}
        </Button>
      </AlertDialogTrigger>
      
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Limpiar Datos Corruptos
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Esta acción eliminará datos corruptos del almacenamiento local que pueden estar causando errores de sincronización.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
              <strong>Se eliminarán:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Checklists offline con datos inválidos</li>
                <li>Órdenes de trabajo offline corruptas</li>
                <li>Fotos huérfanas sin referencia</li>
                <li>Datos JSON corruptos en localStorage</li>
              </ul>
            </div>
            <p className="text-amber-700">
              <strong>Nota:</strong> La página se recargará automáticamente después de la limpieza.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cleaning}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleCleanup}
            disabled={cleaning}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {cleaning ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Limpiando...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Limpiar Cache
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
} 