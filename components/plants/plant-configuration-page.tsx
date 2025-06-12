'use client'

import { useState, useEffect } from 'react'
import { 
  Building2, 
  Plus, 
  Edit, 
  Eye, 
  Users,
  Package,
  MapPin,
  Phone,
  Mail
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'

interface BusinessUnit {
  id: string
  name: string
  code: string
}

interface Plant {
  id: string
  name: string
  code: string
  address?: string
  phone?: string
  email?: string
  status: string
  business_unit_id: string
  business_units?: BusinessUnit
}

export function PlantConfigurationPage() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchPlants()
  }, [])

  const fetchPlants = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/plants')
      if (response.ok) {
        const data = await response.json()
        setPlants(data)
      } else {
        throw new Error('Error fetching plants')
      }
    } catch (error) {
      console.error('Error fetching plants:', error)
      toast({
        title: "Error",
        description: "Error al cargar las plantas",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    return status === 'active' ? 'default' : 'secondary'
  }

  const getStatusDisplayName = (status: string) => {
    return status === 'active' ? 'Activa' : 'Inactiva'
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
          <h1 className="text-2xl font-bold text-gray-900">Configuración de Plantas</h1>
          <p className="text-gray-600">Gestiona las plantas y su configuración organizacional</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Planta
        </Button>
      </div>

      {/* Plants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plants.map((plant) => (
          <Card key={plant.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{plant.name}</CardTitle>
                    <p className="text-sm text-gray-600">{plant.code}</p>
                  </div>
                </div>
                <Badge variant={getStatusBadgeColor(plant.status)}>
                  {getStatusDisplayName(plant.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Business Unit */}
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Unidad de Negocio:</span>
                <span className="font-medium">{plant.business_units?.name}</span>
              </div>

              {/* Address */}
              {plant.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <span className="text-gray-600">Dirección:</span>
                    <p className="font-medium">{plant.address}</p>
                  </div>
                </div>
              )}

              {/* Contact Info */}
              <div className="space-y-2">
                {plant.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Teléfono:</span>
                    <span className="font-medium">{plant.phone}</span>
                  </div>
                )}
                {plant.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium">{plant.email}</span>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                    <Package className="w-4 h-4" />
                    <span>Activos</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">-</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>Personal</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">-</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="w-4 h-4 mr-1" />
                  Ver Detalles
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plants.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay plantas configuradas
              </h3>
              <p className="text-gray-600 mb-4">
                Comienza agregando tu primera planta al sistema
              </p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Crear Primera Planta
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 