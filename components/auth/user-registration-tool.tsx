'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'react-hot-toast'
import { Loader2, UserPlus, Building2, MapPin, Mail, Phone, Shield, Calendar, Hash, Key } from 'lucide-react'
import { useAuthZustand } from '@/hooks/use-auth-zustand'

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
}

const AVAILABLE_ROLES = [
  { value: 'OPERADOR', label: 'Operador', description: 'Operación básica de equipos' },
  { value: 'DOSIFICADOR', label: 'Dosificador', description: 'Gestión de diesel y dosificación' },
  { value: 'ENCARGADO_MANTENIMIENTO', label: 'Encargado Mantenimiento', description: 'Gestión completa de mantenimiento' },
  { value: 'JEFE_PLANTA', label: 'Jefe de Planta', description: 'Supervisión completa de planta' },
  { value: 'JEFE_UNIDAD_NEGOCIO', label: 'Jefe Unidad de Negocio', description: 'Gestión de unidad de negocio' },
  { value: 'AUXILIAR_COMPRAS', label: 'Auxiliar de Compras', description: 'Gestión de compras e inventario' },
  { value: 'AREA_ADMINISTRATIVA', label: 'Área Administrativa', description: 'Administración y autorización' },
  { value: 'EJECUTIVO', label: 'Ejecutivo', description: 'Acceso ejecutivo con gestión de personal' },
  { value: 'VISUALIZADOR', label: 'Visualizador', description: 'Visualización de información' }
]

const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Matutino (6:00 - 14:00)' },
  { value: 'afternoon', label: 'Vespertino (14:00 - 22:00)' },
  { value: 'night', label: 'Nocturno (22:00 - 6:00)' }
]

export function UserRegistrationTool() {
  const { profile } = useAuthZustand()
  const [open, setOpen] = useState(false)
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
    notes: ''
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

  const generateEmployeeCode = () => {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
    return `EMP${timestamp}${random}`
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

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

    if (!formData.business_unit_id) {
      toast.error('Selecciona una unidad de negocio')
      return
    }

    // For plant-specific roles, require plant selection
    const plantSpecificRoles = ['OPERADOR', 'DOSIFICADOR', 'ENCARGADO_MANTENIMIENTO', 'JEFE_PLANTA']
    if (plantSpecificRoles.includes(formData.role) && !formData.plant_id) {
      toast.error('Este rol requiere selección de planta')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/operators/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          can_authorize_up_to: parseFloat(formData.can_authorize_up_to) || 0,
          hire_date: formData.hire_date || new Date().toISOString(),
          password: formData.provisional_password,
          plant_id: formData.plant_id || null,
          business_unit_id: formData.business_unit_id || null
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error creating user')
      }

      toast.success('✅ Usuario registrado exitosamente', {
        description: `${result.nombre} ${result.apellido} ha sido registrado como ${result.role}. Credenciales: ${result.email} / ${formData.provisional_password}`,
        duration: 8000
      })

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
        notes: ''
      })

      setOpen(false)

    } catch (error: any) {
      console.error('Error creating user:', error)
      toast.error('Error registrando usuario: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = AVAILABLE_ROLES.find(role => role.value === formData.role)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <UserPlus className="h-4 w-4 mr-2" />
          Registrar Usuario
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Registro de Nuevo Usuario
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                    {AVAILABLE_ROLES.map((role) => (
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
                      onClick={generateEmployeeCode}
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
                <Select value={formData.business_unit_id} onValueChange={(value) => handleInputChange('business_unit_id', value)}>
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
                  disabled={!formData.business_unit_id}
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
                {selectedRole && ['OPERADOR', 'DOSIFICADOR', 'ENCARGADO_MANTENIMIENTO', 'JEFE_PLANTA'].includes(formData.role) && (
                  <Badge variant="secondary" className="text-xs">
                    Este rol requiere selección de planta
                  </Badge>
                )}
              </div>

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
                  Esta será la contraseña inicial del usuario. Debe cambiarla en su primer acceso.
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
