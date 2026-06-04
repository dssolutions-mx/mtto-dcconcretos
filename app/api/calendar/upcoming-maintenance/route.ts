import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  computeCyclicIntervalResults,
  parseMaintenanceUnitString,
} from '@/lib/utils/cyclic-maintenance'

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
    const monthParam = searchParams.get('month') // YYYY-MM
    const dateFromParam = searchParams.get('dateFrom') // ISO date
    const dateToParam = searchParams.get('dateTo') // ISO date
    const includeWarranties = searchParams.get('includeWarranties') === 'true'
    const includeWorkOrders = searchParams.get('includeWorkOrders') !== 'false' // default true
    
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

      const maintenanceUnit = parseMaintenanceUnitString(equipmentModel.maintenance_unit)
      const currentValue =
        maintenanceUnit === 'hours'
          ? Number(asset.current_hours) || 0
          : Number(asset.current_kilometers) || 0

      const { data: allMaintenances, error: maintenanceError } = await supabase
        .from('maintenance_history')
        .select('maintenance_plan_id, hours, kilometers, date, type')
        .eq('asset_id', asset.id)
        .order('date', { ascending: false })

      if (maintenanceError) {
        console.error('Error getting maintenance history:', maintenanceError)
        continue
      }

      const intervals = equipmentModel.maintenance_intervals || []
      const intervalResults = computeCyclicIntervalResults({
        intervals,
        history: allMaintenances || [],
        currentValue,
        unit: maintenanceUnit,
        options: { applyEarliestUnpaid: true },
      })

      const statusesToInclude = assetIdFilter
        ? ['overdue', 'upcoming']
        : ['overdue', 'upcoming', 'covered', 'scheduled']

      for (const r of intervalResults) {
        if (r.status === 'completed' || r.status === 'not_applicable') continue
        if (!statusesToInclude.includes(r.status)) continue

        const targetValue = r.nextDueValue ?? (Number(r.interval.interval_value) || 0)
        const valueRemaining = r.valueRemaining
        const estimatedDate =
          r.status === 'covered'
            ? new Date()
            : maintenanceUnit === 'hours'
              ? calculateEstimatedDate(currentValue, targetValue)
              : calculateEstimatedDateByKm(currentValue, targetValue)

        const lastMaintenance = (allMaintenances || []).find(
          (m) => m.maintenance_plan_id === r.intervalId
        )

        upcomingMaintenances.push({
          id: `${asset.id}-${r.intervalId}`,
          assetId: asset.id,
          assetName: asset.name,
          assetCode: asset.asset_id,
          intervalId: r.intervalId,
          intervalName: r.interval.name || r.interval.description,
          intervalType: r.interval.type,
          targetValue,
          currentValue,
          valueRemaining,
          unit: maintenanceUnit,
          estimatedDate: estimatedDate.toISOString(),
          status: r.status,
          urgency: r.urgency,
          lastMaintenance,
        })
      }
    }

    // Summary MUST be computed from full dataset (before filtering)
    const summary = {
      overdue: upcomingMaintenances.filter(m => m.status === 'overdue').length,
      upcoming: upcomingMaintenances.filter(m => m.status === 'upcoming').length,
      covered: upcomingMaintenances.filter(m => m.status === 'covered').length,
      scheduled: upcomingMaintenances.filter(m => m.status === 'scheduled').length,
      highUrgency: upcomingMaintenances.filter(m => m.urgency === 'high').length,
      mediumUrgency: upcomingMaintenances.filter(m => m.urgency === 'medium').length
    }

    // Filter by status if specified (urgent = high urgency cross-cutting)
    let filteredMaintenances = upcomingMaintenances
    if (statusFilter) {
      if (statusFilter === 'urgent') {
        filteredMaintenances = upcomingMaintenances.filter(m => m.urgency === 'high')
      } else {
        filteredMaintenances = upcomingMaintenances.filter(m => m.status === statusFilter)
      }
    }

    // Filter by date range when month or dateFrom/dateTo provided
    if (monthParam || dateFromParam || dateToParam) {
      let rangeStart: Date
      let rangeEnd: Date
      if (monthParam) {
        const [y, m] = monthParam.split('-').map(Number)
        rangeStart = new Date(y, m - 1, 1)
        rangeEnd = new Date(y, m, 0, 23, 59, 59)
      } else {
        rangeStart = dateFromParam ? new Date(dateFromParam) : new Date(0)
        rangeEnd = dateToParam ? new Date(dateToParam) : new Date(8640000000000000)
      }
      filteredMaintenances = filteredMaintenances.filter(m => {
        const d = new Date(m.estimatedDate)
        return d >= rangeStart && d <= rangeEnd
      })
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
          // Primero por status - MISMO ORDEN QUE PÁGINA INDIVIDUAL
          const statusOrder = { 'overdue': 4, 'upcoming': 3, 'scheduled': 2, 'covered': 1 }
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

    // When month/date range specified, return all in range for calendar; otherwise paginate
    const usePagination = !monthParam && !dateFromParam && !dateToParam
    const paginated = usePagination
      ? filteredMaintenances.slice(offset, offset + limit)
      : filteredMaintenances

    // Fetch warranty events when requested
    let warrantyEvents: Array<{
      id: string
      assetId: string
      assetName: string
      assetCode: string
      warrantyExpiration: string
      status: 'expired' | 'expiring_soon' | 'active'
    }> = []
    if (includeWarranties) {
      const { data: warrantyAssets } = await supabase
        .from('assets')
        .select('id, name, asset_id, warranty_expiration')
        .eq('status', 'operational')
        .not('warranty_expiration', 'is', null)
      const now = new Date()
      const soonThreshold = new Date(now)
      soonThreshold.setDate(soonThreshold.getDate() + 90)
      for (const a of warrantyAssets || []) {
        const exp = new Date(a.warranty_expiration!)
        const status = exp < now ? 'expired' : exp <= soonThreshold ? 'expiring_soon' : 'active'
        warrantyEvents.push({
          id: `warranty-${a.id}`,
          assetId: a.id,
          assetName: a.name,
          assetCode: a.asset_id || '-',
          warrantyExpiration: exp.toISOString(),
          status
        })
      }
    }

    // Fetch work orders with planned_date in range (most actionable: actual scheduled work)
    let workOrderEvents: Array<{
      id: string
      orderId: string
      assetId: string | null
      assetName: string | null
      assetCode: string | null
      plannedDate: string
      type: string
      priority: string
      status: string
      description: string | null
    }> = []
    if (includeWorkOrders && (monthParam || dateFromParam || dateToParam)) {
      let rangeStart: Date
      let rangeEnd: Date
      if (monthParam) {
        const [y, m] = monthParam.split('-').map(Number)
        rangeStart = new Date(y, m - 1, 1)
        rangeEnd = new Date(y, m, 0, 23, 59, 59)
      } else {
        rangeStart = dateFromParam ? new Date(dateFromParam) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        rangeEnd = dateToParam ? new Date(dateToParam) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)
      }
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select(`
          id,
          order_id,
          asset_id,
          planned_date,
          type,
          priority,
          status,
          description,
          asset:assets (
            name,
            asset_id
          )
        `)
        .not('planned_date', 'is', null)
        .not('status', 'eq', 'Completada')
        .gte('planned_date', rangeStart.toISOString())
        .lte('planned_date', rangeEnd.toISOString())
        .order('planned_date', { ascending: true })
      const asset = (wo: any) => (wo.asset || wo.assets) as { name?: string; asset_id?: string } | null
      workOrderEvents = (workOrders || []).map((wo: any) => ({
        id: wo.id,
        orderId: wo.order_id,
        assetId: wo.asset_id,
        assetName: asset(wo)?.name ?? null,
        assetCode: asset(wo)?.asset_id ?? null,
        plannedDate: wo.planned_date,
        type: wo.type || 'corrective',
        priority: wo.priority || 'Media',
        status: wo.status || 'Pendiente',
        description: wo.description
      }))
    }

    return NextResponse.json({
      upcomingMaintenances: paginated,
      totalCount: filteredMaintenances.length,
      summary,
      warrantyEvents: includeWarranties ? warrantyEvents : undefined,
      workOrderEvents: includeWorkOrders ? workOrderEvents : undefined
    })

  } catch (error) {
    console.error('Error fetching upcoming maintenance:', error)
    return NextResponse.json(
      { error: 'Error al obtener los próximos mantenimientos' },
      { status: 500 }
    )
  }
} 