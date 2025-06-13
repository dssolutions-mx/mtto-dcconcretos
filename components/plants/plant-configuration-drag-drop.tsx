'use client'

import { useState, useEffect } from 'react'
import { 
  Building2, 
  Users, 
  Shield, 
  Settings,
  Plus,
  Edit,
  GripVertical,
  ChevronRight,
  UserPlus,
  Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  plants?: Plant
  business_units?: BusinessUnit
}

interface Permission {
  id: string
  name: string
  description: string
  category: string
}

interface RolePermission {
  role: string
  permissions: string[]
}

// Draggable User Card
function DraggableUserCard({ user }: { user: User }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: user.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-all cursor-grab ${
        isDragging ? 'cursor-grabbing' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners}>
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        <Avatar className="h-10 w-10">
          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.nombre} ${user.apellido}`} />
          <AvatarFallback>
            {user.nombre?.[0]}{user.apellido?.[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {user.nombre} {user.apellido}
          </p>
          <p className="text-xs text-gray-600">{user.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="text-xs" variant={getRoleBadgeVariant(user.role)}>
              {getRoleDisplayName(user.role)}
            </Badge>
            {user.can_authorize_up_to && (
              <span className="text-xs text-gray-500">
                Autoriza: ${user.can_authorize_up_to.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Droppable Role Zone
function DroppableRoleZone({ 
  role, 
  users, 
  isOver,
  onUpdateRole
}: { 
  role: string
  users: User[]
  isOver: boolean
  onUpdateRole: (userId: string, newRole: string) => void
}) {
  return (
    <Card className={`transition-all ${isOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{getRoleDisplayName(role)}</span>
          <Badge variant="secondary">{users.length}</Badge>
        </CardTitle>
        <CardDescription>
          {getRoleDescription(role)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            <SortableContext
              items={users.map(u => u.id)}
              strategy={verticalListSortingStrategy}
            >
              {users.map((user) => (
                <DraggableUserCard key={user.id} user={user} />
              ))}
            </SortableContext>
            {users.length === 0 && (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Arrastra usuarios aquí</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
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

function getRoleDescription(role: string) {
  const descriptions: Record<string, string> = {
    'GERENCIA_GENERAL': 'Acceso completo al sistema, autorización ilimitada',
    'JEFE_UNIDAD_NEGOCIO': 'Gestión de múltiples plantas, autoriza hasta $5,000',
    'ENCARGADO_MANTENIMIENTO': 'Gestión de mantenimiento, autoriza hasta $1,000',
    'JEFE_PLANTA': 'Gestión de planta específica, autoriza hasta $1,000',
    'DOSIFICADOR': 'Operaciones de dosificación, autoriza hasta $1,000',
    'OPERADOR': 'Operación de equipos, requiere autorización',
    'AUXILIAR_COMPRAS': 'Apoyo en compras, requiere autorización',
    'AREA_ADMINISTRATIVA': 'Funciones administrativas, autoriza hasta $2,000',
    'EJECUTIVO': 'Nivel ejecutivo, autorización ilimitada',
    'VISUALIZADOR': 'Solo lectura, sin autorización'
  }
  return descriptions[role] || 'Sin descripción'
}

const defaultPermissions: Permission[] = [
  // Assets
  { id: '1', name: 'assets.view', description: 'Ver activos', category: 'Activos' },
  { id: '2', name: 'assets.create', description: 'Crear activos', category: 'Activos' },
  { id: '3', name: 'assets.edit', description: 'Editar activos', category: 'Activos' },
  { id: '4', name: 'assets.delete', description: 'Eliminar activos', category: 'Activos' },
  
  // Work Orders
  { id: '5', name: 'work_orders.view', description: 'Ver órdenes de trabajo', category: 'Órdenes de Trabajo' },
  { id: '6', name: 'work_orders.create', description: 'Crear órdenes de trabajo', category: 'Órdenes de Trabajo' },
  { id: '7', name: 'work_orders.edit', description: 'Editar órdenes de trabajo', category: 'Órdenes de Trabajo' },
  { id: '8', name: 'work_orders.complete', description: 'Completar órdenes de trabajo', category: 'Órdenes de Trabajo' },
  
  // Purchase Orders
  { id: '9', name: 'purchase_orders.view', description: 'Ver órdenes de compra', category: 'Compras' },
  { id: '10', name: 'purchase_orders.create', description: 'Crear órdenes de compra', category: 'Compras' },
  { id: '11', name: 'purchase_orders.approve', description: 'Aprobar órdenes de compra', category: 'Compras' },
  
  // Reports
  { id: '12', name: 'reports.view', description: 'Ver reportes', category: 'Reportes' },
  { id: '13', name: 'reports.export', description: 'Exportar reportes', category: 'Reportes' },
  
  // Personnel
  { id: '14', name: 'personnel.view', description: 'Ver personal', category: 'Personal' },
  { id: '15', name: 'personnel.manage', description: 'Gestionar personal', category: 'Personal' },
  { id: '16', name: 'personnel.permissions', description: 'Gestionar permisos', category: 'Personal' },
]

const defaultRolePermissions: RolePermission[] = [
  {
    role: 'GERENCIA_GENERAL',
    permissions: defaultPermissions.map(p => p.name) // All permissions
  },
  {
    role: 'JEFE_UNIDAD_NEGOCIO',
    permissions: defaultPermissions.filter(p => !p.name.includes('delete')).map(p => p.name)
  },
  {
    role: 'JEFE_PLANTA',
    permissions: ['assets.view', 'assets.edit', 'work_orders.view', 'work_orders.create', 'work_orders.edit', 'purchase_orders.view', 'purchase_orders.create', 'reports.view', 'personnel.view']
  },
  {
    role: 'ENCARGADO_MANTENIMIENTO',
    permissions: ['assets.view', 'assets.edit', 'work_orders.view', 'work_orders.create', 'work_orders.edit', 'work_orders.complete', 'purchase_orders.view', 'purchase_orders.create']
  },
  {
    role: 'OPERADOR',
    permissions: ['assets.view', 'work_orders.view', 'reports.view']
  },
  {
    role: 'VISUALIZADOR',
    permissions: ['assets.view', 'work_orders.view', 'reports.view']
  }
]

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
            <Label htmlFor="location">Ubicación</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
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
              <Label htmlFor="contact_phone">Teléfono</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Email</Label>
              <Input
                id="contact_email"
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
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null)
  const [plants, setPlants] = useState<Plant[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>(defaultRolePermissions)
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [editingPlant, setEditingPlant] = useState(false)
  const [showCreatePlant, setShowCreatePlant] = useState(false)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedPlant) {
      fetchUsersByPlant(selectedPlant.id)
    }
  }, [selectedPlant])

  const fetchData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        fetchPlants(),
        fetchBusinessUnits()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "Error al cargar los datos",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchPlants = async () => {
    try {
      const response = await fetch('/api/plants')
      if (response.ok) {
        const data = await response.json()
        setPlants(data)
        if (data.length > 0 && !selectedPlant) {
          setSelectedPlant(data[0])
        }
      }
    } catch (error) {
      console.error('Error fetching plants:', error)
    }
  }

  const fetchBusinessUnits = async () => {
    try {
      const response = await fetch('/api/business-units')
      if (response.ok) {
        const data = await response.json()
        setBusinessUnits(data)
      }
    } catch (error) {
      console.error('Error fetching business units:', error)
    }
  }

  const fetchUsersByPlant = async (plantId: string) => {
    try {
      const response = await fetch(`/api/operators/register?plant_id=${plantId}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over) return

    const userId = active.id as string
    const targetRole = over.id as string

    const user = users.find(u => u.id === userId)
    if (!user || user.role === targetRole) return

    // Update user role
    try {
      const response = await fetch(`/api/operators/register/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: targetRole
        })
      })

      if (response.ok) {
        // Update local state
        setUsers(prev => prev.map(u => 
          u.id === userId 
            ? { ...u, role: targetRole }
            : u
        ))
        
        toast({
          title: "Éxito",
          description: `Rol de ${user.nombre} ${user.apellido} actualizado a ${getRoleDisplayName(targetRole)}`,
        })
      } else {
        throw new Error('Error al actualizar rol')
      }
    } catch (error) {
      console.error('Error updating user role:', error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el rol del usuario",
        variant: "destructive"
      })
    }
  }

  const handlePermissionToggle = (role: string, permission: string) => {
    setRolePermissions(prev => prev.map(rp => {
      if (rp.role === role) {
        const permissions = rp.permissions.includes(permission)
          ? rp.permissions.filter(p => p !== permission)
          : [...rp.permissions, permission]
        return { ...rp, permissions }
      }
      return rp
    }))
  }

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

  // Group users by role
  const usersByRole = users.reduce((acc, user) => {
    if (!acc[user.role]) acc[user.role] = []
    acc[user.role].push(user)
    return acc
  }, {} as Record<string, User[]>)

  const activeUser = users.find(u => u.id === activeId)

  const roles = [
    'GERENCIA_GENERAL',
    'JEFE_UNIDAD_NEGOCIO',
    'JEFE_PLANTA',
    'ENCARGADO_MANTENIMIENTO',
    'DOSIFICADOR',
    'OPERADOR',
    'AUXILIAR_COMPRAS',
    'AREA_ADMINISTRATIVA',
    'EJECUTIVO',
    'VISUALIZADOR'
  ]

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
          <p className="text-gray-600">Gestiona plantas, personal y permisos</p>
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
        </div>
      </div>

      {selectedPlant && (
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="personnel">Personal y Roles</TabsTrigger>
            <TabsTrigger value="permissions">Permisos</TabsTrigger>
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
                        type="email"
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

          {/* Personnel Tab with Drag & Drop */}
          <TabsContent value="personnel" className="space-y-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <div key={role} id={role}>
                    <DroppableRoleZone
                      role={role}
                      users={usersByRole[role] || []}
                      isOver={overId === role}
                      onUpdateRole={(userId, newRole) => {
                        // This is handled in handleDragEnd
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Drag Overlay */}
              <DragOverlay>
                {activeUser && (
                  <div className="p-3 bg-white border rounded-lg shadow-lg cursor-grabbing">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${activeUser.nombre} ${activeUser.apellido}`} />
                        <AvatarFallback>
                          {activeUser.nombre?.[0]}{activeUser.apellido?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">
                          {activeUser.nombre} {activeUser.apellido}
                        </p>
                        <Badge className="text-xs" variant={getRoleBadgeVariant(activeUser.role)}>
                          {getRoleDisplayName(activeUser.role)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Permisos por Rol</CardTitle>
                <CardDescription>
                  Configura los permisos específicos para cada rol en esta planta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {roles.filter(role => usersByRole[role]?.length > 0).map((role) => {
                    const rolePerms = rolePermissions.find(rp => rp.role === role)
                    
                    return (
                      <div key={role} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Shield className="w-5 h-5" />
                          <h3 className="font-semibold">{getRoleDisplayName(role)}</h3>
                          <Badge variant="secondary">{usersByRole[role]?.length || 0} usuarios</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-7">
                          {Object.entries(
                            defaultPermissions.reduce((acc, perm) => {
                              if (!acc[perm.category]) acc[perm.category] = []
                              acc[perm.category].push(perm)
                              return acc
                            }, {} as Record<string, Permission[]>)
                          ).map(([category, permissions]) => (
                            <div key={category} className="space-y-2">
                              <h4 className="text-sm font-medium text-gray-700">{category}</h4>
                              <div className="space-y-1">
                                {permissions.map((permission) => (
                                  <div key={permission.id} className="flex items-center space-x-2">
                                    <Switch
                                      id={`${role}-${permission.id}`}
                                      checked={rolePerms?.permissions.includes(permission.name) || false}
                                      onCheckedChange={() => handlePermissionToggle(role, permission.name)}
                                      disabled={role === 'GERENCIA_GENERAL'} // Always has all permissions
                                    />
                                    <Label
                                      htmlFor={`${role}-${permission.id}`}
                                      className="text-sm font-normal cursor-pointer"
                                    >
                                      {permission.description}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <Separator />
                      </div>
                    )
                  })}
                </div>
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