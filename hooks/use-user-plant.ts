import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuthStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'

interface UserPlant {
  plant_id: string
  plant_name: string
  business_unit_id?: string
  business_unit_name?: string
}

interface UserPlantsHook {
  userPlants: UserPlant[]
  loading: boolean
  error: string | null
  userRole: string | null
  hasFullAccess: boolean
}

export function useUserPlant(): UserPlantsHook {
  const { user, isInitialized } = useAuthStore(
    useShallow((s) => ({ user: s.user, isInitialized: s.isInitialized }))
  )
  const [userPlants, setUserPlants] = useState<UserPlant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [hasFullAccess, setHasFullAccess] = useState(false)

  useEffect(() => {
    if (!isInitialized) {
      return
    }
    if (!user?.id) {
      setError('Usuario no autenticado')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const fetchUserPlants = async () => {
      try {
        const supabase = createClient()
        const userId = user.id

        const { data: authData, error: authError } = await supabase
          .from('user_authorization_summary')
          .select('role, plant_id, plant_name, business_unit_id, business_unit_name')
          .eq('user_id', userId)
          .limit(1)
          .single()

        if (authError) {
          setError('No se pudo cargar la información del usuario')
          return
        }

        setUserRole(authData.role)

        // NULL plant_id = access to ALL plants (global / unpinned scope)
        const hasFull = authData.plant_id === null
        setHasFullAccess(hasFull)

        if (hasFull) {
          const { data: allPlants, error: plantsError } = await supabase
            .from('plants')
            .select('id, name, business_unit_id')
            .eq('status', 'active')
            .order('name')

          if (plantsError) {
            setError('No se pudieron cargar las plantas')
            return
          }

          const businessUnitIds = [
            ...new Set((allPlants ?? []).map((p) => p.business_unit_id).filter(Boolean)),
          ] as string[]
          let businessUnits: { id: string; name: string }[] = []
          if (businessUnitIds.length > 0) {
            const { data: buData, error: buError } = await supabase
              .from('business_units')
              .select('id, name')
              .in('id', businessUnitIds)
            if (!buError && buData) {
              businessUnits = buData
            }
          }

          const plantsWithBU = (allPlants ?? [])
            .filter((plant) => plant.id)
            .map((plant) => {
              const businessUnit = businessUnits.find((bu) => bu.id === plant.business_unit_id)
              return {
                plant_id: plant.id,
                plant_name: plant.name,
                business_unit_id: plant.business_unit_id,
                business_unit_name: businessUnit?.name || undefined,
              }
            })

          setUserPlants(plantsWithBU)
        } else {
          // Multi-plant Jefe de Planta: union from profile + junction (see `user_plants_expanded` view)
          const { data: expanded, error: expandedError } = await supabase
            .from('user_plants_expanded')
            .select('plant_id, plant_name, business_unit_id, business_unit_name')
            .order('plant_name')

          if (!expandedError && expanded && expanded.length > 0) {
            setUserPlants(
              expanded
                .filter((p) => p.plant_id)
                .map((p) => ({
                  plant_id: p.plant_id!,
                  plant_name: p.plant_name ?? '',
                  business_unit_id: p.business_unit_id ?? undefined,
                  business_unit_name: p.business_unit_name ?? undefined,
                }))
            )
            return
          }

          const { data: userSpecificPlants, error: userPlantsError } = await supabase
            .from('user_authorization_summary')
            .select('plant_id, plant_name, business_unit_id, business_unit_name')
            .eq('user_id', userId)
            .not('plant_id', 'is', null)

          if (userPlantsError) {
            setError('No se pudieron cargar las plantas del usuario')
            return
          }

          const uniquePlants = (userSpecificPlants ?? [])
            .filter((plant) => plant.plant_id)
            .filter(
              (plant, index, array) =>
                array.findIndex((p) => p.plant_id === plant.plant_id) === index
            )

          setUserPlants(
            uniquePlants.map((p) => ({
              plant_id: p.plant_id!,
              plant_name: p.plant_name ?? '',
              business_unit_id: p.business_unit_id,
              business_unit_name: p.business_unit_name,
            }))
          )
        }
      } catch (err) {
        console.error('useUserPlant:', err)
        setError('Error al cargar la información de las plantas')
      } finally {
        setLoading(false)
      }
    }

    fetchUserPlants()
  }, [isInitialized, user?.id])

  return { userPlants, loading, error, userRole, hasFullAccess }
}
