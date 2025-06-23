'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertCircle, AlertTriangle, Users, Building2, Factory, Plus, Edit, Trash2, Shield, Settings, DollarSign, UserCheck, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { useAuthZustand } from '@/hooks/use-auth-zustand'

interface BusinessUnit {
  id: string
  name: string
  description: string
  assigned_limit?: number
  used_limit?: number
  available_limit?: number
}

interface Plant {
  id: string
  name: string
  business_unit_id: string
  assigned_limit?: number
  used_limit?: number
  available_limit?: number
}

interface UserProfile {
  user_id: string
  nombre: string
  apellido: string
  email: string
  role: string
  individual_limit: number
  role_limit: number
  effective_global_authorization: number
  business_unit_id?: string
  business_unit_name?: string
  business_unit_max_limit?: number
  plant_id?: string
  plant_name?: string
  delegations_granted_count: number
  delegations_received_count: number
  total_delegated_out: number
  total_delegated_in: number
  position?: string
  employee_code?: string
}

interface BusinessUnitLimit {
  business_unit_id: string
  business_unit_name: string
  max_authorization_limit: number
  notes: string
  last_updated?: string
}



const USER_ROLES = [
  'OPERADOR',
  'DOSIFICADOR', 
  'ENCARGADO_MANTENIMIENTO',
  'JEFE_PLANTA',
  'AREA_ADMINISTRATIVA',
  'AUXILIAR_COMPRAS',
  'JEFE_UNIDAD_NEGOCIO',
  'EJECUTIVO',
  'GERENCIA_GENERAL',
  'VISUALIZADOR'
]

