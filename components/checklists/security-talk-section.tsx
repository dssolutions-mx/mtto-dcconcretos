"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Loader2, Users, User, Camera } from "lucide-react"
import { SecurityConfig, SecurityTalkData } from "@/types"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { EvidenceCaptureSection } from "@/components/checklists/evidence-capture-section"
import {
  normalizeSecurityConfig,
  resolveSecurityTalkUiMode,
} from "@/lib/checklist/security-talk-validation"

interface Operator {
  id: string
  nombre: string
  apellido: string
  employee_code?: string
}

interface SecurityTalkSectionProps {
  sectionId: string
  sectionTitle: string
  config: Partial<SecurityConfig> | Record<string, unknown>
  plantId?: string
  onDataChange: (sectionId: string, data: SecurityTalkData) => void
  initialData?: SecurityTalkData
  disabled?: boolean
}

export function SecurityTalkSection({
  sectionId,
  sectionTitle,
  config: configProp,
  plantId,
  onDataChange,
  initialData,
  disabled = false
}: SecurityTalkSectionProps) {
  const { profile } = useAuthZustand()
  const templateConfig = normalizeSecurityConfig(configProp)
  const uiMode = resolveSecurityTalkUiMode(templateConfig, profile?.role)
  const config: SecurityConfig = { ...templateConfig, mode: uiMode }

  const [operators, setOperators] = useState<Operator[]>([])
  const [loadingOperators, setLoadingOperators] = useState(false)
  const [operatorsError, setOperatorsError] = useState<string | null>(null)
  const [attendance, setAttendance] = useState<boolean>(initialData?.attendance ?? false)
  const [attendees, setAttendees] = useState<string[]>(initialData?.attendees ?? [])
  const [topic, setTopic] = useState<string>(initialData?.topic ?? '')
  const [reflection, setReflection] = useState<string>(initialData?.reflection ?? '')
  const [evidenceData, setEvidenceData] = useState<any[]>(
    initialData?.evidence?.map((entry, index) => ({
      id: `restored-${index}`,
      photo_url: entry.photo_url,
      category: entry.category,
      description: entry.description,
    })) ?? []
  )

  const fetchOperators = useCallback(async () => {
    if (!plantId) {
      setOperators([])
      setOperatorsError('No se pudo determinar la planta del activo.')
      return
    }

    setLoadingOperators(true)
    setOperatorsError(null)
    try {
      const response = await fetch(`/api/hr/plant-operations-roster?plant_id=${plantId}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'No se pudo cargar el roster de operadores')
      }
      const data = await response.json()
      setOperators(data.operators || [])
    } catch (error) {
      console.error('Error fetching operators:', error)
      setOperators([])
      setOperatorsError(
        error instanceof Error
          ? error.message
          : 'Error al cargar operadores de la planta'
      )
    } finally {
      setLoadingOperators(false)
    }
  }, [plantId])

  // Fetch operators for plant manager mode
  useEffect(() => {
    if (config.mode === 'plant_manager' && plantId) {
      void fetchOperators()
    }
  }, [config.mode, plantId, fetchOperators])

  // Update parent when data changes
  useEffect(() => {
    const data: SecurityTalkData = {
      attendance: config.mode === 'operator' ? attendance : undefined,
      attendees: config.mode === 'plant_manager' ? attendees : undefined,
      topic: topic || undefined,
      reflection: reflection || undefined,
      evidence: evidenceData.length > 0 ? evidenceData.map(e => ({
        photo_url: e.photo_url,
        category: e.category,
        description: e.description
      })) : undefined
    }
    onDataChange(sectionId, data)
  }, [attendance, attendees, topic, reflection, evidenceData, sectionId, config.mode, onDataChange])

  const handleAttendeeToggle = (operatorId: string) => {
    setAttendees(prev => 
      prev.includes(operatorId)
        ? prev.filter(id => id !== operatorId)
        : [...prev, operatorId]
    )
  }

  const handleEvidenceChange = useCallback((_sectionId: string, evidences: any[]) => {
    setEvidenceData(evidences)
  }, [])

  const isPlantManagerMode = config.mode === 'plant_manager'
  
  // Check if attendance is marked
  const hasAttendance = isPlantManagerMode 
    ? attendees.length > 0
    : attendance === true
  
  // Only require topic/reflection if attendance is marked (or attendance is not required)
  const shouldRequireDetails = !config.require_attendance || hasAttendance
  const detailsLocked = config.require_attendance && !hasAttendance
  
  const hasRequiredData = 
    (!config.require_attendance || hasAttendance) &&
    (!config.require_topic || !shouldRequireDetails || topic.trim().length > 0) &&
    (!config.require_reflection || !shouldRequireDetails || reflection.trim().length > 0)

  return (
    <Card className="mb-6 border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-orange-600" />
          {sectionTitle}
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            {isPlantManagerMode ? 'Jefe de Planta / Dosificador' : 'Operador'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Registre la información de la charla de seguridad realizada
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Attendance Section - Always show, but only require if config says so */}
        <div className="space-y-4">
          {isPlantManagerMode ? (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Lista de Asistentes {config.require_attendance && <span className="text-red-500">*</span>}
              </Label>
                {loadingOperators ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando operadores...
                  </div>
                ) : operatorsError ? (
                  <Alert variant="destructive">
                    <AlertDescription className="space-y-2">
                      <p>{operatorsError}</p>
                      <button
                        type="button"
                        className="text-sm underline"
                        onClick={() => void fetchOperators()}
                        disabled={disabled}
                      >
                        Reintentar
                      </button>
                    </AlertDescription>
                  </Alert>
                ) : operators.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      No se encontraron operadores en esta planta. Verifique que el activo tenga planta asignada y que existan operadores activos.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {operators.map((operator) => (
                      <div key={operator.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`operator-${operator.id}`}
                          checked={attendees.includes(operator.id)}
                          onCheckedChange={() => handleAttendeeToggle(operator.id)}
                          disabled={disabled}
                        />
                        <Label
                          htmlFor={`operator-${operator.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {operator.nombre} {operator.apellido}
                          {operator.employee_code && (
                            <span className="text-gray-500 ml-2">({operator.employee_code})</span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
                {attendees.length > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {attendees.length} operador{attendees.length > 1 ? 'es' : ''} seleccionado{attendees.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`attendance-${sectionId}`}
                  checked={attendance}
                  onCheckedChange={(checked) => {
                    setAttendance(checked === true)
                    // Clear topic and reflection if attendance is unchecked
                    if (!checked) {
                      setTopic('')
                      setReflection('')
                    }
                  }}
                  disabled={disabled}
                />
                <Label
                  htmlFor={`attendance-${sectionId}`}
                  className="text-sm font-normal cursor-pointer flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  Asistí a la charla de seguridad {config.require_attendance && <span className="text-red-500">*</span>}
                </Label>
              </div>
            )}
          </div>

        {detailsLocked && (config.require_topic || config.require_reflection) && (
          <p className="text-sm text-muted-foreground">
            {isPlantManagerMode
              ? 'Seleccione al menos un asistente para registrar el tema y la reflexión.'
              : 'Marque su asistencia para registrar el tema y la reflexión.'}
          </p>
        )}
        
        {/* Topic Section */}
        {config.require_topic && (
          <div className="space-y-2">
            <Label htmlFor={`topic-${sectionId}`}>
              Tema Cubierto <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`topic-${sectionId}`}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej: Uso correcto de EPP, Procedimientos de seguridad en altura..."
              disabled={disabled || detailsLocked}
            />
          </div>
        )}

        {/* Reflection Section */}
        {config.require_reflection && (
          <div className="space-y-2">
            <Label htmlFor={`reflection-${sectionId}`}>
              Reflexión <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id={`reflection-${sectionId}`}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="Escriba su reflexión sobre la charla de seguridad..."
              rows={4}
              disabled={disabled || detailsLocked}
            />
          </div>
        )}

        {/* Evidence Section */}
        {config.allow_evidence && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Evidencia Fotográfica (Opcional)
            </Label>
            <EvidenceCaptureSection
              sectionId={`${sectionId}-evidence`}
              sectionTitle="Evidencia de Charla de Seguridad"
              config={{
                min_photos: 0,
                max_photos: 5,
                categories: ['Charla de Seguridad'],
                descriptions: {
                  'Charla de Seguridad': 'Fotografía de la charla de seguridad realizada'
                }
              }}
              onEvidenceChange={handleEvidenceChange}
              disabled={disabled || detailsLocked}
              checklistId={`security-${sectionId}`}
            />
          </div>
        )}

        {/* Validation Feedback */}
        {!hasRequiredData && (
          <Alert variant="destructive">
            <AlertDescription>
              Por favor complete todos los campos requeridos:
              {config.require_attendance && !hasAttendance && (
                <div>• {isPlantManagerMode ? 'Seleccione al menos un asistente' : 'Marque su asistencia'}</div>
              )}
              {shouldRequireDetails && config.require_topic && !topic.trim() && (
                <div>• Ingrese el tema cubierto</div>
              )}
              {shouldRequireDetails && config.require_reflection && !reflection.trim() && (
                <div>• Escriba su reflexión</div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
