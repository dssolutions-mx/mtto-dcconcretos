import type { Office } from '@/types'

export interface Employee {
  id: string
  nombre: string
  apellido: string
  email?: string
  employee_code?: string
  position?: string
  role?: string
  hire_date?: string
  status?: string
  avatar_url?: string
  telefono?: string
  phone_secondary?: string
  imss_number?: string
  system_username?: string
  system_password?: string
  system_access_password?: string
  credential_notes?: string
  departamento?: string
  direccion?: string
  fecha_nacimiento?: string
  estado_civil?: string
  nivel_educacion?: string
  experiencia_anos?: number
  tipo_contrato?: string
  shift?: string
  notas_rh?: string
  emergency_contact?: {
    name?: string
    relationship?: string
    phone?: string
  }
  plants?: {
    id: string
    name: string
    contact_phone?: string
    contact_email?: string
    address?: string
  } | null
  business_units?: {
    id: string
    name: string
  }
  office_id?: string
  office?: Office
}
