import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuthStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import {
  fetchPlantsForScope,
  resolveClientPlantIds,
} from '@/lib/auth/client-plant-scope'

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

async function attachBusinessUnitNames(
  supabase: ReturnType<typeof createClient>,
  plants: Array<{ id: string; name: string; business_unit_id: string | null }>
): Promise<UserPlant[]> {
  const businessUnitIds = [
    ...new Set(plants.map((p) => p.business_unit_id).filter(Boolean)),
  ] as string[]

  let businessUnits: { id: string; name: string }[] = []
  if (businessUnitIds.length > 0) {
    const { data: buData } = await supabase
      .from('business_units')
      .select('id, name')
      .in('id', businessUnitIds)
    businessUnits = buData ?? []
  }

  return plants.map((plant) => {
    const businessUnit = businessUnits.find((bu) => bu.id === plant.business_unit_id)
    return {
      plant_id: plant.id,
      plant_name: plant.name,
      business_unit_id: plant.business_unit_id ?? undefined,
      business_unit_name: businessUnit?.name || undefined,
    }
  })
}

export function useUserPlant(): UserPlantsHook {
  const { user, profile, isInitialized } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      profile: s.profile,
      isInitialized: s.isInitialized,
    }))
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

        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('id, role, plant_id, business_unit_id')
          .eq('id', userId)
          .single()

        if (profileError || !profileRow) {
          setError('No se pudo cargar la información del usuario')
          return
        }

        setUserRole(profileRow.role)

        const scopeProfile = {
          id: profileRow.id,
          role: profileRow.role,
          plant_id: profileRow.plant_id,
          business_unit_id: profileRow.business_unit_id,
          managed_plant_ids: profile?.managed_plant_ids,
        }

        const scopedIds = await resolveClientPlantIds(supabase, scopeProfile)

        // Global / BU-wide users without a pinned plant see every plant RLS allows.
        const unpinnedGlobal =
          profileRow.plant_id === null &&
          profileRow.business_unit_id === null &&
          profileRow.role !== 'JEFE_PLANTA' &&
          profileRow.role !== 'ENCARGADO_MANTENIMIENTO'

        const unpinnedBu =
          profileRow.plant_id === null &&
          profileRow.business_unit_id !== null &&
          profileRow.role === 'JEFE_UNIDAD_NEGOCIO'

        const hasFull = unpinnedGlobal || unpinnedBu
        setHasFullAccess(hasFull)

        if (scopedIds.length > 0) {
          const plants = await fetchPlantsForScope(supabase, scopedIds)
          if (plants.length === 0) {
            setError(
              'No se pudieron cargar tus plantas asignadas. Cierra sesión y vuelve a entrar, o contacta a Recursos Humanos.'
            )
            setUserPlants([])
            return
          }
          setUserPlants(await attachBusinessUnitNames(supabase, plants))
          return
        }

        if (hasFull) {
          let plantQuery = supabase
            .from('plants')
            .select('id, name, business_unit_id')
            .eq('status', 'active')
            .order('name')

          if (unpinnedBu && profileRow.business_unit_id) {
            plantQuery = plantQuery.eq('business_unit_id', profileRow.business_unit_id)
          }

          const { data: allPlants, error: plantsError } = await plantQuery

          if (plantsError) {
            setError('No se pudieron cargar las plantas')
            return
          }

          setUserPlants(
            await attachBusinessUnitNames(supabase, (allPlants ?? []) as Array<{
              id: string
              name: string
              business_unit_id: string | null
            }>)
          )
          return
        }

        setUserPlants([])
        setError(
          'Tu usuario no tiene plantas asignadas. Contacta a Recursos Humanos para revisar tu alcance.'
        )
      } catch (err) {
        console.error('useUserPlant:', err)
        setError('Error al cargar la información de las plantas')
      } finally {
        setLoading(false)
      }
    }

    fetchUserPlants()
  }, [isInitialized, user?.id, profile?.managed_plant_ids])

  return { userPlants, loading, error, userRole, hasFullAccess }
}
