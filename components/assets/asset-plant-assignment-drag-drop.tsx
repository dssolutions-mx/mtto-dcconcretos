'use client'

import { useState, useEffect } from 'react'
import { 
  Building2, 
  Package, 
  Search,
  Filter,
  RefreshCw,
  Factory,
  MapPin,
  Wrench,
  AlertCircle,
  Plus,
  Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'

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
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Asset {
  id: string
  asset_id: string
  name: string
  status: string
  location?: string
  department?: string
  current_hours?: number
  plant_id?: string
  equipment_models?: {
    id: string
    name: string
    manufacturer: string
  }
  plants?: {
    id: string
    name: string
    code: string
    business_unit_id: string
    business_units?: {
      id: string
      name: string
      code: string
    }
  }
}

interface Plant {
  id: string
  name: string
  code: string
  business_unit_id: string
  address?: string
  contact_phone?: string
  status: string
}

interface BusinessUnit {
  id: string
  name: string
  code: string
  description?: string
}

// Asset Draggable Item Component
function AssetDraggableItem({ 
  asset, 
}: { 
  asset: Asset
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-gray-100 border-2 border-dashed border-gray-300 rounded p-1 opacity-50"
      >
        <div className="text-xs text-gray-500">Moviendo {asset.asset_id}</div>
      </div>
    )
  }

  // Ultra-compact version for better density
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white border border-gray-200 rounded p-1.5 cursor-grab active:cursor-grabbing hover:shadow-sm transition-all duration-200 hover:border-blue-300"
    >
      {/* Single line with Asset ID and Badge */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <div className="p-0.5 bg-blue-50 rounded">
            <Package className="h-2 w-2 text-blue-600" />
          </div>
          <span className="font-bold text-sm text-gray-900">
            {asset.asset_id}
          </span>
        </div>
        <Badge variant={asset.status === 'active' ? 'default' : 'secondary'} className="text-[8px] h-2.5 px-1">
          {asset.status}
        </Badge>
      </div>
      
      {/* Asset Name - Only one line, no model duplication */}
      <p className="text-[10px] text-gray-600 leading-tight truncate">
        {asset.name}
      </p>
      
      {/* Bottom line with location and hours */}
      <div className="flex items-center justify-between mt-1">
        {asset.location && (
          <p className="text-[8px] text-gray-500 flex items-center gap-0.5">
            <MapPin className="h-1.5 w-1.5" />
            {asset.location}
          </p>
        )}
        {asset.current_hours && (
          <span className="text-[8px] text-gray-500">
            {asset.current_hours.toLocaleString()}h
          </span>
        )}
      </div>
    </div>
  )
}

