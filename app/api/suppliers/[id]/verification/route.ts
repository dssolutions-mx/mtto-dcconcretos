import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorProfile } from '@/lib/auth/server-authorization'
import { effectiveRoleForPermissions } from '@/lib/auth/role-model'
import { hasModuleAccess, hasWriteAccess } from '@/lib/auth/role-permissions'
import { evaluateSupplierVerification } from '@/lib/suppliers/verification-rules'
import type { Supplier, SupplierVerificationAction } from '@/types/suppliers'

const ACTION_TO_STATUS: Record<SupplierVerificationAction, string> = {
  certify: 'active_certified',
  activate: 'active',
  suspend: 'suspended',
  revoke_certification: 'active',
  reactivate: 'active',
  reject: 'pending',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: supplierId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const profile = await loadActorProfile(supabase, user.id)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }
    const role = effectiveRoleForPermissions(profile)
    if (!role || !hasModuleAccess(role, 'purchases')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const { data: events, error } = await supabase
      .from('supplier_verification_events')
      .select('id, supplier_id, actor_id, action, notes, checklist_snapshot, created_at')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('verification events list:', error)
      return NextResponse.json({ error: 'Error al cargar historial' }, { status: 500 })
    }

    return NextResponse.json({ events: events ?? [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: supplierId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const profile = await loadActorProfile(supabase, user.id)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }
    const role = effectiveRoleForPermissions(profile)
    if (!role || !hasWriteAccess(role, 'purchases')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = (await request.json()) as {
      action?: SupplierVerificationAction
      notes?: string | null
      checklist_snapshot?: Record<string, unknown> | null
    }
    const action = body.action
    if (!action || !(action in ACTION_TO_STATUS)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const newStatus = ACTION_TO_STATUS[action]

    const { data: supplierRow, error: supErr } = await supabase
      .from('suppliers')
      .select(`
        *,
        supplier_contacts(id, is_active),
        supplier_certifications(id),
        supplier_work_history(id, created_at)
      `)
      .eq('id', supplierId)
      .single()

    if (supErr || !supplierRow) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const supplier = supplierRow as unknown as Supplier & {
      supplier_contacts?: { id: string; is_active: boolean | null }[]
      supplier_certifications?: { id: string }[]
      supplier_work_history?: { id: string; created_at: string | null }[]
    }

    const primaryContactCount =
      supplier.supplier_contacts?.filter((c) => c.is_active !== false).length ?? 0
    const certificationsCount = supplier.supplier_certifications?.length ?? 0
    const since = new Date()
    since.setDate(since.getDate() - 365)
    const sinceIso = since.toISOString()
    const workHistoryCountLast365d =
      supplier.supplier_work_history?.filter((w) => w.created_at && w.created_at >= sinceIso).length ?? 0

    if (action === 'certify') {
      const evalResult = evaluateSupplierVerification({
        supplier,
        certificationsCount,
        primaryContactCount,
        workHistoryCountLast365d,
      })
      if (!evalResult.allRequiredPass) {
        return NextResponse.json(
          {
            error: 'La verificación del expediente no cumple los requisitos para certificar',
            evaluation: evalResult,
          },
          { status: 422 }
        )
      }
    }

    const checklist_snapshot =
      body.checklist_snapshot ??
      (action === 'certify'
        ? (() => {
            const ev = evaluateSupplierVerification({
              supplier,
              certificationsCount,
              primaryContactCount,
              workHistoryCountLast365d,
            })
            return {
              passedCount: ev.passedCount,
              totalCount: ev.totalCount,
              checks: ev.checks,
            } as Record<string, unknown>
          })()
        : null)

    const { error: rpcError } = await supabase.rpc(
      'apply_supplier_verification_event',
      {
        p_supplier_id: supplierId,
        p_action: action,
        p_new_status: newStatus,
        p_notes: body.notes ?? null,
        p_checklist_snapshot: checklist_snapshot,
      }
    )

    if (rpcError) {
      console.error('apply_supplier_verification_event', rpcError)
      return NextResponse.json(
        { error: rpcError.message || 'No se pudo aplicar el cambio' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
