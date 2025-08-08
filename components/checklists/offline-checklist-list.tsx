"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Clock, WifiOff, CheckCircle } from "lucide-react"
import Link from "next/link"

// Importación dinámica del servicio offline
let offlineChecklistService: any = null

interface OfflineChecklistItem {
  id: string
  template: any
  asset: any
  lastUpdated: number
  isRecent: boolean
}

interface OfflineChecklistListProps {
  className?: string
}

export function OfflineChecklistList({ className = "" }: OfflineChecklistListProps) {
  const [availableChecklists, setAvailableChecklists] = useState<OfflineChecklistItem[]>([])
  const [loading, setLoading] = useState(true)

  // Inicializar servicio offline
  useEffect(() => {
    if (typeof window !== 'undefined' && !offlineChecklistService) {
      import('@/lib/services/offline-checklist-service').then(module => {
        offlineChecklistService = module.offlineChecklistService
        loadAvailableChecklists()
      })
    }
  }, [])

  const loadAvailableChecklists = async () => {
    if (!offlineChecklistService) return

    try {
      setLoading(true)
      const available = await offlineChecklistService.getAvailableOfflineChecklists()
      
      // Filtrar solo los que tienen datos válidos
      const validChecklists = available.filter((item: OfflineChecklistItem) => 
        item.template && 
        item.template.checklists && 
        item.template.status === 'pendiente'
      )

      setAvailableChecklists(validChecklists)
    } catch (error) {
      console.error('Error loading available offline checklists:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatLastUpdate = (timestamp: number) => {
    const now = new Date()
    const updated = new Date(timestamp)
    const diffHours = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 1) return "Hace menos de 1 hora"
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`
    
    const diffDays = Math.floor(diffHours / 24)
    return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOff className="h-5 w-5" />
            Checklists Disponibles Offline
          </CardTitle>
          <CardDescription>
            Cargando checklists disponibles...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (availableChecklists.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOff className="h-5 w-5" />
            Checklists Disponibles Offline
          </CardTitle>
          <CardDescription>
            No hay checklists disponibles para ejecutar sin conexión
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium mb-2">Sin checklists offline</p>
            <p className="text-sm text-muted-foreground mb-4">
              Para trabajar sin conexión, necesitas abrir los checklists mientras tienes internet.
            </p>
            <p className="text-xs text-muted-foreground">
              Cuando vuelva la conexión, visita la página de checklists para preparar el modo offline.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WifiOff className="h-5 w-5" />
          Checklists Disponibles Offline
          <Badge variant="secondary">{availableChecklists.length}</Badge>
        </CardTitle>
        <CardDescription>
          Checklists que puedes ejecutar sin conexión a internet
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {availableChecklists.map((item) => {
            const checklist = item.template
            const asset = item.asset
            
            return (
              <Link 
                key={item.id} 
                href={`/checklists/ejecutar/${item.id}`}
                className="block"
              >
                <Card className="hover:bg-muted/50 transition-colors border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">
                            {checklist.checklists?.name || 'Checklist sin nombre'}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            {checklist.checklists?.frequency || 'N/A'}
                          </Badge>
                          {item.isRecent && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Reciente
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1 mb-3">
                          <p className="text-sm font-medium text-blue-700">
                            🚛 {asset?.name || 'Sin activo asignado'}
                          </p>
                          {asset?.asset_id && (
                            <p className="text-xs text-muted-foreground">
                              ID: {asset.asset_id}
                              {((asset as any).plants?.name || asset.location) && ` • 📍 ${(asset as any).plants?.name || asset.location}`}
                            </p>
                          )}
                          {checklist.scheduled_date && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Programado: {new Date((checklist as any).scheduled_day || checklist.scheduled_date).toLocaleDateString('es')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Descargado: {formatLastUpdate(item.lastUpdated)}</span>
                          {!item.isRecent && (
                            <Badge variant="outline" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Datos antiguos
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <Button size="sm" className="ml-4">
                        Ejecutar Offline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800 mb-2">
            <strong>💡 Consejo:</strong> Para tener más checklists disponibles offline:
          </p>
          <ul className="text-xs text-blue-700 space-y-1 ml-4">
            <li>• Abre los checklists que necesites mientras tienes internet</li>
            <li>• Usa el botón "Preparar Offline" en la página principal</li>
            <li>• Los checklists se sincronizan automáticamente cuando vuelve la conexión</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
} 