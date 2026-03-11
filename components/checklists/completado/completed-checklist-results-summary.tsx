"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CompletedChecklistResultsSummaryProps {
  totalItems: number
  passedItems: number
  flaggedItems: number
  failedItems: number
}

export function CompletedChecklistResultsSummary({
  totalItems,
  passedItems,
  flaggedItems,
  failedItems,
}: CompletedChecklistResultsSummaryProps) {
  return (
    <Card className="shadow-checklist-2">
      <CardHeader>
        <CardTitle>Resumen de Resultados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{totalItems}</div>
            <div className="text-sm text-muted-foreground">Total de ítems</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{passedItems}</div>
            <div className="text-sm text-muted-foreground">Correctos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{flaggedItems}</div>
            <div className="text-sm text-muted-foreground">Con atención</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{failedItems}</div>
            <div className="text-sm text-muted-foreground">Fallidos</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
