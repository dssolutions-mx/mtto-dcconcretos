"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Camera, MapPin } from "lucide-react"
import { EvidenceViewer } from "@/components/ui/evidence-viewer"
import type { DieselEvidenceImageMetadata } from "@/lib/photos/diesel-evidence-image-metadata"
import {
  comparePhotoTimeToTransaction,
  isDieselEvidenceImageMetadata,
} from "@/lib/photos/photo-time-vs-transaction"
import type { Json } from "@/types/supabase-types"
import { cn } from "@/lib/utils"

interface TransactionEvidenceModalProps {
  transactionId: string | null
  isOpen: boolean
  onClose: () => void
  headerTitle?: string
  subheader?: string
}

interface EvidenceRow {
  id: string
  photo_url: string
  description: string | null
  category: string | null
  created_at: string
  metadata: Json | null
}

interface TxDetail {
  id: string
  warehouse_id: string
  transaction_type: string
  transaction_date: string
  quantity_liters: number
  cuenta_litros: number | null
}

interface WarehouseMeta {
  id: string
  has_cuenta_litros: boolean
}

export function TransactionEvidenceModal({
  transactionId,
  isOpen,
  onClose,
  headerTitle = "Evidencia de la Transacción",
  subheader
}: TransactionEvidenceModalProps) {
  const [loading, setLoading] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [evidence, setEvidence] = useState<Array<{
    id: string
    url: string
    description: string
    category: string
    uploaded_at: string
    metadata?: DieselEvidenceImageMetadata | null
  }>>([])
  const [txDetail, setTxDetail] = useState<TxDetail | null>(null)
  const [warehouseMeta, setWarehouseMeta] = useState<WarehouseMeta | null>(null)
  const [previousCuentaLitros, setPreviousCuentaLitros] = useState<number | null>(null)
  const [varianceInfo, setVarianceInfo] = useState<{ expected?: number, movement?: number, variance?: number, valid?: boolean } | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const fetchEvidence = async () => {
      if (!transactionId || !isOpen) return
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('diesel_evidence')
          .select('id, photo_url, description, category, created_at, metadata')
          .eq('transaction_id', transactionId)
          .order('created_at', { ascending: true })

        if (error) {
          // Silent fail; UI shows empty state
          console.error('Error loading evidence:', error)
          setEvidence([])
          return
        }

        const items = (data as EvidenceRow[] | null)?.map(row => ({
          id: row.id,
          url: row.photo_url,
          description: row.description || 'Evidencia',
          category: row.category || 'other',
          uploaded_at: row.created_at,
          metadata: isDieselEvidenceImageMetadata(row.metadata) ? row.metadata : null,
        })) || []

        setEvidence(items)
      } finally {
        setLoading(false)
      }
    }

    fetchEvidence()
  }, [transactionId, isOpen])

  useEffect(() => {
    const fetchAudit = async () => {
      if (!transactionId || !isOpen) return
      try {
        setAuditLoading(true)
        // 1) Load transaction core fields
        const { data: tx, error: txErr } = await supabase
          .from('diesel_transactions')
          .select('id, warehouse_id, transaction_type, transaction_date, quantity_liters, cuenta_litros')
          .eq('id', transactionId)
          .single()

        if (txErr) {
          console.error('Audit: load tx error', txErr)
          setTxDetail(null)
          setWarehouseMeta(null)
          setPreviousCuentaLitros(null)
          setVarianceInfo(null)
          return
        }
        setTxDetail(tx as TxDetail)

        // 2) Load warehouse meta (has_cuenta_litros)
        const { data: wh, error: whErr } = await supabase
          .from('diesel_warehouses')
          .select('id, has_cuenta_litros')
          .eq('id', (tx as TxDetail).warehouse_id)
          .single()
        if (whErr) {
          console.error('Audit: load warehouse error', whErr)
          setWarehouseMeta(null)
        } else {
          setWarehouseMeta(wh as WarehouseMeta)
        }

        // 3) Load previous cuenta litros from previous transaction for same warehouse (by date)
        let prevCuenta: number | null = null
        const { data: prevTx, error: prevErr } = await supabase
          .from('diesel_transactions')
          .select('id, cuenta_litros, transaction_date')
          .eq('warehouse_id', (tx as TxDetail).warehouse_id)
          .lt('transaction_date', (tx as TxDetail).transaction_date)
          .not('cuenta_litros', 'is', null)
          .order('transaction_date', { ascending: false })
          .limit(1)

        if (prevErr) {
          console.error('Audit: load prev cuenta error', prevErr)
        }
        if (prevTx && prevTx.length > 0) {
          prevCuenta = prevTx[0].cuenta_litros as number | null
        }
        setPreviousCuentaLitros(prevCuenta)

        // 4) Compute variance for consumption only and when data present
        if ((tx as TxDetail).transaction_type === 'consumption' && wh?.has_cuenta_litros && prevCuenta != null && (tx as TxDetail).cuenta_litros != null) {
          const quantity = (tx as TxDetail).quantity_liters
          const actual = (tx as TxDetail).cuenta_litros as number
          const expected = prevCuenta + quantity
          const movement = actual - prevCuenta
          const variance = Math.abs(movement - quantity)
          const valid = variance <= 2
          setVarianceInfo({ expected, movement, variance, valid })
        } else {
          setVarianceInfo(null)
        }
      } finally {
        setAuditLoading(false)
      }
    }

    fetchAudit()
  }, [transactionId, isOpen])

  const primaryExifMeta =
    evidence.map((e) => e.metadata).find((m) => m != null) ?? null
  const timeComparison =
    txDetail?.transaction_type === "consumption" && txDetail.transaction_date
      ? comparePhotoTimeToTransaction(txDetail.transaction_date, primaryExifMeta)
      : null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[96vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{headerTitle}</DialogTitle>
          {subheader && (
            <DialogDescription>
              {subheader}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Audit panel */}
            <div className="mb-4 p-3 rounded-lg border bg-gray-50">
              {auditLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculando auditoría...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Cuenta litros (actual)</div>
                    <div className="font-medium">{txDetail?.cuenta_litros ?? 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cuenta litros (previa)</div>
                    <div className="font-medium">{previousCuentaLitros ?? 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Movimiento medidor</div>
                    <div className="font-medium">{varianceInfo?.movement != null ? `${varianceInfo.movement.toFixed(1)}L` : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cantidad registrada</div>
                    <div className="font-medium">{txDetail ? `${txDetail.quantity_liters.toFixed(1)}L` : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Esperado (prev + cantidad)</div>
                    <div className="font-medium">{varianceInfo?.expected != null ? `${varianceInfo.expected.toFixed(1)}L` : 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Varianza</div>
                    <div className={`font-medium ${varianceInfo ? (varianceInfo.valid ? 'text-green-700' : 'text-orange-700') : 'text-muted-foreground'}`}>
                      {varianceInfo?.variance != null ? `${varianceInfo.variance.toFixed(1)}L ${varianceInfo.valid ? '✓ dentro de tolerancia' : '⚠️ requiere validación'}` : (warehouseMeta?.has_cuenta_litros ? 'No disponible' : 'Sin cuenta litros')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* EXIF / executive: registered time vs camera capture */}
            {timeComparison && (
              <div className="mb-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />
                  Auditoría: hora registrada vs. foto (EXIF)
                </div>
                <Alert
                  className={cn(
                    timeComparison.severity === "aligned" && "border-green-200 bg-green-50/80",
                    timeComparison.severity === "minor" && "border-amber-200 bg-amber-50/80",
                    timeComparison.severity === "major" && "border-red-200 bg-red-50/80",
                    timeComparison.severity === "unknown" && "border-slate-200 bg-slate-50/80"
                  )}
                >
                  <AlertTitle className="flex flex-wrap items-center gap-2 text-sm">
                    <span>Comparación de tiempos</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs font-medium",
                        timeComparison.severity === "aligned" && "bg-green-100 text-green-900",
                        timeComparison.severity === "minor" && "bg-amber-100 text-amber-900",
                        timeComparison.severity === "major" && "bg-red-100 text-red-900",
                        timeComparison.severity === "unknown" && "bg-slate-100 text-slate-800"
                      )}
                    >
                      {timeComparison.severity === "aligned" && "Coherente (≤15 min)"}
                      {timeComparison.severity === "minor" && "Revisar (16–120 min)"}
                      {timeComparison.severity === "major" && "Gran discrepancia (>120 min)"}
                      {timeComparison.severity === "unknown" && "Sin dato EXIF de hora"}
                    </Badge>
                    {timeComparison.deltaMinutes != null && (
                      <span className="text-muted-foreground font-normal">
                        Δ {timeComparison.deltaMinutes > 0 ? "+" : ""}
                        {timeComparison.deltaMinutes} min (foto − registro)
                      </span>
                    )}
                  </AlertTitle>
                  <AlertDescription className="text-sm space-y-2 mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">
                          Fecha/hora en la transacción
                        </div>
                        <div className="font-medium tabular-nums">{timeComparison.transactionLabel}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">
                          Fecha/hora según cámara (EXIF)
                        </div>
                        <div className="font-medium tabular-nums">
                          {timeComparison.photoLabel ?? "—"}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{timeComparison.hint}</p>
                    {primaryExifMeta?.exifError && (
                      <p className="text-xs text-muted-foreground">
                        Metadatos: {primaryExifMeta.exifError}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>

                {primaryExifMeta &&
                  (primaryExifMeta.camera?.make ||
                    primaryExifMeta.camera?.model ||
                    primaryExifMeta.gps?.latitude != null) && (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1.5 text-muted-foreground">
                      {(primaryExifMeta.camera?.make || primaryExifMeta.camera?.model) && (
                        <div>
                          <span className="font-medium text-foreground">Equipo / app: </span>
                          {[primaryExifMeta.camera.make, primaryExifMeta.camera.model]
                            .filter(Boolean)
                            .join(" · ")}
                          {primaryExifMeta.camera.software
                            ? ` · ${primaryExifMeta.camera.software}`
                            : ""}
                        </div>
                      )}
                      {primaryExifMeta.gps &&
                        (primaryExifMeta.gps.latitude != null ||
                          primaryExifMeta.gps.longitude != null) && (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>
                              GPS foto:{" "}
                              <span className="font-mono text-foreground">
                                {primaryExifMeta.gps.latitude?.toFixed(5) ?? "—"},{" "}
                                {primaryExifMeta.gps.longitude?.toFixed(5) ?? "—"}
                              </span>
                              {primaryExifMeta.gps.altitude != null && (
                                <span> · alt. {primaryExifMeta.gps.altitude.toFixed(1)} m</span>
                              )}
                            </span>
                          </div>
                        )}
                      {primaryExifMeta.exifReaderVersion && (
                        <div className="pt-1 border-t border-border/60 text-[10px]">
                          EXIF leído con ExifReader {primaryExifMeta.exifReaderVersion}
                          {primaryExifMeta.extractedAt
                            ? ` · extracción ${new Date(primaryExifMeta.extractedAt).toLocaleString("es-MX")}`
                            : ""}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            )}

            {/* Evidence grid */}
            <EvidenceViewer
              evidence={evidence.map(
                ({ id, url, description, category, uploaded_at }) => ({
                  id,
                  url,
                  description,
                  category,
                  uploaded_at,
                })
              )}
              title={evidence.length > 0 ? undefined : 'Evidencia'}
              showCategories
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}


