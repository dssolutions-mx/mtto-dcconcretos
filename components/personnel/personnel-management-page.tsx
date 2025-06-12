'use client'

import { useState, useEffect } from 'react'
import { Plus, Users, Building2, UserPlus, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import { CreateOperatorDialog } from './create-operator-dialog'
import { OperatorDetailsDialog } from './operator-details-dialog'
import { useToast } from '@/components/ui/use-toast'

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

export function PersonnelManagementPage() {
  const [operators, setOperators] = useState<Operator[]>([])
  const [filteredOperators, setFilteredOperators] = useState<Operator[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Fetch operators and plants
  useEffect(() => {
    fetchOperators()
    fetchPlants()
  }, [])

  // Filter operators based on search and filters
  useEffect(() => {
    let filtered = operators

    if (selectedPlant) {
      filtered = filtered.filter(op => op.plants?.id === selectedPlant.id)
    }

    if (selectedRole !== 'all') {
      filtered = filtered.filter(op => op.role === selectedRole)
    }

    if (searchTerm) {
      filtered = filtered.filter(op => 
        `${op.nombre} ${op.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredOperators(filtered)
  }, [operators, selectedPlant, selectedRole, searchTerm])

  const fetchOperators = async () => {
    try {
      const response = await fetch('/api/operators/register')
      if (response.ok) {
        const data = await response.json()
        setOperators(data)
      } else {
        toast({
          title: "Error",
          description: "No se pudieron cargar los operadores",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching operators:', error)
      toast({
        title: "Error",
        description: "Error de conexión al cargar operadores",
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
      }
    } catch (error) {
      console.error('Error fetching plants:', error)
    }
  }

  const handleOperatorCreated = (newOperator: Operator) => {
    setOperators(prev => [newOperator, ...prev])
    setShowCreateDialog(false)
    toast({
      title: "Éxito",
      description: "Operador creado exitosamente",
    })
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Personal</h1>
          <p className="text-gray-600">Administra operadores y personal de planta</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
          <UserPlus className="w-4 h-4 mr-2" />
          Nuevo Empleado
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedPlant?.id || 'all'} onValueChange={(value) => {
              if (value === 'all') {
                setSelectedPlant(null)
              } else {
                const plant = plants.find(p => p.id === value)
                setSelectedPlant(plant || null)
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las plantas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las plantas</SelectItem>
                {plants.map((plant) => (
                  <SelectItem key={plant.id} value={plant.id}>
                    {plant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="OPERADOR">Operadores</SelectItem>
                <SelectItem value="DOSIFICADOR">Dosificadores</SelectItem>
                <SelectItem value="JEFE_PLANTA">Jefes de Planta</SelectItem>
                <SelectItem value="ENCARGADO_MANTENIMIENTO">Encargados Mantenimiento</SelectItem>
                <SelectItem value="JEFE_UNIDAD_NEGOCIO">Jefes Unidad Negocio</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              {filteredOperators.length} empleados
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOperators.map((operator) => (
          <Card 
            key={operator.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedOperator(operator)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${operator.nombre} ${operator.apellido}`} />
                  <AvatarFallback>
                    {operator.nombre?.[0]}{operator.apellido?.[0]}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {operator.nombre} {operator.apellido}
                  </h3>
                  
                  {operator.employee_code && (
                    <p className="text-sm text-gray-600">
                      Código: {operator.employee_code}
                    </p>
                  )}
                  
                  <div className="mt-2 space-y-1">
                    <Badge className={getRoleBadgeColor(operator.role)}>
                      {getRoleDisplayName(operator.role)}
                    </Badge>
                    
                    {operator.plants && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Building2 className="w-3 h-3" />
                        {operator.plants.name}
                      </div>
                    )}
                    
                    {operator.shift && (
                      <div className="text-xs text-gray-600">
                        Turno: {operator.shift}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center text-xs text-gray-600">
                  <span>Estado: {operator.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                  {operator.can_authorize_up_to && (
                    <span>Autoriza: ${operator.can_authorize_up_to.toLocaleString()}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredOperators.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No se encontraron empleados
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedPlant || selectedRole !== 'all' 
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Comienza agregando tu primer empleado'
                }
              </p>
              {!searchTerm && !selectedPlant && selectedRole === 'all' && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Agregar Empleado
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateOperatorDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onOperatorCreated={handleOperatorCreated}
        plants={plants}
      />

      {selectedOperator && (
        <OperatorDetailsDialog
          operator={selectedOperator}
          open={!!selectedOperator}
          onOpenChange={(open: boolean) => !open && setSelectedOperator(null)}
          plants={plants}
          onOperatorUpdated={(updatedOperator: Operator) => {
            setOperators(prev => prev.map(op => 
              op.id === updatedOperator.id ? updatedOperator : op
            ))
            setSelectedOperator(null)
          }}
        />
      )}
    </div>
  )
} 