import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext } from '@/lib/auth/server-authorization'
import { loadDepartmentMembers } from '@/lib/departments/department-membership'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ departmentId: string }> },
) {
  try {
    const { departmentId } = await params
    const plantId = req.nextUrl.searchParams.get('plant_id')
    if (!plantId) {
      return NextResponse.json({ error: 'plant_id es requerido' }, { status: 400 })
    }

    const supabase = await createClient()
    const members = await loadDepartmentMembers(supabase, { plantId, departmentId })

    return NextResponse.json({
      department_id: departmentId,
      plant_id: plantId,
      members,
    })
  } catch (error) {
    console.error('GET department members error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
