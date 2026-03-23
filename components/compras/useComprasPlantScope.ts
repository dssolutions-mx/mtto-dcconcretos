"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useAuthZustand } from "@/hooks/use-auth-zustand"

/**
 * Plant IDs the current user may see in Compras (matches asset-selector / personnel scoping).
 * - `allowedPlantIds === null` = no restriction (global / gerencia).
 * - non-null `Set` = only POs whose resolved plant is in the set.
 * - `resolving` = true while loading plant IDs for a business-unit-scoped user (avoid showing other BUs).
 */
export function useComprasPlantScope(): {
  allowedPlantIds: Set<string> | null
  resolving: boolean
} {
  const { profile } = useAuthZustand()
  const [allowedPlantIds, setAllowedPlantIds] = useState<Set<string> | null>(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    let cancelled = false

    const finish = (ids: Set<string> | null) => {
      if (!cancelled) {
        setAllowedPlantIds(ids)
        setResolving(false)
      }
    }

    if (!profile?.id) {
      finish(null)
      return () => {
        cancelled = true
      }
    }

    if (profile.plant_id) {
      finish(new Set([profile.plant_id]))
      return () => {
        cancelled = true
      }
    }

    if (profile.business_unit_id) {
      setResolving(true)
      const supabase = createClient()
      void supabase
        .from("plants")
        .select("id")
        .eq("business_unit_id", profile.business_unit_id)
        .then(({ data, error }) => {
          if (cancelled) return
          if (error || !data?.length) {
            finish(new Set())
          } else {
            finish(new Set(data.map((p) => p.id).filter(Boolean)))
          }
        })
      return () => {
        cancelled = true
      }
    }

    finish(null)
    return () => {
      cancelled = true
    }
  }, [profile?.id, profile?.plant_id, profile?.business_unit_id])

  return { allowedPlantIds, resolving }
}
