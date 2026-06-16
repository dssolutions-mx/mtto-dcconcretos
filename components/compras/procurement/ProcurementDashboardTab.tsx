"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProcurementActionQueueItem, ProcurementDashboard } from "@/types/po-invoices"
import { formatMxCurrency } from "@/lib/ap/po-invoice-utils"

interface ProcurementDashboardTabProps {
  plantId?: string
  onNavigateTab: (tab: string) => void
}

function KpiCard({
  label,
  value,
  sub,
  tone = "default",
  onClick,
}: {
  label: string
  value: string | number
  sub?: string
  tone?: "default" | "warning" | "danger"
  onClick?: () => void
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : "border-border/60"

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${toneClass} ${
        onClick ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </button>
  )
}

export function ProcurementDashboardTab({ plantId, onNavigateTab }: ProcurementDashboardTabProps) {
  const [dashboard, setDashboard] = useState<ProcurementDashboard | null>(null)
  const [queue, setQueue] = useState<ProcurementActionQueueItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = plantId ? `?plant_id=${plantId}` : ""
      const [dashRes, queueRes] = await Promise.all([
        fetch(`/api/compras/procurement/dashboard${qs}`),
        fetch(`/api/compras/procurement/action-queue${qs}`),
      ])
      const dashJson = await dashRes.json()
      const queueJson = await queueRes.json()
      if (dashJson.success) setDashboard(dashJson.dashboard)
      if (queueJson.success) setQueue(queueJson.items)
    } finally {
      setLoading(false)
    }
  }, [plantId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando resumen de compras post-aprobación...
      </div>
    )
  }

  if (!dashboard) {
    return <p className="text-center text-muted-foreground py-8">No se pudo cargar el resumen.</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sin factura"
          value={dashboard.sin_factura_count}
          sub={formatMxCurrency(dashboard.sin_factura_amount)}
          tone={dashboard.sin_factura_count > 0 ? "warning" : "default"}
          onClick={() => onNavigateTab("sin_factura")}
        />
        <KpiCard
          label="CxP abierta"
          value={dashboard.open_invoices_count}
          sub={formatMxCurrency(dashboard.open_invoices_balance)}
          onClick={() => onNavigateTab("facturas")}
        />
        <KpiCard
          label="Vencidas"
          value={dashboard.overdue_count}
          sub={formatMxCurrency(dashboard.overdue_balance)}
          tone={dashboard.overdue_count > 0 ? "danger" : "default"}
          onClick={() => onNavigateTab("facturas")}
        />
        <KpiCard
          label="Post-aprobación"
          value={dashboard.post_approval_pending_count}
          sub={`${dashboard.partially_paid_count} pagos parciales`}
          onClick={() => onNavigateTab("post_aprobacion")}
        />
      </div>

      <Card className="rounded-2xl border border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cola de acciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {queue.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              No hay acciones pendientes en compras post-aprobación.
            </div>
          ) : (
            queue.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    <Badge
                      variant={item.priority === "high" ? "destructive" : "outline"}
                      className="text-[10px]"
                    >
                      {item.priority === "high" ? "Alta" : item.priority === "medium" ? "Media" : "Baja"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  {item.amount != null && (
                    <p className="text-sm font-semibold">{formatMxCurrency(item.amount)}</p>
                  )}
                  {item.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Vence: {format(new Date(item.due_date), "dd/MM/yyyy", { locale: es })}
                    </p>
                  )}
                </div>
                {item.purchase_order_id && (
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link href={`/compras/${item.purchase_order_id}`}>
                      Ver OC
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function PoLifecycleStrip({ purchaseOrderId }: { purchaseOrderId: string }) {
  const [steps, setSteps] = useState<
    Array<{ key: string; label: string; done: boolean; count?: number }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/purchase-orders/${purchaseOrderId}/lifecycle`)
        const json = await res.json()
        if (json.success) {
          const lifecycle = json.lifecycle
          setSteps(Array.isArray(lifecycle) ? lifecycle : (lifecycle?.steps ?? []))
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [purchaseOrderId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Cargando ciclo contable...
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((step) => (
        <div
          key={step.key}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
            step.done
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-border/60 bg-muted/30 text-muted-foreground"
          }`}
        >
          {step.done ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <Circle className="h-3 w-3" />
          )}
          {step.label}
          {step.count != null && step.count > 0 && (
            <span className="font-semibold">({step.count})</span>
          )}
        </div>
      ))}
      {steps.some((s) => s.key === "invoice" && !s.done && steps.some((r) => r.key === "receipt" && r.done)) && (
        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle className="h-3 w-3" />
          Comprobante sin factura fiscal
        </span>
      )}
    </div>
  )
}
