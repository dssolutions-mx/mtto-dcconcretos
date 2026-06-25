"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { toast } from "sonner"
import type {
  MaintenanceInterval,
  MaintenancePlan,
  PendingSchedule,
  ScheduleAsset,
  SchedulePlant,
  ScheduleTemplate,
  ScheduleUser,
} from "./types"

type LoadState = {
  templates: ScheduleTemplate[]
  assets: ScheduleAsset[]
  users: ScheduleUser[]
  plants: SchedulePlant[]
  loadingTemplates: boolean
  loadingAssets: boolean
  loadingUsers: boolean
  loadError: string | null
}

const initialLoadState: LoadState = {
  templates: [],
  assets: [],
  users: [],
  plants: [],
  loadingTemplates: true,
  loadingAssets: true,
  loadingUsers: true,
  loadError: null,
}

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function useScheduleFormData() {
  const [loadState, setLoadState] = useState<LoadState>(initialLoadState)
  const [pendingSchedules, setPendingSchedules] = useState<PendingSchedule[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [maintenanceIntervals, setMaintenanceIntervals] = useState<MaintenanceInterval[]>([])
  const [maintenancePlans, setMaintenancePlans] = useState<MaintenancePlan[]>([])
  const [loadingIntervals, setLoadingIntervals] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCoreData() {
      const supabase = createSupabase()

      const templatesPromise = supabase
        .from("checklists")
        .select(
          `
          id,
          name,
          frequency,
          model_id,
          executor_roles,
          equipment_models ( name, maintenance_unit ),
          checklist_sections ( section_type, title )
        `
        )
        .order("name")

      const assetsPromise = supabase
        .from("assets")
        .select(
          `
          id,
          name,
          asset_id,
          location,
          model_id,
          plant_id,
          plants ( id, name ),
          equipment_models ( name, maintenance_unit )
        `
        )
        .in("status", ["operational", "maintenance"])
        .order("asset_id")

      const usersPromise = supabase
        .from("profiles")
        .select("id, nombre, apellido, role, plant_id")
        .order("nombre")

      const [templatesResult, assetsResult, usersResult] = await Promise.all([
        templatesPromise,
        assetsPromise,
        usersPromise,
      ])

      if (cancelled) return

      const errors: string[] = []

      if (templatesResult.error) {
        console.error("Error loading templates:", templatesResult.error)
        errors.push("plantillas")
      }
      if (assetsResult.error) {
        console.error("Error loading assets:", assetsResult.error)
        errors.push("activos")
      }
      if (usersResult.error) {
        console.error("Error loading users:", usersResult.error)
        errors.push("técnicos")
      }

      const plantsMap = new Map<string, SchedulePlant>()
      for (const asset of assetsResult.data ?? []) {
        const plant = (asset as ScheduleAsset).plants
        if (plant?.name) {
          const plantId = plant.id ?? asset.plant_id
          if (plantId) {
            plantsMap.set(plantId, { id: plantId, name: plant.name })
          }
        }
      }

      const plants = [...plantsMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "es")
      )

      setLoadState({
        templates: (templatesResult.data as ScheduleTemplate[]) ?? [],
        assets: (assetsResult.data as ScheduleAsset[]) ?? [],
        users: (usersResult.data as ScheduleUser[]) ?? [],
        plants,
        loadingTemplates: false,
        loadingAssets: false,
        loadingUsers: false,
        loadError:
          errors.length > 0
            ? `No se pudieron cargar: ${errors.join(", ")}`
            : null,
      })

      if (errors.length > 0) {
        toast.error("Error al cargar datos del formulario")
      }
    }

    loadCoreData()

    return () => {
      cancelled = true
    }
  }, [])

  const fetchPendingSchedules = useCallback(async (assetId: string) => {
    if (!assetId) {
      setPendingSchedules([])
      return
    }

    setLoadingPending(true)
    try {
      const response = await fetch(
        `/api/checklists/schedules?status=pendiente&assetId=${encodeURIComponent(assetId)}`
      )
      if (!response.ok) {
        throw new Error(`Error ${response.status}`)
      }
      const json = await response.json()
      setPendingSchedules((json.data as PendingSchedule[]) ?? [])
    } catch (error) {
      console.error("Error loading pending schedules:", error)
      setPendingSchedules([])
    } finally {
      setLoadingPending(false)
    }
  }, [])

  const fetchMaintenanceIntervals = useCallback(async (modelId: string) => {
    if (!modelId) {
      setMaintenanceIntervals([])
      return
    }

    setLoadingIntervals(true)
    try {
      const response = await fetch(`/api/models/${modelId}/maintenance-intervals`)
      if (!response.ok) {
        throw new Error(`Error ${response.status}`)
      }
      const data = await response.json()
      setMaintenanceIntervals((data as MaintenanceInterval[]) ?? [])
    } catch (error) {
      console.error("Error loading maintenance intervals:", error)
      toast.error("Error al cargar los intervalos de mantenimiento")
      setMaintenanceIntervals([])
    } finally {
      setLoadingIntervals(false)
    }
  }, [])

  const fetchMaintenancePlans = useCallback(async (assetId: string) => {
    if (!assetId) {
      setMaintenancePlans([])
      return
    }

    setLoadingPlans(true)
    try {
      const supabase = createSupabase()
      const { data, error } = await supabase
        .from("maintenance_plans")
        .select(
          `
          *,
          maintenance_intervals(name, type)
        `
        )
        .eq("asset_id", assetId)
        .order("next_due", { ascending: true })

      if (error) throw error
      setMaintenancePlans((data as MaintenancePlan[]) ?? [])
    } catch (error) {
      console.error("Error loading maintenance plans:", error)
      toast.error("Error al cargar los planes de mantenimiento")
      setMaintenancePlans([])
    } finally {
      setLoadingPlans(false)
    }
  }, [])

  const loadAssetMaintenanceContext = useCallback(
    async (assetId: string, modelId: string | null) => {
      await Promise.all([
        fetchPendingSchedules(assetId),
        modelId ? fetchMaintenanceIntervals(modelId) : Promise.resolve(),
        fetchMaintenancePlans(assetId),
      ])
    },
    [fetchMaintenanceIntervals, fetchMaintenancePlans, fetchPendingSchedules]
  )

  const isLoaded = useMemo(
    () =>
      !loadState.loadingTemplates &&
      !loadState.loadingAssets &&
      !loadState.loadingUsers,
    [loadState.loadingAssets, loadState.loadingTemplates, loadState.loadingUsers]
  )

  return {
    ...loadState,
    isLoaded,
    pendingSchedules,
    loadingPending,
    maintenanceIntervals,
    maintenancePlans,
    loadingIntervals,
    loadingPlans,
    fetchPendingSchedules,
    loadAssetMaintenanceContext,
  }
}
