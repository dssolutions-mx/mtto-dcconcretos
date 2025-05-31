import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const {
      asset_id,
      hours_reading,
      kilometers_reading
    } = await request.json()

    if (!asset_id) {
      return NextResponse.json(
        { error: 'Se requiere el ID del activo' },
        { status: 400 }
      )
    }

    // Usar la función de validación de la base de datos
    const { data: validationResult, error: validationError } = await supabase
      .rpc('validate_equipment_readings', {
        p_asset_id: asset_id,
        p_hours_reading: hours_reading,
        p_kilometers_reading: kilometers_reading
      })

    if (validationError) {
      console.error('Error validating readings:', validationError)
      return NextResponse.json(
        { error: 'Error validando lecturas del equipo' },
        { status: 500 }
      )
    }

    return NextResponse.json(validationResult)
    
  } catch (error: any) {
    console.error('Error in readings validation:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
} 