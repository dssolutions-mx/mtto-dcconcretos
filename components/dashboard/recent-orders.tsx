"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface RecentOrdersProps {
  className?: string
}

export function RecentOrders({ className }: RecentOrdersProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Órdenes Recientes</CardTitle>
        <CardDescription>Últimas órdenes de trabajo registradas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Lista de órdenes recientes</p>
        </div>
      </CardContent>
    </Card>
  )
}
