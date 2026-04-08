'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { 
  Building2, 
  Package, 
  RefreshCw,
  Factory,
  MapPin,
  AlertCircle,
  GripVertical,
  Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { getAssetStatusConfig } from '@/lib/utils/asset-status'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { MoveConflictDialog, ConflictData, ResolutionStrategy } from '@/components/personnel/dialogs/move-conflict-dialog'
import { QuickOperatorAssignmentDialog } from './quick-operator-assignment-dialog'
import { dragItemVariants, dropZoneVariants, springTransition, dragOverlayVariants } from '@/lib/utils/framer-drag-animations'

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  assetDragId,
  parseAssetDragId,
  plantDroppableId,
  parsePlantDroppableId,
  preferZoneDroppableCollision,
} from '@/lib/dnd/assignment-drop-targets'
import { motion, AnimatePresence } from 'framer-motion'
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
  /** When true, row is the composite parent; components are not listed separately. */
  is_composite?: boolean | null
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
  onRequestMove,
  /** Single-line row: fits more assets per plant without tiny scroll viewport. */
  density = 'default',
}: { 
  asset: Asset
  onRequestMove?: (asset: Asset) => void
  density?: 'default' | 'compact'
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: assetDragId(asset.id) })

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

  if (density === 'compact') {
    return (
      <motion.div
        variants={dragItemVariants}
        initial="idle"
        animate={isDragging ? "dragging" : "idle"}
        whileHover="hover"
        layout
        transition={springTransition}
      >
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          className="bg-white border border-gray-200 rounded px-1 py-0.5 hover:shadow-sm transition-all duration-200 hover:border-blue-300"
        >
          <div
            {...listeners}
            className="cursor-grab touch-none active:cursor-grabbing flex items-center gap-0.5 min-h-[26px]"
          >
            <GripVertical className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
            <span className="font-semibold text-[11px] text-gray-900 tabular-nums shrink-0 max-w-[5.5rem] truncate">
              {asset.asset_id}
            </span>
            <span className="text-[10px] text-gray-600 truncate min-w-0 flex-1" title={asset.name}>
              {asset.name}
            </span>
            {asset.is_composite && (
              <span
                className="inline-flex items-center gap-0 rounded border border-violet-200 bg-violet-50 px-0.5 shrink-0"
                title="Activo compuesto (incluye componentes)"
              >
                <Layers className="h-2.5 w-2.5 text-violet-600" aria-hidden />
              </span>
            )}
            <Badge
              variant={getAssetStatusConfig(asset.status).variant}
              className="text-[7px] h-4 px-1 py-0 leading-none shrink-0 max-w-[4.5rem] truncate"
              title={getAssetStatusConfig(asset.status).label}
            >
              {getAssetStatusConfig(asset.status).label}
            </Badge>
          </div>
          {onRequestMove && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-0.5 h-6 text-[9px] md:hidden py-0"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onRequestMove(asset)
              }}
            >
              Mover…
            </Button>
          )}
        </div>
      </motion.div>
    )
  }

  // Default: unassigned panel & drag overlay — a bit more detail
  return (
    <motion.div
      variants={dragItemVariants}
      initial="idle"
      animate={isDragging ? "dragging" : "idle"}
      whileHover="hover"
      layout
      transition={springTransition}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className="bg-white border border-gray-200 rounded p-1.5 hover:shadow-sm transition-all duration-200 hover:border-blue-300"
      >
        <div
          {...listeners}
          className="cursor-grab touch-none active:cursor-grabbing"
        >
          <div className="flex items-start gap-1">
            <span className="mt-0.5 text-gray-400 shrink-0" aria-hidden>
              <GripVertical className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1 min-w-0">
                  <div className="p-0.5 bg-blue-50 rounded shrink-0">
                    {asset.is_composite ? (
                      <Layers className="h-2 w-2 text-violet-600" aria-hidden />
                    ) : (
                      <Package className="h-2 w-2 text-blue-600" />
                    )}
                  </div>
                  <span className="font-bold text-sm text-gray-900 truncate">
                    {asset.asset_id}
                  </span>
                </div>
                <Badge variant={getAssetStatusConfig(asset.status).variant} className="text-[8px] h-2.5 px-1 shrink-0">
                  {getAssetStatusConfig(asset.status).label}
                </Badge>
              </div>
              <p className="text-[10px] text-gray-600 leading-tight truncate">
                {asset.name}
              </p>
              <div className="flex items-center justify-between mt-1">
                {asset.location && (
                  <p className="text-[8px] text-gray-500 flex items-center gap-0.5 truncate">
                    <MapPin className="h-1.5 w-1.5 shrink-0" />
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
          </div>
        </div>
        {onRequestMove && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full mt-1.5 h-7 text-[10px] md:hidden"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onRequestMove(asset)
            }}
          >
            Mover a planta…
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// Plant Container Component
function PlantContainer({ 
  plant, 
  assets, 
  onRequestMove,
}: {
  plant: Plant
  assets: Asset[]
  onRequestMove?: (asset: Asset) => void
}) {
  
  const { setNodeRef, isOver } = useDroppable({
    id: plantDroppableId(plant.id),
  })
  
  const plantAssets = assets.filter(asset => asset.plant_id === plant.id)

  return (
    <motion.div
      variants={dropZoneVariants}
      animate={isOver ? "dragOver" : "idle"}
      transition={{ duration: 0.1 }}
    >
      <div 
        ref={setNodeRef} 
        className={`
          relative border-2 rounded-lg transition-all duration-200 min-h-[100px]
          ${isOver 
            ? 'border-green-400 bg-green-50 shadow-lg' 
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }
        `}
      >
      {/* Header — slim so list area gets vertical space */}
      <div className="py-2 px-2 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-1.5">
          <div className="p-1 bg-green-100 rounded shrink-0">
            <Factory className="h-3.5 w-3.5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-xs text-gray-900 truncate leading-tight">
              {plant.name}
            </h4>
            <p className="text-[10px] text-gray-600 leading-tight">
              {plantAssets.length} activo{plantAssets.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
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

      {/* Assets — viewport-tall scroll + compact rows = many visible per plant */}
      <div className="p-1.5">
        <div className="max-h-[min(72vh,720px)] min-h-[120px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 overscroll-contain">
          <div className="space-y-0.5 pr-1">
            <SortableContext 
              items={plantAssets.map(a => assetDragId(a.id))} 
              strategy={verticalListSortingStrategy}
            >
              <AnimatePresence mode="popLayout">
                {plantAssets.map((asset) => (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <AssetDraggableItem
                      asset={asset}
                      onRequestMove={onRequestMove}
                      density="compact"
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </SortableContext>
            
            {plantAssets.length === 0 && !isOver && (
              <div className="text-center py-6 text-gray-400">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 mb-2">
                  <Package className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-xs font-medium text-gray-600 mb-1">Sin activos asignados</p>
                <p className="text-[10px] text-gray-500">Arrastra activos desde el panel izquierdo para asignarlos a esta planta</p>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </motion.div>
  )
}

// Business Unit Container Component
function BusinessUnitContainer({ 
  businessUnit, 
  plantsInUnit, 
  configuredPlantCount,
  assets, 
  onRequestMove,
}: {
  businessUnit: BusinessUnit
  plantsInUnit: Plant[]
  /** Total plants in DB for this BU (before visibility filter). */
  configuredPlantCount: number
  assets: Asset[]
  onRequestMove?: (asset: Asset) => void
}) {
  
  const businessUnitPlants = plantsInUnit
  const businessUnitAssets = assets.filter(asset => {
    const assetPlant = businessUnitPlants.find(p => p.id === asset.plant_id)
    return assetPlant !== undefined
  })

  return (
    <motion.div
      variants={dropZoneVariants}
      initial="idle"
      animate="idle"
      whileHover="hover"
      transition={{ duration: 0.2 }}
      className="border border-blue-200 rounded-lg bg-white"
    >
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

      {/* Plants grid — fewer, wider columns so each plant list is readable */}
      <div className="p-2 md:p-3">
        {businessUnitPlants.length > 0 ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {businessUnitPlants.map((plant) => (
                <motion.div
                  key={plant.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <PlantContainer 
                    plant={plant}
                    assets={assets}
                    onRequestMove={onRequestMove}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : configuredPlantCount === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Factory className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No hay plantas configuradas</p>
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-amber-800 bg-amber-50 rounded-lg border border-amber-100 px-3">
            <p className="font-medium">Plantas ocultas (sin activos asignados)</p>
            <p className="text-xs mt-1 text-amber-900/80">
              Activa &quot;Mostrar plantas sin activos&quot; arriba o usa &quot;Mover a planta…&quot; en el activo para elegir destino.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Unassigned Assets Container
function UnassignedAssetsContainer({ 
  assets, 
  searchTerm,
  onRequestMove,
}: { 
  assets: Asset[]
  searchTerm: string
  onRequestMove?: (asset: Asset) => void
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
    <motion.div
      variants={dropZoneVariants}
      initial="idle"
      animate="idle"
      whileHover="hover"
      transition={{ duration: 0.2 }}
      className="border-2 border-orange-200 rounded-lg bg-white"
    >
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
              items={filteredAssets.map(a => assetDragId(a.id))} 
              strategy={verticalListSortingStrategy}
            >
              <AnimatePresence mode="popLayout">
                {filteredAssets.map((asset) => (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <AssetDraggableItem
                      asset={asset}
                      onRequestMove={onRequestMove}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </SortableContext>
            
            {filteredAssets.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                  <Package className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-600 mb-1">
                  {searchTerm ? 'No se encontraron activos' : 'Todos los activos están asignados'}
                </h3>
                <p className="text-xs text-gray-500">
                  {searchTerm 
                    ? 'Intenta con otros términos de búsqueda o verifica los filtros aplicados'
                    : 'Excelente organización. Todos los activos tienen ubicación asignada.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
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
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [conflictData, setConflictData] = useState<ConflictData | null>(null)
  const [pendingAssignment, setPendingAssignment] = useState<{ assetId: string; plantId: string | null } | null>(null)
  const [quickAssignDialogOpen, setQuickAssignDialogOpen] = useState(false)
  const [recentlyAssignedAsset, setRecentlyAssignedAsset] = useState<{ id: string; name: string; asset_id: string; plantId: string } | null>(null)
  const [showEmptyPlantsWithNoAssets, setShowEmptyPlantsWithNoAssets] = useState(false)
  const [assetForMovePicker, setAssetForMovePicker] = useState<Asset | null>(null)
  const [movePickerPlantId, setMovePickerPlantId] = useState<string>('')
  const lastPlantContainerRef = useRef<string | null>(null)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
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
      const response = await fetch('/api/assets?exclude_components=true')
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
    lastPlantContainerRef.current = null
  }

  const handleDragOver = (event: DragOverEvent) => {
    const id = event.over?.id
    if (id && parsePlantDroppableId(String(id))) {
      lastPlantContainerRef.current = String(id)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    const assetId = parseAssetDragId(active.id)
    if (!assetId) {
      lastPlantContainerRef.current = null
      return
    }

    const overStr = over ? String(over.id) : ''
    let plantId: string | null = parsePlantDroppableId(overStr)
    if (!plantId && lastPlantContainerRef.current) {
      plantId = parsePlantDroppableId(lastPlantContainerRef.current)
    }
    lastPlantContainerRef.current = null

    if (plantId === null) {
      return
    }

    const asset = assets.find((a) => a.id === assetId)
    if (asset?.plant_id === plantId) {
      return
    }

    await handleAssetPlantAssignment(assetId, plantId)
  }

  const openMovePicker = useCallback((asset: Asset) => {
    setAssetForMovePicker(asset)
    setMovePickerPlantId(asset.plant_id || plants[0]?.id || '')
  }, [plants])

  const handleAssetPlantAssignment = async (
    assetId: string, 
    plantId: string | null, 
    resolveConflicts?: ResolutionStrategy
  ) => {
    try {
      const asset = assets.find(a => a.id === assetId)
      if (!asset) return

      const response = await fetch(`/api/assets/${assetId}/plant-assignment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant_id: plantId,
          notes: 'Asignación actualizada mediante drag & drop',
          resolve_conflicts: resolveConflicts
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        // Check if this is a conflict response
        if (response.status === 409 && data.conflicts) {
          if (
            !resolveConflicts &&
            plantId &&
            data.canTransfer &&
            !data.requiresUnassign
          ) {
            await handleAssetPlantAssignment(assetId, plantId, 'transfer_operators')
            return
          }
          // Get plant names for display
          const currentPlant = asset.plants
          const newPlant = plantId ? plants.find(p => p.id === plantId) : null

          const conflictData: ConflictData = {
            type: 'asset_move',
            assetId: asset.id,
            assetName: asset.name,
            assetCode: asset.asset_id,
            currentPlantId: asset.plant_id || null,
            currentPlantName: currentPlant?.name || null,
            newPlantId: plantId,
            newPlantName: newPlant?.name || null,
            affected_operators: data.affected_operators || [],
            canTransfer: data.canTransfer || false,
            requiresUnassign: data.requiresUnassign || false
          }

          setConflictData(conflictData)
          setPendingAssignment({ assetId, plantId })
          setConflictDialogOpen(true)
          return
        }

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

      // Show quick assignment dialog if asset was assigned to a plant
      // BUT skip if operators were already transferred (resolve_conflicts === 'transfer_operators')
      if (plantId && asset && resolveConflicts !== 'transfer_operators') {
        setRecentlyAssignedAsset({
          id: asset.id,
          name: asset.name,
          asset_id: asset.asset_id,
          plantId: plantId
        })
        setQuickAssignDialogOpen(true)
      }
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al procesar la asignación",
        variant: "destructive"
      })
      console.error('Error updating asset assignment:', error)
    }
  }

  const handleConflictResolve = async (strategy: ResolutionStrategy) => {
    if (!pendingAssignment) return

    if (strategy === 'cancel') {
      setPendingAssignment(null)
      setConflictData(null)
      return
    }

    await handleAssetPlantAssignment(
      pendingAssignment.assetId,
      pendingAssignment.plantId,
      strategy
    )

    setPendingAssignment(null)
    setConflictData(null)
  }

  const handleConflictCancel = () => {
    setPendingAssignment(null)
    setConflictData(null)
  }

  const handleQuickAssign = async (operatorId: string, assignmentType: 'primary' | 'secondary') => {
    if (!recentlyAssignedAsset) return

    try {
      // First, try regular assignment
      let response = await fetch('/api/asset-operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: recentlyAssignedAsset.id,
          operator_id: operatorId,
          assignment_type: assignmentType,
          start_date: new Date().toISOString().split('T')[0]
        })
      })

      // Handle conflicts: 409 = primary operator exists, 400 = operator already assigned
      if (response.status === 409 || response.status === 400) {
        const errorData = await response.json()
        const errorMessage = errorData.error || ''
        
        // Check if this is a "primary operator exists" error (409)
        if (response.status === 409 && errorMessage.includes('primary operator')) {
          // Use transfer API with force_transfer to replace the existing primary operator
          response = await fetch('/api/asset-operators/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operator_id: operatorId,
              to_asset_id: recentlyAssignedAsset.id,
              assignment_type: assignmentType,
              transfer_reason: 'Replacement via quick assignment dialog',
              force_transfer: true
            })
          })
        } 
        // Check if operator is already assigned to this asset (400)
        else if (response.status === 400 && errorMessage.includes('already assigned')) {
          // If operator is already assigned, check if they want to change assignment type
          // For now, just show a friendly message that they're already assigned
          toast({
            title: "Información",
            description: "Este operador ya está asignado a este activo.",
          })
          await fetchAssets() // Refresh to show current state
          return // Exit early since assignment already exists
        } else {
          // For other conflicts, throw the original error
          throw new Error(errorMessage || 'Error al asignar operador')
        }
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al asignar operador')
      }

      toast({
        title: "Éxito",
        description: `Operador asignado como ${assignmentType === 'primary' ? 'principal' : 'secundario'}`,
      })

      // Refresh assets to show the assignment
      await fetchAssets()
    } catch (error) {
      console.error('Error assigning operator:', error)
      throw error
    }
  }

  const filteredBusinessUnits = businessUnits.filter(bu => 
    selectedBusinessUnit === 'all' || bu.id === selectedBusinessUnit
  )

  const visiblePlants = useMemo(() => {
    return plants.filter(
      (p) =>
        showEmptyPlantsWithNoAssets ||
        assets.some((a) => a.plant_id === p.id)
    )
  }, [plants, assets, showEmptyPlantsWithNoAssets])

  const businessUnitsToRender = useMemo(() => {
    return filteredBusinessUnits.filter((bu) =>
      plants.some((p) => p.business_unit_id === bu.id)
    )
  }, [filteredBusinessUnits, plants])

  const activeAsset = useMemo(() => {
    const raw = parseAssetDragId(activeId)
    return raw ? assets.find((a) => a.id === raw) ?? null : null
  }, [activeId, assets])

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
      collisionDetection={preferZoneDroppableCollision()}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
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
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-empty-plants"
                  checked={showEmptyPlantsWithNoAssets}
                  onCheckedChange={setShowEmptyPlantsWithNoAssets}
                />
                <Label htmlFor="show-empty-plants" className="text-xs cursor-pointer whitespace-nowrap">
                  Mostrar plantas sin activos
                </Label>
              </div>
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
              onRequestMove={openMovePicker}
            />
          </div>

          {/* Business Units and Plants - Main Area */}
          <div className="lg:col-span-3 space-y-4">
            {businessUnitsToRender.map((businessUnit) => (
              <BusinessUnitContainer
                key={businessUnit.id}
                businessUnit={businessUnit}
                plantsInUnit={visiblePlants.filter((p) => p.business_unit_id === businessUnit.id)}
                configuredPlantCount={
                  plants.filter((p) => p.business_unit_id === businessUnit.id).length
                }
                assets={assets}
                onRequestMove={openMovePicker}
              />
            ))}
            
            {businessUnitsToRender.length === 0 && (
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
          {activeAsset && (
            <motion.div
              variants={dragOverlayVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="bg-white border-2 border-blue-400 rounded-lg shadow-lg">
                <AssetDraggableItem asset={activeAsset} />
              </div>
            </motion.div>
          )}
        </DragOverlay>

        {/* Conflict Resolution Dialog */}
        <MoveConflictDialog
          open={conflictDialogOpen}
          onOpenChange={setConflictDialogOpen}
          conflictData={conflictData}
          onResolve={handleConflictResolve}
          onCancel={handleConflictCancel}
        />

        {/* Quick Operator Assignment Dialog */}
        {recentlyAssignedAsset && (
          <QuickOperatorAssignmentDialog
            open={quickAssignDialogOpen}
            onOpenChange={(open) => {
              setQuickAssignDialogOpen(open)
              if (!open) {
                setRecentlyAssignedAsset(null)
              }
            }}
            assetId={recentlyAssignedAsset.id}
            assetName={recentlyAssignedAsset.name}
            assetCode={recentlyAssignedAsset.asset_id}
            plantId={recentlyAssignedAsset.plantId}
            onAssign={handleQuickAssign}
          />
        )}

        <Dialog
          open={assetForMovePicker !== null}
          onOpenChange={(open) => {
            if (!open) {
              setAssetForMovePicker(null)
              setMovePickerPlantId('')
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Mover activo a planta</DialogTitle>
              <DialogDescription>
                {assetForMovePicker
                  ? `${assetForMovePicker.asset_id} — ${assetForMovePicker.name}`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="move-plant-select">Planta destino</Label>
              <Select
                value={movePickerPlantId}
                onValueChange={setMovePickerPlantId}
              >
                <SelectTrigger id="move-plant-select">
                  <SelectValue placeholder="Selecciona planta" />
                </SelectTrigger>
                <SelectContent>
                  {plants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAssetForMovePicker(null)
                  setMovePickerPlantId('')
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!assetForMovePicker || !movePickerPlantId) return
                  await handleAssetPlantAssignment(assetForMovePicker.id, movePickerPlantId)
                  setAssetForMovePicker(null)
                  setMovePickerPlantId('')
                }}
                disabled={!movePickerPlantId}
              >
                Mover
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DndContext>
  )
} 