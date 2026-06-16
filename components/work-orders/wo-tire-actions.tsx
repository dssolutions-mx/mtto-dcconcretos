"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CircleDot } from "lucide-react"

interface WOTireActionsProps {
  workOrderId: string
  assetId: string | null
  status?: string
}

export function WOTireActions({ workOrderId, assetId, status }: WOTireActionsProps) {
  if (!assetId) return null

  const isActive = status && !["completed", "cancelled", "completada", "cancelada"].includes(status.toLowerCase())
  if (!isActive) return null

  return (
    <Card className="no-print">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-base">Llantas</CardTitle>
        <CardDescription className="text-xs">
          Montaje, lecturas y eventos vinculados a esta orden de trabajo
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <Button variant="outline" size="sm" asChild className="w-full justify-start">
          <Link href={`/activos/${assetId}/llantas?workOrderId=${workOrderId}`}>
            <CircleDot className="mr-2 h-4 w-4" />
            Abrir trabajo de llantas
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
