'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { createClient } from '@/lib/supabase'

export interface PersonnelBoardProfile {
  id: string
  nombre: string
  apellido: string
  role: string
  employee_code: string
  position: string
  shift: string
  telefono: string
  plant_id: string | null
  business_unit_id: string | null
  status: string
  plants?: {
    id: string
    name: string
    code: string
  }
  business_units?: {
    id: string
    name: string
  }
  _isUpdating?: boolean
  _originalPlantId?: string | null
  _originalBusinessUnitId?: string | null
}

export interface PersonnelBoardPlant {
  id: string
  name: string
  code: string
  business_unit_id: string
  status: string
  business_units?: {
    id: string
    name: string
  }
}

export interface PersonnelBoardBusinessUnit {
  id: string
  name: string
  code: string
}

export function usePersonnelBoardData(profile: {
  id?: string | null
  role?: string | null
  business_unit_id?: string | null
  plant_id?: string | null
} | null) {
  const [operators, setOperators] = useState<PersonnelBoardProfile[]>([])
  const [plants, setPlants] = useState<PersonnelBoardPlant[]>([])
  const [businessUnits, setBusinessUnits] = useState<PersonnelBoardBusinessUnit[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      const [operatorsRes, plantsRes, businessUnitsRes] = await Promise.all([
        fetch('/api/operators/register'),
        fetch('/api/plants'),
        fetch('/api/business-units'),
      ])

      const [operatorsData, plantsData, businessUnitsData] = await Promise.all([
        operatorsRes.ok ? operatorsRes.json() : [],
        plantsRes.ok ? plantsRes.json() : [],
        businessUnitsRes.ok ? businessUnitsRes.json() : [],
      ])

      const rawOperators = Array.isArray(operatorsData)
        ? operatorsData
        : (operatorsData?.operators || [])
      const rawPlants = Array.isArray(plantsData) ? plantsData : (plantsData?.plants || [])
      const rawBusinessUnits = Array.isArray(businessUnitsData)
        ? businessUnitsData
        : (businessUnitsData?.business_units || [])

      let filteredOperators: PersonnelBoardProfile[] = rawOperators
      let filteredPlants: PersonnelBoardPlant[] = rawPlants
      let filteredBusinessUnits: PersonnelBoardBusinessUnit[] = rawBusinessUnits

      if (profile?.role === 'JEFE_UNIDAD_NEGOCIO' && profile?.business_unit_id) {
        filteredBusinessUnits = rawBusinessUnits.filter(
          (bu: PersonnelBoardBusinessUnit) => bu.id === profile.business_unit_id
        )
        filteredPlants = rawPlants.filter(
          (p: PersonnelBoardPlant) => p.business_unit_id === profile.business_unit_id
        )
        filteredOperators = rawOperators.filter(
          (op: PersonnelBoardProfile) =>
            op.business_unit_id === profile.business_unit_id ||
            filteredPlants.some((p: PersonnelBoardPlant) => p.id === op.plant_id) ||
            (!op.plant_id && !op.business_unit_id)
        )
      } else if (profile?.role === 'JEFE_PLANTA' && profile?.id) {
        const supabase = createClient()
        const { data: managedIds } = await supabase.rpc('profile_scoped_plant_ids', {
          p_user_id: profile.id,
        })
        const plantIds: string[] =
          Array.isArray(managedIds) && managedIds.length > 0
            ? managedIds
            : profile.plant_id
              ? [profile.plant_id]
              : []
        if (plantIds.length > 0) {
          const plantSet = new Set(plantIds)
          filteredPlants = rawPlants.filter((p: PersonnelBoardPlant) => plantSet.has(p.id))
          const buIds = [
            ...new Set(
              filteredPlants.map((p: PersonnelBoardPlant) => p.business_unit_id).filter(Boolean)
            ),
          ] as string[]
          filteredBusinessUnits = rawBusinessUnits.filter((bu: PersonnelBoardBusinessUnit) =>
            buIds.includes(bu.id)
          )
          filteredOperators = rawOperators.filter(
            (op: PersonnelBoardProfile) => op.plant_id != null && plantSet.has(op.plant_id)
          )
        }
      }

      setOperators(filteredOperators)
      setPlants(filteredPlants)
      setBusinessUnits(filteredBusinessUnits)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    refetch()
  }, [refetch])

  return {
    operators,
    setOperators,
    plants,
    businessUnits,
    loading,
    refetch,
  }
}
