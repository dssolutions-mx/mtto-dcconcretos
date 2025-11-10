"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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

interface Operator {
  id: string
  nombre: string
  apellido: string
  employee_code?: string
}

interface SecurityTalkSectionProps {
  sectionId: string
  sectionTitle: string
  config: SecurityConfig
  plantId?: string
  onDataChange: (sectionId: string, data: SecurityTalkData) => void
  initialData?: SecurityTalkData
  disabled?: boolean
}

export function SecurityTalkSection({
  sectionId,
  sectionTitle,
  config,
  plantId,
  onDataChange,
  initialData,
  disabled = false
}: SecurityTalkSectionProps) {
  const { profile } = useAuthZustand()
  const [operators, setOperators] = useState<Operator[]>([])
  const [loadingOperators, setLoadingOperators] = useState(false)
  const [attendance, setAttendance] = useState<boolean>(initialData?.attendance ?? false)
  const [attendees, setAttendees] = useState<string[]>(initialData?.attendees ?? [])
  const [topic, setTopic] = useState<string>(initialData?.topic ?? '')
  const [reflection, setReflection] = useState<string>(initialData?.reflection ?? '')
  const [evidenceData, setEvidenceData] = useState<any[]>([])

  // Fetch operators for plant manager mode
  useEffect(() => {
    if (config.mode === 'plant_manager' && plantId) {
      fetchOperators()
    }
  }, [config.mode, plantId])

  const fetchOperators = async () => {
    if (!plantId) return
    
    setLoadingOperators(true)
    try {
      const response = await fetch(`/api/operators/register?plant_id=${plantId}&role=OPERADOR`)
      if (response.ok) {
        const data = await response.json()
        setOperators(data || [])
      }
    } catch (error) {
      console.error('Error fetching operators:', error)
    } finally {
      setLoadingOperators(false)
    }
  }

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

  const handleEvidenceChange = useCallback((sectionId: string, evidences: any[]) => {
    setEvidenceData(evidences)
  }, [])

  const isPlantManagerMode = config.mode === 'plant_manager'
  
  // Check if attendance is marked
  const hasAttendance = isPlantManagerMode 
    ? attendees.length > 0
    : attendance === true
  
  // Only require topic/reflection if attendance is marked (or attendance is not required)
  const shouldRequireDetails = !config.require_attendance || hasAttendance
  
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
                ) : operators.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      No se encontraron operadores en esta planta
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
        
        {/* Topic Section - Only show if attendance is marked or attendance is not required */}
        {shouldRequireDetails && config.require_topic && (
          <div className="space-y-2">
            <Label htmlFor={`topic-${sectionId}`}>
              Tema Cubierto <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`topic-${sectionId}`}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej: Uso correcto de EPP, Procedimientos de seguridad en altura..."
              disabled={disabled}
            />
          </div>
        )}

        {/* Reflection Section - Only show if attendance is marked or attendance is not required */}
        {shouldRequireDetails && config.require_reflection && (
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
              disabled={disabled}
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
              disabled={disabled}
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

