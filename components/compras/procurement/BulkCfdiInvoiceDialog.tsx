"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { FileArchive, Loader2, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatMxCurrency } from "@/lib/ap/po-invoice-utils"
import { invoiceNumberFromCfdi, shouldOmitCfdiFromBulkCreate } from "@/lib/ap/bulkCfdiValidation"
import type { ParsedCfdi } from "@/types/cfdi"
import { toast } from "sonner"

type BulkItem = {
  id: string
  file_name: string
  cfdi: ParsedCfdi
  duplicate_invoice: { id: string; invoice_number: string } | null
  purchase_order_id: string | null
  order_id: string | null
  duplicate_cfdi_in_upload: boolean
  duplicate_folio_in_upload: boolean
}

interface BulkCfdiInvoiceDialogProps {
  open: boolean
  onClose: () => void
  plantId?: string
  onCreated: () => void
}

export function BulkCfdiInvoiceDialog({
  open,
  onClose,
  plantId,
  onCreated,
}: BulkCfdiInvoiceDialogProps) {
  const zipRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<BulkItem[]>([])
  const [errors, setErrors] = useState<Array<{ file: string; message: string }>>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) {
      setItems([])
      setErrors([])
    }
  }, [open])

  const handleUpload = async (file: File) => {
    setLoading(true)
    try {
      const form = new FormData()
      form.append("zip_file", file)
      if (plantId) form.append("plant_id", plantId)
      const res = await fetch("/api/ap/cfdi/parse-bulk", { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Error al procesar ZIP")
        return
      }
      setItems(json.parsed ?? [])
      setErrors(json.errors ?? [])
      toast.success(`${json.parsed?.length ?? 0} CFDI listos para revisión`)
    } catch {
      toast.error("Error al cargar archivos")
    } finally {
      setLoading(false)
      if (zipRef.current) zipRef.current.value = ""
    }
  }

  const eligible = items.filter((i) => !shouldOmitCfdiFromBulkCreate(i) && i.purchase_order_id)

  const handleCreate = useCallback(async () => {
    if (eligible.length === 0) {
      toast.error("No hay facturas elegibles con OC vinculada")
      return
    }
    setCreating(true)
    let ok = 0
    for (const item of eligible) {
      const cfdi = item.cfdi
      const body = {
        invoice_number: invoiceNumberFromCfdi(cfdi),
        invoice_date: cfdi.fecha_emision.slice(0, 10),
        subtotal: cfdi.subtotal,
        discount_amount: cfdi.descuento,
        vat_rate: cfdi.vat_rate || 0.16,
        retention_isr_rate: cfdi.retention_isr_rate,
        retention_iva_rate: cfdi.retention_iva_rate,
        cfdi_uuid: cfdi.uuid,
        cfdi_serie: cfdi.serie,
        cfdi_folio: cfdi.folio,
        cfdi_emisor_rfc: cfdi.emisor_rfc,
        cfdi_receptor_rfc: cfdi.receptor_rfc,
        cfdi_metodo_pago: cfdi.metodo_pago,
        cfdi_forma_pago: cfdi.forma_pago,
        cfdi_uso: cfdi.uso_cfdi,
        cfdi_tipo_comprobante: cfdi.tipo_comprobante,
        cfdi_fecha_emision: cfdi.fecha_emision,
        cfdi_fecha_timbrado: cfdi.fecha_timbrado,
        cfdi_capture_mode: "cfdi" as const,
      }
      const res = await fetch(`/api/purchase-orders/${item.purchase_order_id}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (res.ok && json.success) ok += 1
    }
    setCreating(false)
    toast.success(`${ok} de ${eligible.length} facturas registradas`)
    onCreated()
    onClose()
  }, [eligible, onClose, onCreated])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importación masiva de CFDI</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={zipRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => zipRef.current?.click()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Subir ZIP con XML
          </Button>

          {errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 space-y-1">
              {errors.map((e) => (
                <p key={e.file}>
                  {e.file}: {e.message}
                </p>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => {
                const omit = shouldOmitCfdiFromBulkCreate(item)
                const noPo = !item.purchase_order_id
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border p-3 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileArchive className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {invoiceNumberFromCfdi(item.cfdi)}
                        </span>
                        {omit && <Badge variant="destructive">Omitido</Badge>}
                        {noPo && !omit && (
                          <Badge variant="secondary">Sin OC vinculada</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.cfdi.emisor_nombre ?? item.cfdi.emisor_rfc} · Base sin IVA{" "}
                        {formatMxCurrency(item.cfdi.subtotal - item.cfdi.descuento)} · Neto{" "}
                        {formatMxCurrency(item.cfdi.total)}
                      </p>
                      {item.order_id && (
                        <p className="text-xs">OC sugerida: {item.order_id}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(item.cfdi.fecha_emision), "dd/MM/yyyy", { locale: es })}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={creating || eligible.length === 0}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              `Registrar ${eligible.length} factura(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
