'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, User, Wrench, AlertTriangle } from 'lucide-react'

export interface TransferData {
  operator: {
    id: string
    name: string
    employee_code?: string
  }
  fromAsset: {
    id: string
    name: string
    asset_id: string
  }
  toAsset: {
    id: string
    name: string
    asset_id: string
  }
  assignmentType: 'primary' | 'secondary'
  conflictType?: 'existing_primary' | 'none'
  existingOperator?: {
    id: string
    name: string
  }
}

interface OperatorTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transferData: TransferData | null
  onConfirm: (forceTransfer?: boolean) => void
  onCancel: () => void
}

export function OperatorTransferDialog({
  open,
  onOpenChange,
  transferData,
  onConfirm,
  onCancel
}: OperatorTransferDialogProps) {
  if (!transferData) return null

  const isReplacement = transferData.conflictType === 'existing_primary'
  const isPrimaryAssignment = transferData.assignmentType === 'primary'

  const handleConfirm = () => {
    onConfirm(isReplacement)
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {isReplacement ? 'Confirmar Reemplazo de Operador' : 'Confirmar Transferencia de Operador'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isReplacement 
              ? 'Esta acción reemplazará al operador principal existente.'
              : 'Se transferirá al operador desde su asignación actual a un nuevo activo.'
            }
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Operator Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{transferData.operator.name}</p>
                  {transferData.operator.employee_code && (
                    <p className="text-sm text-gray-500">
                      Código: {transferData.operator.employee_code}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transfer Flow */}
          <div className="flex items-center gap-4">
            {/* From Asset */}
            <Card className="flex-1">
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Desde</p>
                  <p className="font-medium">{transferData.fromAsset.asset_id}</p>
                  <p className="text-sm text-gray-600">{transferData.fromAsset.name}</p>
                </div>
              </CardContent>
            </Card>

            {/* Arrow */}
            <ArrowRight className="h-6 w-6 text-gray-400" />

            {/* To Asset */}
            <Card className="flex-1">
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Hacia</p>
                  <p className="font-medium">{transferData.toAsset.asset_id}</p>
                  <p className="text-sm text-gray-600">{transferData.toAsset.name}</p>
                  <div className="mt-2">
                    <Badge variant={isPrimaryAssignment ? 'default' : 'secondary'}>
                      {isPrimaryAssignment ? 'Principal' : 'Secundario'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conflict Warning */}
          {isReplacement && transferData.existingOperator && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-800">
                      Reemplazo de Operador Principal
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      El operador actual <strong>{transferData.existingOperator.name}</strong> será 
                      removido como operador principal de este activo y será marcado como inactivo.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Impact Summary */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <h4 className="font-medium text-blue-800 mb-2">Resumen del Cambio</h4>
              <div className="space-y-1 text-sm text-blue-700">
                <p>• El operador será removido de su asignación actual</p>
                <p>• Se creará una nueva asignación como operador {isPrimaryAssignment ? 'principal' : 'secundario'}</p>
                <p>• El activo origen quedará sin operador asignado</p>
                {isReplacement && (
                  <p>• El operador principal existente será desactivado</p>
                )}
                <p>• Se registrará un historial completo de la transferencia</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            className={isReplacement ? 'bg-orange-600 hover:bg-orange-700' : ''}
          >
            {isReplacement ? 'Confirmar Reemplazo' : 'Confirmar Transferencia'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
} 