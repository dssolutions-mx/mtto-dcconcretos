"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Eye, FileText, Loader2, Receipt } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PoWithoutInvoiceRow } from "@/types/po-invoices"
import { formatMxCurrency } from "@/lib/ap/po-invoice-utils"
import { getPOStatusLabel } from "@/lib/purchase-orders/status-labels"

interface PoWithoutInvoiceTabProps {
  plantId?: string
}

export function PoWithoutInvoiceTab({ plantId }: PoWithoutInvoiceTabProps) {
  const [rows, setRows] = useState<PoWithoutInvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [receiptFilter, setReceiptFilter] = useState<string>("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (plantId) params.set("plant_id", plantId)
      if (receiptFilter === "with") params.set("has_receipt", "true")
      if (receiptFilter === "without") params.set("has_receipt", "false")
      const res = await fetch(`/api/ap/po-without-invoice?${params}`)
      const json = await res.json()
      if (json.success) setRows(json.rows ?? [])
    } finally {
      setLoading(false)
    }
  }, [plantId, receiptFilter])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">OC sin factura de proveedor</h2>
          <p className="text-sm text-muted-foreground">
            Órdenes post-aprobación pendientes de registro contable fiscal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={receiptFilter} onValueChange={setReceiptFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="with">Con comprobante</SelectItem>
              <SelectItem value="without">Sin comprobante</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline">
            <FileText className="h-3 w-3 mr-1" />
            {rows.length}
          </Badge>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando...
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No hay órdenes post-aprobación sin factura registrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.purchase_order_id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="font-semibold">{row.order_id}</p>
                      <p className="text-sm text-muted-foreground">{row.supplier}</p>
                      {row.plant_name && (
                        <p className="text-xs text-muted-foreground">{row.plant_name}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Estado OC</p>
                      <Badge variant="outline">{getPOStatusLabel(row.po_status)}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Monto</p>
                      <p className="font-semibold">
                        {formatMxCurrency(Number(row.actual_amount ?? row.total_amount ?? 0))}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.has_receipt ? (
                        <Badge className="bg-blue-100 text-blue-800">
                          <Receipt className="h-3 w-3 mr-1" />
                          {row.receipt_count} comprobante(s)
                        </Badge>
                      ) : (
                        <Badge variant="outline">Sin comprobante</Badge>
                      )}
                      {row.approval_date && (
                        <span className="text-xs text-muted-foreground self-center">
                          Aprobada {format(new Date(row.approval_date), "dd/MM/yy", { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href={`/compras/${row.purchase_order_id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      Registrar factura
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
