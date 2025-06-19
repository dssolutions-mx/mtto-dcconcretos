'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Building2, 
  Users, 
  Settings,
  Plus,
  Edit,
  Save,
  MapPin,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

interface Plant {
  id: string
  name: string
  code: string
  business_unit_id: string
  address?: string
  contact_phone?: string
  contact_email?: string
  status: string
}

interface BusinessUnit {
  id: string
  name: string
  code: string
}

interface User {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono?: string
  role: string
  employee_code?: string
  position?: string
  status: string
  can_authorize_up_to?: number
  plant_id?: string
  business_unit_id?: string
  plants?: Plant
  business_units?: BusinessUnit
}

// Helper functions
function getRoleBadgeVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    'GERENCIA_GENERAL': 'default',
    'JEFE_UNIDAD_NEGOCIO': 'default',
    'ENCARGADO_MANTENIMIENTO': 'secondary',
    'JEFE_PLANTA': 'secondary',
    'OPERADOR': 'outline',
  }
  return variants[role] || 'outline'
}

function getRoleDisplayName(role: string) {
  const names: Record<string, string> = {
    'GERENCIA_GENERAL': 'Gerencia General',
    'JEFE_UNIDAD_NEGOCIO': 'Jefe Unidad de Negocio',
    'ENCARGADO_MANTENIMIENTO': 'Encargado Mantenimiento',
    'JEFE_PLANTA': 'Jefe de Planta',
    'DOSIFICADOR': 'Dosificador',
    'OPERADOR': 'Operador',
    'AUXILIAR_COMPRAS': 'Auxiliar de Compras',
    'AREA_ADMINISTRATIVA': 'Área Administrativa',
    'EJECUTIVO': 'Ejecutivo',
    'VISUALIZADOR': 'Visualizador'
  }
  return names[role] || role
}

