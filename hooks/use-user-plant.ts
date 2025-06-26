import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

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
  const [userPlants, setUserPlants] = useState<UserPlant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [hasFullAccess, setHasFullAccess] = useState(false)

  useEffect(() => {
    const fetchUserPlants = async () => {
      try {
        const supabase = createClient()
        
        // Get current authenticated user first
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) {
          console.error('Auth error:', userError)
          setError('Error de autenticación')
          return
        }
        
        if (!user) {
          setError('Usuario no autenticado')
          return
        }

        console.log('Current user ID:', user.id)
        
        // Get the user's authorization info using the authenticated user ID
        const { data: authData, error: authError } = await supabase
          .from('user_authorization_summary')
          .select('role, plant_id, plant_name, business_unit_id, business_unit_name')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (authError) {
          console.error('Error fetching user authorization:', authError)
          setError('No se pudo cargar la información del usuario')
          return
        }

        console.log('User authorization data:', authData)
        setUserRole(authData.role)

        // CORRECT LOGIC: NULL plant_id = access to ALL plants
        const hasFullAccess = authData.plant_id === null
        setHasFullAccess(hasFullAccess)

        console.log('Has full access:', hasFullAccess)

        if (hasFullAccess) {
          // User has NULL plant_id - fetch ALL active plants
          const { data: allPlants, error: plantsError } = await supabase
            .from('plants')
            .select('id, name, business_unit_id')
            .eq('status', 'active')
            .order('name')

          if (plantsError) {
            console.error('Error fetching all plants:', plantsError)
            setError('No se pudieron cargar las plantas')
            return
          }

          console.log('All plants fetched:', allPlants?.length)

          // Get business unit names for the plants
          const businessUnitIds = [...new Set(allPlants.map(p => p.business_unit_id).filter(Boolean))]
          let businessUnits: any[] = []
          
          if (businessUnitIds.length > 0) {
            const { data: buData, error: buError } = await supabase
              .from('business_units')
              .select('id, name')
              .in('id', businessUnitIds)
            
            if (!buError && buData) {
              businessUnits = buData
            }
          }

          // Filter out any plants without IDs and ensure plant_id is always a string
          const plantsWithBU = allPlants
            .filter(plant => plant.id) // Only plants with valid IDs
            .map(plant => {
              const businessUnit = businessUnits.find(bu => bu.id === plant.business_unit_id)
              return {
                plant_id: plant.id,
                plant_name: plant.name,
                business_unit_id: plant.business_unit_id,
                business_unit_name: businessUnit?.name || null
              }
            })

          console.log('Final plants with BU:', plantsWithBU)
          setUserPlants(plantsWithBU)
        } else {
          // User has specific plant_id - get their assigned plants
          // For now, get all user authorization entries (in case they have multiple plants)
          const { data: userSpecificPlants, error: userPlantsError } = await supabase
            .from('user_authorization_summary')
            .select('plant_id, plant_name, business_unit_id, business_unit_name')
            .eq('user_id', user.id)
            .not('plant_id', 'is', null)

          if (userPlantsError) {
            console.error('Error fetching user specific plants:', userPlantsError)
            setError('No se pudieron cargar las plantas del usuario')
            return
          }

          console.log('User specific plants:', userSpecificPlants)

          // Remove duplicates and filter for valid plant IDs
          const uniquePlants = userSpecificPlants
            .filter(plant => plant.plant_id) // Only plants with valid IDs
            .filter((plant, index, array) => 
              array.findIndex(p => p.plant_id === plant.plant_id) === index
            )

          const plants = uniquePlants.map(p => ({
            plant_id: p.plant_id,
            plant_name: p.plant_name,
            business_unit_id: p.business_unit_id,
            business_unit_name: p.business_unit_name
          }))

          console.log('Final user plants:', plants)
          setUserPlants(plants)
        }
      } catch (err) {
        console.error('Error:', err)
        setError('Error al cargar la información de las plantas')
      } finally {
        setLoading(false)
      }
    }

    fetchUserPlants()
  }, [])

  return { userPlants, loading, error, userRole, hasFullAccess }
} 