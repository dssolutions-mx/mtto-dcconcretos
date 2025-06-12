'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Calendar, 
  Clock, 
  DollarSign, 
  Edit, 
  UserCheck,
  AlertTriangle
} from 'lucide-react'

interface Plant {
  id: string
  name: string
  code: string
  business_unit_id: string
}

interface BusinessUnit {
  id: string
  name: string
}

interface Operator {
  id: string
  nombre: string
  apellido: string
  telefono?: string
  phone_secondary?: string
  role: string
  employee_code?: string
  position?: string
  shift?: string
  hire_date?: string
  status: string
  can_authorize_up_to?: number
  plants?: Plant
  business_units?: BusinessUnit
}

interface OperatorDetailsDialogProps {
  operator: Operator
  open: boolean
  onOpenChange: (open: boolean) => void
  plants: Plant[]
  onOperatorUpdated: (operator: Operator) => void
}

export function OperatorDetailsDialog({ 
  operator, 
  open, 
  onOpenChange, 
  plants, 
  onOperatorUpdated 
}: OperatorDetailsDialogProps) {
  const [loading, setLoading] = useState(false)

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      'GERENCIA_GENERAL': 'bg-purple-100 text-purple-800',
      'JEFE_UNIDAD_NEGOCIO': 'bg-blue-100 text-blue-800',
      'ENCARGADO_MANTENIMIENTO': 'bg-green-100 text-green-800',
      'JEFE_PLANTA': 'bg-orange-100 text-orange-800',
      'DOSIFICADOR': 'bg-yellow-100 text-yellow-800',
      'OPERADOR': 'bg-gray-100 text-gray-800',
      'AUXILIAR_COMPRAS': 'bg-pink-100 text-pink-800',
      'AREA_ADMINISTRATIVA': 'bg-indigo-100 text-indigo-800',
      'VISUALIZADOR': 'bg-slate-100 text-slate-800'
    }
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getRoleDisplayName = (role: string) => {
    const names = {
      'GERENCIA_GENERAL': 'Gerencia General',
      'JEFE_UNIDAD_NEGOCIO': 'Jefe Unidad de Negocio',
      'ENCARGADO_MANTENIMIENTO': 'Encargado Mantenimiento',
      'JEFE_PLANTA': 'Jefe de Planta',
      'DOSIFICADOR': 'Dosificador',
      'OPERADOR': 'Operador',
      'AUXILIAR_COMPRAS': 'Auxiliar de Compras',
      'AREA_ADMINISTRATIVA': 'Área Administrativa',
      'VISUALIZADOR': 'Visualizador'
    }
    return names[role as keyof typeof names] || role
  }

  const getShiftDisplayName = (shift?: string) => {
    const shifts = {
      'morning': 'Matutino',
      'afternoon': 'Vespertino',
      'night': 'Nocturno'
    }
    return shift ? shifts[shift as keyof typeof shifts] || shift : 'No asignado'
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No especificada'
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0'
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${operator.nombre} ${operator.apellido}`} />
              <AvatarFallback>
                {operator.nombre?.[0]}{operator.apellido?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">
                {operator.nombre} {operator.apellido}
              </h2>
              <p className="text-sm text-gray-600">
                {operator.employee_code && `${operator.employee_code} • `}
                {getRoleDisplayName(operator.role)}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Role */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={getRoleBadgeColor(operator.role)}>
                {getRoleDisplayName(operator.role)}
              </Badge>
              <Badge variant={operator.status === 'active' ? 'default' : 'secondary'}>
                {operator.status === 'active' ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {operator.can_authorize_up_to && operator.can_authorize_up_to > 0 && (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <DollarSign className="w-4 h-4" />
                Autoriza hasta {formatCurrency(operator.can_authorize_up_to)}
              </div>
            )}
          </div>

          <Separator />

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Información Personal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </div>
                  <p className="font-medium">No disponible</p>
                </div>

                {operator.telefono && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>Teléfono Principal</span>
                    </div>
                    <p className="font-medium">{operator.telefono}</p>
                  </div>
                )}

                {operator.phone_secondary && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      <span>Teléfono Secundario</span>
                    </div>
                    <p className="font-medium">{operator.phone_secondary}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Fecha de Contratación</span>
                  </div>
                  <p className="font-medium">{formatDate(operator.hire_date)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Información Laboral
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 className="w-4 h-4" />
                    <span>Planta</span>
                  </div>
                  <p className="font-medium">
                    {operator.plants?.name || 'No asignada'}
                  </p>
                  {operator.plants?.code && (
                    <p className="text-sm text-gray-600">Código: {operator.plants.code}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <UserCheck className="w-4 h-4" />
                    <span>Puesto</span>
                  </div>
                  <p className="font-medium">{operator.position || 'No especificado'}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>Turno</span>
                  </div>
                  <p className="font-medium">{getShiftDisplayName(operator.shift)}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <DollarSign className="w-4 h-4" />
                    <span>Límite de Autorización</span>
                  </div>
                  <p className="font-medium">
                    {formatCurrency(operator.can_authorize_up_to)}
                  </p>
                </div>
              </div>

              {operator.business_units && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 className="w-4 h-4" />
                    <span>Unidad de Negocio</span>
                  </div>
                  <p className="font-medium">{operator.business_units.name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Authorization Information */}
          {operator.role === 'OPERADOR' && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-800">
                      Requiere Autorización
                    </h4>
                    <p className="text-sm text-orange-700">
                      Este operador no puede autorizar compras. Todas las solicitudes 
                      requieren aprobación del Jefe de Planta.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 