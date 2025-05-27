"use client"

import { useState, useCallback, useMemo } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { 
  CalendarIcon, 
  CheckCircle2, 
  ClipboardList, 
  DollarSign, 
  Plus, 
  Trash2 
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface MaintenanceTask {
  id: string
  description: string
  type: string
  estimatedTime: number
  requiresSpecialist: boolean
  parts: MaintenancePart[]
  completed?: boolean
}

interface MaintenancePart {
  id: string
  name: string
  partNumber: string
  quantity: number
  cost?: number
}

interface MaintenanceHistoryPart {
  name: string
  partNumber?: string
  quantity: number
  cost?: string
}

interface MaintenanceSchedule {
  id: string
  hours: number
  name: string
  description: string
  tasks: MaintenanceTask[]
  completed?: boolean
  completionDate?: Date
  technician?: string
}

interface MaintenanceRegistrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMaintenancePlan: MaintenanceSchedule | null
  historyDate: Date | undefined
  setHistoryDate: (date: Date | undefined) => void
  historyType: string
  setHistoryType: (type: string) => void
  historyHours: string
  setHistoryHours: (hours: string) => void
  historyDescription: string
  setHistoryDescription: (description: string) => void
  historyFindings: string
  setHistoryFindings: (findings: string) => void
  historyActions: string
  setHistoryActions: (actions: string) => void
  historyTechnician: string
  setHistoryTechnician: (technician: string) => void
  historyLaborHours: string
  setHistoryLaborHours: (hours: string) => void
  historyLaborCost: string
  setHistoryLaborCost: (cost: string) => void
  historyWorkOrder: string
  setHistoryWorkOrder: (workOrder: string) => void
  historyParts: MaintenanceHistoryPart[]
  setHistoryParts: (parts: MaintenanceHistoryPart[]) => void
  completedTasks: Record<string, boolean>
  setCompletedTasks: (tasks: Record<string, boolean>) => void
  onOpenPartDialog: () => void
  onOpenTasksDialog: () => void
  onSubmit: () => void
}

