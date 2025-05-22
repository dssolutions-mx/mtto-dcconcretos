import { useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useChecklistSchedules } from '@/hooks/useChecklists'

interface ChecklistScheduleListProps {
  status?: string
  type?: string
}

export default function ChecklistScheduleList({ status, type }: ChecklistScheduleListProps) {
  const { schedules, loading, error, fetchSchedules } = useChecklistSchedules()

  useEffect(() => {
    fetchSchedules(status, type)
  }, [fetchSchedules, status, type])

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
        <p className="font-medium">Error al cargar las programaciones</p>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (schedules.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-4 mb-4">
        <p className="font-medium">No hay checklists programados</p>
        <p className="text-sm">
          No se encontraron checklists programados con los filtros seleccionados.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {schedules.map((schedule) => (
        <Card key={schedule.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{schedule.checklists?.name || 'Checklist'}</CardTitle>
                <CardDescription className="text-sm mt-1">
                  {schedule.assets?.name || 'Activo no especificado'}
                </CardDescription>
              </div>
              <StatusBadge status={schedule.status} />
            </div>
          </CardHeader>
          <CardContent className="text-sm pb-2">
            <div className="space-y-1">
              <p>
                <span className="font-medium">Fecha programada:</span>{' '}
                {formatDate(schedule.scheduled_date)}
              </p>
              <p>
                <span className="font-medium">Tipo:</span>{' '}
                {schedule.checklists?.frequency || 'No especificado'}
              </p>
              <p>
                <span className="font-medium">Asignado a:</span>{' '}
                {schedule.profiles 
                  ? `${schedule.profiles.nombre} ${schedule.profiles.apellido}`
                  : 'No asignado'}
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-2 flex justify-between">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/checklists/programados/${schedule.id}`}>
                Ver detalles
              </Link>
            </Button>
            {schedule.status === 'pendiente' && (
              <Button size="sm" asChild>
                <Link href={`/checklists/ejecutar/${schedule.id}`}>
                  Ejecutar
                </Link>
              </Button>
            )}
            {schedule.status === 'completed' && (
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/checklists/resultados/${schedule.id}`}>
                  Ver resultados
                </Link>
              </Button>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string, color: string }> = {
    pendiente: { 
      label: 'Pendiente', 
      color: 'bg-amber-100 text-amber-800 border-amber-200'
    },
    en_progreso: { 
      label: 'En progreso', 
      color: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    completed: { 
      label: 'Completado', 
      color: 'bg-green-100 text-green-800 border-green-200'
    },
    vencido: { 
      label: 'Vencido', 
      color: 'bg-red-100 text-red-800 border-red-200'
    },
    cancelado: { 
      label: 'Cancelado', 
      color: 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const { label, color } = statusMap[status] || { 
    label: 'Desconocido', 
    color: 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <Badge className={`ml-2 ${color}`} variant="outline">
      {label}
    </Badge>
  )
}

function formatDate(dateString: string) {
  try {
    const date = new Date(dateString)
    return format(date, 'PPP', { locale: es })
  } catch (e) {
    return dateString
  }
} 