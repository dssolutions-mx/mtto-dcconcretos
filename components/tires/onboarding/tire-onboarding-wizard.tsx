'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import {
  OnboardingProgressBar,
} from '@/components/tires/onboarding/onboarding-progress-bar'
import { StepScope } from '@/components/tires/onboarding/step-scope'
import { StepLayouts } from '@/components/tires/onboarding/step-layouts'
import { StepIdRules } from '@/components/tires/onboarding/step-id-rules'
import { StepInventory } from '@/components/tires/onboarding/step-inventory'
import { StepPilot } from '@/components/tires/onboarding/step-pilot'
import { getTireUiRole } from '@/lib/tires/fleet-status'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type {
  TireLayoutTemplateKey,
  TireOnboardingProgress,
  TireOnboardingScopePayload,
  TireIdRules,
} from '@/types/tires'
import type { OnboardingWizardStep } from '@/components/tires/onboarding/constants'

export function TireOnboardingWizardPage() {
  const router = useRouter()
  const { profile } = useAuthZustand()
  const tireRole = getTireUiRole(profile?.role)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState<OnboardingWizardStep>('scope')
  const [progress, setProgress] = useState<TireOnboardingProgress[]>([])
  const [context, setContext] = useState<{
    plants: { id: string; name: string; code?: string | null }[]
    models: {
      id: string
      name: string
      category?: string | null
      layout?: { template_key: string } | null
      position_count?: number
    }[]
    assets: {
      id: string
      name: string | null
      asset_id?: string | null
      plant_id?: string | null
      equipment_models?: { name?: string; category?: string | null } | null
    }[]
    categories: string[]
    id_rules?: TireIdRules
  }>({ plants: [], models: [], assets: [], categories: [] })

  const completedSteps = useMemo(
    () => new Set(progress.filter((p) => p.completed_at).map((p) => p.step)),
    [progress]
  )

  const scopePayload = useMemo(() => {
    const row = progress.find((p) => p.step === 'scope')
    return (row?.payload ?? {}) as TireOnboardingScopePayload
  }, [progress])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tires/onboarding')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar onboarding')
      const rows = (data.progress ?? []) as TireOnboardingProgress[]
      setProgress(rows)

      const settingsRes = await fetch('/api/tires/settings')
      const settingsData = await settingsRes.json()
      setContext({
        ...(data.context ?? { plants: [], models: [], assets: [], categories: [] }),
        id_rules: settingsRes.ok ? settingsData.settings?.id_rules ?? {} : {},
      })

      const done = new Set(rows.filter((p) => p.completed_at).map((p) => p.step))
      if (!done.has('scope')) setCurrentStep('scope')
      else if (!done.has('layouts')) setCurrentStep('layouts')
      else if (!done.has('id_rules')) setCurrentStep('id_rules')
      else if (!done.has('inventory')) setCurrentStep('inventory')
      else if (!done.has('pilot')) setCurrentStep('pilot')
      else setCurrentStep('pilot')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar configuración')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveStep = async (
    step: OnboardingWizardStep,
    payload: Record<string, unknown> | object,
    complete: boolean
  ) => {
    setSaving(true)
    try {
      const res = await fetch('/api/tires/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, payload, completed: complete }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      setProgress((prev) => {
        const others = prev.filter((p) => p.step !== step)
        return [...others, data.progress]
      })
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleScopeSave = async (payload: TireOnboardingScopePayload, complete: boolean) => {
    const ok = await saveStep('scope', payload, complete)
    if (ok) {
      toast.success(complete ? 'Alcance guardado' : 'Progreso guardado')
      if (complete) setCurrentStep('layouts')
    }
  }

  const handleLayoutsSave = async (
    assignments: Record<string, TireLayoutTemplateKey>,
    complete: boolean
  ) => {
    setSaving(true)
    try {
      const entries = Object.entries(assignments).filter(([, key]) => key && key !== 'custom')
      for (const [modelId, templateKey] of entries) {
        const res = await fetch(`/api/equipment-models/${modelId}/tire-layout`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_key: templateKey, positions: [] }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `Error al guardar layout del modelo ${modelId}`)
        }
      }

      const ok = await saveStep(
        'layouts',
        { assignments, configured_model_ids: entries.map(([id]) => id) },
        complete
      )
      if (ok) {
        toast.success(
          complete
            ? 'Layouts guardados. Continúe con reglas de identificación.'
            : 'Progreso guardado'
        )
        if (complete) setCurrentStep('id_rules')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar layouts')
    } finally {
      setSaving(false)
    }
  }

  const handleIdRulesSave = async (rules: TireIdRules, complete: boolean) => {
    setSaving(true)
    try {
      const res = await fetch('/api/tires/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_rules: rules }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar reglas')

      const ok = await saveStep('id_rules', { rules }, complete)
      if (ok) {
        toast.success(complete ? 'Reglas guardadas' : 'Progreso guardado')
        if (complete) setCurrentStep('inventory')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar reglas')
    } finally {
      setSaving(false)
    }
  }

  const handleInventoryComplete = async (method: string) => {
    const ok = await saveStep('inventory', { method }, true)
    if (ok) {
      toast.success('Inventario registrado en el plan')
      setCurrentStep('pilot')
    }
  }

  const handlePilotComplete = async () => {
    const ok = await saveStep('pilot', { completed_via: 'diagram' }, true)
    if (ok) {
      toast.success('Piloto registrado. Puede continuar con inventario en una fase posterior.')
      router.push('/activos/llantas')
    }
  }

  if (tireRole === 'mechanic') {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Configuración de llantas"
          text="Esta sección está reservada para supervisores de mantenimiento."
        />
        <Alert>
          <AlertDescription>
            Aún no hay llantas configuradas. Pida a su supervisor iniciar la configuración.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href="/activos">Volver a activos</Link>
        </Button>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Asistente de configuración de llantas"
        text="Defina el alcance y los layouts por modelo antes de cargar inventario."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/activos/llantas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Inventario de llantas
          </Link>
        </Button>
      </DashboardHeader>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mx-auto max-w-5xl space-y-6">
          <OnboardingProgressBar
            currentStep={currentStep}
            completedSteps={completedSteps}
          />

          {currentStep === 'scope' && (
            <StepScope
              plants={context.plants}
              assets={context.assets}
              categories={context.categories}
              initialPayload={scopePayload}
              saving={saving}
              onSave={handleScopeSave}
            />
          )}

          {currentStep === 'layouts' && (
            <StepLayouts
              models={context.models}
              scopePayload={scopePayload}
              saving={saving}
              onBack={() => setCurrentStep('scope')}
              onSaveLayouts={handleLayoutsSave}
            />
          )}

          {currentStep === 'id_rules' && (
            <StepIdRules
              initialRules={context.id_rules}
              saving={saving}
              onBack={() => setCurrentStep('layouts')}
              onSave={handleIdRulesSave}
            />
          )}

          {currentStep === 'inventory' && (
            <StepInventory
              saving={saving}
              onBack={() => setCurrentStep('id_rules')}
              onComplete={handleInventoryComplete}
            />
          )}

          {currentStep === 'pilot' && (
            <StepPilot
              assets={context.assets}
              scopePayload={scopePayload}
              saving={saving}
              onBack={() => setCurrentStep('inventory')}
              onComplete={handlePilotComplete}
            />
          )}
        </div>
      )}
    </DashboardShell>
  )
}
