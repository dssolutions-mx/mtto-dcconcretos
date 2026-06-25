"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { createBrowserClient } from "@supabase/ssr"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useScheduleFormData } from "@/components/checklists/scheduling/use-schedule-form-data"
import { ManualScheduleTab } from "@/components/checklists/scheduling/schedule-form-manual-tab"
import { MaintenanceScheduleTab } from "@/components/checklists/scheduling/schedule-form-maintenance-tab"

export function ChecklistScheduleForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const assetId = searchParams.get("asset")
  const maintenanceIntervalId = searchParams.get("maintenanceInterval")
  const templateId = searchParams.get("template")

  const [activeTab, setActiveTab] = useState("manual")
  const [isLoading, setIsLoading] = useState(false)

  const {
    templates,
    assets,
    users,
    plants,
    isLoaded,
    loadError,
    pendingSchedules,
    loadingPending,
    maintenanceIntervals,
    maintenancePlans,
    loadingIntervals,
    loadingPlans,
    fetchPendingSchedules,
    loadAssetMaintenanceContext,
  } = useScheduleFormData()

  const [formData, setFormData] = useState({
    template_id: templateId || "",
    asset_id: assetId || "",
    scheduled_date: new Date(),
    assigned_to: "",
  })

  const [maintenanceFormData, setMaintenanceFormData] = useState({
    asset_id: assetId || "",
    model_id: "",
    frequency: "mensual",
    assigned_to: "",
    maintenance_interval_id: maintenanceIntervalId || "",
    maintenance_plan_id: "",
  })

  useEffect(() => {
    const targetAssetId =
      activeTab === "manual" ? formData.asset_id : maintenanceFormData.asset_id

    if (!targetAssetId) return
    fetchPendingSchedules(targetAssetId)
  }, [
    activeTab,
    formData.asset_id,
    maintenanceFormData.asset_id,
    fetchPendingSchedules,
  ])

  useEffect(() => {
    if (!maintenanceFormData.asset_id) return

    let cancelled = false

    const loadAssetModel = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      try {
        const { data, error } = await supabase
          .from("assets")
          .select("model_id")
          .eq("id", maintenanceFormData.asset_id)
          .single()

        if (error) throw error
        if (cancelled) return

        const modelId = data?.model_id ?? ""
        setMaintenanceFormData((prev) => ({
          ...prev,
          model_id: modelId,
        }))

        if (modelId) {
          await loadAssetMaintenanceContext(maintenanceFormData.asset_id, modelId)
        }
      } catch (error) {
        console.error("Error loading asset model:", error)
      }
    }

    loadAssetModel()

    return () => {
      cancelled = true
    }
  }, [maintenanceFormData.asset_id, loadAssetMaintenanceContext])

  const handleFormChange = (field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleMaintenanceFormChange = (field: string, value: unknown) => {
    if (
      (field === "maintenance_plan_id" || field === "maintenance_interval_id") &&
      value === "none"
    ) {
      setMaintenanceFormData((prev) => ({
        ...prev,
        [field]: "",
      }))
      return
    }

    if (field === "asset_id") {
      setMaintenanceFormData((prev) => ({
        ...prev,
        asset_id: value as string,
        model_id: "",
        maintenance_interval_id: "",
        maintenance_plan_id: "",
      }))
      return
    }

    setMaintenanceFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const validateForm = () => {
    if (activeTab === "manual") {
      if (!formData.template_id) {
        toast.error("Debe seleccionar una plantilla")
        return false
      }
      if (!formData.asset_id) {
        toast.error("Debe seleccionar un activo")
        return false
      }
      if (!formData.assigned_to) {
        toast.error("Debe asignar un técnico")
        return false
      }
    } else {
      if (!maintenanceFormData.asset_id) {
        toast.error("Debe seleccionar un activo")
        return false
      }
      if (!maintenanceFormData.model_id) {
        toast.error("No se pudo determinar el modelo del activo")
        return false
      }
      if (!maintenanceFormData.assigned_to) {
        toast.error("Debe asignar un técnico")
        return false
      }
    }
    return true
  }

  const redirectPathForFrequency = (frequency: string | undefined) => {
    switch (frequency) {
      case "semanal":
        return "/checklists/semanales"
      case "mensual":
        return "/checklists/mensuales"
      case "diario":
        return "/checklists/diarios"
      default:
        return "/checklists"
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsLoading(true)

    try {
      let response: Response
      let result: { count?: number; error?: string; details?: unknown }

      if (activeTab === "manual") {
        response = await fetch("/api/checklists/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schedule: {
              ...formData,
              scheduled_date: formData.scheduled_date.toISOString(),
            },
          }),
        })

        result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Error al programar checklist")
        }
      } else {
        response = await fetch("/api/checklists/schedules/from-maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetId: maintenanceFormData.asset_id,
            modelId: maintenanceFormData.model_id,
            frequency: maintenanceFormData.frequency,
            assignedTo: maintenanceFormData.assigned_to,
            maintenanceIntervalId: maintenanceFormData.maintenance_interval_id || null,
            maintenancePlanId: maintenanceFormData.maintenance_plan_id || null,
          }),
        })

        result = await response.json()

        if (!response.ok) {
          if (response.status === 404 && result.details) {
            const details = result.details as {
              templatesForModel?: Array<{ frequency: string }>
            }
            let errorMessage = `No existen plantillas de checklist para ${maintenanceFormData.frequency}`
            if (details.templatesForModel?.length) {
              const frequencies = [
                ...new Set(details.templatesForModel.map((t) => t.frequency)),
              ].join(", ")
              errorMessage += `. Hay plantillas para este modelo con frecuencias: ${frequencies}`
            }
            throw new Error(errorMessage)
          }
          throw new Error(result.error || "Error al programar checklist")
        }
      }

      toast.success(
        activeTab === "manual"
          ? "Checklist programado exitosamente"
          : `${result.count} checklists programados exitosamente`
      )

      let redirectPath = "/checklists"
      if (activeTab === "manual") {
        const selectedTemplate = templates.find((t) => t.id === formData.template_id)
        redirectPath = redirectPathForFrequency(selectedTemplate?.frequency)
      } else {
        redirectPath = redirectPathForFrequency(maintenanceFormData.frequency)
      }

      router.push(redirectPath)
    } catch (error: unknown) {
      console.error("Error scheduling checklist:", error)
      const message =
        error instanceof Error ? error.message : "Error al programar el checklist"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const activePendingSchedules = useMemo(() => {
    return pendingSchedules
  }, [pendingSchedules])

  return (
    <div className="space-y-4">
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Programación de checklist</CardTitle>
          <CardDescription>
            Elija planta y activo, filtre plantillas compatibles y revise programaciones
            existentes antes de confirmar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isLoaded ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Cargando plantillas, activos y usuarios…</span>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual</TabsTrigger>
                <TabsTrigger value="maintenance">Desde mantenimiento</TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="pt-4">
                <ManualScheduleTab
                  formData={formData}
                  onChange={handleFormChange}
                  templates={templates}
                  assets={assets}
                  plants={plants}
                  users={users}
                  pendingSchedules={activePendingSchedules}
                  loadingPending={loadingPending}
                />
              </TabsContent>

              <TabsContent value="maintenance" className="pt-4">
                <MaintenanceScheduleTab
                  formData={maintenanceFormData}
                  onChange={handleMaintenanceFormChange}
                  assets={assets}
                  plants={plants}
                  users={users}
                  maintenanceIntervals={maintenanceIntervals}
                  maintenancePlans={maintenancePlans}
                  pendingSchedules={activePendingSchedules}
                  loadingPending={loadingPending}
                  loadingIntervals={loadingIntervals}
                  loadingPlans={loadingPlans}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSubmit} disabled={isLoading || !isLoaded}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Programando…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Programar checklist
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
