import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import {
  executeAssetPlantReassignment,
  type DbClient,
} from '@/lib/assets/execute-asset-plant-reassignment'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: rawProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single()

    if (profileError || !rawProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const currentProfile = rawProfile as {
      role: string
      plant_id: string | null
      business_unit_id: string | null
    }

    const { data: managedIds } = await supabase.rpc('profile_scoped_plant_ids', {
      p_user_id: user.id,
    })

    const resolvedParams = await params
    const assetId = resolvedParams.id
    const { plant_id, notes, resolve_conflicts } = await request.json()

    const adminClient = createAdminClient() as DbClient
    const result = await executeAssetPlantReassignment({
      supabase: supabase as DbClient,
      adminClient,
      userId: user.id,
      actor: {
        role: currentProfile.role,
        plant_id: currentProfile.plant_id,
        business_unit_id: currentProfile.business_unit_id,
        managed_plant_ids: Array.isArray(managedIds) ? managedIds : undefined,
      },
      assetId,
      plantId: plant_id ?? null,
      notes: notes ?? null,
      resolveConflicts: resolve_conflicts,
    })

    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status })
    }

    return NextResponse.json({
      message: 'Asset plant assignment updated successfully',
      asset: result.asset,
    })
  } catch (error) {
    console.error('Error in asset plant assignment PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
