import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Función para calcular la fecha estimada basada en horas promedio
function calculateEstimatedDate(currentHours: number, targetHours: number, dailyHours: number = 8): Date {
  const hoursRemaining = targetHours - currentHours;
  const daysRemaining = Math.ceil(hoursRemaining / dailyHours);
  
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + daysRemaining);
  
  return estimatedDate;
}

// Función para calcular la fecha estimada basada en kilómetros promedio
function calculateEstimatedDateByKm(currentKm: number, targetKm: number, dailyKm: number = 100): Date {
  const kmRemaining = targetKm - currentKm;
  const daysRemaining = Math.ceil(kmRemaining / dailyKm);
  
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + daysRemaining);
  
  return estimatedDate;
}

export async function GET(request: Request) {
  try {
    // Obtener parámetros de paginación
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    
    // Parámetros de filtro
    const statusFilter = searchParams.get('status')
    const sortBy = searchParams.get('sortBy') || 'default'
    const assetIdFilter = searchParams.get('assetId')
    
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Obtener todos los activos con sus modelos e intervalos de mantenimiento
    let assetsQuery = supabase
      .from('assets')
      .select(`
        id,
        name,
        asset_id,
        current_hours,
        current_kilometers,
        last_maintenance_date,
        equipment_models (
          id,
          name,
          manufacturer,
          maintenance_unit,
          maintenance_intervals (
            id,
            interval_value,
            type,
            description,
            name
          )
        )
      `)
      .eq('status', 'operational')

    // Filter by specific asset if assetId parameter is provided
    if (assetIdFilter) {
      assetsQuery = assetsQuery.eq('id', assetIdFilter)
    }

    const { data: assets, error: assetsError } = await assetsQuery

    if (assetsError) {
      throw assetsError
    }

    if (!assets || assets.length === 0) {
      return NextResponse.json({ 
        upcomingMaintenances: [],
        summary: { overdue: 0, upcoming: 0, covered: 0, scheduled: 0, highUrgency: 0, mediumUrgency: 0 }
      })
    }

    const upcomingMaintenances = []

    for (const asset of assets) {
      const equipmentModel = asset.equipment_models as any
      if (!equipmentModel?.maintenance_intervals) continue

      const currentHours = asset.current_hours || 0
      const currentKm = asset.current_kilometers || 0
      const maintenanceUnit = equipmentModel.maintenance_unit

      // Obtener TODOS los mantenimientos de este activo ordenados por fecha
      const { data: allMaintenances, error: maintenanceError } = await supabase
        .from('maintenance_history')
        .select('maintenance_plan_id, hours, kilometers, date')
        .eq('asset_id', asset.id)
        .order('date', { ascending: false })

      if (maintenanceError) {
        console.error('Error getting maintenance history:', maintenanceError)
        continue
      }

      // Aplicar la MISMA lógica que la página de mantenimiento individual
      
      // Encontrar la hora/km del último mantenimiento realizado (cualquier tipo)
      let lastMaintenanceValue = 0
      if (maintenanceUnit === 'hours') {
        const allMaintenanceHours = (allMaintenances || [])
          .map(m => Number(m.hours) || 0)
          .filter(h => h > 0)
          .sort((a, b) => b - a) // Ordenar de mayor a menor
        
        lastMaintenanceValue = allMaintenanceHours.length > 0 ? allMaintenanceHours[0] : 0
      } else {
        const allMaintenanceKm = (allMaintenances || [])
          .map(m => Number(m.kilometers) || 0)
          .filter(k => k > 0)
          .sort((a, b) => b - a)
        
        lastMaintenanceValue = allMaintenanceKm.length > 0 ? allMaintenanceKm[0] : 0
      }

      for (const interval of equipmentModel.maintenance_intervals) {
        // Encontrar si este mantenimiento específico ya se realizó
        const lastMaintenanceOfType = allMaintenances?.find(m => 
          m.maintenance_plan_id === interval.id
        )

        let status: string
        let urgency: 'low' | 'medium' | 'high'
        let estimatedDate: Date
        let currentValue: number
        let targetValue: number
        let valueRemaining: number
        let lastMaintenance = null

        const intervalValue = interval.interval_value || 0

        if (maintenanceUnit === 'hours') {
          currentValue = currentHours
          
          if (lastMaintenanceOfType) {
            // Este mantenimiento YA se realizó - ya no aplica, no es cíclico
            // Por lo tanto, no lo incluimos en los próximos mantenimientos
            continue
          } else {
            // Este mantenimiento NUNCA se realizó - aplicar lógica de "cubierto"
            targetValue = intervalValue
            valueRemaining = targetValue - currentValue
            
            // Verificar si fue "cubierto" por un mantenimiento posterior
            if (intervalValue <= lastMaintenanceValue) {
              // Fue cubierto por mantenimientos posteriores
              status = 'covered'
              urgency = 'low'
              estimatedDate = new Date() // Ya está cubierto
            } else if (currentValue >= intervalValue) {
              // Las horas actuales ya pasaron este intervalo - VENCIDO
              const hoursOverdue = currentValue - intervalValue
              status = 'overdue'
              
              if (hoursOverdue > intervalValue * 0.5) {
                urgency = 'high'
              } else {
                urgency = 'medium'
              }
              estimatedDate = new Date() // Ya debería haberse hecho
            } else {
              // Las horas actuales aún no llegan a este intervalo
              estimatedDate = calculateEstimatedDate(currentValue, targetValue)
              const progress = Math.round((currentValue / intervalValue) * 100)
              
              if (progress >= 90) {
                status = 'upcoming'
                urgency = 'medium'
              } else {
                status = 'scheduled'
                urgency = 'low'
              }
            }
          }
        } else {
          // Lógica similar para kilómetros
          currentValue = currentKm
          
          if (lastMaintenanceOfType) {
            // Este mantenimiento YA se realizó - ya no aplica, no es cíclico
            continue
          } else {
            targetValue = intervalValue
            valueRemaining = targetValue - currentValue
            
            if (intervalValue <= lastMaintenanceValue) {
              status = 'covered'
              urgency = 'low'
              estimatedDate = new Date()
            } else if (currentValue >= intervalValue) {
              const kmOverdue = currentValue - intervalValue
              status = 'overdue'
              urgency = kmOverdue > intervalValue * 0.5 ? 'high' : 'medium'
              estimatedDate = new Date()
            } else {
              estimatedDate = calculateEstimatedDateByKm(currentValue, targetValue)
              const progress = Math.round((currentValue / intervalValue) * 100)
              
              if (progress >= 90) {
                status = 'upcoming'
                urgency = 'medium'
              } else {
                status = 'scheduled'
                urgency = 'low'
              }
            }
          }
        }

        // For asset detail page (when assetId is provided), show only overdue and upcoming
        // For calendar page (no assetId), show all statuses for complete calendar view
        const statusesToInclude = assetIdFilter 
          ? ['overdue', 'upcoming'] 
          : ['overdue', 'upcoming', 'covered', 'scheduled']

        if (statusesToInclude.includes(status)) {
          upcomingMaintenances.push({
            id: `${asset.id}-${interval.id}`,
            assetId: asset.id,
            assetName: asset.name,
            assetCode: asset.asset_id,
            intervalId: interval.id,
            intervalName: interval.name || interval.description,
            intervalType: interval.type,
            targetValue,
            currentValue,
            valueRemaining,
            unit: maintenanceUnit,
            estimatedDate: estimatedDate.toISOString(),
            status,
            urgency,
            lastMaintenance
          })
        }
      }
    }

    // Filtrar por status si se especificó
    let filteredMaintenances = upcomingMaintenances
    if (statusFilter) {
      filteredMaintenances = upcomingMaintenances.filter(m => m.status === statusFilter)
    }

    // Ordenar según el criterio seleccionado
    switch (sortBy) {
      case 'urgency':
        // Ordenar solo por urgencia, de mayor a menor
        filteredMaintenances.sort((a, b) => {
          const urgencyOrder = { 'high': 3, 'medium': 2, 'low': 1 }
          return (urgencyOrder[b.urgency] || 0) - (urgencyOrder[a.urgency] || 0)
        })
        break
      case 'date':
        // Ordenar por fecha estimada (más cercana primero)
        filteredMaintenances.sort((a, b) => 
          new Date(a.estimatedDate).getTime() - new Date(b.estimatedDate).getTime()
        )
        break
      case 'asset':
        // Ordenar por nombre de activo
        filteredMaintenances.sort((a, b) => 
          a.assetName.localeCompare(b.assetName)
        )
        break
      default:
        // Ordenar por prioridad (status, luego urgencia, luego fecha)
        filteredMaintenances.sort((a, b) => {
          // Primero por status
          const statusOrder = { 'overdue': 3, 'upcoming': 2, 'covered': 1 }
          const statusA = statusOrder[a.status as keyof typeof statusOrder] || 0
          const statusB = statusOrder[b.status as keyof typeof statusOrder] || 0
          
          if (statusA !== statusB) {
            return statusB - statusA
          }
          
          // Luego por urgencia
          const urgencyOrder = { 'high': 3, 'medium': 2, 'low': 1 }
          const urgencyA = urgencyOrder[a.urgency] || 0
          const urgencyB = urgencyOrder[b.urgency] || 0
          
          if (urgencyA !== urgencyB) {
            return urgencyB - urgencyA
          }
          
          // Finalmente por fecha estimada
          return new Date(a.estimatedDate).getTime() - new Date(b.estimatedDate).getTime()
        })
    }

    return NextResponse.json({
      upcomingMaintenances: filteredMaintenances.slice(offset, offset + limit),
      totalCount: filteredMaintenances.length,
      summary: {
        overdue: filteredMaintenances.filter(m => m.status === 'overdue').length,
        upcoming: filteredMaintenances.filter(m => m.status === 'upcoming').length,
        covered: filteredMaintenances.filter(m => m.status === 'covered').length,
        scheduled: filteredMaintenances.filter(m => m.status === 'scheduled').length,
        highUrgency: filteredMaintenances.filter(m => m.urgency === 'high').length,
        mediumUrgency: filteredMaintenances.filter(m => m.urgency === 'medium').length
      }
    })

  } catch (error) {
    console.error('Error fetching upcoming maintenance:', error)
    return NextResponse.json(
      { error: 'Error al obtener los próximos mantenimientos' },
      { status: 500 }
    )
  }
} 