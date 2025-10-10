/*
  One-off synchronization script to backfill employees from missing_employee_codes.json
  - Duplicate detection by employee_code, imss_number, name+surname, and email
  - Dry-run support via --dry-run
  - Creates auth users with password Planta01DC and inserts profiles for new records
  - Updates only missing/empty profile fields for existing records
*/

import fs from 'fs/promises'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}

// Admin client (service role)
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')

function removeDiacritics(input) {
  return input.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function normalizeNamePart(input) {
  const trimmed = String(input || '').trim().toLowerCase()
  const noAccents = removeDiacritics(trimmed)
  return noAccents.replace(/[^a-z\s.]/g, '').replace(/\s+/g, ' ')
}

function firstToken(input) {
  return normalizeNamePart(input).split(' ')[0] || ''
}

function lastToken(input) {
  const parts = normalizeNamePart(input).split(' ').filter(Boolean)
  return parts[parts.length - 1] || ''
}

function buildEmailBase(nombre, apellido) {
  const first = firstToken(nombre)
  const last = lastToken(apellido)
  const local = [first, last].filter(Boolean).join('.')
  return `${local}@mail.com`
}

function isEmptyValue(v) {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (typeof v === 'object' && !Array.isArray(v)) return Object.keys(v).length === 0
  return false
}

async function emailExistsAnywhere(email) {
  // Check profiles.email only (auth users will have matching profile entries)
  const { data: prof } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  return !!prof
}

async function generateUniqueEmail(nombre, apellido, employeeCode) {
  const base = buildEmailBase(nombre, apellido)
  if (!(await emailExistsAnywhere(base))) return base
  const candidate = base.replace('@', `.${employeeCode}@`)
  if (!(await emailExistsAnywhere(candidate))) return candidate
  let suffix = 2
  while (suffix < 100) {
    const c = base.replace('@', `.${employeeCode}.${suffix}@`)
    // eslint-disable-next-line no-await-in-loop
    const exists = await emailExistsAnywhere(c)
    if (!exists) return c
    suffix += 1
  }
  return base
}

async function findExistingProfile(record) {
  // 1) employee_code
  if (record.employee_code) {
    const { data } = await admin
      .from('profiles')
      .select('id, email, employee_code, role, position, nombre, apellido, imss_number, hire_date, fecha_nacimiento, emergency_contact, telefono, phone_secondary')
      .eq('employee_code', record.employee_code)
      .limit(1)
    if (data && data.length > 0) return data[0]
  }

  // 2) imss_number
  if (record.imss_number && String(record.imss_number).trim() !== '') {
    const { data } = await admin
      .from('profiles')
      .select('id, email, employee_code, role, position, nombre, apellido, imss_number, hire_date, fecha_nacimiento, emergency_contact, telefono, phone_secondary')
      .eq('imss_number', record.imss_number)
      .limit(1)
    if (data && data.length > 0) return data[0]
  }

  // 3) name + surname (approximate)
  const nameLike = `%${firstToken(record.nombre)}%`
  const apellidoLike = `%${firstToken(record.apellido)}%`
  const { data: candidates } = await admin
    .from('profiles')
    .select('id, email, employee_code, role, position, nombre, apellido, imss_number, hire_date, fecha_nacimiento, emergency_contact, telefono, phone_secondary')
    .ilike('nombre', nameLike)
    .ilike('apellido', apellidoLike)
    .limit(5)
  if (candidates && candidates.length > 0) {
    const last = lastToken(record.apellido)
    const refined = candidates.find(c => (c.apellido || '').toLowerCase().includes(last))
    return (refined || candidates[0])
  }

  // 4) Try generated email in profiles
  const generated = buildEmailBase(record.nombre, record.apellido)
  const { data: byEmail } = await admin
    .from('profiles')
    .select('id, email, employee_code, role, position, nombre, apellido, imss_number, hire_date, fecha_nacimiento, emergency_contact, telefono, phone_secondary')
    .ilike('email', generated)
    .limit(1)
  if (byEmail && byEmail.length > 0) return byEmail[0]

  return null
}

async function run() {
  const root = process.cwd()
  const jsonPath = path.resolve(root, 'missing_employee_codes.json')
  const raw = await fs.readFile(jsonPath, 'utf-8')
  const list = JSON.parse(raw)

  const results = []

  for (const rec of list) {
    try {
      const existing = await findExistingProfile(rec)

      if (existing) {
        const update = {}

        if (isEmptyValue(existing.employee_code) && rec.employee_code) update.employee_code = rec.employee_code
        if (isEmptyValue(existing.position) && rec.position) update.position = rec.position
        if (isEmptyValue(existing.imss_number) && rec.imss_number) update.imss_number = rec.imss_number
        if (isEmptyValue(existing.hire_date) && rec.hire_date) update.hire_date = rec.hire_date
        if (isEmptyValue(existing.fecha_nacimiento) && rec.fecha_nacimiento) update.fecha_nacimiento = rec.fecha_nacimiento
        if (isEmptyValue(existing.emergency_contact) && rec.emergency_contact) update.emergency_contact = rec.emergency_contact

        let decidedEmail = existing.email || ''
        if (isEmptyValue(existing.email)) {
          decidedEmail = await generateUniqueEmail(rec.nombre, rec.apellido, rec.employee_code)
          update.email = decidedEmail
        }

        if (Object.keys(update).length === 0) {
          results.push({
            employee_code: rec.employee_code,
            nombre: rec.nombre,
            apellido: rec.apellido,
            decidedEmail,
            action: 'skip',
            reason: 'Existing profile complete or no missing fields',
            profileId: existing.id
          })
          continue
        }

        if (!isDryRun) {
          const { error: upErr } = await admin
            .from('profiles')
            .update({ ...update, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          if (upErr) {
            results.push({
              employee_code: rec.employee_code,
              nombre: rec.nombre,
              apellido: rec.apellido,
              decidedEmail,
              action: 'skip',
              reason: `Update failed: ${upErr.message}`,
              profileId: existing.id
            })
            continue
          }
        }

        results.push({
          employee_code: rec.employee_code,
          nombre: rec.nombre,
          apellido: rec.apellido,
          decidedEmail,
          action: 'update',
          reason: 'Updated missing fields',
          profileId: existing.id
        })
        continue
      }

      // Create new auth user + profile
      const decidedEmail = await generateUniqueEmail(rec.nombre, rec.apellido, rec.employee_code)

      if (!isDryRun) {
        const { data: created, error: createUserError } = await admin.auth.admin.createUser({
          email: decidedEmail,
          password: 'Planta01DC',
          email_confirm: true,
          user_metadata: {
            nombre: rec.nombre,
            apellido: rec.apellido,
            role: 'OPERADOR',
            employee_code: rec.employee_code
          }
        })
        if (createUserError || !created?.user?.id) {
          results.push({
            employee_code: rec.employee_code,
            nombre: rec.nombre,
            apellido: rec.apellido,
            decidedEmail,
            action: 'skip',
            reason: `Auth create failed: ${createUserError?.message || 'unknown'}`
          })
          continue
        }

        const userId = created.user.id
        const insertPayload = {
          id: userId,
          nombre: rec.nombre,
          apellido: rec.apellido,
          email: decidedEmail,
          role: 'OPERADOR',
          employee_code: rec.employee_code,
          position: rec.position,
          imss_number: rec.imss_number || null,
          hire_date: rec.hire_date || null,
          fecha_nacimiento: rec.fecha_nacimiento || null,
          emergency_contact: rec.emergency_contact || null,
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
          results.push({
            employee_code: rec.employee_code,
            nombre: rec.nombre,
            apellido: rec.apellido,
            decidedEmail,
            action: 'skip',
            reason: `Profile insert failed: ${insErr.message}`
          })
          continue
        }
      }

      results.push({
        employee_code: rec.employee_code,
        nombre: rec.nombre,
        apellido: rec.apellido,
        decidedEmail,
        action: 'create',
        reason: 'Created auth user and profile'
      })
    } catch (e) {
      results.push({
        employee_code: rec.employee_code,
        nombre: rec.nombre,
        apellido: rec.apellido,
        decidedEmail: '',
        action: 'skip',
        reason: `Unhandled error: ${e?.message || e}`
      })
    }
  }

  // Write CSV summary
  const outDir = path.resolve(process.cwd(), 'scripts', 'out')
  try { await fs.mkdir(outDir, { recursive: true }) } catch {}
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const outPath = path.join(outDir, `missing_employees_sync_${isDryRun ? 'dryrun_' : ''}${ts}.csv`)
  const header = 'employee_code,nombre,apellido,email,action,reason,profile_id\n'
  const lines = results.map(r => [
    r.employee_code,
    JSON.stringify(r.nombre),
    JSON.stringify(r.apellido),
    JSON.stringify(r.decidedEmail || ''),
    r.action,
    JSON.stringify(r.reason),
    r.profileId || ''
  ].join(','))
  await fs.writeFile(outPath, header + lines.join('\n'), 'utf-8')

  // eslint-disable-next-line no-console
  console.log(`Done. ${results.length} processed. CSV: ${outPath}`)
}

run().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})


