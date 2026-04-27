import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import {
  loadActorContext,
  canCreateOperators,
  canViewOperatorsList,
  checkRHOwnershipAuthority,
  managedPlantIdsForProfile,
} from '@/lib/auth/server-authorization'
import { normalizeRoleForPersistence } from '@/lib/auth/role-model'
import {
  isJunOrJefePlantaActor,
  isJunJpRegisterableLegacyRole,
  junJpRegistrationAuditNote,
  validateJunJpCreatePlacement,
  operatorRowVisibleToJun,
  operatorRowVisibleToJp,
} from '@/lib/auth/operator-scope'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!canCreateOperators(actor)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const payload = (await request.json()) as {
      nombre: string
      apellido: string
      email: string
      telefono?: string
      phone_secondary?: string
      role: string
      employee_code: string
      position?: string
      shift?: string
      hire_date?: string
      plant_id?: string
      business_unit_id?: string
      can_authorize_up_to?: string | number
      notes?: string
      password: string
      /** RH/GG: extra plants for JEFE_PLANTA — `profile_managed_plants` in addition to primary `plant_id`. */
      additional_plant_ids?: string[]
    }
    const {
      nombre,
      apellido,
      email,
      telefono,
      phone_secondary,
      role,
      employee_code,
      position,
      shift,
      hire_date,
      plant_id,
      business_unit_id,
      can_authorize_up_to,
      notes,
      password,
    } = payload
    const additional_plant_ids = Array.isArray(payload.additional_plant_ids)
      ? payload.additional_plant_ids.filter((id) => typeof id === 'string' && id.length > 0)
      : []

    const normalizedRole = normalizeRoleForPersistence(role)

    // Validate required fields
    if (!nombre || !apellido || !email || !role || !employee_code || !password) {
      return NextResponse.json({ 
        error: 'Missing required fields: nombre, apellido, email, role, employee_code, password' 
      }, { status: 400 })
    }

    if (!normalizedRole) {
      return NextResponse.json({ error: 'Invalid role provided' }, { status: 400 })
    }

    const rhOrGg =
      checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'
    if (
      isJunOrJefePlantaActor({
        userId: actor.userId,
        profile: {
          role: actor.profile.role,
          business_unit_id: actor.profile.business_unit_id,
          plant_id: actor.profile.plant_id,
          managed_plant_ids: actor.profile.managed_plant_ids,
        },
      }) &&
      !rhOrGg
    ) {
      if (!isJunJpRegisterableLegacyRole(normalizedRole.role)) {
        return NextResponse.json(
          { error: 'Tu rol solo puede registrar Operador, Dosificador o Mecánico' },
          { status: 403 }
        )
      }
    }

    if (password.length < 6) {
      return NextResponse.json({ 
        error: 'Password must be at least 6 characters long' 
      }, { status: 400 })
    }

    // Validate UUID fields - convert empty strings to null
    const validatedPlantId = plant_id && plant_id.trim() !== '' ? plant_id : null
    const validatedBusinessUnitId = business_unit_id && business_unit_id.trim() !== '' ? business_unit_id : null

    let plantBusinessUnitId: string | null = null
    if (validatedPlantId) {
      const { data: plantRow } = await supabase
        .from('plants')
        .select('business_unit_id')
        .eq('id', validatedPlantId)
        .single()
      plantBusinessUnitId = plantRow?.business_unit_id ?? null
    }

    const effectiveBusinessUnitId =
      actor.profile.role === 'JEFE_UNIDAD_NEGOCIO' &&
      validatedPlantId &&
      plantBusinessUnitId &&
      !validatedBusinessUnitId
        ? plantBusinessUnitId
        : validatedBusinessUnitId

    if (
      isJunOrJefePlantaActor({
        userId: actor.userId,
        profile: {
          role: actor.profile.role,
          business_unit_id: actor.profile.business_unit_id,
          plant_id: actor.profile.plant_id,
          managed_plant_ids: actor.profile.managed_plant_ids,
        },
      }) &&
      !rhOrGg
    ) {
      const placement = validateJunJpCreatePlacement(
        {
          userId: actor.userId,
          profile: {
            role: actor.profile.role,
            business_unit_id: actor.profile.business_unit_id,
            plant_id: actor.profile.plant_id,
            managed_plant_ids: actor.profile.managed_plant_ids,
          },
        },
        validatedPlantId,
        effectiveBusinessUnitId,
        plantBusinessUnitId
      )
      if (!placement.ok) {
        return NextResponse.json({ error: placement.error }, { status: 400 })
      }
    }

    // Check if employee code already exists
    const { data: existingOperator } = await supabase
      .from('profiles')
      .select('id')
      .eq('employee_code', employee_code)
      .single()

    if (existingOperator) {
      return NextResponse.json({ 
        error: 'Employee code already exists' 
      }, { status: 400 })
    }

    // Create auth user first - password is stored securely in auth.users table
    // NEVER store passwords in profiles table for security
    const adminSupabase = createAdminClient()
    const { data: authData, error: createUserError } = await adminSupabase.auth.admin.createUser({
      email,
      password: password, // Use provided provisional password - stored in auth.users
      email_confirm: true,
      user_metadata: {
        nombre,
        apellido,
        role: normalizedRole.role,
        business_role: normalizedRole.businessRole,
        employee_code
      }
    })

    if (createUserError || !authData.user) {
      console.error('Error creating auth user:', createUserError)
      const msg = createUserError?.message?.toLowerCase() ?? ''
      if (
        msg.includes('already been registered') ||
        msg.includes('already exists') ||
        msg.includes('duplicate') ||
        createUserError?.status === 422
      ) {
        return NextResponse.json(
          { error: 'Ya existe una cuenta con este correo. Usa otro email o recupera el acceso del usuario.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        {
          error:
            createUserError?.message ||
            'No se pudo crear la cuenta de acceso. Revisa el correo y vuelve a intentar.',
        },
        { status: 500 }
      )
    }

    const newUserId = authData.user.id

    // Create operator profile with the auth user ID
    // NOTE: Password is NOT stored here - only in auth.users table for security
    const { data: operator, error } = await supabase
      .from('profiles')
      .insert({
        id: newUserId, // Links to auth.users.id
        nombre,
        apellido,
        email,
        telefono,
        phone_secondary,
        role: normalizedRole.role,
        business_role: normalizedRole.businessRole,
        role_scope: normalizedRole.roleScope,
        employee_code,
        position,
        shift,
        hire_date: hire_date || new Date().toISOString(),
        plant_id: validatedPlantId,
        business_unit_id: effectiveBusinessUnitId,
        can_authorize_up_to: can_authorize_up_to || 0,
        status: 'active',
        notas_rh: (() => {
          const base = notes?.trim() ? notes.trim() : ''
          if (
            isJunOrJefePlantaActor({
              userId: actor.userId,
              profile: {
                role: actor.profile.role,
                business_unit_id: actor.profile.business_unit_id,
                plant_id: actor.profile.plant_id,
                managed_plant_ids: actor.profile.managed_plant_ids,
              },
            }) &&
            !rhOrGg
          ) {
            const tag = junJpRegistrationAuditNote({
              userId: actor.userId,
              profile: {
                role: actor.profile.role,
                business_unit_id: actor.profile.business_unit_id,
                plant_id: actor.profile.plant_id,
                managed_plant_ids: actor.profile.managed_plant_ids,
              },
            })
            return [tag, base].filter(Boolean).join('\n') || tag
          }
          return base || null
        })(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
        // system_password and system_access_password are NOT set here
        // These are separate credentials for other systems, not auth passwords
      })
      .select(`
        id,
        nombre,
        apellido,
        email,
        telefono,
        phone_secondary,
        role,
        business_role,
        role_scope,
        employee_code,
        position,
        shift,
        hire_date,
        status,
        can_authorize_up_to,
        plant_id,
        business_unit_id,
        plants:plant_id(id, name, code),
        business_units:business_unit_id(id, name)
      `)
      .single()

    if (error) {
      console.error('Error creating operator:', error)
      try {
        await adminSupabase.auth.admin.deleteUser(newUserId)
      } catch (delErr) {
        console.error('Rollback: failed to delete orphan auth user', delErr)
      }
      const pgMsg = error.message?.toLowerCase() ?? ''
      if (pgMsg.includes('duplicate') || pgMsg.includes('unique')) {
        return NextResponse.json(
          {
            error:
              'Datos duplicados (correo, código de empleado o ID). Verifica e intenta de nuevo.',
          },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: error.message || 'No se pudo guardar el perfil del usuario.' },
        { status: 500 }
      )
    }

    if (normalizedRole.role === 'JEFE_PLANTA' && rhOrGg) {
      const toInsert = new Set<string>()
      if (validatedPlantId) toInsert.add(validatedPlantId)
      for (const id of additional_plant_ids) {
        toInsert.add(id)
      }
      if (toInsert.size > 0) {
        const { error: pmpErr } = await supabase.from('profile_managed_plants').upsert(
          [...toInsert].map((plant_id) => ({ profile_id: newUserId, plant_id })),
          { onConflict: 'profile_id,plant_id' }
        )
        if (pmpErr) {
          console.error('profile_managed_plants for new JP:', pmpErr)
        }
      }
    }

    return NextResponse.json({
      ...operator,
      user: { profile: operator },
      message: 'User created successfully',
      login_instructions: {
        email: email,
        password: password,
        note: 'User can login with their email and the provisional password provided'
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error in operators POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!canViewOperatorsList(actor)) {
      return NextResponse.json([])
    }

    const { searchParams } = new URL(request.url)
    const plant_id = searchParams.get('plant_id')
    const business_unit_id = searchParams.get('business_unit_id')
    const role = searchParams.get('role')
    const status = searchParams.get('status') || 'active'
    const ids = searchParams.get('ids')

    if (
      actor.profile.role === 'DOSIFICADOR' &&
      actor.profile.plant_id &&
      plant_id &&
      plant_id !== actor.profile.plant_id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rhOrGgView =
      checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'

    if (
      !rhOrGgView &&
      actor.profile.role === 'JEFE_PLANTA' &&
      managedPlantIdsForProfile(actor.profile).length === 0
    ) {
      return NextResponse.json([])
    }

    let query = supabase
      .from('profiles')
      .select(`
        id,
        nombre,
        apellido,
        email,
        telefono,
        phone_secondary,
        role,
        business_role,
        role_scope,
        employee_code,
        position,
        shift,
        hire_date,
        status,
        can_authorize_up_to,
        plant_id,
        business_unit_id,
        plants:plant_id(id, name, code),
        business_units:business_unit_id(id, name)
      `)
      .order('nombre')

    if (ids) {
      const idArray = ids.split(',').filter((id) => id.trim())
      if (idArray.length > 0) {
        query = query.in('id', idArray)
      }
    } else {
      query = query.eq('status', status)

      if (rhOrGgView) {
        if (plant_id) {
          query = query.eq('plant_id', plant_id)
        }
        if (business_unit_id) {
          query = query.eq('business_unit_id', business_unit_id)
        }
      } else if (actor.profile.role === 'JEFE_PLANTA') {
        const jpPlants = managedPlantIdsForProfile(actor.profile)
        query = query.in('plant_id', jpPlants)
      } else if (actor.profile.role === 'DOSIFICADOR' && actor.profile.plant_id) {
        query = query.eq('plant_id', actor.profile.plant_id)
      } else if (actor.profile.role === 'JEFE_UNIDAD_NEGOCIO' && actor.profile.business_unit_id) {
        const buId = actor.profile.business_unit_id
        const { data: buPlants } = await supabase
          .from('plants')
          .select('id')
          .eq('business_unit_id', buId)
        const plantIds = (buPlants ?? []).map((p) => p.id).filter(Boolean)
        const orParts = [`business_unit_id.eq.${buId}`, 'and(business_unit_id.is.null,plant_id.is.null)']
        if (plantIds.length > 0) {
          orParts.push(`plant_id.in.(${plantIds.join(',')})`)
        }
        query = query.or(orParts.join(','))
      }

      if (rhOrGgView && role) {
        query = query.or(`role.eq.${role},business_role.eq.${role}`)
      }
    }

    const { data: operators, error } = await query

    if (error) {
      console.error('Error fetching operators:', error)
      return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 })
    }

    let list = operators || []

    if (!rhOrGgView && actor.profile.role === 'JEFE_UNIDAD_NEGOCIO' && actor.profile.business_unit_id) {
      const { data: buPlants } = await supabase
        .from('plants')
        .select('id')
        .eq('business_unit_id', actor.profile.business_unit_id)
      const plantIdsInBu = (buPlants ?? []).map((p) => p.id)
      list = list.filter((op) =>
        operatorRowVisibleToJun(
          {
            plant_id: op.plant_id,
            business_unit_id: op.business_unit_id,
          },
          actor.profile.business_unit_id!,
          plantIdsInBu
        )
      )
    }

    if (!rhOrGgView && actor.profile.role === 'JEFE_PLANTA') {
      const jpPlants = managedPlantIdsForProfile(actor.profile)
      if (jpPlants.length > 0) {
        list = list.filter((op) =>
          operatorRowVisibleToJp(
            { plant_id: op.plant_id, business_unit_id: op.business_unit_id },
            jpPlants
          )
        )
      } else {
        list = []
      }
    }

    if (!rhOrGgView && actor.profile.role === 'DOSIFICADOR' && actor.profile.plant_id) {
      list = list.filter((op) =>
        operatorRowVisibleToJp(
          { plant_id: op.plant_id, business_unit_id: op.business_unit_id },
          actor.profile.plant_id!
        )
      )
    }

    return NextResponse.json(list)
  } catch (error) {
    console.error('Error in operators GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 