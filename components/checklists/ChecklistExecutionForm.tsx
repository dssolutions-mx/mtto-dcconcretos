import { useEffect, useState } from 'react'
import { useChecklistExecution } from '@/hooks/useChecklists'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Save
} from 'lucide-react'

interface ChecklistExecutionFormProps {
  scheduleId: string
  onComplete?: () => void
}

export default function ChecklistExecutionForm({ scheduleId, onComplete }: ChecklistExecutionFormProps) {
  const { toast } = useToast()
  const { execution, schedule, loading, error, fetchExecution, saveExecution } = useChecklistExecution()
  const [itemStatuses, setItemStatuses] = useState<Record<string, { status: string; notes?: string; value?: string }>>({})
  const [notes, setNotes] = useState('')
  const [technician, setTechnician] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (scheduleId) {
      fetchExecution(scheduleId)
    }
  }, [fetchExecution, scheduleId])

  const handleItemStatusChange = (itemId: string, status: string) => {
    setItemStatuses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status }
    }))
  }

  const handleItemNotesChange = (itemId: string, notes: string) => {
    setItemStatuses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes }
    }))
  }

  const handleItemValueChange = (itemId: string, value: string) => {
    setItemStatuses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], value }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Verificar que todos los campos requeridos estén completados
      if (!technician) {
        toast({
          title: "Campo requerido",
          description: "Por favor, ingrese el nombre del técnico",
          variant: "destructive"
        })
        setIsSubmitting(false)
        return
      }

      // Verificar que todos los elementos requeridos tengan un estado
      let missingItems = false
      if (schedule?.checklists?.checklist_sections) {
        for (const section of schedule.checklists.checklist_sections) {
          for (const item of section.checklist_items || []) {
            if (item.required && !itemStatuses[item.id]) {
              missingItems = true
              break
            }
          }
        }
      }

      if (missingItems) {
        toast({
          title: "Items incompletos",
          description: "Por favor, complete todos los items requeridos",
          variant: "destructive"
        })
        setIsSubmitting(false)
        return
      }

      // Preparar datos para guardar
      const executionData = {
        schedule_id: scheduleId,
        executed_by: technician,
        execution_date: new Date().toISOString(),
        status: 'completed',
        notes: notes
      }

      // Preparar items de ejecución
      const executionItems = Object.entries(itemStatuses).map(([itemId, data]) => ({
        item_id: itemId,
        value: data.value || '',
        notes: data.notes || '',
        status: data.status || 'completed'
      }))

      // Guardar la ejecución
      const result = await saveExecution(executionData, executionItems)

      if (result) {
        toast({
          title: "Checklist completado",
          description: "El checklist ha sido completado exitosamente",
          variant: "default"
        })

        if (onComplete) {
          onComplete()
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al guardar el checklist",
        variant: "destructive"
      })
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-4">
        <p className="font-medium">Error al cargar el checklist</p>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (!schedule) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-4 mb-4">
        <p className="font-medium">Checklist no encontrado</p>
        <p className="text-sm">No se pudo encontrar el checklist programado</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información de la Inspección</CardTitle>
          <CardDescription>
            Complete los datos del técnico que realiza la inspección
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-1">Activo</h3>
              <p className="text-sm">{schedule.assets?.name}</p>
              <p className="text-xs text-muted-foreground">{schedule.assets?.asset_id}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-1">Plantilla</h3>
              <p className="text-sm">{schedule.checklists?.name}</p>
              <p className="text-xs text-muted-foreground">{schedule.checklists?.frequency}</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="technician">
              Técnico Responsable
            </label>
            <Input
              id="technician"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              placeholder="Nombre del técnico"
              required
            />
          </div>
        </CardContent>
      </Card>

      {schedule.checklists?.checklist_sections?.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.checklist_items?.map((item) => (
              <div key={item.id} className="border p-4 rounded-md space-y-3">
                <div className="flex justify-between">
                  <div>
                    <h4 className="text-sm font-medium">{item.description}</h4>
                    {item.required && (
                      <Badge variant="outline" className="mt-1">Requerido</Badge>
                    )}
                    {item.expected_value && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Valor esperado: {item.expected_value} {item.tolerance ? `(${item.tolerance})` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={itemStatuses[item.id]?.status === 'pass' ? 'default' : 'outline'}
                    onClick={() => handleItemStatusChange(item.id, 'pass')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Bien
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={itemStatuses[item.id]?.status === 'flag' ? 'default' : 'outline'}
                    onClick={() => handleItemStatusChange(item.id, 'flag')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Alerta
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={itemStatuses[item.id]?.status === 'fail' ? 'default' : 'outline'}
                    onClick={() => handleItemStatusChange(item.id, 'fail')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Mal
                  </Button>
                </div>

                {(item.item_type === 'measure' || item.item_type === 'text') && (
                  <div>
                    <Input
                      placeholder={item.item_type === 'measure' ? "Ingrese la medida" : "Ingrese el valor"}
                      value={itemStatuses[item.id]?.value || ''}
                      onChange={(e) => handleItemValueChange(item.id, e.target.value)}
                      className="mt-2"
                    />
                  </div>
                )}

                {(itemStatuses[item.id]?.status === 'flag' || itemStatuses[item.id]?.status === 'fail') && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Describa el problema"
                      value={itemStatuses[item.id]?.notes || ''}
                      onChange={(e) => handleItemNotesChange(item.id, e.target.value)}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Notas Adicionales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Observaciones adicionales sobre la inspección"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Guardando...' : 'Completar Inspección'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
} 