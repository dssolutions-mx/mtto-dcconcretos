'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, Plus, CheckCircle2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type DistributionTarget = {
  id: string
  type: 'plant' | 'businessUnit' | 'department'
  plantId?: string
  businessUnitId?: string
  department?: string
  percentage: number
  amount: number
}

type DistributionTableProps = {
  distributions: DistributionTarget[]
  totalAmount: number
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, updates: Partial<DistributionTarget>) => void
  plants: Array<{ id: string; name: string; code: string; business_unit_id: string }>
  businessUnits: Array<{ id: string; name: string; code: string }>
  departments: string[]
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

export function DistributionTable({
  distributions,
  totalAmount,
  onAdd,
  onRemove,
  onUpdate,
  plants,
  businessUnits,
  departments
}: DistributionTableProps) {
  const totalPercentage = distributions.reduce((sum, d) => sum + d.percentage, 0)
  const isValid = Math.abs(totalPercentage - 100) < 0.01

  const handleTypeChange = (id: string, type: 'plant' | 'businessUnit' | 'department') => {
    const updates: Partial<DistributionTarget> = { type }
    if (type === 'plant') {
      updates.businessUnitId = undefined
      updates.department = undefined
    } else if (type === 'businessUnit') {
      updates.plantId = undefined
      updates.department = undefined
    } else {
      updates.plantId = undefined
      updates.businessUnitId = undefined
    }
    onUpdate(id, updates)
  }

  const handlePercentageChange = (id: string, percentage: number) => {
    const amount = (totalAmount * percentage) / 100
    onUpdate(id, { percentage, amount })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Distribuciones</Label>
        <Button 
          type="button" 
          onClick={onAdd}
          size="sm" 
          variant="outline"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Distribución
        </Button>
      </div>

      {distributions.length === 0 ? (
        <div className="border rounded-lg p-6 text-center bg-muted/50">
          <p className="text-sm text-muted-foreground mb-2">No hay distribuciones configuradas</p>
          <p className="text-xs text-muted-foreground mb-4">Haz clic en "Agregar Distribución" para comenzar</p>
          <Button 
            type="button" 
            onClick={onAdd}
            size="sm" 
            variant="default"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primera Distribución
          </Button>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Tipo</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-right w-[120px]">Porcentaje</TableHead>
                  <TableHead className="text-right w-[140px]">Monto</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributions.map((dist) => (
                  <TableRow key={dist.id}>
                    <TableCell>
                      <Select
                        value={dist.type}
                        onValueChange={(val) => handleTypeChange(dist.id, val as any)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="plant">Planta</SelectItem>
                          <SelectItem value="businessUnit">Unidad de Negocio</SelectItem>
                          <SelectItem value="department">Departamento</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {dist.type === 'plant' && (
                        <Select
                          value={dist.plantId || ''}
                          onValueChange={(val) => onUpdate(dist.id, { plantId: val })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Seleccionar planta" />
                          </SelectTrigger>
                          <SelectContent>
                            {plants.map(plant => (
                              <SelectItem key={plant.id} value={plant.id}>
                                {plant.name} ({plant.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {dist.type === 'businessUnit' && (
                        <Select
                          value={dist.businessUnitId || ''}
                          onValueChange={(val) => onUpdate(dist.id, { businessUnitId: val })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Seleccionar unidad" />
                          </SelectTrigger>
                          <SelectContent>
                            {businessUnits.map(bu => (
                              <SelectItem key={bu.id} value={bu.id}>
                                {bu.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {dist.type === 'department' && (
                        <Select
                          value={dist.department || ''}
                          onValueChange={(val) => onUpdate(dist.id, { department: val })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Seleccionar departamento" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map(dept => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={dist.percentage}
                        onChange={(e) => handlePercentageChange(dist.id, Number(e.target.value))}
                        className="text-right h-9"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(dist.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(dist.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={2} className="font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={isValid ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}>
                        {totalPercentage.toFixed(2)}%
                      </span>
                      {isValid ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(totalAmount)}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {!isValid && (
            <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
              <AlertCircle className="w-4 h-4" />
              <span>Los porcentajes deben sumar exactamente 100%</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

