"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  Settings,
  Target,
  ExternalLink,
  Building,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Database,
  Info,
  Zap,
  MapPin
} from "lucide-react"
import { AssetMapper } from '../migration/AssetMapper'
import { useDieselStore, useDieselProcessingStatus } from '@/store/diesel-store'

interface MappingTabProps {
  onBackToImport?: () => void
  onProceedToProcessing?: () => void
}

export function MappingTab({ onBackToImport, onProceedToProcessing }: MappingTabProps) {
  const {
    parsedData,
    currentBatch,
    pendingMappings,
    mappingProgress,
    errors
  } = useDieselStore()
  
  const { status, step, progress } = useDieselProcessingStatus()
  
  const [showInstructions, setShowInstructions] = useState(true)

  // Calculate mapping statistics
  const mappingStats = {
    totalAssets: new Set(parsedData.map(row => row.unidad).filter(Boolean)).size,
    mappedAssets: pendingMappings.size,
    unmappedAssets: new Set(parsedData.map(row => row.unidad).filter(Boolean)).size - pendingMappings.size,
    progress: mappingProgress
  }

  // Asset category breakdown
  const categoryBreakdown = Array.from(pendingMappings.values()).reduce((acc, mapping) => {
    acc[mapping.asset_category] = (acc[mapping.asset_category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (parsedData.length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No hay datos para mapear</AlertTitle>
          <AlertDescription>
            Primero necesitas subir y procesar un archivo Excel en la pestaña de Importar.
          </AlertDescription>
        </Alert>
        
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <Button variant="outline" onClick={onBackToImport}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Importar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header and Instructions */}
      {showInstructions && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Mapeo de Activos</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>
              Este paso te permite mapear los nombres de activos del sistema legacy a tu sistema actual.
              Puedes categorizar cada activo como:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm mt-2">
              <li><strong>Formal:</strong> Mapear a un activo existente en el sistema</li>
              <li><strong>Excepción:</strong> Crear una entrada para equipos externos (socios, rentados, etc.)</li>
              <li><strong>General:</strong> Marcar como consumo general de la planta</li>
              <li><strong>Ignorar:</strong> No procesar estos registros</li>
            </ul>
            <div className="flex justify-end mt-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowInstructions(false)}
              >
                Entendido
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Current Batch Information */}
      {currentBatch && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Lote Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Archivo</div>
                <div className="font-medium">{currentBatch.original_filename}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Registros</div>
                <div className="font-medium">{currentBatch.total_rows}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Activos Únicos</div>
                <div className="font-medium">{mappingStats.totalAssets}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Estado</div>
                <Badge 
                  variant={
                    currentBatch.status === 'completed' ? 'default' :
                    currentBatch.status === 'uploading' ? 'secondary' :
                    'outline'
                  }
                >
                  {currentBatch.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapping Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{mappingStats.totalAssets}</div>
                <div className="text-xs text-muted-foreground">Total Activos</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{mappingStats.mappedAssets}</div>
                <div className="text-xs text-muted-foreground">Mapeados</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">{mappingStats.unmappedAssets}</div>
                <div className="text-xs text-muted-foreground">Pendientes</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">{Math.round(mappingStats.progress)}%</div>
                <div className="text-xs text-muted-foreground">Completado</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {Object.keys(categoryBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Categorías</CardTitle>
            <CardDescription>
              Cómo se han categorizado los activos mapeados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: 'formal', label: 'Formales', icon: Target, color: 'text-green-600' },
                { key: 'exception', label: 'Excepciones', icon: ExternalLink, color: 'text-blue-600' },
                { key: 'general', label: 'Generales', icon: Building, color: 'text-purple-600' }
              ].map(({ key, label, icon: Icon, color }) => {
                const count = categoryBreakdown[key] || 0
                return (
                  <div key={key} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <div>
                      <div className="text-lg font-semibold">{count}</div>
                      <div className="text-sm text-muted-foreground">{label}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progreso del Mapeo</span>
              <span>{Math.round(mappingStats.progress)}% completado</span>
            </div>
            <Progress value={mappingStats.progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Processing Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Errores de Procesamiento ({errors.filter(e => !e.resolved).length})</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {errors.filter(e => !e.resolved).slice(0, 3).map((error, index) => (
                <div key={error.id} className="text-sm">
                  • {error.error_message}
                </div>
              ))}
              {errors.filter(e => !e.resolved).length > 3 && (
                <div className="text-sm text-muted-foreground">
                  ... y {errors.filter(e => !e.resolved).length - 3} errores más
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      {/* Main Asset Mapper Component */}
      <AssetMapper
        onMappingComplete={() => {
          console.log('Mapping completed, ready to proceed')
        }}
        onProceedToProcessing={onProceedToProcessing}
      />

      {/* Navigation Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onBackToImport}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Importar
            </Button>
            
            <div className="flex gap-2">
              {mappingStats.progress < 100 && (
                <Badge variant="outline" className="px-3 py-1">
                  {mappingStats.unmappedAssets} activos pendientes
                </Badge>
              )}
              
              <Button 
                onClick={onProceedToProcessing}
                disabled={mappingStats.mappedAssets === 0}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Continuar a Procesamiento
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Development Info */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground space-y-2">
              <div><strong>Debug - Mapping State:</strong></div>
              <div>Total assets: {mappingStats.totalAssets}</div>
              <div>Mapped: {mappingStats.mappedAssets}</div>
              <div>Pending mappings size: {pendingMappings.size}</div>
              <div>Progress: {mappingStats.progress.toFixed(1)}%</div>
              <div>Status: {status}</div>
              <div>Current step: {step}</div>
              <div>Overall progress: {progress}%</div>
              <div>Errors: {errors.filter(e => !e.resolved).length} unresolved</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}




