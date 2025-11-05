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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Users, Building2, MapPin, CheckCircle2, X } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Profile {
  id: string
  nombre: string
  apellido: string
  employee_code?: string
  role: string
}

interface Plant {
  id: string
  name: string
  code: string
  business_unit_id: string
}

interface BusinessUnit {
  id: string
  name: string
  code: string
}

interface BatchAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedOperators: Profile[]
  plants: Plant[]
  businessUnits: BusinessUnit[]
  onAssign: (operatorIds: string[], targetType: 'plant' | 'businessUnit', targetId: string) => Promise<void>
}

export function BatchAssignmentDialog({
  open,
  onOpenChange,
  selectedOperators,
  plants,
  businessUnits,
  onAssign
}: BatchAssignmentDialogProps) {
  const [targetType, setTargetType] = useState<'plant' | 'businessUnit'>('plant')
  const [targetId, setTargetId] = useState<string>('')
  const [assigning, setAssigning] = useState(false)

  const handleAssign = async () => {
    if (!targetId) {
      toast.error('Por favor selecciona un destino')
      return
    }

    setAssigning(true)
    try {
      await onAssign(
        selectedOperators.map(op => op.id),
        targetType,
        targetId
      )
      toast.success(`${selectedOperators.length} operador(es) asignado(s) exitosamente`)
      onOpenChange(false)
      // Reset form
      setTargetType('plant')
      setTargetId('')
    } catch (error) {
      toast.error('Error al asignar operadores')
      console.error(error)
    } finally {
      setAssigning(false)
    }
  }

  const availableTargets = targetType === 'plant' ? plants : businessUnits

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Asignación Masiva
          </DialogTitle>
          <DialogDescription>
            Asigna {selectedOperators.length} operador(es) seleccionado(s) a una planta o unidad de negocio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Operators Preview */}
          <Card>
            <CardContent className="pt-4">
              <Label className="mb-2 block">Operadores Seleccionados</Label>
              <ScrollArea className="max-h-40">
                <div className="space-y-2">
                  {selectedOperators.map((op) => (
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
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {op.role.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Target Selection */}
          <div className="space-y-4">
            <div>
              <Label>Tipo de Destino</Label>
              <Select value={targetType} onValueChange={(value: 'plant' | 'businessUnit') => {
                setTargetType(value)
                setTargetId('') // Reset selection when type changes
              }}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plant">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Planta
                    </div>
                  </SelectItem>
                  <SelectItem value="businessUnit">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Unidad de Negocio
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>
                {targetType === 'plant' ? 'Planta' : 'Unidad de Negocio'}
              </Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={`Selecciona una ${targetType === 'plant' ? 'planta' : 'unidad de negocio'}`} />
                </SelectTrigger>
                <SelectContent>
                  {availableTargets.map((target) => (
                    <SelectItem key={target.id} value={target.id}>
                      {target.name} ({target.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          {targetId && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <p className="font-medium text-blue-800">Vista Previa</p>
                </div>
                <p className="text-sm text-blue-700">
                  {selectedOperators.length} operador(es) serán asignado(s) a{' '}
                  <strong>
                    {availableTargets.find(t => t.id === targetId)?.name}
                  </strong>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={!targetId || assigning}
          >
            {assigning ? 'Asignando...' : `Asignar ${selectedOperators.length} Operador(es)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

