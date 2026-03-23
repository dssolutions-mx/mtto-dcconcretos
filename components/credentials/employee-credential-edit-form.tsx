"use client"

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, Camera, Save, XCircle } from 'lucide-react'
import type { Employee } from './employee-credentials-types'
import type { Office } from '@/types'

export interface EmployeeCredentialEditFormProps {
  employee: Employee
  onSave: (employee: Employee) => void
  onCancel: () => void
  onStageAvatar: (file: File, employeeId: string) => void
  stagedPreview: string | null
  offices: Office[]
}

export function EmployeeCredentialEditForm({
  employee,
  onSave,
  onCancel,
  onStageAvatar,
  stagedPreview,
  offices,
}: EmployeeCredentialEditFormProps) {
  const [formData, setFormData] = useState<Employee>(employee)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onStageAvatar(file, employee.id)
    }
  }

  const currentAvatar = stagedPreview || formData.avatar_url

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-6 p-4 bg-gray-50 rounded-lg">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-4 border-gray-300">
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={`${formData.nombre} ${formData.apellido}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Camera className="w-8 h-8" />
              </div>
            )}
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {formData.nombre} {formData.apellido}
          </h3>
          <p className="text-sm text-gray-600">{formData.position}</p>
          <div className="mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Cambiar Foto
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={formData.nombre || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nombre: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  value={formData.apellido || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, apellido: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email (Usuario del Sistema)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@dcconcretos.com.mx"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  El email será usado como usuario del sistema
                </p>
              </div>
              <div>
                <Label htmlFor="employee_code">Código de Empleado</Label>
                <Input
                  id="employee_code"
                  value={formData.employee_code || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, employee_code: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="telefono">Teléfono Principal</Label>
                <Input
                  id="telefono"
                  value={formData.telefono || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, telefono: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="phone_secondary">Teléfono Secundario</Label>
                <Input
                  id="phone_secondary"
                  value={formData.phone_secondary || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone_secondary: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="imss_number">Número IMSS</Label>
                <Input
                  id="imss_number"
                  value={formData.imss_number || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, imss_number: e.target.value }))}
                  placeholder="12345678910"
                />
              </div>
              <div>
                <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  value={formData.fecha_nacimiento || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, fecha_nacimiento: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información Laboral</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="position">Posición/Cargo</Label>
                <Input
                  id="position"
                  value={formData.position || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="departamento">Departamento</Label>
                <Input
                  id="departamento"
                  value={formData.departamento || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, departamento: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">Rol</Label>
                <Select
                  value={formData.role || ''}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GERENCIA_GENERAL">Gerencia General</SelectItem>
                    <SelectItem value="JEFE_UNIDAD_NEGOCIO">Jefe de Unidad de Negocio</SelectItem>
                    <SelectItem value="AREA_ADMINISTRATIVA">Área Administrativa</SelectItem>
                    <SelectItem value="JEFE_PLANTA">Jefe de Planta</SelectItem>
                    <SelectItem value="COORDINADOR_MANTENIMIENTO">Coordinador de Mantenimiento</SelectItem>
                    <SelectItem value="GERENTE_MANTENIMIENTO">Gerente de Mantenimiento</SelectItem>
                    <SelectItem value="MECANICO">Mecánico</SelectItem>
                    <SelectItem value="RECURSOS_HUMANOS">Recursos Humanos</SelectItem>
                    <SelectItem value="DOSIFICADOR">Dosificador</SelectItem>
                    <SelectItem value="OPERADOR">Operador</SelectItem>
                    <SelectItem value="AUXILIAR_COMPRAS">Auxiliar de Compras</SelectItem>
                    <SelectItem value="EJECUTIVO">Ejecutivo</SelectItem>
                    <SelectItem value="VISUALIZADOR">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={formData.status || ''}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hire_date">Fecha de Contratación</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, hire_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="tipo_contrato">Tipo de Contrato</Label>
                <Select
                  value={formData.tipo_contrato || ''}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, tipo_contrato: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiempo_completo">Tiempo Completo</SelectItem>
                    <SelectItem value="medio_tiempo">Medio Tiempo</SelectItem>
                    <SelectItem value="temporal">Temporal</SelectItem>
                    <SelectItem value="por_proyecto">Por Proyecto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Credenciales del Sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="system_access_password">Código de Acceso (Planta)</Label>
              <Input
                id="system_access_password"
                type="text"
                value={formData.system_access_password || ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, system_access_password: e.target.value }))
                }
                placeholder="Planta01DC"
              />
              <p className="text-xs text-gray-500 mt-1">
                Código específico mostrado en credencial (ej: Planta01DC, Planta02DC)
              </p>
            </div>

            <div>
              <Label htmlFor="office_id">Oficina Asignada</Label>
              <Select
                value={formData.office_id || 'none'}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, office_id: value === 'none' ? null : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una oficina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin oficina asignada</SelectItem>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                La información de contacto de la oficina aparecerá en la credencial
              </p>
            </div>

            <div>
              <Label htmlFor="credential_notes">Notas Adicionales</Label>
              <Textarea
                id="credential_notes"
                value={formData.credential_notes || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, credential_notes: e.target.value }))}
                placeholder="Notas adicionales para la credencial"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contacto de Emergencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="emergency_name">Nombre Completo</Label>
                <Input
                  id="emergency_name"
                  value={formData.emergency_contact?.name || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      emergency_contact: { ...prev.emergency_contact, name: e.target.value },
                    }))
                  }
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <Label htmlFor="emergency_relationship">Relación</Label>
                <Input
                  id="emergency_relationship"
                  value={formData.emergency_contact?.relationship || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      emergency_contact: { ...prev.emergency_contact, relationship: e.target.value },
                    }))
                  }
                  placeholder="Familiar, amigo, etc."
                />
              </div>
              <div>
                <Label htmlFor="emergency_phone">Teléfono</Label>
                <Input
                  id="emergency_phone"
                  value={formData.emergency_contact?.phone || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      emergency_contact: { ...prev.emergency_contact, phone: e.target.value },
                    }))
                  }
                  placeholder="Número de teléfono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4 pt-6 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button type="submit">
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>
      </form>
    </div>
  )
}
