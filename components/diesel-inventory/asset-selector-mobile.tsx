"use client"

import { useState, useEffect, useMemo } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Search, Truck, Loader2, X, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

interface Asset {
  id: string
  asset_id: string
  name: string
  model_id: string
  current_hours: number | null
  current_kilometers: number | null
  plant_id: string
  equipment_models: {
    name: string
    manufacturer: string
    maintenance_unit: string
  } | null
  plants: {
    name: string
    code: string
  } | null
}

interface AssetSelectorMobileProps {
  onSelect: (asset: Asset) => void
  selectedAssetId?: string | null
  plantFilter?: string | null // Optional plant filter
  businessUnitFilter?: boolean // Auto-filter by user's business unit
}

export function AssetSelectorMobile({
  onSelect,
  selectedAssetId,
  plantFilter,
  businessUnitFilter = true
}: AssetSelectorMobileProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [recentAssets, setRecentAssets] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Load recent assets from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const recent = localStorage.getItem('diesel-recent-assets')
      if (recent) {
        try {
          setRecentAssets(JSON.parse(recent))
        } catch (error) {
          console.error('Error loading recent assets:', error)
        }
      }
    }
  }, [])

  // Load assets with business unit filtering
  useEffect(() => {
    loadAssets()
  }, [plantFilter])

  const loadAssets = async () => {
    try {
      setLoading(true)

      // Get current user's context
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("No hay sesión de usuario")
        return
      }

      // Get user profile to determine filtering
      const { data: profile } = await supabase
        .from('profiles')
        .select('plant_id, business_unit_id, role')
        .eq('id', user.id)
        .single()

      if (!profile) {
        toast.error("No se encontró el perfil del usuario")
        return
      }

      // Build query with hierarchical filtering
      let query = supabase
        .from('assets')
        .select(`
          id,
          asset_id,
          name,
          model_id,
          current_hours,
          current_kilometers,
          plant_id,
          equipment_models (
            name,
            manufacturer,
            maintenance_unit
          ),
          plants (
            name,
            code
          )
        `)
        .eq('status', 'operational')
        .order('name')

      // Apply business unit filtering if enabled
      if (businessUnitFilter) {
        if (profile.plant_id && !profile.business_unit_id) {
          // Plant-level user: only their plant
          query = query.eq('plant_id', profile.plant_id)
        } else if (profile.business_unit_id && !profile.plant_id) {
          // Business unit user: all plants in their BU
          const { data: plants } = await supabase
            .from('plants')
            .select('id')
            .eq('business_unit_id', profile.business_unit_id)
          
          if (plants && plants.length > 0) {
            const plantIds = plants.map(p => p.id)
            query = query.in('plant_id', plantIds)
          }
        }
        // Global users (no plant_id, no business_unit_id) see all assets
      }

      // Apply explicit plant filter if provided
      if (plantFilter) {
        query = query.eq('plant_id', plantFilter)
      }

      const { data, error } = await query

      if (error) throw error

      setAssets(data || [])

      // Load selected asset if provided
      if (selectedAssetId) {
        const selected = (data || []).find(a => a.id === selectedAssetId)
        if (selected) {
          setSelectedAsset(selected)
        }
      }
    } catch (error) {
      console.error('Error loading assets:', error)
      toast.error("Error al cargar los activos")
    } finally {
      setLoading(false)
    }
  }

  // Filter assets based on search term
  const filteredAssets = useMemo(() => {
    if (!searchTerm.trim()) {
      // Show recent assets first when no search
      const recent = assets.filter(a => recentAssets.includes(a.id))
      const others = assets.filter(a => !recentAssets.includes(a.id))
      return [...recent, ...others]
    }

    const term = searchTerm.toLowerCase()
    return assets.filter(asset => 
      asset.asset_id.toLowerCase().includes(term) ||
      asset.name.toLowerCase().includes(term) ||
      asset.equipment_models?.name.toLowerCase().includes(term) ||
      asset.equipment_models?.manufacturer.toLowerCase().includes(term) ||
      asset.plants?.name.toLowerCase().includes(term)
    )
  }, [assets, searchTerm, recentAssets])

  const handleSelect = (asset: Asset) => {
    setSelectedAsset(asset)
    onSelect(asset)
    
    // Save to recent assets
    if (typeof window !== 'undefined') {
      const recent = [asset.id, ...recentAssets.filter(id => id !== asset.id)].slice(0, 5)
      setRecentAssets(recent)
      localStorage.setItem('diesel-recent-assets', JSON.stringify(recent))
    }
  }

  const handleClear = () => {
    setSelectedAsset(null)
    setSearchTerm("")
    onSelect(null as any)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando activos...</span>
      </div>
    )
  }

  // Selected asset display (compact)
  if (selectedAsset) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-sm">{selectedAsset.name}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>ID: {selectedAsset.asset_id}</div>
                {selectedAsset.equipment_models && (
                  <div>{selectedAsset.equipment_models.manufacturer} {selectedAsset.equipment_models.name}</div>
                )}
                {selectedAsset.plants && (
                  <div>📍 {selectedAsset.plants.name}</div>
                )}
                {(selectedAsset.current_hours !== null || selectedAsset.current_kilometers !== null) && (
                  <div className="flex gap-3 mt-2">
                    {selectedAsset.current_hours !== null && (
                      <Badge variant="outline" className="text-xs">
                        ⏱️ {selectedAsset.current_hours.toLocaleString()}h
                      </Badge>
                    )}
                    {selectedAsset.current_kilometers !== null && (
                      <Badge variant="outline" className="text-xs">
                        📏 {selectedAsset.current_kilometers.toLocaleString()}km
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Asset selection view
  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar por ID, nombre, modelo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12 text-base"
          autoFocus
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Recent assets hint */}
      {!searchTerm && recentAssets.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Clock className="h-3 w-3" />
          <span>Activos recientes primero</span>
        </div>
      )}

      {/* Assets list */}
      <ScrollArea className="h-[400px] w-full rounded-md border">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground mb-1">
              No se encontraron activos
            </p>
            <p className="text-xs text-muted-foreground">
              {searchTerm 
                ? "Intenta con otro término de búsqueda" 
                : "No hay activos disponibles en tu planta"}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {filteredAssets.map((asset, index) => {
              const isRecent = recentAssets.includes(asset.id)
              
              return (
                <Card
                  key={asset.id}
                  className={`cursor-pointer transition-all hover:shadow-md hover:border-blue-300 ${
                    isRecent ? 'border-blue-200 bg-blue-50/30' : ''
                  }`}
                  onClick={() => handleSelect(asset)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Asset name and recent badge */}
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span className="font-semibold text-sm truncate">{asset.name}</span>
                          {isRecent && (
                            <Badge variant="secondary" className="text-xs ml-auto flex-shrink-0">
                              Reciente
                            </Badge>
                          )}
                        </div>

                        {/* Asset details */}
                        <div className="text-xs text-muted-foreground space-y-1 ml-6">
                          <div className="font-mono">ID: {asset.asset_id}</div>
                          
                          {asset.equipment_models && (
                            <div>
                              {asset.equipment_models.manufacturer} {asset.equipment_models.name}
                            </div>
                          )}
                          
                          {asset.plants && (
                            <div className="flex items-center gap-1">
                              <span>📍</span>
                              <span>{asset.plants.name}</span>
                            </div>
                          )}

                          {/* Current readings */}
                          {(asset.current_hours !== null || asset.current_kilometers !== null) && (
                            <div className="flex gap-2 mt-1.5">
                              {asset.current_hours !== null && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0">
                                  ⏱️ {asset.current_hours.toLocaleString()}h
                                </Badge>
                              )}
                              {asset.current_kilometers !== null && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0">
                                  📏 {asset.current_kilometers.toLocaleString()}km
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Results count */}
      {filteredAssets.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          {filteredAssets.length} activo{filteredAssets.length !== 1 ? 's' : ''} encontrado{filteredAssets.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

