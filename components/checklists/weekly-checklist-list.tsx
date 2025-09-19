"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RescheduleChecklistModal } from '@/components/checklists/reschedule-checklist-modal'
import { useChecklistSchedules } from '@/hooks/useChecklists'
import Link from 'next/link'

export function WeeklyChecklistList() {
  const { schedules, loading, error, fetchSchedules } = useChecklistSchedules()
  const weekly = schedules.filter(s => s.checklists?.frequency === 'semanal')
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {weekly.map(item => (
        <Card key={item.id}>
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.checklists?.name}</span>
                <Badge variant="outline">{item.assets?.name}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Fecha: {new Date(item.scheduled_date).toLocaleDateString('es')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpenId(item.id)}>
                Reprogramar
              </Button>
              <Button asChild size="sm">
                <Link href={`/checklists/ejecutar/${item.id}`}>Ejecutar</Link>
              </Button>
            </div>
          </CardContent>
          <RescheduleChecklistModal
            scheduleId={item.id}
            open={openId === item.id}
            onOpenChange={(o) => setOpenId(o ? item.id : null)}
            onRescheduled={async () => {
              await fetchSchedules('pendiente')
            }}
          />
        </Card>
      ))}
      {weekly.length === 0 && (
        <div className="text-sm text-muted-foreground">No hay checklists semanales</div>
      )}
    </div>
  )
}
