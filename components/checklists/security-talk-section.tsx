"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Loader2, Users, User, Camera, X, ImageIcon } from "lucide-react"
import { SecurityConfig, SecurityTalkData } from "@/types"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import {
  normalizeSecurityConfig,
  resolveSecurityTalkUiMode,
} from "@/lib/checklist/security-talk-validation"
import { isPersistablePhotoUrl } from "@/lib/offline/sanitize-draft"
import { initOfflineClient, offlineClient } from "@/lib/offline/offline-client"
import { db } from "@/lib/offline/db"
import { toast } from "sonner"

interface Operator {
  id: string
  nombre: string
  apellido: string
  employee_code?: string
}

type SecurityEvidenceItem = {
  id: string
  photo_id?: string
  photo_url?: string
  previewUrl?: string
  category?: string
  description?: string
}

interface SecurityTalkSectionProps {
  sectionId: string
  sectionTitle: string
  config: Partial<SecurityConfig> | Record<string, unknown>
  plantId?: string
  /** Checklist schedule id — used for offline photo queue keys */
  checklistScheduleId: string
  onDataChange: (sectionId: string, data: SecurityTalkData) => void
  initialData?: SecurityTalkData
  disabled?: boolean
  /** When true, skip outer Card (parent already renders section chrome). */
  embedded?: boolean
}

const MAX_EVIDENCE_PHOTOS = 5

function toPersistableEvidence(
  items: SecurityEvidenceItem[]
): NonNullable<SecurityTalkData["evidence"]> {
  return items
    .map((item) => {
      const row: {
        photo_url?: string
        photo_id?: string
        category?: string
        description?: string
      } = {
        category: item.category ?? "Charla de Seguridad",
        description: item.description,
      }
      if (item.photo_id) row.photo_id = item.photo_id
      if (isPersistablePhotoUrl(item.photo_url)) row.photo_url = item.photo_url
      return row
    })
    .filter((row) => row.photo_id || row.photo_url)
}