// Plant Container Component
function PlantContainer({ 
  plant, 
  assets, 
  onDrop,
  draggedAsset
}: {
  plant: Plant
  assets: Asset[]
  onDrop: (assetId: string, plantId: string) => void
  draggedAsset: Asset | null
}) {
  
  const { setNodeRef, isOver } = useDroppable({
    id: `plant-${plant.id}`,
  })
  
  const plantAssets = assets.filter(asset => asset.plant_id === plant.id)

  return (
    <div 
      ref={setNodeRef} 
      className={`
        relative border-2 rounded-lg transition-all duration-200 min-h-[150px]
        ${isOver 
          ? 'border-green-400 bg-green-50 shadow-lg' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
        }
      `}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-100 rounded">
            <Factory className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-gray-900 truncate">
              {plant.name}
            </h4>
            <p className="text-xs text-gray-600">
              {plantAssets.length} activo{plantAssets.length !== 1 ? 's' : ''} asignado{plantAssets.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Badge variant="outline" className="text-xs px-2 py-0.5">
            {plant.code}
          </Badge>
        </div>
      </div>

      {/* Drop Zone Indicator - Always present to improve detection */}
      <div className={`
        absolute inset-0 rounded-lg transition-all duration-200 pointer-events-none
        ${isOver 
          ? 'bg-green-100/80 border-2 border-dashed border-green-400' 
          : 'bg-transparent'
        }
      `}>
        {isOver && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Package className="h-6 w-6 mx-auto mb-1 text-green-600" />
              <p className="text-xs font-medium text-green-700">
                Soltar activo aquí
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Assets in this plant */}
      <div className="p-2">
        <div className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div className="space-y-1 pr-2">
            <SortableContext 
              items={plantAssets.map(a => a.id)} 
              strategy={verticalListSortingStrategy}
            >
              {plantAssets.map((asset) => (
                <AssetDraggableItem
                  key={asset.id}
                  asset={asset}
                />
              ))}
            </SortableContext>
            
            {plantAssets.length === 0 && !isOver && (
              <div className="text-center py-4 text-gray-400">
                <Package className="h-6 w-6 mx-auto mb-1 opacity-50" />
                <p className="text-[10px] font-medium">Sin activos asignados</p>
                <p className="text-[8px]">Arrastra activos aquí para asignarlos</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Business Unit Container Component
function BusinessUnitContainer({ 
  businessUnit, 
  plants, 
  assets, 
  onDrop,
  draggedAsset
}: {
  businessUnit: BusinessUnit
  plants: Plant[]
  assets: Asset[]
  onDrop: (assetId: string, plantId: string) => void
  draggedAsset: Asset | null
}) {
  
  const businessUnitPlants = plants.filter(plant => plant.business_unit_id === businessUnit.id)
  const businessUnitAssets = assets.filter(asset => {
    const assetPlant = businessUnitPlants.find(p => p.id === asset.plant_id)
    return assetPlant !== undefined
  })

  return (
    <div className="border border-blue-200 rounded-lg bg-white">
      {/* Header */}
      <div className="bg-blue-50 p-3 border-b border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded">
              <Building2 className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-blue-900">
                {businessUnit.name}
              </h3>
              <p className="text-xs text-blue-700">
                {businessUnitPlants.length} plantas • {businessUnitAssets.length} activos
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
            {businessUnit.code}
          </Badge>
        </div>
      </div>

      {/* Plants grid */}
      <div className="p-3">
        {businessUnitPlants.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {businessUnitPlants.map((plant) => (
              <PlantContainer 
                key={plant.id}
                plant={plant}
                assets={assets}
                onDrop={onDrop}
                draggedAsset={draggedAsset}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <Factory className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No hay plantas configuradas</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Unassigned Assets Container
function UnassignedAssetsContainer({ 
  assets, 
  searchTerm 
}: { 
  assets: Asset[]
  searchTerm: string
}) {
  const filteredAssets = assets.filter(asset =>
    !asset.plant_id && (
      searchTerm === '' || 
      asset.asset_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.equipment_models?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  return (
    <div className="border-2 border-orange-200 rounded-lg bg-white">
      {/* Header */}
      <div className="bg-orange-50 p-3 border-b border-orange-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-orange-100 rounded">
            <AlertCircle className="h-4 w-4 text-orange-700" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-orange-900">
              Activos Sin Asignar
            </h3>
            <p className="text-xs text-orange-700">
              {filteredAssets.length} activos disponibles para asignación
            </p>
          </div>
        </div>
      </div>

      {/* Assets list */}
      <div className="p-2">
        <div className="h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-orange-300 scrollbar-track-orange-100">
          <div className="space-y-1 pr-2">
            <SortableContext 
              items={filteredAssets.map(a => a.id)} 
              strategy={verticalListSortingStrategy}
            >
              {filteredAssets.map((asset) => (
                <AssetDraggableItem
                  key={asset.id}
                  asset={asset}
                />
              ))}
            </SortableContext>
            
            {filteredAssets.length === 0 && (
              <div className="text-center py-6 text-gray-400">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium mb-1">
                  {searchTerm ? 'No se encontraron activos' : 'Todos los activos están asignados'}
                </p>
                <p className="text-[10px]">
                  {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Excelente organización'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Main Component
export function AssetPlantAssignmentDragDrop() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
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

  const fetchData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        fetchAssets(),
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

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/assets')
      if (response.ok) {
        const data = await response.json()
        setAssets(data)
      }
    } catch (error) {
      console.error('Error fetching assets:', error)
    }
  }

  const fetchPlants = async () => {
    try {
      const response = await fetch('/api/plants')
      if (response.ok) {
        const data = await response.json()
        setPlants(data.plants || [])
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
        setBusinessUnits(data.business_units || [])
      }
    } catch (error) {
      console.error('Error fetching business units:', error)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const assetId = active.id as string
    const dropZoneId = over.id as string

    // Extract plant ID from drop zone ID
    let plantId: string | null = null
    if (dropZoneId.startsWith('plant-')) {
      plantId = dropZoneId.replace('plant-', '')
    }

    await handleAssetPlantAssignment(assetId, plantId)
  }

  const handleAssetPlantAssignment = async (assetId: string, plantId: string | null) => {
    try {
      const response = await fetch(`/api/assets/${assetId}/plant-assignment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant_id: plantId,
          notes: 'Asignación actualizada mediante drag & drop'
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        toast({
          title: "Error",
          description: data.error || 'Error al actualizar asignación',
          variant: "destructive"
        })
        return
      }

      toast({
        title: "Éxito",
        description: plantId 
          ? `Activo asignado correctamente a la planta`
          : `Activo removido de la asignación`,
      })

      // Refresh assets to show updated assignments
      await fetchAssets()
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al procesar la asignación",
        variant: "destructive"
      })
      console.error('Error updating asset assignment:', error)
    }
  }

  const filteredBusinessUnits = businessUnits.filter(bu => 
    selectedBusinessUnit === 'all' || bu.id === selectedBusinessUnit
  )

  const activeAsset = assets.find(asset => asset.id === activeId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Compact Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Input
                placeholder="Buscar activos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Select value={selectedBusinessUnit} onValueChange={setSelectedBusinessUnit}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Filtrar por unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las unidades</SelectItem>
                  {businessUnits.map((bu) => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="text-xs h-6 px-2">
                <Package className="h-3 w-3 mr-1" />
                {assets.length} Total
              </Badge>
              <Badge variant="outline" className="text-xs h-6 px-2">
                <AlertCircle className="h-3 w-3 mr-1" />
                {assets.filter(a => !a.plant_id).length} Sin Asignar
              </Badge>
            </div>
            <div className="flex justify-end">
              <Button onClick={fetchData} variant="outline" size="sm" className="h-8">
                <RefreshCw className="h-3 w-3 mr-1" />
                Actualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Unassigned Assets - Left Panel */}
          <div className="lg:col-span-1">
            <UnassignedAssetsContainer 
              assets={assets}
              searchTerm={searchTerm}
            />
          </div>

          {/* Business Units and Plants - Main Area */}
          <div className="lg:col-span-3 space-y-4">
            {filteredBusinessUnits.map((businessUnit) => (
              <BusinessUnitContainer
                key={businessUnit.id}
                businessUnit={businessUnit}
                plants={plants}
                assets={assets}
                onDrop={handleAssetPlantAssignment}
                draggedAsset={activeAsset || null}
              />
            ))}
            
            {filteredBusinessUnits.length === 0 && (
              <div className="border border-gray-200 rounded-lg p-6 text-center bg-white">
                <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  No hay unidades de negocio configuradas
                </h3>
                <p className="text-xs text-gray-600">
                  Configura unidades de negocio y plantas antes de asignar activos
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeAsset ? (
            <div className="bg-white border-2 border-blue-400 rounded-lg shadow-lg">
              <AssetDraggableItem asset={activeAsset} />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
} 