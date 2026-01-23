'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  AlertTriangle, 
  UserX, 
  Calendar, 
  MapPin, 
  ArrowRight,
  Search,
  Filter
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ComplianceTrafficLight } from './compliance-traffic-light'
import type { ForgottenAsset } from '@/types/compliance'

export function ForgottenAssetsView() {
  const [assets, setAssets] = useState<ForgottenAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'emergency' | 'critical' | 'no_operator'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchForgottenAssets()
  }, [filter])

  const fetchForgottenAssets = async () => {
    try {
      const supabase = createClient()
      
      // Fetch tracking data with asset info
      const { data: trackingData, error: trackingError } = await supabase
        .from('asset_accountability_tracking')
        .select(`
          *,
          asset:assets!inner (
            id,
            name,
            asset_id,
            plant:plants (
              id,
              name,
              business_unit:business_units (
                id,
                name
              )
            )
          ),
          primary_responsible:profiles!primary_responsible_user_id (
            id,
            nombre,
            apellido
          )
        `)
        .in('alert_level', ['warning', 'critical', 'emergency'])
        .order('days_without_checklist', { ascending: false })

      if (trackingError) throw trackingError

      // Get asset IDs to fetch operators
      const assetIds = trackingData?.map(item => item.asset_id) || []
      
      // Fetch operators separately using the view
      let operatorMap: Record<string, { nombre: string; apellido: string } | null> = {}
      if (assetIds.length > 0) {
        const { data: operatorsData } = await supabase
          .from('asset_operators_full')
          .select('asset_id, operator_nombre, operator_apellido')
          .in('asset_id', assetIds)
          .eq('status', 'active')
          .eq('assignment_type', 'primary')
        
        if (operatorsData) {
          operatorsData.forEach(op => {
            if (op.operator_nombre && op.operator_apellido) {
              operatorMap[op.asset_id] = {
                nombre: op.operator_nombre,
                apellido: op.operator_apellido
              }
            }
          })
        }
      }

      // Transform data
      const forgottenAssets: ForgottenAsset[] = (trackingData || []).map((item: any) => {
        const operator = operatorMap[item.asset_id]
        return {
          ...item,
          asset_name: item.asset?.name || 'Sin nombre',
          asset_code: item.asset?.asset_id || 'N/A',
          plant_name: item.asset?.plant?.name || 'Sin planta',
          business_unit_name: item.asset?.plant?.business_unit?.name || 'Sin unidad',
          operator_name: operator 
            ? `${operator.nombre} ${operator.apellido}`
            : null,
          primary_responsible_name: item.primary_responsible
            ? `${item.primary_responsible.nombre} ${item.primary_responsible.apellido}`
            : null
        }
      })

      setAssets(forgottenAssets)
    } catch (error) {
      console.error('Error loading forgotten assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'emergency':
        return 'bg-red-500'
      case 'critical':
        return 'bg-orange-500'
      case 'warning':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const filteredAssets = assets.filter(asset => {
    // Apply filter
    if (filter === 'no_operator' && asset.has_operator) return false
    if (filter === 'emergency' && asset.alert_level !== 'emergency') return false
    if (filter === 'critical' && asset.alert_level !== 'critical') return false

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        asset.asset_name?.toLowerCase().includes(query) ||
        asset.asset_code?.toLowerCase().includes(query) ||
        asset.plant_name?.toLowerCase().includes(query)
      )
    }

    return true
  })

  // Calculate stats
  const stats = {
    total: filteredAssets.length,
    emergency: filteredAssets.filter(a => a.alert_level === 'emergency').length,
    critical: filteredAssets.filter(a => a.alert_level === 'critical').length,
    no_operator: filteredAssets.filter(a => !a.has_operator).length
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{stats.emergency}</div>
              <p className="text-xs text-muted-foreground">Emergencia</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{stats.critical}</div>
              <p className="text-xs text-muted-foreground">Crítico</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.no_operator}</div>
              <p className="text-xs text-muted-foreground">Sin Operador</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código o planta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Todos
          </Button>
          <Button
            variant={filter === 'emergency' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('emergency')}
            className="border-red-500"
          >
            Emergencia
          </Button>
          <Button
            variant={filter === 'critical' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('critical')}
            className="border-orange-500"
          >
            Crítico
          </Button>
          <Button
            variant={filter === 'no_operator' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('no_operator')}
            className="border-yellow-500"
          >
            Sin Operador
          </Button>
        </div>
      </div>

      {/* Assets List */}
      <div className="space-y-3">
        {filteredAssets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-lg text-muted-foreground">
                🎉 No hay activos olvidados en esta categoría
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAssets.map((asset) => (
            <Card key={asset.asset_id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`w-3 h-3 rounded-full ${getAlertColor(asset.alert_level)} ${
                          asset.alert_level === 'emergency' ? 'animate-pulse' : ''
                        }`}
                      />
                      <h3 className="font-bold text-lg truncate">{asset.asset_name}</h3>
                      <span className="text-sm text-muted-foreground">({asset.asset_code})</span>
                      <Badge
                        variant={
                          asset.alert_level === 'emergency'
                            ? 'destructive'
                            : asset.alert_level === 'critical'
                            ? 'outline'
                            : 'secondary'
                        }
                        className={
                          asset.alert_level === 'critical'
                            ? 'border-orange-500 text-orange-700'
                            : ''
                        }
                      >
                        {asset.alert_level.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">
                          {asset.plant_name} • {asset.business_unit_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {asset.has_operator ? (
                          <>
                            <UserX className="h-4 w-4 text-green-600" />
                            <span className="text-green-600">
                              Operador: {asset.operator_name || 'N/A'}
                            </span>
                          </>
                        ) : (
                          <>
                            <UserX className="h-4 w-4 text-red-600" />
                            <span className="text-red-600 font-semibold">SIN OPERADOR</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-red-600">
                          {asset.days_without_checklist === 999
                            ? 'NUNCA tuvo checklist'
                            : `${asset.days_without_checklist} días sin checklist`}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Responsable: </span>
                        <span className="font-medium">{asset.primary_responsible_name || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {!asset.has_operator && (
                      <Button size="sm" variant="destructive" asChild>
                        <Link href={`/activos/${asset.asset_id}/asignar-operador`}>
                          Asignar Operador
                        </Link>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/checklists/assets/${asset.asset_id}`}>
                        Ver Checklists
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