export function SecurityTalkSection({
  sectionId,
  sectionTitle,
  config: configProp,
  plantId,
  checklistScheduleId,
  onDataChange,
  initialData,
  disabled = false,
  embedded = false,
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
  const [topic, setTopic] = useState<string>(initialData?.topic ?? "")
  const [reflection, setReflection] = useState<string>(initialData?.reflection ?? "")
  const [evidenceItems, setEvidenceItems] = useState<SecurityEvidenceItem[]>([])
  const [uploadingEvidence, setUploadingEvidence] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewUrlsRef = useRef<string[]>([])

  useEffect(() => {
    void initOfflineClient().then(() => setOfflineReady(true))
    return () => {
      for (const url of previewUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
      previewUrlsRef.current = []
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function hydrateEvidence() {
      const initial = initialData?.evidence ?? []
      if (initial.length === 0) {
        setEvidenceItems([])
        return
      }

      const hydrated: SecurityEvidenceItem[] = []
      for (let index = 0; index < initial.length; index++) {
        const entry = initial[index] as {
          photo_url?: string
          photo_id?: string
          category?: string
          description?: string
        }
        const photoId = entry.photo_id
        let previewUrl: string | undefined
        let photoUrl = isPersistablePhotoUrl(entry.photo_url)
          ? entry.photo_url
          : undefined

        if (photoId && offlineReady) {
          try {
            const stored = await db.photos.get(photoId)
            if (stored?.blob instanceof Blob) {
              previewUrl = URL.createObjectURL(stored.blob)
              previewUrlsRef.current.push(previewUrl)
            }
          } catch {
            // ignore — preview optional
          }
        } else if (photoUrl) {
          previewUrl = photoUrl
        }

        hydrated.push({
          id: `restored-${index}`,
          photo_id: photoId,
          photo_url: photoUrl,
          previewUrl,
          category: entry.category,
          description: entry.description,
        })
      }

      if (!cancelled) setEvidenceItems(hydrated)
    }

    void hydrateEvidence()
    return () => {
      cancelled = true
    }
  }, [initialData?.evidence, offlineReady])

  const fetchOperators = useCallback(async () => {
    if (!plantId) {
      setOperators([])
      setOperatorsError("No se pudo determinar la planta del activo.")
      return
    }

    setLoadingOperators(true)
    setOperatorsError(null)
    try {
      const response = await fetch(`/api/hr/plant-operations-roster?plant_id=${plantId}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "No se pudo cargar el roster de operadores")
      }
      const data = await response.json()
      setOperators(data.operators || [])
    } catch (error) {
      console.error("Error fetching operators:", error)
      setOperators([])
      setOperatorsError(
        error instanceof Error ? error.message : "Error al cargar operadores de la planta"
      )
    } finally {
      setLoadingOperators(false)
    }
  }, [plantId])

  useEffect(() => {
    if (config.mode === "plant_manager" && plantId) {
      void fetchOperators()
    }
  }, [config.mode, plantId, fetchOperators])

  const emitChange = useCallback(
    (
      nextAttendance: boolean,
      nextAttendees: string[],
      nextTopic: string,
      nextReflection: string,
      nextEvidence: SecurityEvidenceItem[]
    ) => {
      const evidence = toPersistableEvidence(nextEvidence)
      const data: SecurityTalkData = {
        attendance: config.mode === "operator" ? nextAttendance : undefined,
        attendees: config.mode === "plant_manager" ? nextAttendees : undefined,
        topic: nextTopic || undefined,
        reflection: nextReflection || undefined,
        evidence: evidence.length > 0 ? evidence : undefined,
      }
      onDataChange(sectionId, data)
    },
    [config.mode, onDataChange, sectionId]
  )

  useEffect(() => {
    emitChange(attendance, attendees, topic, reflection, evidenceItems)
  }, [attendance, attendees, topic, reflection, evidenceItems, emitChange])

  const handleAttendeeToggle = (operatorId: string) => {
    setAttendees((prev) =>
      prev.includes(operatorId)
        ? prev.filter((id) => id !== operatorId)
        : [...prev, operatorId]
    )
  }

  const handleAddEvidencePhoto = async (file: File) => {
    if (!offlineReady || disabled) return
    if (evidenceItems.length >= MAX_EVIDENCE_PHOTOS) {
      toast.error(`Máximo ${MAX_EVIDENCE_PHOTOS} fotos`)
      return
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes")
      return
    }

    setUploadingEvidence(true)
    const itemId = `security-talk-${sectionId}-${Date.now()}`
    const photoId = `photo_${checklistScheduleId}_${itemId}`

    try {
      const blob = file
      await offlineClient.savePhoto({
        id: photoId,
        checklistId: checklistScheduleId,
        itemId,
        blob,
        fileName: file.name,
      })

      const previewUrl = URL.createObjectURL(blob)
      previewUrlsRef.current.push(previewUrl)

      setEvidenceItems((prev) => [
        ...prev,
        {
          id: photoId,
          photo_id: photoId,
          previewUrl,
          category: "Charla de Seguridad",
          description: "Fotografía de la charla de seguridad realizada",
        },
      ])
      toast.success("Foto guardada en el dispositivo")
    } catch (error) {
      console.error("Security talk evidence save failed:", error)
      toast.error("No se pudo guardar la foto", {
        description:
          error instanceof Error ? error.message : "Error de almacenamiento local",
      })
    } finally {
      setUploadingEvidence(false)
    }
  }

  const removeEvidence = async (item: SecurityEvidenceItem) => {
    if (item.photo_id) {
      try {
        await db.photos.delete(item.photo_id)
      } catch {
        // ignore
      }
    }
    if (item.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl)
      previewUrlsRef.current = previewUrlsRef.current.filter((u) => u !== item.previewUrl)
    }
    setEvidenceItems((prev) => prev.filter((e) => e.id !== item.id))
  }

  const isPlantManagerMode = config.mode === "plant_manager"
  const hasAttendance = isPlantManagerMode ? attendees.length > 0 : attendance === true
  const shouldRequireDetails = !config.require_attendance || hasAttendance
  const detailsLocked = config.require_attendance && !hasAttendance

  const hasRequiredData =
    (!config.require_attendance || hasAttendance) &&
    (!config.require_topic || !shouldRequireDetails || topic.trim().length > 0) &&
    (!config.require_reflection || !shouldRequireDetails || reflection.trim().length > 0)

  const body = (
    <div className="space-y-6">
      <div className="space-y-4">
        {isPlantManagerMode ? (
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Lista de Asistentes{" "}
              {config.require_attendance && <span className="text-red-500">*</span>}
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
                  No se encontraron operadores en esta planta. Verifique que el activo tenga
                  planta asignada y que existan operadores activos.
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
                {attendees.length} operador{attendees.length > 1 ? "es" : ""} seleccionado
                {attendees.length > 1 ? "s" : ""}
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
                if (!checked) {
                  setTopic("")
                  setReflection("")
                }
              }}
              disabled={disabled}
            />
            <Label
              htmlFor={`attendance-${sectionId}`}
              className="text-sm font-normal cursor-pointer flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              Asistí a la charla de seguridad{" "}
              {config.require_attendance && <span className="text-red-500">*</span>}
            </Label>
          </div>
        )}
      </div>

      {detailsLocked && (config.require_topic || config.require_reflection) && (
        <p className="text-sm text-muted-foreground">
          {isPlantManagerMode
            ? "Seleccione al menos un asistente para registrar el tema y la reflexión."
            : "Marque su asistencia para registrar el tema y la reflexión."}
        </p>
      )}

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

      {config.allow_evidence && (
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Evidencia Fotográfica (Opcional)
          </Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={disabled || detailsLocked || uploadingEvidence}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleAddEvidencePhoto(file)
              e.target.value = ""
            }}
          />
          <div className="flex flex-wrap gap-3">
            {evidenceItems.map((item) => (
              <div key={item.id} className="relative h-24 w-24 rounded-lg border overflow-hidden bg-muted">
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt="Evidencia charla de seguridad"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute top-1 right-1 h-6 w-6"
                  disabled={disabled}
                  onClick={() => void removeEvidence(item)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {evidenceItems.length < MAX_EVIDENCE_PHOTOS && (
              <Button
                type="button"
                variant="outline"
                className="h-24 w-24 flex-col gap-1"
                disabled={disabled || detailsLocked || uploadingEvidence || !offlineReady}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingEvidence ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                <span className="text-xs">Agregar</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {!hasRequiredData && (
        <Alert variant="destructive">
          <AlertDescription>
            Por favor complete todos los campos requeridos:
            {config.require_attendance && !hasAttendance && (
              <div>
                • {isPlantManagerMode ? "Seleccione al menos un asistente" : "Marque su asistencia"}
              </div>
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
    </div>
  )

  if (embedded) {
    return (
      <div className="rounded-lg border border-orange-200 bg-white p-4">{body}</div>
    )
  }

  return (
    <Card className="mb-6 border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-orange-600" />
          {sectionTitle}
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            {isPlantManagerMode ? "Jefe de Planta / Dosificador" : "Operador"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Registre la información de la charla de seguridad realizada
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
