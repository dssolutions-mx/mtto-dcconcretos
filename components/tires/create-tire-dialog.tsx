"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { formatTirePrimaryId } from "@/lib/tires/display"
import {
  buildTireFormForAnother,
  createEmptyTireForm,
  hasIdentityBlockingFeedback,
  normalizeDotSerial,
  validateIdentificationStep,
  validateSpecsStep,
  type CreateTireWizardStep,
} from "@/lib/tires/create-tire-form"
import { useTireIdentityCheck } from "@/hooks/use-tire-identity-check"
import { CreateTireWizardProgress } from "@/components/tires/create-tire/wizard-progress"
import { CreateTireStepIdentification } from "@/components/tires/create-tire/step-identification"
import { CreateTireStepSpecs } from "@/components/tires/create-tire/step-specs"
import { CreateTireStepLocation } from "@/components/tires/create-tire/step-location"
import type { CreateTireInput, TireIdRules } from "@/types/tires"

interface WarehouseOption {
  id: string
  name: string
  warehouse_code: string
}

interface PlantOption {
  id: string
  name: string
  code?: string | null
}

interface CreateTireDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

async function fetchPreviewCode(plantId?: string | null) {
  const params = plantId ? `?plant_id=${encodeURIComponent(plantId)}` : ""
  const res = await fetch(`/api/tires/preview-code${params}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "No se pudo cargar el código de flota")
  return data as {
    preview_code: string | null
    id_rules: TireIdRules
    plant_code?: string | null
  }
}

export function CreateTireDialog({ open, onOpenChange, onCreated }: CreateTireDialogProps) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<CreateTireWizardStep>("identification")
  const [idRules, setIdRules] = useState<TireIdRules>({})
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  const [selectedPlantCode, setSelectedPlantCode] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [plants, setPlants] = useState<PlantOption[]>([])
  const [form, setForm] = useState<CreateTireInput>(createEmptyTireForm())

  const checkDot = !!form.serial_number?.trim()
  const checkInternalCode = idRules.auto_generate !== true && !!form.internal_code?.trim()

  const { dotFeedback, internalFeedback } = useTireIdentityCheck({
    dot: form.serial_number ?? '',
    internalCode: form.internal_code ?? '',
    checkDot,
    checkInternalCode,
    enabled: open,
  })

  const identityCheckOptions = useMemo(
    () => ({ checkDot, checkInternalCode }),
    [checkDot, checkInternalCode]
  )

  const resetWizard = useCallback(() => {
    setStep("identification")
    setForm(createEmptyTireForm())
    setPreviewCode(null)
    setSelectedPlantCode(null)
    setIdRules({})
  }, [])

  const loadPreview = useCallback(async (plantId?: string | null) => {
    try {
      const data = await fetchPreviewCode(plantId)
      setIdRules(data.id_rules ?? {})
      setPreviewCode(data.preview_code ?? null)
      setSelectedPlantCode(data.plant_code ?? null)
    } catch {
      setPreviewCode(null)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    setStep("identification")

    Promise.all([
      fetch("/api/inventory/warehouses?is_active=true").then((r) => r.json()),
      fetch("/api/plants").then((r) => r.json()),
    ])
      .then(async ([warehouseData, plantData]) => {
        const plantList = (plantData.plants ?? []) as PlantOption[]
        setWarehouses(warehouseData.warehouses ?? [])
        setPlants(plantList)

        const initialForm = createEmptyTireForm()
        const defaultPlantId = plantList.length === 1 ? plantList[0].id : undefined
        if (defaultPlantId) {
          initialForm.plant_id = defaultPlantId
        }
        setForm(initialForm)

        const previewData = await fetchPreviewCode(defaultPlantId)
        setIdRules(previewData.id_rules ?? {})
        setPreviewCode(previewData.preview_code ?? null)
        setSelectedPlantCode(previewData.plant_code ?? null)
      })
      .catch(() => {
        setIdRules({})
        setPreviewCode(null)
        setWarehouses([])
        setPlants([])
        setForm(createEmptyTireForm())
      })
  }, [open, loadPreview])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetWizard()
    onOpenChange(nextOpen)
  }

  const patchForm = (patch: Partial<CreateTireInput>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handlePlantChange = async (plantId: string | undefined) => {
    patchForm({ plant_id: plantId ?? null })
    const plant = plants.find((p) => p.id === plantId)
    setSelectedPlantCode(plant?.code?.trim() || null)
    await loadPreview(plantId)
  }

  const handleDotBlur = () => {
    if (!form.serial_number?.trim()) return
    const normalized = normalizeDotSerial(form.serial_number)
    if (normalized !== form.serial_number) {
      patchForm({ serial_number: normalized })
    }
  }

  const validateIdentification = (): boolean => {
    const error = validateIdentificationStep(idRules, form)
    if (error) {
      toast.error(error)
      return false
    }

    const identityError = hasIdentityBlockingFeedback(
      dotFeedback,
      internalFeedback,
      identityCheckOptions
    )
    if (identityError) {
      toast.error(identityError)
      return false
    }

    return true
  }

  const validateCurrentStep = (): boolean => {
    if (step === "identification") {
      return validateIdentification()
    }

    if (step === "specs") {
      const error = validateSpecsStep(form)
      if (error) {
        toast.error(error)
        return false
      }
      return true
    }

    return true
  }

  const goNext = () => {
    if (!validateCurrentStep()) return
    if (step === "identification") setStep("specs")
    else if (step === "specs") setStep("location")
  }

  const goBack = () => {
    if (step === "location") setStep("specs")
    else if (step === "specs") setStep("identification")
  }

  const submitPayload = useMemo((): CreateTireInput => {
    const serial = form.serial_number?.trim()
      ? normalizeDotSerial(form.serial_number)
      : undefined
    return {
      ...form,
      brand: form.brand.trim(),
      size: form.size.trim(),
      model: form.model?.trim() || undefined,
      serial_number: serial,
      internal_code: form.internal_code?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    }
  }, [form])

  const handleSave = async (registerAnother: boolean) => {
    if (!validateIdentification()) {
      setStep("identification")
      return
    }

    const specsError = validateSpecsStep(form)
    if (specsError) {
      toast.error(specsError)
      setStep("specs")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/tires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitPayload),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Error al crear llanta")
      }

      const tire = data.tire
      const assignedCode = formatTirePrimaryId(tire)
      toast.success(`Llanta registrada: ${assignedCode}`)
      onCreated()

      if (registerAnother) {
        const keptPlantId = form.plant_id
        setForm(buildTireFormForAnother(form, keptPlantId))
        setStep("identification")
        await loadPreview(keptPlantId)
      } else {
        handleOpenChange(false)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar llanta")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar llanta</DialogTitle>
          <DialogDescription>
            Alta en catálogo e inventario. Capture el DOT y confirme el código de flota antes de
            guardar.
          </DialogDescription>
        </DialogHeader>

        <CreateTireWizardProgress currentStep={step} />

        <div className="py-1">
          {step === "identification" && (
            <CreateTireStepIdentification
              form={form}
              idRules={idRules}
              previewCode={previewCode}
              plants={plants}
              selectedPlantCode={selectedPlantCode}
              dotFeedback={dotFeedback}
              internalFeedback={internalFeedback}
              onFormChange={patchForm}
              onPlantChange={handlePlantChange}
              onDotBlur={handleDotBlur}
            />
          )}

          {step === "specs" && (
            <CreateTireStepSpecs form={form} onFormChange={patchForm} />
          )}

          {step === "location" && (
            <CreateTireStepLocation
              form={form}
              previewCode={previewCode}
              autoGenerate={idRules.auto_generate === true}
              plants={plants}
              warehouses={warehouses}
              onFormChange={patchForm}
            />
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <div className="flex w-full flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              {step !== "identification" ? (
                <Button type="button" variant="outline" onClick={goBack} disabled={loading}>
                  Anterior
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={loading}
                >
                  Cancelar
                </Button>
              )}
            </div>

            {step !== "location" ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={
                  step === "identification" &&
                  !!hasIdentityBlockingFeedback(
                    dotFeedback,
                    internalFeedback,
                    identityCheckOptions
                  )
                }
              >
                Siguiente
              </Button>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => handleSave(true)}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar y registrar otra
                </Button>
                <Button type="button" disabled={loading} onClick={() => handleSave(false)}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar llanta
                </Button>
              </div>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
