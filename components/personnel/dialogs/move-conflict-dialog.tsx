'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { 
  AlertTriangle, 
  ArrowRight, 
  Users, 
  Package, 
  Building2, 
  MapPin,
  X,
  CheckCircle2
} from 'lucide-react'
import { OperatorConflict, AssetConflict } from '@/lib/utils/conflict-detection'

export type ConflictType = 'asset_move' | 'operator_move'

export type ResolutionStrategy = 
  | 'keep' 
  | 'transfer_operators' 
  | 'transfer_assets' 
  | 'unassign' 
  | 'cancel'

export interface AssetMoveConflictData {
  type: 'asset_move'
  assetId: string
  assetName: string
  assetCode: string
  currentPlantId: string | null
  currentPlantName: string | null
  newPlantId: string | null
  newPlantName: string | null
  affected_operators: OperatorConflict[]
  canTransfer: boolean
  requiresUnassign: boolean
}

export interface OperatorMoveConflictData {
  type: 'operator_move'
  operatorId: string
  operatorName: string
  employeeCode?: string
  currentPlantId: string | null
  currentPlantName: string | null
  newPlantId: string | null
  newPlantName: string | null
  affected_assets: AssetConflict[]
  assets_in_new_plant: AssetConflict[]
  assets_in_other_plants: AssetConflict[]
}

export type ConflictData = AssetMoveConflictData | OperatorMoveConflictData

interface MoveConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflictData: ConflictData | null
  onResolve: (strategy: ResolutionStrategy) => void
  onCancel: () => void
}

