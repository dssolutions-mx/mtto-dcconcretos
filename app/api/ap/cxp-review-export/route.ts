import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase-server'
import { buildPoCxpReviewExcel, loadPoCxpReviewData } from '@/lib/ap/poCxpReviewExport'

const ALLOWED_ROLES = new Set([
  'GERENCIA_GENERAL',
  'AREA_ADMINISTRATIVA',
  'GERENTE_MANTENIMIENTO',
])

export const maxDuration = 120

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile?.role || !ALLOWED_ROLES.has(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const plantId = request.nextUrl.searchParams.get('plant_id') || undefined
    const generatedAt = new Date()
    const data = await loadPoCxpReviewData(supabase, plantId)
    const buffer = await buildPoCxpReviewExcel(data, generatedAt)

    const scopeSlug = data.plantLabel.replace(/[^\w\-]+/g, '_').slice(0, 30)
    const fileName = `CxP_OC_Mantenimiento_${scopeSlug}_${format(generatedAt, 'yyyy-MM-dd')}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/ap/cxp-review-export error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}
