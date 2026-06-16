"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, MinusCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  PO_CREDIT_NOTE_REASON_LABELS,
  PO_CREDIT_NOTE_STATUS_LABELS,
  type PoCreditNote,
} from "@/types/po-invoices"
import { formatMxCurrency } from "@/lib/ap/po-invoice-utils"

interface PoCreditNotesTabProps {
  plantId?: string
}

export function PoCreditNotesTab({ plantId }: PoCreditNotesTabProps) {
  const [notes, setNotes] = useState<PoCreditNote[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (plantId) params.set("plant_id", plantId)
      const res = await fetch(`/api/ap/credit-notes?${params}`)
      const json = await res.json()
      if (json.success) setNotes(json.credit_notes ?? [])
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
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MinusCircle className="h-5 w-5" />
          Notas de crédito
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ajustes y devoluciones vinculados a facturas de proveedor. Los montos de crédito se
          expresan sin IVA; el total incluye el impuesto correspondiente.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando notas de crédito...
        </div>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No hay notas de crédito registradas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {note.credit_number ?? `NC-${note.id.slice(0, 8)}`}
                  </p>
                  <Badge variant="outline">
                    {PO_CREDIT_NOTE_STATUS_LABELS[note.status]}
                  </Badge>
                  <Badge variant="secondary">
                    {PO_CREDIT_NOTE_REASON_LABELS[note.reason]}
                  </Badge>
                  {note.cfdi_uuid && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      CFDI
                    </Badge>
                  )}
                </div>
                <div className="grid gap-1 text-sm sm:grid-cols-3">
                  <p>
                    Fecha:{" "}
                    {format(new Date(note.credit_date), "dd/MM/yyyy", { locale: es })}
                  </p>
                  <p>
                    Monto sin IVA: <strong>{formatMxCurrency(note.amount)}</strong>
                  </p>
                  <p>
                    Total NC: <strong>{formatMxCurrency(note.total)}</strong>
                  </p>
                </div>
                {note.notes && (
                  <p className="text-xs text-muted-foreground">{note.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
