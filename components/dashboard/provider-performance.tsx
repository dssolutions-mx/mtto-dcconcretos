"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ProviderPerformanceProps {
  className?: string
}

export function ProviderPerformance({ className }: ProviderPerformanceProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Desempeño de Proveedores</CardTitle>
        <CardDescription>Comparativa de órdenes y cumplimiento por proveedor</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Gráfico de desempeño de proveedores</p>
        </div>
      </CardContent>
    </Card>
  )
}
