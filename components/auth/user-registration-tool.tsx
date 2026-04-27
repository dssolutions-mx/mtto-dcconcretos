'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'react-hot-toast'
import { Loader2, UserPlus, Building2, Shield, Calendar, Hash, Key } from 'lucide-react'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import {
  canRegisterOperatorsClient,
  isFullPersonnelRegistrationClient,
} from '@/lib/auth/client-authorization'

interface BusinessUnit {
  id: string
  name: string
}

interface Plant {
  id: string
  name: string
  code: string
  business_unit_id: string
}

interface UserRegistrationFormData {
  nombre: string
  apellido: string
  email: string
  telefono: string
  phone_secondary: string
  role: string
  employee_code: string
  position: string
  shift: string
  hire_date: string
  plant_id: string
  business_unit_id: string
  can_authorize_up_to: string
  provisional_password: string
  notes: string
  /** RH: extra plants for a new Jefe de Planta (in addition to primary `plant_id`). */
  jefe_extra_plant_ids: string[]
}

const LINE_MANAGER_REGISTER_ROLES = [
  { value: 'OPERADOR', label: 'Operador', description: 'Operación básica de equipos' },
  { value: 'DOSIFICADOR', label: 'Dosificador', description: 'Gestión de diesel y dosificación' },
  { value: 'MECANICO', label: 'Mecánico', description: 'Ejecución de mantenimiento en planta' },
]

const FULL_REGISTER_ROLES = [
  ...LINE_MANAGER_REGISTER_ROLES,
  { value: 'COORDINADOR_MANTENIMIENTO', label: 'Coordinador de Mantenimiento', description: 'Gestión completa de mantenimiento' },
  { value: 'JEFE_PLANTA', label: 'Jefe de Planta', description: 'Supervisión completa de planta' },
  { value: 'JEFE_UNIDAD_NEGOCIO', label: 'Jefe de Unidad de Negocio', description: 'Autoridad operativa de la unidad' },
  { value: 'GERENTE_MANTENIMIENTO', label: 'Gerente de Mantenimiento', description: 'Dirección técnica de mantenimiento' },
  { value: 'ENCARGADO_ALMACEN', label: 'Encargado de Almacén', description: 'Custodia e inventario en planta' },
  { value: 'AUXILIAR_COMPRAS', label: 'Auxiliar de Compras', description: 'Gestión de compras e inventario' },
  { value: 'AREA_ADMINISTRATIVA', label: 'Área Administrativa', description: 'Administración y autorización' },
  { value: 'RECURSOS_HUMANOS', label: 'Recursos Humanos', description: 'Altas, bajas y gobierno de personal' },
  { value: 'EJECUTIVO', label: 'Ejecutivo', description: 'Acceso ejecutivo con gestión de personal' },
  { value: 'VISUALIZADOR', label: 'Visualizador', description: 'Visualización de información' },
]

const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Matutino (6:00 - 14:00)' },
  { value: 'afternoon', label: 'Vespertino (14:00 - 22:00)' },
  { value: 'night', label: 'Nocturno (22:00 - 6:00)' }
]

export type UserRegistrationTriggerVariant = 'toolbar' | 'hero'

/** Profile payload returned from `POST /api/operators/register` (inserted row). */
export type RegisteredOperatorProfile = {
  id: string
  nombre: string
  apellido: string
  role: string
  status?: string
  employee_code?: string | null
  shift?: string | null
  plant_id?: string | null
  business_unit_id?: string | null
}

export interface UserRegistrationToolProps {
  /** `hero`: large primary CTA for personal / RH pages. */
  triggerVariant?: UserRegistrationTriggerVariant
  /** Called after a successful registration with the created profile when available. */
  onRegistered?: (profile?: RegisteredOperatorProfile) => void
  /** With `onOpenChange`, controls dialog visibility from the parent. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Omit the default trigger button (parent opens via `open` / `onOpenChange`). */
  hideTrigger?: boolean
  /** Prefill plant and business unit when the dialog opens (assignment board, filters). Ignored for JEFE_PLANTA (profile locks plant). */
  initialPlantId?: string | null
}

