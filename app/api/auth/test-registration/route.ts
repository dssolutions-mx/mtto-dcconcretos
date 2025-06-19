import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Simple endpoint to test if our registration system is properly set up
    return NextResponse.json({
      message: 'Registration system is active',
      endpoints: {
        register: '/api/auth/register',
        method: 'POST',
        required_fields: ['nombre', 'apellido', 'email', 'role', 'password'],
        optional_fields: ['telefono', 'emergency_contact'],
      },
      available_roles: [
        'GERENCIA_GENERAL',
        'JEFE_UNIDAD_NEGOCIO', 
        'ENCARGADO_MANTENIMIENTO',
        'JEFE_PLANTA',
        'DOSIFICADOR',
        'OPERADOR',
        'AUXILIAR_COMPRAS',
        'AREA_ADMINISTRATIVA',
        'EJECUTIVO',
        'VISUALIZADOR'
      ]
    }, { status: 200 })

  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json({
      error: 'Test endpoint failed'
    }, { status: 500 })
  }
} 