"use client"

import { useCallback, useRef, useState } from "react"
import { FileUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { ParsedCfdi } from "@/types/cfdi"
import { invoiceNumberFromCfdi } from "@/lib/ap/bulkCfdiValidation"
import { toast } from "sonner"

export interface CfdiPrefill {
  invoice_number: string
  invoice_date: string
  subtotal: number
  discount_amount: number
  vat_rate: number
  retention_isr_rate: number
  retention_iva_rate: number
  cfdi_uuid: string
  cfdi_serie?: string | null
  cfdi_folio?: string | null
  cfdi_emisor_rfc: string
  cfdi_receptor_rfc: string
  cfdi_metodo_pago?: string | null
  cfdi_forma_pago?: string | null
  cfdi_uso?: string | null
  cfdi_tipo_comprobante: string
  cfdi_fecha_emision: string
  cfdi_fecha_timbrado: string
  cfdi_capture_mode: "cfdi"
}

interface CfdiXmlUploadFieldProps {
  onParsed: (prefill: CfdiPrefill, cfdi: ParsedCfdi) => void
  disabled?: boolean
  /** Endpoint de parseo (default: staff `/api/ap/cfdi/parse`). */
  parseUrl?: string
}

function cfdiToPrefill(cfdi: ParsedCfdi): CfdiPrefill {
  return {
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
    cfdi_capture_mode: "cfdi",
  }
}

export function CfdiXmlUploadField({
  onParsed,
  disabled,
  parseUrl = "/api/ap/cfdi/parse",
}: CfdiXmlUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (file: File) => {
    setLoading(true)
    try {
      const form = new FormData()
      form.append("xml_file", file)
      const res = await fetch(parseUrl, { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo leer el CFDI")
        return
      }
      if (json.duplicate_invoice) {
        toast.error(`Este CFDI ya está registrado (${json.duplicate_invoice.invoice_number})`)
        return
      }
      const prefill = cfdiToPrefill(json.cfdi as ParsedCfdi)
      onParsed(prefill, json.cfdi as ParsedCfdi)
      toast.success("CFDI cargado — revise los montos antes de guardar")
    } catch {
      toast.error("Error al procesar XML")
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <Label>Importar desde XML (CFDI)</Label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".xml"
          className="hidden"
          disabled={disabled || loading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4 mr-2" />
          )}
          Cargar XML
        </Button>
        <span className="text-xs text-muted-foreground">
          Autocompleta folio, montos sin IVA, IVA y retenciones
        </span>
      </div>
    </div>
  )
}

export { cfdiToPrefill }