function generateProvisionalPasswordString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export function UserRegistrationTool({
  triggerVariant = 'toolbar',
  onRegistered,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  hideTrigger = false,
  initialPlantId = null,
}: UserRegistrationToolProps) {
  const { profile } = useAuthZustand()
  const canManageUsers = canRegisterOperatorsClient(profile)
  const lineManagerOnly =
    canManageUsers && profile && !isFullPersonnelRegistrationClient(profile)
  const roleOptions = lineManagerOnly ? LINE_MANAGER_REGISTER_ROLES : FULL_REGISTER_ROLES
  const isControlled = openProp !== undefined && onOpenChangeProp !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? openProp : internalOpen
  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChangeProp(next)
    } else {
      setInternalOpen(next)
    }
  }
  const [loading, setLoading] = useState(false)
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [filteredPlants, setFilteredPlants] = useState<Plant[]>([])

  const [formData, setFormData] = useState<UserRegistrationFormData>({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    phone_secondary: '',
    role: '',
    employee_code: '',
    position: '',
    shift: '',
    hire_date: new Date().toISOString().split('T')[0],
    plant_id: '',
    business_unit_id: '',
    can_authorize_up_to: '0',
    provisional_password: '',
    notes: '',
    jefe_extra_plant_ids: [],
  })

  // Load data on component mount
  useEffect(() => {
    loadBusinessUnits()
    loadPlants()
  }, [])

  // Filter plants when business unit changes
  useEffect(() => {
    if (formData.business_unit_id) {
      const filtered = plants.filter(plant => plant.business_unit_id === formData.business_unit_id)
      setFilteredPlants(filtered)
      // Reset plant selection if current plant is not in filtered list
      if (formData.plant_id && !filtered.find(p => p.id === formData.plant_id)) {
        setFormData(prev => ({ ...prev, plant_id: '' }))
      }
    } else {
      setFilteredPlants(plants)
    }
  }, [formData.business_unit_id, plants])

  useEffect(() => {
    if (!profile?.role) return
    if (profile.role === 'JEFE_UNIDAD_NEGOCIO' && profile.business_unit_id) {
      setFormData((prev) =>
        prev.business_unit_id === profile.business_unit_id
          ? prev
          : { ...prev, business_unit_id: profile.business_unit_id! }
      )
    }
    if (profile.role === 'JEFE_PLANTA' && profile.plant_id && plants.length > 0) {
      const pl = plants.find((p) => p.id === profile.plant_id)
      setFormData((prev) => ({
        ...prev,
        plant_id: profile.plant_id!,
        business_unit_id: pl?.business_unit_id ?? prev.business_unit_id,
      }))
    }
  }, [profile?.role, profile?.business_unit_id, profile?.plant_id, plants])

  const registrarOpenedFromUrl = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !canManageUsers || isControlled) return
    const sp = new URLSearchParams(window.location.search)
    const flag = sp.get('registrar') ?? sp.get('alta')
    if ((flag === '1' || flag === 'true') && !registrarOpenedFromUrl.current) {
      registrarOpenedFromUrl.current = true
      setInternalOpen(true)
    }
  }, [canManageUsers, isControlled])

  /** Re-sync BU/plant when opening dialog (JP/JUN after async plant load). */
  useEffect(() => {
    if (!open || !profile) return
    if (profile.role === 'JEFE_UNIDAD_NEGOCIO' && profile.business_unit_id) {
      setFormData((prev) =>
        prev.business_unit_id === profile.business_unit_id
          ? prev
          : { ...prev, business_unit_id: profile.business_unit_id! }
      )
    }
    if (profile.role === 'JEFE_PLANTA' && profile.plant_id && plants.length > 0) {
      const pl = plants.find((p) => p.id === profile.plant_id)
      setFormData((prev) => ({
        ...prev,
        plant_id: profile.plant_id!,
        business_unit_id: pl?.business_unit_id ?? prev.business_unit_id,
      }))
    }
  }, [open, profile, plants])

  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const lockPlant = profile?.role === 'JEFE_PLANTA'
      setFormData((prev) => {
        const next = { ...prev }
        if (!next.provisional_password || next.provisional_password.length < 6) {
          next.provisional_password = generateProvisionalPasswordString()
        }
        if (!next.employee_code.trim()) {
          const timestamp = Date.now().toString().slice(-6)
          const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
          next.employee_code = `EMP${timestamp}${random}`
        }
        if (
          initialPlantId &&
          plants.length > 0 &&
          !lockPlant
        ) {
          const pl = plants.find((p) => p.id === initialPlantId)
          if (pl) {
            next.plant_id = pl.id
            next.business_unit_id = pl.business_unit_id
          }
        }
        return next
      })
    }
    prevOpenRef.current = open
  }, [open, initialPlantId, plants, profile?.role])

  const loadBusinessUnits = async () => {
    try {
      const response = await fetch('/api/business-units')
      const data = await response.json()
      setBusinessUnits(data.business_units || [])
    } catch (error) {
      console.error('Error loading business units:', error)
      toast.error('Error cargando unidades de negocio')
    }
  }

  const loadPlants = async () => {
    try {
      const response = await fetch('/api/plants')
      const data = await response.json()
      setPlants(data.plants || [])
    } catch (error) {
      console.error('Error loading plants:', error)
      toast.error('Error cargando plantas')
    }
  }

  const handleInputChange = (field: keyof UserRegistrationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const makeEmployeeCode = () => {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
    return `EMP${timestamp}${random}`
  }

  const generatePassword = () => generateProvisionalPasswordString()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.nombre || !formData.apellido || !formData.email || !formData.role || !formData.employee_code || !formData.provisional_password) {
      toast.error('Por favor completa todos los campos obligatorios')
      return
    }

    if (formData.provisional_password.length < 6) {
      toast.error('La contraseña provisional debe tener al menos 6 caracteres')
      return
    }

    if (isFullPersonnelRegistrationClient(profile) && !formData.business_unit_id) {
      toast.error('Selecciona una unidad de negocio')
      return
    }
    if (profile?.role === 'JEFE_UNIDAD_NEGOCIO' && !formData.business_unit_id) {
      toast.error('Tu perfil no tiene unidad de negocio asignada')
      return
    }
    if (profile?.role === 'JEFE_PLANTA' && !formData.plant_id) {
      toast.error('Tu perfil no tiene planta asignada')
      return
    }

    // For plant-specific roles, require plant selection
    const plantSpecificRoles = ['OPERADOR', 'DOSIFICADOR', 'JEFE_PLANTA', 'COORDINADOR_MANTENIMIENTO', 'MECANICO']
    if (plantSpecificRoles.includes(formData.role) && !formData.plant_id) {
      toast.error('Este rol requiere selección de planta')
      return
    }

    setLoading(true)

    try {
      const { jefe_extra_plant_ids, ...formPayload } = formData
      const response = await fetch('/api/operators/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formPayload,
          can_authorize_up_to: parseFloat(formData.can_authorize_up_to) || 0,
          hire_date: formData.hire_date || new Date().toISOString(),
          password: formData.provisional_password,
          plant_id: formData.plant_id || null,
          business_unit_id: formData.business_unit_id || null,
          additional_plant_ids:
            formData.role === 'JEFE_PLANTA' && !lineManagerOnly && jefe_extra_plant_ids.length > 0
              ? jefe_extra_plant_ids
              : undefined,
        }),
      })

      let result: {
        error?: string
        email?: string
        nombre?: string
        apellido?: string
        role?: string
        id?: string
        user?: { profile?: RegisteredOperatorProfile }
      } & Partial<RegisteredOperatorProfile> = {}
      try {
        result = await response.json()
      } catch {
        /* empty body */
      }

      if (!response.ok) {
        const msg =
          typeof result.error === 'string' && result.error.trim()
            ? result.error.trim()
            : `No se pudo registrar (${response.status})`
        throw new Error(msg)
      }

      const createdProfile: RegisteredOperatorProfile | undefined =
        result.user?.profile ??
        (result.id
          ? {
              id: result.id,
              nombre: result.nombre ?? formData.nombre,
              apellido: result.apellido ?? formData.apellido,
              role: result.role ?? formData.role,
              status: result.status ?? 'active',
              employee_code: result.employee_code ?? formData.employee_code,
              shift: result.shift ?? formData.shift,
              plant_id: result.plant_id ?? formData.plant_id,
              business_unit_id: result.business_unit_id ?? formData.business_unit_id,
            }
          : undefined)

      const outEmail = result.email ?? formData.email
      const credLine = `${outEmail}\t${formData.provisional_password}`
      try {
        await navigator.clipboard.writeText(credLine)
        toast.success(
          `Usuario registrado: ${result.nombre ?? ''} ${result.apellido ?? ''} (${result.role ?? formData.role}). Acceso copiado al portapapeles (una vez); guárdalo de forma segura.`,
          { duration: 6000 }
        )
      } catch {
        toast.success(
          `Usuario registrado: ${result.nombre ?? ''} ${result.apellido ?? ''} (${result.role ?? formData.role}). Entrega la contraseña provisional por un canal seguro; no se mostró en pantalla.`,
          { duration: 8000 }
        )
      }

      onRegistered?.(createdProfile)

      // Reset form
      setFormData({
        nombre: '',
        apellido: '',
        email: '',
        telefono: '',
        phone_secondary: '',
        role: '',
        employee_code: '',
        position: '',
        shift: '',
        hire_date: new Date().toISOString().split('T')[0],
        plant_id: '',
        business_unit_id: '',
        can_authorize_up_to: '0',
        provisional_password: '',
        notes: '',
        jefe_extra_plant_ids: [],
      })

      setOpen(false)

    } catch (error: unknown) {
      console.error('Error creating user:', error)
      toast.error(`Error registrando usuario: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = roleOptions.find((role) => role.value === formData.role)
  const lockBusinessUnit = profile?.role === 'JEFE_UNIDAD_NEGOCIO'
  const lockPlant = profile?.role === 'JEFE_PLANTA'

  if (!canManageUsers) {
    return null
  }

  const triggerLabel = lineManagerOnly ? 'Alta de operador' : 'Registrar usuario'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            size={triggerVariant === 'hero' ? 'lg' : 'default'}
            className={
              triggerVariant === 'hero'
                ? 'w-full sm:w-auto min-h-[48px] px-6 text-base font-semibold shadow-sm'
                : 'w-full sm:w-auto cursor-pointer'
            }
          >
            <UserPlus className={triggerVariant === 'hero' ? 'h-5 w-5 mr-2' : 'h-4 w-4 mr-2'} />
            {triggerLabel}
          </Button>
        </DialogTrigger>
      )}
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Registro de Nuevo Usuario
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {lineManagerOnly && (
            <p className="text-sm text-muted-foreground rounded-lg border bg-muted/40 px-3 py-2">
              Alta en plataforma a solicitud de Jefe de Unidad o Jefe de Planta (POL-OPE-001). RRHH da el alta
              integral; aquí solo registras personal operativo en tu alcance.
            </p>
          )}
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Información Básica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => handleInputChange('nombre', e.target.value)}
                    placeholder="Ej: Juan"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido *</Label>
                  <Input
                    id="apellido"
                    value={formData.apellido}
                    onChange={(e) => handleInputChange('apellido', e.target.value)}
                    placeholder="Ej: Pérez"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Ej: juan.perez@empresa.com"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono Principal</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => handleInputChange('telefono', e.target.value)}
                    placeholder="Ej: 555-123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_secondary">Teléfono Secundario</Label>
                  <Input
                    id="phone_secondary"
                    value={formData.phone_secondary}
                    onChange={(e) => handleInputChange('phone_secondary', e.target.value)}
                    placeholder="Ej: 555-987-6543"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role and Position */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Rol y Posición
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Rol *</Label>
                <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{role.label}</span>
                          <span className="text-xs text-muted-foreground">{role.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRole && (
                  <Badge variant="outline" className="text-xs">
                    {selectedRole.description}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee_code">Código de Empleado *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="employee_code"
                      value={formData.employee_code}
                      onChange={(e) => handleInputChange('employee_code', e.target.value)}
                      placeholder="Ej: EMP001"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange('employee_code', makeEmployeeCode())}
                      className="px-3"
                    >
                      <Hash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Posición</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => handleInputChange('position', e.target.value)}
                    placeholder="Ej: Operador Senior"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shift">Turno</Label>
                  <Select value={formData.shift} onValueChange={(value) => handleInputChange('shift', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona turno" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFT_OPTIONS.map((shift) => (
                        <SelectItem key={shift.value} value={shift.value}>
                          {shift.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hire_date">Fecha de Contratación</Label>
                  <Input
                    id="hire_date"
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => handleInputChange('hire_date', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organizational Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Asignación Organizacional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business_unit_id">Unidad de Negocio *</Label>
                <Select
                  value={formData.business_unit_id}
                  onValueChange={(value) => handleInputChange('business_unit_id', value)}
                  disabled={lockBusinessUnit || lockPlant}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona unidad de negocio" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessUnits.map((bu) => (
                      <SelectItem key={bu.id} value={bu.id}>
                        {bu.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plant_id">Planta</Label>
                <Select
                  value={formData.plant_id}
                  onValueChange={(value) => handleInputChange('plant_id', value)}
                  disabled={lockPlant || (!formData.business_unit_id && !lockBusinessUnit)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !formData.business_unit_id 
                        ? "Primero selecciona una unidad de negocio" 
                        : "Selecciona una planta"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPlants.map((plant) => (
                      <SelectItem key={plant.id} value={plant.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{plant.name}</span>
                          <span className="text-xs text-muted-foreground">{plant.code}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRole && ['OPERADOR', 'DOSIFICADOR', 'JEFE_PLANTA', 'COORDINADOR_MANTENIMIENTO', 'MECANICO'].includes(formData.role) && (
                  <Badge variant="secondary" className="text-xs">
                    Este rol requiere selección de planta
                  </Badge>
                )}
                {!lineManagerOnly && formData.role === 'JEFE_PLANTA' && formData.plant_id && (
                  <div className="space-y-2 rounded-md border p-3">
                    <span className="text-sm font-medium">Plantas adicionales a cargo (opcional)</span>
                    <p className="text-xs text-muted-foreground">Además de la planta principal arriba.</p>
                    <div className="flex max-h-32 flex-col gap-2 overflow-y-auto">
                      {filteredPlants
                        .filter((p) => p.id !== formData.plant_id)
                        .map((plant) => (
                          <label key={plant.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="rounded border border-input"
                              checked={formData.jefe_extra_plant_ids.includes(plant.id)}
                              onChange={(e) => {
                                setFormData((prev) => {
                                  const s = new Set(prev.jefe_extra_plant_ids)
                                  if (e.target.checked) s.add(plant.id)
                                  else s.delete(plant.id)
                                  return { ...prev, jefe_extra_plant_ids: [...s] }
                                })
                              }}
                            />
                            {plant.name} ({plant.code})
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {!lineManagerOnly && (
                <div className="space-y-2">
                  <Label htmlFor="can_authorize_up_to">Límite de Autorización ($)</Label>
                  <Input
                    id="can_authorize_up_to"
                    type="number"
                    min="0"
                    step="100"
                    value={formData.can_authorize_up_to}
                    onChange={(e) => handleInputChange('can_authorize_up_to', e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Monto máximo que puede autorizar en compras (0 = sin autorización)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Información Adicional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provisional_password">Contraseña Provisional *</Label>
                <div className="flex gap-2">
                  <Input
                    id="provisional_password"
                    type="password"
                    value={formData.provisional_password}
                    onChange={(e) => handleInputChange('provisional_password', e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInputChange('provisional_password', generatePassword())}
                    className="px-3"
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Contraseña inicial en Supabase Auth (mínimo 6 caracteres). Se genera automáticamente al abrir
                  este formulario; puedes regenerarla con el botón. El usuario debe cambiarla en su primer acceso.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Información adicional sobre el usuario..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Registrar Usuario
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
