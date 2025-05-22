'use client'

import type { Metadata } from "next"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { use } from "react"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function DeleteEquipmentModelPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  
  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)
    
    try {
      const supabase = createClient()
      
      // First, check if this model is used by any assets
      const { data: assets, error: assetsError } = await supabase
        .from('assets')
        .select('id')
        .eq('model_id', id)
        .limit(1)
        
      if (assetsError) throw assetsError
      
      if (assets && assets.length > 0) {
        throw new Error("No se puede eliminar este modelo porque está siendo usado por equipos existentes")
      }
      
      // If not used by assets, delete all maintenance intervals related to this model
      const { error: intervalsError } = await supabase
        .from('maintenance_intervals')
        .delete()
        .eq('model_id', id)
        
      if (intervalsError) throw intervalsError
      
      // Finally, delete the model
      const { error: deleteError } = await supabase
        .from('equipment_models')
        .delete()
        .eq('id', id)
        
      if (deleteError) throw deleteError
      
      // Redirect to models list
      router.push('/modelos')
      
    } catch (err: any) {
      console.error("Error deleting model:", err)
      setError(err.message || 'Error al eliminar el modelo')
      setIsDeleting(false)
    }
  }
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Eliminar Modelo de Equipo"
        text="Eliminar permanentemente este modelo de equipo y todos sus datos asociados."
      >
        <Button variant="outline" asChild>
          <Link href={`/modelos/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Confirmar eliminación</CardTitle>
          <CardDescription>
            Esta acción no se puede deshacer. Esto eliminará permanentemente el modelo de equipo 
            y todos sus datos asociados, incluyendo intervalos de mantenimiento y tareas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Advertencia</AlertTitle>
            <AlertDescription>
              No se puede eliminar un modelo si está siendo utilizado por equipos existentes.
              Primero debe cambiar el modelo de esos equipos o eliminarlos.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href={`/modelos/${id}`}>
              Cancelar
            </Link>
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Eliminando..." : "Eliminar permanentemente"}
          </Button>
        </CardFooter>
      </Card>
    </DashboardShell>
  )
} 