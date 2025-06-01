"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Trash2, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function MaintenanceCleanupButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  const handleCleanup = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/checklists/cleanup-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al limpiar datos')
      }

      toast({
        title: "Limpieza completada",
        description: result.message || `Se limpiaron exitosamente los datos duplicados`,
        variant: "default",
      })

      setIsOpen(false)
    } catch (error: any) {
      console.error('Error during cleanup:', error)
      toast({
        title: "Error en la limpieza",
        description: error.message || "Ocurrió un error al limpiar los datos duplicados",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="text-orange-600 border-orange-200 hover:bg-orange-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Limpiar Duplicados
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Limpiar Datos Duplicados</DialogTitle>
          <DialogDescription>
            Esta acción eliminará checklists programados duplicados y datos de mantenimiento redundantes.
            <br />
            <strong>Nota:</strong> No se eliminarán checklists ya completados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleCleanup}
            disabled={isLoading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Limpiando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar Ahora
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 