// CreatePlantDialog Component
function CreatePlantDialog({ 
  open, 
  onOpenChange, 
  onPlantCreated,
  businessUnits 
}: { 
  open: boolean
  onOpenChange: (open: boolean) => void
  onPlantCreated: (plantData: any) => void
  businessUnits: BusinessUnit[]
}) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    business_unit_id: '',
    location: '',
    address: '',
    contact_phone: '',
    contact_email: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.code || !formData.business_unit_id) {
      return
    }

    setLoading(true)
    try {
      await onPlantCreated(formData)
      setFormData({
        name: '',
        code: '',
        business_unit_id: '',
        location: '',
        address: '',
        contact_phone: '',
        contact_email: ''
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nueva Planta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="business_unit">Unidad de Negocio *</Label>
            <Select 
              value={formData.business_unit_id} 
              onValueChange={(value) => setFormData({ ...formData, business_unit_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar unidad de negocio" />
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
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Planta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PlantConfigurationDragDrop() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingPlant, setEditingPlant] = useState(false)
  const [showCreatePlant, setShowCreatePlant] = useState(false)
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      setLoading(true)
      const [plantsRes, businessUnitsRes] = await Promise.all([
        fetch('/api/plants'),
        fetch('/api/business-units')
      ])

      if (plantsRes.ok) {
        const plantsData = await plantsRes.json()
        setPlants(plantsData || [])
        if (plantsData && plantsData.length > 0 && !selectedPlant) {
          setSelectedPlant(plantsData[0])
        }
      }

      if (businessUnitsRes.ok) {
        const businessUnitsData = await businessUnitsRes.json()
        setBusinessUnits(businessUnitsData || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchUsersByPlant = async (plantId: string) => {
    try {
      const response = await fetch(`/api/operators/register?plant_id=${plantId}`)
      if (response.ok) {
        const usersData = await response.json()
        setUsers(usersData || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedPlant) {
      fetchUsersByPlant(selectedPlant.id)
    }
  }, [selectedPlant])

  const handleSavePlantDetails = async () => {
    if (!selectedPlant) return

    try {
      const response = await fetch(`/api/plants/${selectedPlant.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(selectedPlant)
      })

      if (response.ok) {
        const updatedPlant = await response.json()
        setPlants(prev => prev.map(p => p.id === updatedPlant.id ? updatedPlant : p))
        setSelectedPlant(updatedPlant)
        toast({
          title: "Éxito",
          description: "Detalles de planta actualizados",
        })
        setEditingPlant(false)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Error al actualizar planta')
      }
    } catch (error) {
      console.error('Error updating plant:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudieron actualizar los detalles",
        variant: "destructive"
      })
    }
  }

  const handleCreatePlant = async (plantData: {
    name: string
    code: string
    business_unit_id: string
    location?: string
    address?: string
    contact_phone?: string
    contact_email?: string
  }) => {
    try {
      const response = await fetch('/api/plants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(plantData)
      })

      if (response.ok) {
        const newPlant = await response.json()
        setPlants(prev => [newPlant, ...prev])
        setSelectedPlant(newPlant)
        setShowCreatePlant(false)
        toast({
          title: "Éxito",
          description: "Planta creada exitosamente",
        })
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear planta')
      }
    } catch (error) {
      console.error('Error creating plant:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear la planta",
        variant: "destructive"
      })
    }
  }

  // Group users by role for display
  const usersByRole = useMemo(() => {
    return users.reduce((acc, user) => {
      if (!acc[user.role]) acc[user.role] = []
      acc[user.role].push(user)
      return acc
    }, {} as Record<string, User[]>)
  }, [users])

  // Group plants by business unit
  const plantsByBusinessUnit = useMemo(() => {
    return plants.reduce((acc, plant) => {
      const businessUnit = businessUnits.find(bu => bu.id === plant.business_unit_id)
      if (businessUnit) {
        if (!acc[businessUnit.name]) {
          acc[businessUnit.name] = []
        }
        acc[businessUnit.name].push(plant)
      }
      return acc
    }, {} as Record<string, Plant[]>)
  }, [plants, businessUnits])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración de Plantas</h1>
          <p className="text-gray-600">Gestiona plantas y personal asignado</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPlant?.id || ''} onValueChange={(value) => {
            const plant = plants.find(p => p.id === value)
            setSelectedPlant(plant || null)
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Seleccionar planta" />
            </SelectTrigger>
            <SelectContent>
              {plants.map((plant) => (
                <SelectItem key={plant.id} value={plant.id}>
                  {plant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreatePlant(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Planta
          </Button>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Plants Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(plantsByBusinessUnit).map(([businessUnitName, businessUnitPlants]) => (
          <Card key={businessUnitName}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
                {businessUnitName}
              </CardTitle>
              <CardDescription>
                {businessUnitPlants.length} planta{businessUnitPlants.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {businessUnitPlants.map((plant) => (
                  <div
                    key={plant.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedPlant?.id === plant.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedPlant(plant)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{plant.name}</p>
                        <p className="text-sm text-gray-500">{plant.code}</p>
                      </div>
                      <Badge variant={plant.status === 'active' ? 'default' : 'secondary'}>
                        {plant.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedPlant && (
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="personnel">Personal</TabsTrigger>
          </TabsList>

          {/* Plant Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Información de la Planta</CardTitle>
                  <Button
                    variant={editingPlant ? "default" : "outline"}
                    onClick={() => editingPlant ? handleSavePlantDetails() : setEditingPlant(true)}
                  >
                    {editingPlant ? (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Guardar
                      </>
                    ) : (
                      <>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      value={selectedPlant.name}
                      onChange={(e) => setSelectedPlant({...selectedPlant, name: e.target.value})}
                      disabled={!editingPlant}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Código</Label>
                    <Input
                      id="code"
                      value={selectedPlant.code}
                      onChange={(e) => setSelectedPlant({...selectedPlant, code: e.target.value})}
                      disabled={!editingPlant}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business_unit">Unidad de Negocio</Label>
                    <Select 
                      value={selectedPlant.business_unit_id} 
                      onValueChange={(value) => setSelectedPlant({...selectedPlant, business_unit_id: value})}
                      disabled={!editingPlant}
                    >
                      <SelectTrigger>
                        <SelectValue />
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
                    <Label htmlFor="status">Estado</Label>
                    <Select 
                      value={selectedPlant.status} 
                      onValueChange={(value) => setSelectedPlant({...selectedPlant, status: value})}
                      disabled={!editingPlant}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      value={selectedPlant.address || ''}
                      onChange={(e) => setSelectedPlant({...selectedPlant, address: e.target.value})}
                      disabled={!editingPlant}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        value={selectedPlant.contact_phone || ''}
                        onChange={(e) => setSelectedPlant({...selectedPlant, contact_phone: e.target.value})}
                        disabled={!editingPlant}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={selectedPlant.contact_email || ''}
                        onChange={(e) => setSelectedPlant({...selectedPlant, contact_email: e.target.value})}
                        disabled={!editingPlant}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Personnel Tab */}
          <TabsContent value="personnel" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Personal Asignado
                </CardTitle>
                <CardDescription>
                  Personal actualmente asignado a {selectedPlant.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  {Object.keys(usersByRole).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay personal asignado a esta planta</p>
                      <p className="text-sm">Usa la gestión de personal para asignar operadores</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(usersByRole).map(([role, roleUsers]) => (
                        <div key={role} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={getRoleBadgeVariant(role)}>
                              {getRoleDisplayName(role)}
                            </Badge>
                            <span className="text-sm text-gray-500">({roleUsers.length})</span>
                          </div>
                          <div className="grid gap-2">
                            {roleUsers.map((user) => (
                              <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <p className="font-medium">{user.nombre} {user.apellido}</p>
                                  <p className="text-sm text-gray-500">{user.email}</p>
                                  {user.employee_code && (
                                    <p className="text-xs text-gray-400">#{user.employee_code}</p>
                                  )}
                                </div>
                                {user.can_authorize_up_to && (
                                  <Badge variant="outline" className="text-xs">
                                    Autoriza: ${user.can_authorize_up_to.toLocaleString()}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Create Plant Dialog */}
      <CreatePlantDialog
        open={showCreatePlant}
        onOpenChange={setShowCreatePlant}
        onPlantCreated={handleCreatePlant}
        businessUnits={businessUnits}
      />
    </div>
  )
} 