import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { StockService } from '@/lib/services/stock-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false,
        error: 'User not authenticated' 
      }, { status: 401 })
    }

    // Get work order
    const { data: wo, error: woError } = await supabase
      .from('work_orders')
      .select('required_parts, plant_id')
      .eq('id', params.id)
      .single()

    if (woError) throw woError

    if (!wo.required_parts || !Array.isArray(wo.required_parts) || wo.required_parts.length === 0) {
      return NextResponse.json({
        success: true,
        work_order_id: params.id,
        parts: [],
        summary: {
          total_parts: 0,
          available_parts: 0,
          insufficient_parts: 0,
          not_in_catalog: 0
        }
      })
    }

    if (!wo.plant_id) {
      return NextResponse.json({ 
        success: false,
        error: 'Work order must have a plant_id' 
      }, { status: 400 })
    }

    // Convert required_parts to format for availability check
    const partsForCheck = wo.required_parts.map((p: any) => ({
      part_id: p.part_id || p.id,
      quantity: p.quantity || 0
    })).filter((p: any) => p.part_id)

    // For parts without part_id, try to match by name
    const partsWithoutId = wo.required_parts.filter((p: any) => !p.part_id && !p.id)
    const availabilityResults = []

    // Check parts with IDs
    if (partsForCheck.length > 0) {
      const availability = await StockService.checkMultiplePartsAvailability(
        partsForCheck,
        wo.plant_id
      )
      availabilityResults.push(...availability)
    }

    // Try to match parts without IDs
    for (const part of partsWithoutId) {
      if (part.name) {
        // Try to find part by name
        const { data: foundParts } = await supabase
          .from('inventory_parts')
          .select('id, part_number, name')
          .ilike('name', `%${part.name}%`)
          .eq('is_active', true)
          .limit(1)

        if (foundParts && foundParts.length > 0) {
          const foundPart = foundParts[0]
          const availability = await StockService.checkAvailability(
            foundPart.id,
            wo.plant_id,
            part.quantity || 0
          )

          const total_available = availability.reduce((sum, a) => sum + a.available_quantity, 0)

          availabilityResults.push({
            part_id: foundPart.id,
            part_number: foundPart.part_number,
            part_name: foundPart.name,
            required_quantity: part.quantity || 0,
            available_by_warehouse: availability,
            total_available,
            sufficient: total_available >= (part.quantity || 0)
          })
        } else {
          // Part not in catalog
          availabilityResults.push({
            part_id: '',
            part_number: '',
            part_name: part.name,
            required_quantity: part.quantity || 0,
            available_by_warehouse: [],
            total_available: 0,
            sufficient: false
          })
        }
      }
    }

    const summary = {
      total_parts: availabilityResults.length,
      available_parts: availabilityResults.filter(a => a.sufficient).length,
      insufficient_parts: availabilityResults.filter(a => !a.sufficient && a.part_id).length,
      not_in_catalog: availabilityResults.filter(a => !a.part_id).length
    }

    return NextResponse.json({
      success: true,
      work_order_id: params.id,
      parts: availabilityResults,
      summary
    })
  } catch (error) {
    console.error('Error checking inventory:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to check inventory',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