export default function AuthorizationManagementPage() {
  const { profile, refreshProfile } = useAuthZustand()
  const [activeTab, setActiveTab] = useState('users')

  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [businessUnitLimits, setBusinessUnitLimits] = useState<BusinessUnitLimit[]>([])
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [showUserEditDialog, setShowUserEditDialog] = useState(false)
  const [showBusinessUnitLimitDialog, setShowBusinessUnitLimitDialog] = useState(false)
  const [showValidationError, setShowValidationError] = useState(false)
  const [validationErrorMessage, setValidationErrorMessage] = useState('')

  // Form states
  const [userEditForm, setUserEditForm] = useState({
    user_id: '',
    role: '',
    individual_limit: '',
    business_unit_id: '',
    plant_id: '',
    position: '',
    notes: ''
  })

  const [businessUnitLimitForm, setBusinessUnitLimitForm] = useState({
    business_unit_id: '',
    assigned_limit: '',
    notes: ''
  })



  useEffect(() => {
    if (profile) {
      console.log('Current user profile:', {
        role: profile.role,
        business_unit_id: profile.business_unit_id,
        business_units: profile.business_units,
        plant_id: profile.plant_id,
        plants: profile.plants,
        full_profile: profile
      })
      loadData()
    }
  }, [profile])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadBusinessUnits(),
        loadPlants(),
        loadUsers(),
        loadBusinessUnitLimits()
      ])
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Error cargando datos del sistema')
    } finally {
      setLoading(false)
    }
  }



  const loadBusinessUnits = async () => {
    try {
      const response = await fetch('/api/business-units')
      const data = await response.json()
      if (data.error) {
        console.error('Error loading business units:', data.error)
        setBusinessUnits([])
      } else {
        let businessUnitsData = Array.isArray(data.business_units) ? data.business_units : []
        
        // Apply scope-based filtering
        if (profile?.role === 'JEFE_UNIDAD_NEGOCIO' && profile?.business_unit_id) {
          // JEFE_UNIDAD_NEGOCIO can only see their business unit
          businessUnitsData = businessUnitsData.filter((bu: any) => bu.id === profile.business_unit_id)
        }
        // GERENCIA_GENERAL and AREA_ADMINISTRATIVA can see all business units
        
        setBusinessUnits(businessUnitsData)
      }
    } catch (err) {
      console.error('Error loading business units:', err)
      setBusinessUnits([])
    }
  }

  const loadPlants = async () => {
    try {
      const response = await fetch('/api/plants')
      const data = await response.json()
      if (data.error) {
        console.error('Error loading plants:', data.error)
        setPlants([])
      } else {
        let plantsData = Array.isArray(data.plants) ? data.plants : []
        
        // Apply scope-based filtering
        if (profile?.role === 'JEFE_UNIDAD_NEGOCIO' && profile?.business_unit_id) {
          // JEFE_UNIDAD_NEGOCIO can only see plants in their business unit
          plantsData = plantsData.filter((plant: any) => plant.business_unit_id === profile.business_unit_id)
        } else if (profile?.role === 'JEFE_PLANTA' && profile?.plant_id) {
          // JEFE_PLANTA can only see their plant
          plantsData = plantsData.filter((plant: any) => plant.id === profile.plant_id)
        }
        // GERENCIA_GENERAL and AREA_ADMINISTRATIVA can see all plants
        
        setPlants(plantsData)
      }
    } catch (err) {
      console.error('Error loading plants:', err)
      setPlants([])
    }
  }

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/authorization/summary')
      const data = await response.json()
      if (data.error) {
        console.error('Error loading users:', data.error)
        setUsers([])
      } else if (data.organization_summary && Array.isArray(data.organization_summary)) {
        const allUsers: UserProfile[] = []
        data.organization_summary.forEach((bu: any) => {
          if (bu.plants && Array.isArray(bu.plants)) {
            bu.plants.forEach((plant: any) => {
              if (plant.users && Array.isArray(plant.users)) {
                allUsers.push(...plant.users)
              }
            })
          }
        })
        
        // Apply scope-based filtering
        let filteredUsers = allUsers
        if (profile?.role === 'JEFE_UNIDAD_NEGOCIO' && profile?.business_unit_id) {
          // JEFE_UNIDAD_NEGOCIO can only manage users in their business unit
          filteredUsers = allUsers.filter(user => 
            user.business_unit_id === profile.business_unit_id
          )
        } else if (profile?.role === 'JEFE_PLANTA' && profile?.plant_id) {
          // JEFE_PLANTA can only manage users in their plant
          filteredUsers = allUsers.filter(user => 
            user.plant_id === profile.plant_id
          )
        }
        // GERENCIA_GENERAL and AREA_ADMINISTRATIVA can see all users
        
        setUsers(filteredUsers)
      } else {
        setUsers([])
      }
    } catch (err) {
      console.error('Error loading users:', err)
      setUsers([])
    }
  }

  const loadBusinessUnitLimits = async () => {
    try {
      const response = await fetch('/api/authorization/business-unit-limits')
      if (response.ok) {
        const data = await response.json()
        const limits = Array.isArray(data.limits) ? data.limits : []
        console.log('Loaded business unit limits:', limits)
        setBusinessUnitLimits(limits)
      } else {
        console.error('Error loading business unit limits:', response.statusText)
        setBusinessUnitLimits([])
      }
    } catch (err) {
      console.error('Error loading business unit limits:', err)
      setBusinessUnitLimits([])
    }
  }

  const handleUpdateUser = async () => {
    try {
      const individualLimit = parseFloat(userEditForm.individual_limit)
      
      console.log('handleUpdateUser called with:', {
        individualLimit,
        userRole: profile?.role,
        userBusinessUnitId: profile?.business_unit_id,
        willValidate: profile?.role === 'JEFE_UNIDAD_NEGOCIO' && profile?.business_unit_id
      })
      
      // Validate business unit limit for JEFE_UNIDAD_NEGOCIO
      if (profile?.role === 'JEFE_UNIDAD_NEGOCIO' && profile?.business_unit_id) {
        console.log('Validating limits:', {
          profile_business_unit_id: profile.business_unit_id,
          businessUnitLimits: businessUnitLimits.map(bu => ({
            id: bu.business_unit_id,
            name: bu.business_unit_name,
            max_limit: bu.max_authorization_limit
          })),
          individualLimit,
          individualLimitType: typeof individualLimit
        })
        
        const businessUnitLimit = businessUnitLimits.find(
          bu => bu.business_unit_id === profile.business_unit_id
        )
        
        console.log('Found business unit limit:', businessUnitLimit)
        
        if (businessUnitLimit && individualLimit > businessUnitLimit.max_authorization_limit) {
          console.log('VALIDATION FAILED: Individual limit exceeds business unit limit')
          const errorMessage = `El límite individual (${formatCurrency(individualLimit)}) no puede exceder el límite de la unidad de negocio (${formatCurrency(businessUnitLimit.max_authorization_limit)})`
          
          // Show professional error dialog
          setValidationErrorMessage(errorMessage)
          setShowValidationError(true)
          
          return
        } else {
          console.log('VALIDATION PASSED: Individual limit is within business unit limit')
        }
        
        if (!businessUnitLimit) {
          const errorMessage = 'No se encontró el límite configurado para tu unidad de negocio. Contacta al administrador.'
          setValidationErrorMessage(errorMessage)
          setShowValidationError(true)
          return
        }
      }
      
      const response = await fetch('/api/users/update-authorization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userEditForm.user_id,
          role: userEditForm.role,
          individual_limit: individualLimit,
          business_unit_id: userEditForm.business_unit_id === 'unassigned' ? null : userEditForm.business_unit_id,
          plant_id: userEditForm.plant_id === 'unassigned' ? null : userEditForm.plant_id,
          position: userEditForm.position,
          notes: userEditForm.notes
        })
      })

      const data = await response.json()
      
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success('Usuario actualizado correctamente')
        setShowUserEditDialog(false)
        
        // Refresh profile if we updated our own user
        if (userEditForm.user_id === profile?.id) {
          await refreshProfile()
        }
        
        loadData()
        resetUserEditForm()
      }
    } catch (err) {
      toast.error('Error actualizando usuario')
      console.error(err)
    }
  }

  const handleSetBusinessUnitLimit = async () => {
    try {
      const response = await fetch('/api/authorization/business-unit-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_unit_id: businessUnitLimitForm.business_unit_id,
          assigned_limit: parseFloat(businessUnitLimitForm.assigned_limit),
          notes: businessUnitLimitForm.notes
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        if (response.status === 403) {
          const errorMessage = 'No tienes permisos para configurar límites de unidad de negocio. Solo Gerencia General puede realizar esta acción.'
          setValidationErrorMessage(errorMessage)
          setShowValidationError(true)
          setShowBusinessUnitLimitDialog(false)
        } else {
          toast.error(data.error || 'Error configurando límite')
        }
      } else {
        toast.success(data.message || 'Límite de unidad de negocio configurado')
        setShowBusinessUnitLimitDialog(false)
        loadBusinessUnitLimits() // Only reload the limits, not all data
        resetBusinessUnitLimitForm()
      }
    } catch (err) {
      toast.error('Error configurando límite')
      console.error(err)
    }
  }



  const resetUserEditForm = () => {
    setUserEditForm({
      user_id: '',
      role: '',
      individual_limit: '',
      business_unit_id: '',
      plant_id: '',
      position: '',
      notes: ''
    })
  }

  const resetBusinessUnitLimitForm = () => {
    setBusinessUnitLimitForm({
      business_unit_id: '',
      assigned_limit: '',
      notes: ''
    })
  }



  const openUserEditDialog = (user: UserProfile) => {
    setUserEditForm({
      user_id: user.user_id,
      role: user.role,
      individual_limit: user.individual_limit.toString(),
      business_unit_id: user.business_unit_id || 'unassigned',
      plant_id: user.plant_id || 'unassigned',
      position: user.position || '',
      notes: ''
    })
    setSelectedUser(user)
    setShowUserEditDialog(true)
  }

  const getRoleColor = (role: string) => {
    const colors = {
      'GERENCIA_GENERAL': 'bg-purple-100 text-purple-800',
      'JEFE_UNIDAD_NEGOCIO': 'bg-blue-100 text-blue-800',
      'JEFE_PLANTA': 'bg-green-100 text-green-800',
      'AREA_ADMINISTRATIVA': 'bg-orange-100 text-orange-800',
      'ENCARGADO_MANTENIMIENTO': 'bg-yellow-100 text-yellow-800',
      'EJECUTIVO': 'bg-indigo-100 text-indigo-800',
      'default': 'bg-gray-100 text-gray-800'
    }
    return colors[role as keyof typeof colors] || colors.default
  }

  const getRoleDisplayName = (role: string) => {
    const names = {
      'OPERADOR': 'Operador',
      'DOSIFICADOR': 'Dosificador',
      'ENCARGADO_MANTENIMIENTO': 'Encargado de Mantenimiento',
      'JEFE_PLANTA': 'Jefe de Planta',
      'AREA_ADMINISTRATIVA': 'Área Administrativa',
      'AUXILIAR_COMPRAS': 'Auxiliar de Compras',
      'JEFE_UNIDAD_NEGOCIO': 'Jefe de Unidad de Negocio',
      'EJECUTIVO': 'Ejecutivo',
      'GERENCIA_GENERAL': 'Gerencia General',
      'VISUALIZADOR': 'Visualizador'
    }
    return names[role as keyof typeof names] || role
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Cargando configuración de autorizaciones...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Autorizaciones</h1>
          <p className="text-muted-foreground">
            Configura límites de autorización, roles de usuario y delegaciones
          </p>
          <div className="text-sm text-gray-500 mt-2">
            Usuario actual: {profile?.role} | ID: {profile?.id}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2"
              onClick={() => refreshProfile()}
            >
              Refrescar Perfil
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          {profile?.role === 'GERENCIA_GENERAL' ? (
            <Dialog open={showBusinessUnitLimitDialog} onOpenChange={setShowBusinessUnitLimitDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Building2 className="h-4 w-4 mr-2" />
                  Configurar Límites
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurar Límite Máximo de Unidad de Negocio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Unidad de Negocio</Label>
                  <Select
                    value={businessUnitLimitForm.business_unit_id}
                    onValueChange={(value) =>
                      setBusinessUnitLimitForm(prev => ({ ...prev, business_unit_id: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una unidad de negocio" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(businessUnits) && businessUnits.map((bu) => (
                        <SelectItem key={bu.id} value={bu.id}>
                          {bu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Límite Máximo de Autorización (MXN)</Label>
                  <Input
                    type="number"
                    value={businessUnitLimitForm.assigned_limit}
                    onChange={(e) =>
                      setBusinessUnitLimitForm(prev => ({ ...prev, assigned_limit: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Límite máximo que pueden autorizar los usuarios de esta unidad
                  </p>
                </div>
                <div>
                  <Label>Notas</Label>
                  <Textarea
                    value={businessUnitLimitForm.notes}
                    onChange={(e) =>
                      setBusinessUnitLimitForm(prev => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Motivo del límite asignado..."
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSetBusinessUnitLimit} className="flex-1">
                    Configurar Límite Máximo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowBusinessUnitLimitDialog(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded border">
              <Shield className="h-4 w-4 inline mr-2" />
              Solo Gerencia General puede configurar límites de unidad de negocio
            </div>
          )}
        </div>
      </div>

      {error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="users">Gestión de Usuarios</TabsTrigger>
              <TabsTrigger value="business-units">Límites por Unidad</TabsTrigger>
            </TabsList>



        <TabsContent value="business-units" className="space-y-4">
          {profile?.role !== 'GERENCIA_GENERAL' && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <Shield className="h-4 w-4" />
              <AlertTitle>Acceso de Solo Lectura</AlertTitle>
              <AlertDescription>
                Tu rol <strong>{getRoleDisplayName(profile?.role || '')}</strong> solo puede visualizar los límites de unidad de negocio. 
                Solo Gerencia General puede configurar o modificar estos límites.
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Límites Máximos por Unidad de Negocio</CardTitle>
              <CardDescription>
                {profile?.role === 'GERENCIA_GENERAL' 
                  ? 'Configura el límite máximo de autorización que pueden tener los usuarios de cada unidad de negocio. Este es un techo, no un fondo distribuible - todos los usuarios de la unidad pueden tener hasta este límite.'
                  : 'Visualiza los límites máximos de autorización configurados para cada unidad de negocio.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidad de Negocio</TableHead>
                    <TableHead>Límite Máximo</TableHead>
                    <TableHead>Usuarios en Límite Max</TableHead>
                    <TableHead>Total Usuarios</TableHead>
                    <TableHead>Última Actualización</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(businessUnitLimits) && businessUnitLimits.map((buLimit) => {
                    const lastUpdated = buLimit.last_updated ? new Date(buLimit.last_updated).toLocaleDateString('es-MX') : 'No configurado'
                    
                    return (
                      <TableRow key={buLimit.business_unit_id}>
                        <TableCell className="font-medium">{buLimit.business_unit_name || 'Sin nombre'}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatCurrency(buLimit.max_authorization_limit || 0)}
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-400">N/A</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-400">N/A</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lastUpdated}</TableCell>
                        <TableCell>
                          {profile?.role === 'GERENCIA_GENERAL' ? (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setBusinessUnitLimitForm({
                                  business_unit_id: buLimit.business_unit_id,
                                  assigned_limit: buLimit.max_authorization_limit?.toString() || '0',
                                  notes: buLimit.notes || ''
                                })
                                setShowBusinessUnitLimitDialog(true)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">Solo Gerencia</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4" />
            <AlertTitle>Sistema de Autorización Simplificado</AlertTitle>
            <AlertDescription>
              <strong>Sistema dinámico por unidades de negocio:</strong> Solo Gerencia General tiene autorización ilimitada. 
              Los demás usuarios están limitados por el menor valor entre su límite individual y el límite máximo de su unidad de negocio.
              Configura primero los límites de unidad de negocio en la pestaña "Límites por Unidad".
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Gestión de Usuarios y Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Límite Individual</TableHead>
                    <TableHead>Límite Unidad de Negocio</TableHead>
                    <TableHead>Autorización Efectiva</TableHead>
                    <TableHead>Unidad/Planta</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                                 <TableBody>
                   {Array.isArray(users) && users.map((user) => (
                     <TableRow key={user.user_id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.nombre} {user.apellido}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(user.role)} variant="secondary">
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(user.individual_limit)}</TableCell>
                      <TableCell>
                        {user.business_unit_max_limit ? (
                          <span className="text-blue-600 font-medium">
                            {formatCurrency(user.business_unit_max_limit)}
                          </span>
                        ) : (
                          <span className="text-gray-400">Sin límite configurado</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {formatCurrency(user.effective_global_authorization)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{user.business_unit_name || 'Sin asignar'}</div>
                          <div className="text-muted-foreground">{user.plant_name || 'Sin planta'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openUserEditDialog(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* User Edit Dialog */}
          <Dialog open={showUserEditDialog} onOpenChange={setShowUserEditDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  Editar Usuario: {selectedUser?.nombre} {selectedUser?.apellido}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rol</Label>
                  <Select
                    value={userEditForm.role}
                    onValueChange={(value) =>
                      setUserEditForm(prev => ({ ...prev, role: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {getRoleDisplayName(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Límite Individual (MXN)</Label>
                  <Input
                    type="number"
                    value={userEditForm.individual_limit}
                    onChange={(e) =>
                      setUserEditForm(prev => ({ ...prev, individual_limit: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Unidad de Negocio</Label>
                  <Select
                    value={userEditForm.business_unit_id}
                    onValueChange={(value) =>
                      setUserEditForm(prev => ({ ...prev, business_unit_id: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar unidad" />
                    </SelectTrigger>
                                         <SelectContent>
                       <SelectItem value="unassigned">Sin asignar</SelectItem>
                       {businessUnits.map((bu) => (
                         <SelectItem key={bu.id} value={bu.id}>
                           {bu.name}
                         </SelectItem>
                       ))}
                     </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Planta</Label>
                  <Select
                    value={userEditForm.plant_id}
                    onValueChange={(value) =>
                      setUserEditForm(prev => ({ ...prev, plant_id: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar planta" />
                    </SelectTrigger>
                                         <SelectContent>
                       <SelectItem value="unassigned">Sin asignar</SelectItem>
                       {plants
                         .filter(p => !userEditForm.business_unit_id || userEditForm.business_unit_id === 'unassigned' || p.business_unit_id === userEditForm.business_unit_id)
                         .map((plant) => (
                           <SelectItem key={plant.id} value={plant.id}>
                             {plant.name}
                           </SelectItem>
                         ))}
                     </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Posición</Label>
                  <Input
                    value={userEditForm.position}
                    onChange={(e) =>
                      setUserEditForm(prev => ({ ...prev, position: e.target.value }))
                    }
                    placeholder="Título del puesto"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={userEditForm.notes}
                    onChange={(e) =>
                      setUserEditForm(prev => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Motivo del cambio..."
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleUpdateUser} className="flex-1">
                  Actualizar Usuario
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowUserEditDialog(false)}
                >
                  Cancelar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

      </Tabs>

      {/* Validation Error Dialog */}
      <AlertDialog open={showValidationError} onOpenChange={setShowValidationError}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Límite de Autorización Excedido
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {validationErrorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowValidationError(false)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 