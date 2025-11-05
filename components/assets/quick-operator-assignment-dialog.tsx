'use client'

import { useState, useEffect } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, X, CheckCircle2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Operator {
  id: string
  nombre: string
  apellido: string
  employee_code?: string
  role: string
}

interface QuickOperatorAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string
  assetName: string
  assetCode: string
  plantId: string
  onAssign: (operatorId: string, assignmentType: 'primary' | 'secondary') => Promise<void>
}

export function QuickOperatorAssignmentDialog({
  open,
  onOpenChange,
  assetId,
  assetName,
  assetCode,
  plantId,
  onAssign
}: QuickOperatorAssignmentDialogProps) {
  const [operators, setOperators] = useState<Operator[]>([])
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null)
  const [assignmentType, setAssignmentType] = useState<'primary' | 'secondary'>('primary')
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (open && plantId) {
      fetchOperators()
    }
  }, [open, plantId])

  const fetchOperators = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/operators/register?plant_id=${plantId}`)
      if (response.ok) {
        const data = await response.json()
        setOperators(data || [])
      }
    } catch (error) {
      console.error('Error fetching operators:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedOperatorId) {
      toast.error('Por favor selecciona un operador')
      return
    }

    setAssigning(true)
    try {
      await onAssign(selectedOperatorId, assignmentType)
      toast.success('Operador asignado exitosamente')
      onOpenChange(false)
      // Reset
      setSelectedOperatorId(null)
      setAssignmentType('primary')
    } catch (error) {
      console.error('Error assigning operator:', error)
      toast.error('Error al asignar operador')
    } finally {
      setAssigning(false)
    }
  }

  const handleSkip = () => {
    onOpenChange(false)
    setSelectedOperatorId(null)
    setAssignmentType('primary')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Asignar Operador al Activo
          </DialogTitle>
          <DialogDescription>
            Asigna un operador al activo <strong>{assetCode}</strong> ({assetName})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Operator Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Seleccionar Operador
            </label>
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Cargando operadores...
              </div>
            ) : operators.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No hay operadores disponibles en esta planta</p>
                <p className="text-sm">Asigna operadores a la planta primero</p>
              </div>
            ) : (
              <ScrollArea className="max-h-64 border rounded-lg">
                <div className="p-2 space-y-2">
                  {operators.map((op) => (
                    <div
                      key={op.id}
                      onClick={() => setSelectedOperatorId(op.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedOperatorId === op.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {op.nombre?.[0]}{op.apellido?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {op.nombre} {op.apellido}
                            </p>
                            {op.employee_code && (
                              <p className="text-xs text-gray-500">
                                Código: {op.employee_code}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {op.role.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Assignment Type */}
          {selectedOperatorId && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Tipo de Asignación
              </label>
              <div className="flex gap-2">
                <Button
                  variant={assignmentType === 'primary' ? 'default' : 'outline'}
                  onClick={() => setAssignmentType('primary')}
                  className="flex-1"
                >
                  Operador Principal
                </Button>
                <Button
                  variant={assignmentType === 'secondary' ? 'default' : 'outline'}
                  onClick={() => setAssignmentType('secondary')}
                  className="flex-1"
                >
                  Operador Secundario
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleSkip}>
            Omitir por Ahora
          </Button>
          <Button 
            onClick={handleAssign}
            disabled={!selectedOperatorId || assigning}
          >
            {assigning ? 'Asignando...' : 'Asignar Operador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

