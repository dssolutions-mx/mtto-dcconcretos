"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { toast } from 'sonner'

interface RescheduleChecklistModalProps {
  scheduleId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRescheduled?: (newDate: string) => void
}

export function RescheduleChecklistModal({ scheduleId, open, onOpenChange, onRescheduled }: RescheduleChecklistModalProps) {
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!date) {
      toast.error('Selecciona una fecha')
      return
    }

    setLoading(true)
    try {
      const yyyy = date.getUTCFullYear()
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(date.getUTCDate()).padStart(2, '0')
      const normalized = `${yyyy}-${mm}-${dd}`

      const res = await fetch(`/api/checklists/schedules/${scheduleId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: normalized })
      })

      const json = await res.json()
      if (!res.ok || !json?.success) {
        const err = json?.error || 'No se pudo reprogramar'
        if (err === 'duplicate_schedule') {
          toast.error('Ya existe un checklist programado para esa fecha')
        } else if (err === 'only_pending_can_be_rescheduled') {
          toast.error('Solo se pueden reprogramar checklists pendientes')
        } else {
          toast.error(err)
        }
        return
      }

      toast.success('Checklist reprogramado')
      onOpenChange(false)
      setDate(undefined)
      onRescheduled?.(json?.data?.scheduled_day || normalized)
    } catch (e: any) {
      toast.error(e?.message || 'Error al reprogramar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reprogramar Checklist</DialogTitle>
          <DialogDescription>
            Selecciona una nueva fecha. Si cae en domingo y es diario/semanal, se moverá al lunes.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <DatePicker date={date} setDate={setDate} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!date || loading}>
            {loading ? 'Guardando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
