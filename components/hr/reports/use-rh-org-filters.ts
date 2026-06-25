'use client'

import { useEffect, useMemo, useState } from 'react'

export type RhOrgPlant = { id: string; name: string; business_unit_id: string }
export type RhOrgBusinessUnit = { id: string; name: string }

export type RhOrgFilterState = {
  businessUnit: string
  plant: string
}

export function useRhOrgFilters() {
  const [businessUnit, setBusinessUnit] = useState('all')
  const [plant, setPlant] = useState('all')
  const [businessUnits, setBusinessUnits] = useState<RhOrgBusinessUnit[]>([])
  const [plants, setPlants] = useState<RhOrgPlant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrg() {
      try {
        setLoading(true)
        setError(null)
        const [buRes, plantsRes] = await Promise.all([
          fetch('/api/business-units'),
          fetch('/api/plants'),
        ])
        if (!buRes.ok || !plantsRes.ok) {
          throw new Error('No se pudieron cargar unidades ni plantas')
        }
        const buData = await buRes.json()
        const plantsData = await plantsRes.json()
        setBusinessUnits(buData.business_units ?? [])
        setPlants(plantsData.plants ?? [])
      } catch (err) {
        console.error('[rh-org-filters]', err)
        setError(err instanceof Error ? err.message : 'Error al cargar filtros')
      } finally {
        setLoading(false)
      }
    }
    void loadOrg()
  }, [])

  const filteredPlants = useMemo(() => {
    if (businessUnit === 'all') return plants
    return plants.filter((p) => p.business_unit_id === businessUnit)
  }, [plants, businessUnit])

  const handleBusinessUnitChange = (value: string) => {
    setBusinessUnit(value)
    setPlant('all')
  }

  return {
    businessUnit,
    plant,
    businessUnits,
    plants: filteredPlants,
    allPlants: plants,
    loading,
    error,
    setBusinessUnit: handleBusinessUnitChange,
    setPlant,
    filters: { businessUnit, plant } satisfies RhOrgFilterState,
  }
}
