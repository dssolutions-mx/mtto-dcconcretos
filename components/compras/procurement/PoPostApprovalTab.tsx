"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatMxCurrency } from "@/lib/ap/po-invoice-utils"
import { getPOStatusLabel } from "@/lib/purchase-orders/status-labels"

interface PostApprovalRow {
  id: string
  order_id: string
  supplier: string
  status: string
  po_type?: string | null
  total_amount: number
  actual_amount?: number | null
  accounting_status?: string | null
  plant_id?: string | null
}

interface PoPostApprovalTabProps {
  plantId?: string
}

export function PoPostApprovalTab({ plantId }: PoPostApprovalTabProps) {
  const [rows, setRows] = useState<PostApprovalRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (plantId) params.set("plant_id", plantId)
      const res = await fetch(`/api/compras/procurement/post-approval?${params}`)
      const json = await res.json()
      if (json.success) setRows(json.rows ?? [])
    } finally {
      setLoading(false)
    }
  }, [plantId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">OC en ejecución post-aprobación</h2>
        <p className="text-sm text-muted-foreground">
          Órdenes aprobadas en proceso de compra, comprobante, factura o pago.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando...
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No hay órdenes en ejecución post-aprobación.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{row.order_id}</p>
                    <Badge variant="outline">{getPOStatusLabel(row.status)}</Badge>
                    {row.accounting_status && (
                      <Badge variant="secondary">{row.accounting_status}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{row.supplier}</p>
                  <p className="text-sm font-medium mt-1">
                    {formatMxCurrency(Number(row.actual_amount ?? row.total_amount ?? 0))}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/compras/${row.id}`}>Gestionar OC</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
