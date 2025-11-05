'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Users, Building2, MapPin, CheckCircle2, X, Search, CheckSquare, Square, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface Profile {
  id: string
  nombre: string
  apellido: string
  employee_code?: string
  role: string
  plant_id?: string | null
  business_unit_id?: string | null
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
  availableOperators: Profile[]
  plants: Plant[]
  businessUnits: BusinessUnit[]
  onAssign: (operatorIds: string[], targetType: 'plant' | 'businessUnit', targetId: string) => Promise<void>
}

export function BatchAssignmentDialog({
  open,
  onOpenChange,
  availableOperators,
  plants,
  businessUnits,
  onAssign
}: BatchAssignmentDialogProps) {
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [targetType, setTargetType] = useState<'plant' | 'businessUnit'>('plant')
  const [targetId, setTargetId] = useState<string>('')
  const [assigning, setAssigning] = useState(false)

  // Reset selections when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedOperatorIds(new Set())
      setSearchQuery('')
      setTargetId('')
    }
  }, [open])

  // Filter operators based on search
  const filteredOperators = useMemo(() => {
    if (!searchQuery.trim()) return availableOperators
    
    const query = searchQuery.toLowerCase()
    return availableOperators.filter(op => 
      op.nombre.toLowerCase().includes(query) ||
      op.apellido.toLowerCase().includes(query) ||
      op.employee_code?.toLowerCase().includes(query) ||
      `${op.nombre} ${op.apellido}`.toLowerCase().includes(query)
    )
  }, [availableOperators, searchQuery])

  const selectedOperators = useMemo(() => {
    return availableOperators.filter(op => selectedOperatorIds.has(op.id))
  }, [availableOperators, selectedOperatorIds])

  const handleToggleOperator = (operatorId: string) => {
    setSelectedOperatorIds(prev => {
      const next = new Set(prev)
      if (next.has(operatorId)) {
        next.delete(operatorId)
      } else {
        next.add(operatorId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedOperatorIds.size === filteredOperators.length) {
      // Deselect all
      setSelectedOperatorIds(new Set())
    } else {
      // Select all filtered
      setSelectedOperatorIds(new Set(filteredOperators.map(op => op.id)))
    }
  }

  const handleClearSelection = () => {
    setSelectedOperatorIds(new Set())
  }

  const handleAssign = async () => {
    if (selectedOperatorIds.size === 0) {
      toast.error('Por favor selecciona al menos un operador')
      return
    }

    if (!targetId) {
      toast.error('Por favor selecciona un destino')
      return
    }

    setAssigning(true)
    try {
      await onAssign(
        Array.from(selectedOperatorIds),
        targetType,
        targetId
      )
      toast.success(`${selectedOperatorIds.size} operador(es) asignado(s) exitosamente`)
      onOpenChange(false)
      // Reset form
      setTargetType('plant')
      setTargetId('')
      setSelectedOperatorIds(new Set())
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
            Asignación Masiva de Personal
          </DialogTitle>
          <DialogDescription>
            Selecciona múltiples operadores y asígnalos a una planta o unidad de negocio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Selection Controls */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, apellido o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="flex items-center gap-2"
              >
                {selectedOperatorIds.size === filteredOperators.length && filteredOperators.length > 0 ? (
                  <>
                    <Square className="h-4 w-4" />
                    Deseleccionar Todo
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    Seleccionar Todo
                  </>
                )}
              </Button>
              {selectedOperatorIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Limpiar ({selectedOperatorIds.size})
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                {selectedOperatorIds.size} de {availableOperators.length} seleccionado(s)
              </span>
              {searchQuery && (
                <span>
                  {filteredOperators.length} resultado(s) encontrado(s)
                </span>
              )}
            </div>
          </div>

          {/* Operators List with Checkboxes */}
          <Card>
            <CardContent className="pt-4">
              <Label className="mb-3 block font-semibold">Seleccionar Operadores</Label>
              <ScrollArea className="max-h-[300px] pr-4">
                {filteredOperators.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No se encontraron operadores</p>
                    {searchQuery && (
                      <p className="text-sm mt-1">Intenta con otra búsqueda</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredOperators.map((op) => {
                      const isSelected = selectedOperatorIds.has(op.id)
                      return (
                        <div
                          key={op.id}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                            ${isSelected 
                              ? 'bg-blue-50 border-blue-300 shadow-sm' 
                              : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                            }
                          `}
                          onClick={() => handleToggleOperator(op.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleOperator(op.id)}
                            className="flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`font-medium text-sm ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                {op.nombre} {op.apellido}
                              </p>
                              <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                                {op.role.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              {op.employee_code && (
                                <p className="text-xs text-gray-500">
                                  Código: {op.employee_code}
                                </p>
                              )}
                              {op.plant_id && (
                                <Badge variant="secondary" className="text-xs">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  En Planta
                                </Badge>
                              )}
                              {op.business_unit_id && !op.plant_id && (
                                <Badge variant="secondary" className="text-xs">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  En Unidad
                                </Badge>
                              )}
                              {!op.plant_id && !op.business_unit_id && (
                                <Badge variant="outline" className="text-xs text-orange-600">
                                  Sin Asignar
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
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
          {targetId && selectedOperatorIds.size > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <p className="font-medium text-blue-800">Vista Previa de Asignación</p>
                </div>
                <p className="text-sm text-blue-700">
                  <strong>{selectedOperatorIds.size}</strong> operador(es) serán asignado(s) a{' '}
                  <strong>
                    {availableTargets.find(t => t.id === targetId)?.name}
                  </strong>
                </p>
                {selectedOperators.length <= 5 && (
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <p className="text-xs text-blue-600 font-medium mb-1">Operadores seleccionados:</p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      {selectedOperators.map(op => (
                        <li key={op.id}>• {op.nombre} {op.apellido}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
            disabled={!targetId || assigning || selectedOperatorIds.size === 0}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {assigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Asignando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Asignar {selectedOperatorIds.size} Operador{selectedOperatorIds.size !== 1 ? 'es' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

