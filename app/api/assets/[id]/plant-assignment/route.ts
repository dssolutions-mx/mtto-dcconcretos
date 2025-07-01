import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update asset assignments
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only certain roles can update asset plant assignments
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO']
    if (!allowedRoles.includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions to modify asset assignments' }, { status: 403 })
    }

    // Await params before accessing its properties
    const resolvedParams = await params
    const assetId = resolvedParams.id
    const { plant_id, notes } = await request.json()

    // Get current asset to verify it exists and check current assignment
    const { data: currentAsset, error: assetError } = await supabase
      .from('assets')
      .select(`
        id,
        name,
        asset_id,
        plant_id,
        plants:plant_id(id, name, business_unit_id)
      `)
      .eq('id', assetId)
      .single()

    if (assetError) {
      console.error('Error fetching asset:', assetError)
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Apply role-based restrictions
    if (currentProfile.role === 'JEFE_PLANTA') {
      // JEFE_PLANTA can only move assets within their plant or assign to their plant
      if (currentAsset.plant_id !== currentProfile.plant_id && plant_id !== currentProfile.plant_id) {
        return NextResponse.json({ 
          error: 'Como Jefe de Planta, solo puedes asignar activos a tu planta o mover activos ya asignados a tu planta' 
        }, { status: 403 })
      }
    } else if (currentProfile.role === 'JEFE_UNIDAD_NEGOCIO') {
      // JEFE_UNIDAD_NEGOCIO can only move assets within their business unit
      if (plant_id) {
        const { data: targetPlant } = await supabase
          .from('plants')
          .select('business_unit_id')
          .eq('id', plant_id)
          .single()

        if (targetPlant?.business_unit_id !== currentProfile.business_unit_id) {
          return NextResponse.json({ 
            error: 'Como Jefe de Unidad de Negocio, solo puedes asignar activos a plantas dentro de tu unidad de negocio' 
          }, { status: 403 })
        }
      }

      // Check if current asset is in their business unit
      const assetPlant = Array.isArray(currentAsset.plants) ? currentAsset.plants[0] : currentAsset.plants
      if (assetPlant?.business_unit_id && assetPlant.business_unit_id !== currentProfile.business_unit_id) {
        return NextResponse.json({ 
          error: 'No puedes modificar activos de otras unidades de negocio' 
        }, { status: 403 })
      }
    }

    // Update the asset's plant assignment
    const { data: updatedAsset, error: updateError } = await supabase
      .from('assets')
      .update({
        plant_id: plant_id || null,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', assetId)
      .select(`
        id,
        name,
        asset_id,
        status,
        plant_id,
        plants:plant_id(
          id,
          name,
          code,
          business_unit_id,
          business_units:business_unit_id(id, name, code)
        ),
        equipment_models (
          id,
          name,
          manufacturer
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating asset plant assignment:', updateError)
      return NextResponse.json({ error: 'Error updating asset assignment' }, { status: 500 })
    }

    // Log the assignment change for audit trail
    const { error: logError } = await supabase
      .from('asset_assignment_history')
      .insert({
        asset_id: assetId,
        previous_plant_id: currentAsset.plant_id,
        new_plant_id: plant_id,
        changed_by: user.id,
        change_reason: notes || 'Plant assignment updated via drag & drop',
        created_at: new Date().toISOString()
      })

    if (logError) {
      console.warn('Warning: Could not log assignment change:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      message: 'Asset plant assignment updated successfully',
      asset: updatedAsset
    })

  } catch (error) {
    console.error('Error in asset plant assignment PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 