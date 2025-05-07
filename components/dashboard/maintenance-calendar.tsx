"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface MaintenanceCalendarProps {
  className?: string
}

export function MaintenanceCalendar({ className }: MaintenanceCalendarProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Calendario de Mantenimiento</CardTitle>
        <CardDescription>Próximos mantenimientos programados</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Calendario de mantenimientos programados</p>
        </div>
      </CardContent>
    </Card>
  )
}
