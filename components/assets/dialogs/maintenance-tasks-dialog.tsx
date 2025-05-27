"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface MaintenanceTask {
  id: string
  description: string
  type: string
  estimatedTime: number
  requiresSpecialist: boolean
}

interface MaintenanceSchedule {
  id: string
  name: string
  description: string
  tasks: MaintenanceTask[]
}

interface MaintenanceTasksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMaintenancePlan: MaintenanceSchedule | null
  completedTasks: Record<string, boolean>
  setCompletedTasks: (tasks: Record<string, boolean>) => void
}

export function MaintenanceTasksDialog({
  open,
  onOpenChange,
  selectedMaintenancePlan,
  completedTasks,
  setCompletedTasks
}: MaintenanceTasksDialogProps) {
  
  const markAllTasks = (completed: boolean) => {
    if (!selectedMaintenancePlan) return
    
    const allTasks: Record<string, boolean> = {}
    selectedMaintenancePlan.tasks.forEach((task) => {
      allTasks[task.id] = completed
    })
    setCompletedTasks(allTasks)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar Tareas Completadas</DialogTitle>
          <DialogDescription>Marque las tareas que se completaron durante este mantenimiento</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {selectedMaintenancePlan && (
            <div className="space-y-4">
              <div className="p-3 border rounded-md bg-muted/20">
                <h3 className="font-medium">{selectedMaintenancePlan.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedMaintenancePlan.description}</p>
              </div>

              <div className="space-y-2">
                {selectedMaintenancePlan.tasks.map((task) => (
                  <div key={task.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={`task-${task.id}`}
                      checked={completedTasks[task.id] || false}
                      onCheckedChange={(checked) => {
                        setCompletedTasks({
                          ...completedTasks,
                          [task.id]: !!checked,
                        })
                      }}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor={`task-${task.id}`} className="text-sm font-medium">
                        {task.description}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {task.type} - {task.estimatedTime}h{task.requiresSpecialist && " - Requiere especialista"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => markAllTasks(true)}
                >
                  Marcar todas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => markAllTasks(false)}
                >
                  Desmarcar todas
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 