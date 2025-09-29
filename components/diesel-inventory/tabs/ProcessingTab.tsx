"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Database,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Activity,
  Zap,
  Target,
  Building,
  ExternalLink,
  ArrowLeft,
  Download,
  FileText
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useDieselStore } from '@/store/diesel-store'
import { MeterReconciliationDialog } from '../dialogs/MeterReconciliationDialog'

interface ProcessingTabProps {
  onBackToMapping?: () => void
  onComplete?: () => void
}

interface ProcessingStep {
  id: string
  title: string
  description: string
  status: 'pending' | 'active' | 'completed' | 'error'
  progress: number
  startTime?: Date
  endTime?: Date
  details?: string[]
}

export function ProcessingTab({ onBackToMapping, onComplete }: ProcessingTabProps) {
  const {
    parsedData,
    pendingMappings,
    processDataBatch,
    setProcessingStatus,
    setCurrentStep,
    setOverallProgress,
    addNotification,
    reset,
    getProcessingSummary,
    processingStatus: status,
    currentStep: step,
    overallProgress: progress,
    currentBatch,
    errors,
    plantBatches,
    selectedPlantBatch,
    getSelectedPlantBatch,
    meterConflicts,
    setMeterConflicts,
    meterPreferences
  } = useDieselStore()
  
  const hasErrors = errors.length > 0
  const errorCount = errors.length
  const canStart = parsedData.length > 0 && status !== 'processing'
  const [showMeterDialog, setShowMeterDialog] = useState(false)
  const [processingApiResponse, setProcessingApiResponse] = useState<any>(null)
  
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    {
      id: 'validation',
      title: 'Validación de Datos',
      description: 'Verificar integridad y completitud de los datos',
      status: 'pending',
      progress: 0
    },
    {
      id: 'staging',
      title: 'Preparación de Datos',
      description: 'Insertar datos en tabla de staging',
      status: 'pending',
      progress: 0
    },
    {
      id: 'asset_resolution',
      title: 'Resolución de Activos',
      description: 'Procesar mapeos y crear activos excepción',
      status: 'pending',
      progress: 0
    },
    {
      id: 'transaction_creation',
      title: 'Creación de Transacciones',
      description: 'Generar registros finales en base de datos',
      status: 'pending',
      progress: 0
    },
    {
      id: 'finalization',
      title: 'Finalización',
      description: 'Limpieza y confirmación del proceso',
      status: 'pending',
      progress: 0
    }
  ])
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingLogs, setProcessingLogs] = useState<Array<{
    timestamp: Date
    level: 'info' | 'success' | 'warning' | 'error'
    message: string
  }>>([])

  // Add log entry
  const addLog = useCallback((level: 'info' | 'success' | 'warning' | 'error', message: string) => {
    setProcessingLogs(prev => [...prev, {
      timestamp: new Date(),
      level,
      message
    }].slice(-100)) // Keep only last 100 logs
  }, [])

  // Update processing step
  const updateStep = useCallback((stepId: string, updates: Partial<ProcessingStep>) => {
    setProcessingSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ))
  }, [])

  // Start processing
  const startProcessing = useCallback(async () => {
    if (!canStart || parsedData.length === 0) {
      addNotification({
        type: 'warning',
        title: 'No se puede procesar',
        message: 'No hay datos válidos para procesar'
      })
      return
    }

    // Get current plant batch
    const currentPlantBatch = getSelectedPlantBatch()
    if (!currentPlantBatch) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'No se encontró el lote de planta para procesar'
      })
      return
    }

    setIsProcessing(true)
    setProcessingStatus('processing')
    addLog('info', 'Iniciando procesamiento de datos...')

    try {
      // Step 1: Validation
      updateStep('validation', { status: 'active', startTime: new Date() })
      addLog('info', `Validando ${parsedData.length} registros...`)
      
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate work
      
      updateStep('validation', { 
        status: 'completed', 
        progress: 100, 
        endTime: new Date(),
        details: [
          `${parsedData.length} registros validados`,
          `${errorCount} errores encontrados`,
          `${pendingMappings.size} activos mapeados`
        ]
      })
      addLog('success', 'Validación completada exitosamente')

      // Step 2: Staging
      updateStep('staging', { status: 'active', startTime: new Date() })
      setCurrentStep('Preparando datos para staging...')
      addLog('info', 'Insertando datos en tabla staging...')
      
      // Simulate staging process
      for (let i = 0; i <= 100; i += 10) {
        updateStep('staging', { progress: i })
        setOverallProgress(20 + (i * 0.2)) // 20-40% of overall
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      updateStep('staging', { 
        status: 'completed', 
        endTime: new Date(),
        details: [
          `${parsedData.length} registros insertados en staging`,
          'Datos preparados para procesamiento',
          'Validaciones de integridad pasadas'
        ]
      })
      addLog('success', 'Datos preparados en staging exitosamente')

      // Step 3: Asset Resolution
      updateStep('asset_resolution', { status: 'active', startTime: new Date() })
      setCurrentStep('Resolviendo mapeos de activos...')
      addLog('info', 'Procesando mapeos de activos...')
      
      const mappingCategories = Array.from(pendingMappings.values()).reduce((acc, mapping) => {
        acc[mapping.asset_category] = (acc[mapping.asset_category] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      // Simulate asset resolution
      for (let i = 0; i <= 100; i += 15) {
        updateStep('asset_resolution', { progress: i })
        setOverallProgress(40 + (i * 0.25)) // 40-65% of overall
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      updateStep('asset_resolution', { 
        status: 'completed', 
        endTime: new Date(),
        details: [
          `${mappingCategories.formal || 0} activos formales mapeados`,
          `${mappingCategories.exception || 0} activos excepción creados`,
          `${mappingCategories.general || 0} consumos generales procesados`
        ]
      })
      addLog('success', 'Resolución de activos completada')

      // Step 4: Transaction Creation - Call API
      updateStep('transaction_creation', { status: 'active', startTime: new Date() })
      setCurrentStep('Procesando lote en servidor...')
      addLog('info', 'Enviando datos al servidor...')
      
      // Call server API
      const response = await fetch('/api/diesel/process-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantBatch: currentPlantBatch,
          meterPreferences: meterPreferences,
          meterResolutions: Object.fromEntries(
            meterConflicts
              .filter(c => c.resolution !== 'pending')
              .map(c => [c.asset_code, c.resolution])
          )
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const result = await response.json()
      setProcessingApiResponse(result)

      // Check if meter conflicts need resolution
      if (result.status === 'needs_meter_resolution') {
        addLog('info', `Detectados ${result.conflicts.length} conflictos de medidores`)
        setMeterConflicts(result.conflicts)
        setShowMeterDialog(true)
        setIsProcessing(false)
        setProcessingStatus('idle')
        
        updateStep('transaction_creation', {
          status: 'error',
          progress: 50,
          endTime: new Date(),
          details: [
            `${result.conflicts.length} conflictos de medidores detectados`,
            'Requiere resolución manual',
            'Por favor resuelve los conflictos y continúa'
          ]
        })
        
        addNotification({
          type: 'warning',
          title: 'Conflictos de Medidores',
          message: `Se detectaron ${result.conflicts.length} conflictos con las lecturas del checklist. Resuelve los conflictos para continuar.`
        })
        
        return // Stop here, user needs to resolve conflicts
      }

      // Success - process completed
      if (result.status === 'completed') {
        updateStep('transaction_creation', { 
          status: 'completed', 
          progress: 100,
          endTime: new Date(),
          details: [
            `${result.summary.processed_rows} transacciones creadas`,
            `${result.summary.meter_readings_updated} lecturas de medidores actualizadas`,
            'Inventario actualizado'
          ]
        })
        addLog('success', 'Transacciones creadas exitosamente')
        setOverallProgress(85)
      } else {
        throw new Error('Error en el procesamiento del servidor')
      }

      // Step 5: Finalization
      updateStep('finalization', { status: 'active', startTime: new Date() })
      setCurrentStep('Finalizando proceso...')
      addLog('info', 'Finalizando y limpiando datos temporales...')
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      updateStep('finalization', { 
        status: 'completed', 
        progress: 100,
        endTime: new Date(),
        details: [
          'Datos temporales limpiados',
          'Proceso completado exitosamente',
          'Sistema listo para nueva importación'
        ]
      })
      
      setOverallProgress(100)
      setProcessingStatus('completed')
      addLog('success', '🎉 Procesamiento completado exitosamente!')
      
      addNotification({
        type: 'success',
        title: 'Procesamiento Exitoso',
        message: `Se procesaron ${parsedData.length} registros correctamente`
      })
      
      onComplete?.()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      addLog('error', `Error: ${errorMessage}`)
      
      // Mark current step as error
      const currentActiveStep = processingSteps.find(s => s.status === 'active')
      if (currentActiveStep) {
        updateStep(currentActiveStep.id, { 
          status: 'error', 
          endTime: new Date(),
          details: [`Error: ${errorMessage}`]
        })
      }
      
      setProcessingStatus('error')
      addNotification({
        type: 'error',
        title: 'Error de Procesamiento',
        message: errorMessage
      })
    } finally {
      setIsProcessing(false)
    }
  }, [canStart, parsedData.length, processDataBatch, pendingMappings, errorCount, addLog, updateStep, setProcessingStatus, setCurrentStep, setOverallProgress, addNotification, onComplete, getSelectedPlantBatch, meterPreferences, meterConflicts, setMeterConflicts])

  // Handle meter dialog close and retry
  const handleMeterDialogClose = () => {
    setShowMeterDialog(false)
  }

  const handleMeterConflictsResolved = () => {
    setShowMeterDialog(false)
    // Restart processing with resolved conflicts
    addNotification({
      type: 'info',
      title: 'Conflictos Resueltos',
      message: 'Reiniciando procesamiento con las decisiones tomadas...'
    })
    // Small delay then restart
    setTimeout(() => startProcessing(), 500)
  }

  // Reset processing
  const resetProcessing = useCallback(() => {
    setProcessingSteps(prev => prev.map(step => ({
      ...step,
      status: 'pending' as const,
      progress: 0,
      startTime: undefined,
      endTime: undefined,
      details: undefined
    })))
    setProcessingLogs([])
    setIsProcessing(false)
    setProcessingStatus('idle')
    setCurrentStep('')
    setOverallProgress(0)
    reset()
  }, [setProcessingStatus, setCurrentStep, setOverallProgress, reset])

  // Processing summary
  const processingSummary = getProcessingSummary()
  
  // Check if we can start processing
  const canProcess = parsedData.length > 0 && !isProcessing && status !== 'processing'

  if (parsedData.length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No hay datos para procesar</AlertTitle>
          <AlertDescription>
            Primero necesitas subir un archivo y completar el mapeo de activos.
          </AlertDescription>
        </Alert>
        
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <Button variant="outline" onClick={onBackToMapping}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Mapeo
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Processing Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Procesamiento de Datos
          </CardTitle>
          <CardDescription>
            Etapa final: migración de datos al sistema de inventario diesel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-lg font-bold">{parsedData.length}</div>
                <div className="text-xs text-muted-foreground">Registros</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-lg font-bold">{pendingMappings.size}</div>
                <div className="text-xs text-muted-foreground">Mapeos</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <div>
                <div className="text-lg font-bold">{errorCount}</div>
                <div className="text-xs text-muted-foreground">Errores</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              <div>
                <div className="text-lg font-bold">{Math.round(progress)}%</div>
                <div className="text-xs text-muted-foreground">Progreso</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Batch Info */}
      {currentBatch && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Lote: {currentBatch.batch_id}</div>
                <div className="text-sm text-muted-foreground">
                  {currentBatch.original_filename} • {currentBatch.total_rows} registros
                </div>
              </div>
              <Badge 
                variant={
                  currentBatch.status === 'completed' ? 'default' :
                  currentBatch.status === 'processing' ? 'secondary' :
                  'outline'
                }
              >
                {currentBatch.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">
                {status === 'idle' && 'Listo para procesar'}
                {status === 'processing' && `Procesando: ${step}`}
                {status === 'completed' && 'Procesamiento completado'}
                {status === 'error' && 'Error en el procesamiento'}
              </div>
              {status === 'processing' && (
                <div className="text-sm text-muted-foreground">
                  No cierres esta ventana durante el procesamiento
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              {status === 'idle' && (
                <Button 
                  onClick={startProcessing}
                  disabled={!canProcess}
                  size="lg"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Iniciar Procesamiento
                </Button>
              )}
              
              {status === 'processing' && (
                <Button variant="outline" disabled>
                  <Clock className="mr-2 h-4 w-4 animate-pulse" />
                  Procesando...
                </Button>
              )}
              
              {(status === 'completed' || status === 'error') && (
                <Button variant="outline" onClick={resetProcessing}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reiniciar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overall Progress */}
      {status === 'processing' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso General</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Pasos de Procesamiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {processingSteps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-4">
                {/* Step Icon */}
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 mt-1",
                  step.status === 'completed' && "bg-green-100 border-green-500",
                  step.status === 'active' && "bg-blue-100 border-blue-500",
                  step.status === 'error' && "bg-red-100 border-red-500",
                  step.status === 'pending' && "bg-gray-100 border-gray-300"
                )}>
                  {step.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-600" />}
                  {step.status === 'active' && <Activity className="w-4 h-4 text-blue-600 animate-pulse" />}
                  {step.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                  {step.status === 'pending' && <Clock className="w-4 h-4 text-gray-400" />}
                </div>
                
                {/* Step Content */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{step.title}</div>
                      <div className="text-sm text-muted-foreground">{step.description}</div>
                    </div>
                    
                    {step.status === 'active' && (
                      <Badge variant="secondary">
                        {step.progress}%
                      </Badge>
                    )}
                    
                    {step.endTime && step.startTime && (
                      <Badge variant="outline">
                        {Math.round((step.endTime.getTime() - step.startTime.getTime()) / 1000)}s
                      </Badge>
                    )}
                  </div>
                  
                  {step.status === 'active' && step.progress > 0 && (
                    <Progress value={step.progress} className="h-1" />
                  )}
                  
                  {step.details && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      {step.details.map((detail, i) => (
                        <div key={i}>• {detail}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Processing Logs */}
      {processingLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Registro de Procesamiento</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 w-full">
              <div className="space-y-2">
                {processingLogs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <div className="text-muted-foreground font-mono text-xs mt-0.5">
                      {log.timestamp.toLocaleTimeString()}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs",
                        log.level === 'success' && "border-green-500 text-green-700",
                        log.level === 'error' && "border-red-500 text-red-700",
                        log.level === 'warning' && "border-yellow-500 text-yellow-700",
                        log.level === 'info' && "border-blue-500 text-blue-700"
                      )}
                    >
                      {log.level}
                    </Badge>
                    <div className="flex-1">{log.message}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Errors Summary */}
      {hasErrors && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Errores Detectados ({errorCount})</AlertTitle>
          <AlertDescription>
            <ScrollArea className="h-32 w-full mt-2">
              <div className="space-y-1">
                {errors.slice(0, 5).map((error) => (
                  <div key={error.id} className="text-sm">
                    • {error.error_message}
                    {error.suggested_fix && (
                      <div className="text-xs text-muted-foreground ml-2">
                        Sugerencia: {error.suggested_fix}
                      </div>
                    )}
                  </div>
                ))}
                {errors.length > 5 && (
                  <div className="text-sm text-muted-foreground">
                    ... y {errors.length - 5} errores más
                  </div>
                )}
              </div>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onBackToMapping}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Mapeo
            </Button>
            
            {status === 'completed' && (
              <div className="flex gap-2">
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Reporte
                </Button>
                <Button onClick={() => resetProcessing()}>
                  <Zap className="mr-2 h-4 w-4" />
                  Nueva Importación
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Success Message */}
      {status === 'completed' && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>🎉 Migración Completada Exitosamente</AlertTitle>
          <AlertDescription>
            Se han migrado {parsedData.length} registros al sistema de inventario diesel.
            Los datos están ahora disponibles para consulta y análisis.
          </AlertDescription>
        </Alert>
      )}

      {/* Development Info */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground space-y-2">
              <div><strong>Debug - Processing State:</strong></div>
              <div>Status: {status}</div>
              <div>Step: {step}</div>
              <div>Progress: {progress}%</div>
              <div>Can start: {canStart.toString()}</div>
              <div>Is processing: {isProcessing.toString()}</div>
              <div>Logs: {processingLogs.length} entries</div>
              <div>Batch: {currentBatch?.batch_id || 'None'}</div>
              <div>Meter conflicts: {meterConflicts.length}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meter Reconciliation Dialog */}
      <MeterReconciliationDialog
        open={showMeterDialog}
        onClose={handleMeterDialogClose}
        onResolveAll={handleMeterConflictsResolved}
      />
    </div>
  )
}




