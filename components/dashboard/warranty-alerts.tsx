"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface WarrantyAlertsProps {
  className?: string
}

export function WarrantyAlerts({ className }: WarrantyAlertsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Alertas de Garantía</CardTitle>
        <CardDescription>Equipos con garantía próxima a vencer</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Lista de alertas de garantía</p>
        </div>
      </CardContent>
    </Card>
  )
}
