import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env variables')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function createUser() {
  const email = 'juan.alcibiades@mail.com'
  const password = 'Planta01DC'
  
  console.log('Creating auth user for Juan Carlos Alcibiades Bacalao (118)...')
  
  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nombre: 'JUAN CARLOS',
      apellido: 'ALCIBIADES BACALAO',
      role: 'OPERADOR',
      employee_code: '118'
    }
  })
  
  if (createUserError || !created?.user?.id) {
    console.error('Error creating auth user:', createUserError)
    process.exit(1)
  }
  
  console.log('Auth user created:', created.user.id)
  
  const insertPayload = {
    id: created.user.id,
    nombre: 'JUAN CARLOS',
    apellido: 'ALCIBIADES BACALAO',
    email,
    role: 'OPERADOR',
    employee_code: '118',
    position: 'AUXILIAR DE LABORATORIO',
    imss_number: '3208928626',
    hire_date: '2024-09-10',
    fecha_nacimiento: '1989-10-05',
    emergency_contact: {
      name: 'OLGA SALAZAR',
      phone: '664 551 54 53'
    },
    status: 'active',
    plant_id: null,
    business_unit_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  const { error: insErr } = await admin
    .from('profiles')
    .insert(insertPayload)
  
  if (insErr) {
    console.error('Error creating profile:', insErr)
    process.exit(1)
  }
  
  console.log('✅ Profile created successfully')
  console.log('Email:', email)
  console.log('Password: Planta01DC')
}

createUser().catch(err => {
  console.error(err)
  process.exit(1)
})