export function MoveConflictDialog({
  open,
  onOpenChange,
  conflictData,
  onResolve,
  onCancel
}: MoveConflictDialogProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<ResolutionStrategy | null>(null)

  if (!conflictData) return null

  const isAssetMove = conflictData.type === 'asset_move'
  const isOperatorMove = conflictData.type === 'operator_move'

  // Determine available resolution options based on conflict type
  const getAvailableStrategies = (): ResolutionStrategy[] => {
    if (isAssetMove) {
      const strategies: ResolutionStrategy[] = ['cancel']
      if (conflictData.canTransfer) {
        strategies.push('transfer_operators')
      }
      strategies.push('keep', 'unassign')
      return strategies
    } else {
      // Operator move - NO 'keep' option as per user requirement
      const strategies: ResolutionStrategy[] = ['cancel']
      if (conflictData.assets_in_other_plants.length > 0) {
        strategies.push('transfer_assets')
      }
      strategies.push('unassign')
      return strategies
    }
  }

  const availableStrategies = getAvailableStrategies()

  const handleResolve = () => {
    if (selectedStrategy) {
      onResolve(selectedStrategy)
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  const getStrategyDescription = (strategy: ResolutionStrategy): string => {
    switch (strategy) {
      case 'keep':
        return 'Mantener las asignaciones actuales. Los operadores pueden perder acceso debido a políticas RLS.'
      case 'transfer_operators':
        return 'Transferir automáticamente los operadores a la nueva planta si es posible.'
      case 'transfer_assets':
        return 'Mover los activos asignados a la nueva planta junto con el operador.'
      case 'unassign':
        return 'Desasignar completamente. Limpia todas las relaciones actuales.'
      case 'cancel':
        return 'Cancelar el movimiento. No se realizarán cambios.'
      default:
        return ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Conflicto Detectado en Movimiento
          </DialogTitle>
          <DialogDescription>
            {isAssetMove 
              ? 'Este activo tiene operadores asignados que pueden verse afectados por el movimiento.'
              : 'Este operador tiene activos asignados que pueden verse afectados por el movimiento.'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Current vs Proposed Assignment */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-4">
                  {/* Current */}
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-2">Ubicación Actual</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <p className="font-medium">
                        {isAssetMove 
                          ? conflictData.currentPlantName || 'Sin asignar'
                          : conflictData.currentPlantName || 'Sin asignar'
                        }
                      </p>
                    </div>
                  </div>

                  <ArrowRight className="h-5 w-5 text-gray-400" />

                  {/* Proposed */}
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-2">Nueva Ubicación</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <p className="font-medium text-blue-600">
                        {isAssetMove 
                          ? conflictData.newPlantName || 'Sin asignar'
                          : conflictData.newPlantName || 'Sin asignar'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Affected Entities */}
            <Card>
              <CardContent className="pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  {isAssetMove ? (
                    <>
                      <Users className="h-4 w-4" />
                      Operadores Afectados ({conflictData.affected_operators.length})
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4" />
                      Activos Afectados ({conflictData.affected_assets.length})
                    </>
                  )}
                </h4>
                <ScrollArea className="max-h-48">
                  <div className="space-y-2">
                    {isAssetMove ? (
                      conflictData.affected_operators.map((op) => (
                        <div 
                          key={op.id} 
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {op.nombre} {op.apellido}
                            </p>
                            {op.employee_code && (
                              <p className="text-xs text-gray-500">
                                Código: {op.employee_code}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              Planta actual: {op.plant_id ? 'Asignada' : 'Sin asignar'}
                            </p>
                          </div>
                          <Badge variant={op.assignment_type === 'primary' ? 'default' : 'secondary'}>
                            {op.assignment_type === 'primary' ? 'Principal' : 'Secundario'}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <>
                        {conflictData.assets_in_new_plant.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-green-700 mb-2">
                              Activos en la nueva planta ({conflictData.assets_in_new_plant.length})
                            </p>
                            {conflictData.assets_in_new_plant.map((asset) => (
                              <div 
                                key={asset.id} 
                                className="flex items-center justify-between p-2 bg-green-50 rounded mb-1"
                              >
                                <div>
                                  <p className="font-medium text-sm">{asset.asset_id}</p>
                                  <p className="text-xs text-gray-600">{asset.name}</p>
                                </div>
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </div>
                            ))}
                          </div>
                        )}
                        {conflictData.assets_in_other_plants.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-orange-700 mb-2">
                              Activos en otras plantas ({conflictData.assets_in_other_plants.length})
                            </p>
                            {conflictData.assets_in_other_plants.map((asset) => (
                              <div 
                                key={asset.id} 
                                className="flex items-center justify-between p-2 bg-orange-50 rounded mb-1"
                              >
                                <div>
                                  <p className="font-medium text-sm">{asset.asset_id}</p>
                                  <p className="text-xs text-gray-600">{asset.name}</p>
                                </div>
                                <AlertTriangle className="h-4 w-4 text-orange-600" />
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Resolution Options */}
            <Card>
              <CardContent className="pt-4">
                <h4 className="font-medium mb-3">Estrategia de Resolución</h4>
                <RadioGroup 
                  value={selectedStrategy || ''} 
                  onValueChange={(value) => setSelectedStrategy(value as ResolutionStrategy)}
                >
                  <div className="space-y-3">
                    {availableStrategies.map((strategy) => (
                      <div key={strategy} className="flex items-start space-x-3">
                        <RadioGroupItem value={strategy} id={strategy} className="mt-1" />
                        <div className="flex-1">
                          <Label 
                            htmlFor={strategy} 
                            className="font-medium cursor-pointer"
                          >
                            {strategy === 'keep' && 'Mantener asignaciones'}
                            {strategy === 'transfer_operators' && 'Transferir operadores'}
                            {strategy === 'transfer_assets' && 'Mover activos'}
                            {strategy === 'unassign' && 'Desasignar'}
                            {strategy === 'cancel' && 'Cancelar movimiento'}
                          </Label>
                          <p className="text-sm text-gray-600 mt-1">
                            {getStrategyDescription(strategy)}
                          </p>
                          {strategy === 'keep' && (
                            <Alert className="mt-2 border-orange-200 bg-orange-50">
                              <AlertTriangle className="h-4 w-4 text-orange-600" />
                              <AlertDescription className="text-xs text-orange-700">
                                Advertencia: Esto puede resultar en pérdida de acceso debido a políticas RLS.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Warning for operator moves */}
            {isOperatorMove && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-sm text-red-700">
                  <strong>Importante:</strong> Si mueves este operador sin mover o desasignar los activos, 
                  las asignaciones quedarán inválidas y requerirán pasos adicionales para corregirse.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleResolve}
            disabled={!selectedStrategy}
            className={selectedStrategy === 'cancel' ? 'bg-gray-600 hover:bg-gray-700' : ''}
          >
            {selectedStrategy === 'cancel' ? 'Cancelar Movimiento' : 'Confirmar Resolución'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

