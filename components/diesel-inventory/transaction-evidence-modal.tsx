"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { EvidenceViewer } from "@/components/ui/evidence-viewer"

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
          .select('id, photo_url, description, category, created_at')
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
          uploaded_at: row.created_at
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

            {/* Evidence grid */}
            <EvidenceViewer
              evidence={evidence}
              title={evidence.length > 0 ? undefined : 'Evidencia'}
              showCategories
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}


