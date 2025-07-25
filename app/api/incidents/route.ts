import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // First get incidents with assets
    const { data: incidents, error } = await supabase
      .from('incident_history')
      .select(`
        *,
        assets (
          id,
          name,
          asset_id
        )
      `)
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching incidents:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get all unique user IDs that we need to look up
    const userIds = new Set<string>()
    
    incidents?.forEach(incident => {
      // Handle both old format (UUID in reported_by) and new format (UUID in reported_by_id)
      if (incident.reported_by_id) {
        userIds.add(incident.reported_by_id)
      } else if (incident.reported_by && incident.reported_by.length === 36 && incident.reported_by.includes('-')) {
        // It's a UUID in the reported_by field (legacy format)
        userIds.add(incident.reported_by)
      }
    })

    // Get profile data for all users
    let profiles: Array<{id: string, nombre: string | null, apellido: string | null}> = []
    if (userIds.size > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nombre, apellido')
        .in('id', Array.from(userIds))

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
      } else {
        profiles = profilesData || []
      }
    }

    // Create a profiles lookup map
    const profilesMap = new Map<string, {id: string, nombre: string | null, apellido: string | null}>()
    profiles.forEach(profile => {
      profilesMap.set(profile.id, profile)
    })

    // Process incidents to ensure readable data
    const processedIncidents = incidents?.map(incident => {
      let reporterName = 'Usuario del sistema'
      let reporterId = null

      // Determine reporter information
      if (incident.reported_by_id) {
        // New format: name in reported_by, UUID in reported_by_id
        reporterId = incident.reported_by_id
        const profile = profilesMap.get(incident.reported_by_id)
        if (profile) {
          reporterName = `${profile.nombre || ''} ${profile.apellido || ''}`.trim()
        } else if (incident.reported_by && incident.reported_by.trim()) {
          reporterName = incident.reported_by.trim()
        }
      } else if (incident.reported_by) {
        // Check if it's a UUID (legacy format)
        if (incident.reported_by.length === 36 && incident.reported_by.includes('-')) {
          reporterId = incident.reported_by
          const profile = profilesMap.get(incident.reported_by)
          if (profile) {
            reporterName = `${profile.nombre || ''} ${profile.apellido || ''}`.trim()
          }
        } else {
          // It's already a readable name
          reporterName = incident.reported_by.trim()
        }
      }

      // Process asset information
      let assetDisplayName = 'Activo no encontrado'
      let assetCode = 'N/A'

      if (incident.assets) {
        assetDisplayName = incident.assets.name || 'Activo no encontrado'
        assetCode = incident.assets.asset_id || 'N/A'
      }

      return {
        ...incident,
        reported_by_name: reporterName,
        reported_by_uuid: reporterId,
        asset_display_name: assetDisplayName,
        asset_code: assetCode
      }
    }) || []

    return NextResponse.json(processedIncidents)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 