export function MaintenanceRegistrationDialog({
  open,
  onOpenChange,
  selectedMaintenancePlan,
  historyDate,
  setHistoryDate,
  historyType,
  setHistoryType,
  historyHours,
  setHistoryHours,
  historyDescription,
  setHistoryDescription,
  historyFindings,
  setHistoryFindings,
  historyActions,
  setHistoryActions,
  historyTechnician,
  setHistoryTechnician,
  historyLaborHours,
  setHistoryLaborHours,
  historyLaborCost,
  setHistoryLaborCost,
  historyWorkOrder,
  setHistoryWorkOrder,
  historyParts,
  setHistoryParts,
  completedTasks,
  setCompletedTasks,
  onOpenPartDialog,
  onOpenTasksDialog,
  onSubmit
}: MaintenanceRegistrationDialogProps) {
  
  const removePart = useCallback((index: number) => {
    setHistoryParts((prevParts: MaintenanceHistoryPart[]) => {
      const newParts = [...prevParts]
      newParts.splice(index, 1)
      return newParts
    })
  }, [setHistoryParts])

  const handleCheckboxChange = useCallback((taskId: string, checked: boolean) => {
    setCompletedTasks((prevTasks: Record<string, boolean>) => ({
      ...prevTasks,
      [taskId]: checked,
    }))
  }, [setCompletedTasks])

  // Memoize the parts table to prevent unnecessary re-renders
  const partsTable = useMemo(() => {
    if (historyParts.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground border rounded-md">
          No hay repuestos registrados para este mantenimiento.
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Número de Parte</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Costo</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historyParts.map((part, index) => (
              <TableRow key={index}>
                <TableCell>{part.name}</TableCell>
                <TableCell>{part.partNumber || "-"}</TableCell>
                <TableCell>{part.quantity}</TableCell>
                <TableCell>{part.cost || "-"}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePart(index)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }, [historyParts, removePart])

  // Memoize the tasks section
  const tasksSection = useMemo(() => {
    if (!selectedMaintenancePlan) return null
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Tareas Completadas</Label>
          <Button type="button" variant="outline" size="sm" onClick={onOpenTasksDialog}>
            <ClipboardList className="mr-1 h-4 w-4" /> Gestionar Tareas
          </Button>
        </div>
        <div className="border rounded-md p-3 bg-muted/20">
          {Object.keys(completedTasks).length > 0 ? (
            <div className="space-y-2">
              {selectedMaintenancePlan.tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`plan-task-${task.id}`}
                    checked={completedTasks[task.id] || false}
                    onCheckedChange={(checked) => handleCheckboxChange(task.id, !!checked)}
                  />
                  <Label htmlFor={`plan-task-${task.id}`} className="text-sm">
                    {task.description}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-2 text-sm text-muted-foreground">
              No hay tareas marcadas como completadas
            </div>
          )}
        </div>
      </div>
    )
  }, [selectedMaintenancePlan, completedTasks, handleCheckboxChange, onOpenTasksDialog])

  const isFormValid = useMemo(() => {
    return !!(historyDate && historyType && historyDescription && historyTechnician)
  }, [historyDate, historyType, historyDescription, historyTechnician])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Mantenimiento</DialogTitle>
          <DialogDescription>
            {selectedMaintenancePlan
              ? `${selectedMaintenancePlan.name} - ${selectedMaintenancePlan.hours} horas`
              : "Registre los detalles del mantenimiento realizado"}
          </DialogDescription>
        </DialogHeader>
        <div 
          className="py-4 space-y-5 overflow-y-auto"
          style={{ touchAction: 'pan-y' }} // Add passive touch action to improve scroll performance
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn("w-full pl-3 text-left font-normal", !historyDate && "text-muted-foreground")}
                  >
                    {historyDate ? format(historyDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={historyDate} onSelect={setHistoryDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Mantenimiento</Label>
              <Select onValueChange={setHistoryType} value={historyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Preventivo">Preventivo</SelectItem>
                  <SelectItem value="Correctivo">Correctivo</SelectItem>
                  <SelectItem value="Predictivo">Predictivo</SelectItem>
                  <SelectItem value="Overhaul">Overhaul</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Horas del Equipo</Label>
              <Input
                type="number"
                placeholder="Ej: 500"
                value={historyHours}
                onChange={(e) => setHistoryHours(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Describa el mantenimiento realizado"
                value={historyDescription}
                onChange={(e) => setHistoryDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Hallazgos</Label>
              <Textarea
                placeholder="Hallazgos durante el mantenimiento"
                value={historyFindings}
                onChange={(e) => setHistoryFindings(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Acciones Realizadas</Label>
              <Textarea
                placeholder="Acciones realizadas durante el mantenimiento"
                value={historyActions}
                onChange={(e) => setHistoryActions(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Técnico</Label>
              <Input
                placeholder="Nombre del técnico"
                value={historyTechnician}
                onChange={(e) => setHistoryTechnician(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Horas de Trabajo</Label>
              <Input
                type="number"
                placeholder="Ej: 4"
                value={historyLaborHours}
                onChange={(e) => setHistoryLaborHours(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Costo de Mano de Obra</Label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="0.00"
                  className="pl-8"
                  value={historyLaborCost}
                  onChange={(e) => setHistoryLaborCost(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Orden de Trabajo</Label>
              <Input
                placeholder="Ej: OT-12345"
                value={historyWorkOrder}
                onChange={(e) => setHistoryWorkOrder(e.target.value)}
              />
            </div>
          </div>

          {selectedMaintenancePlan && tasksSection}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Repuestos Utilizados</Label>
              <Button type="button" variant="outline" size="sm" onClick={onOpenPartDialog}>
                <Plus className="mr-1 h-4 w-4" /> Agregar Repuesto
              </Button>
            </div>

            {partsTable}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!isFormValid}
          >
            Registrar Mantenimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 