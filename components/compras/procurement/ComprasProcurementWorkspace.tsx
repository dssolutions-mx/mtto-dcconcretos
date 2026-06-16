"use client"

import { useCallback, useEffect, useMemo, useState, startTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Receipt,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { PROCUREMENT_TABS, type ProcurementTab } from "@/types/po-invoices"
import { ProcurementDashboardTab } from "./ProcurementDashboardTab"
import { PoWithoutInvoiceTab } from "./PoWithoutInvoiceTab"
import { PoInvoicesPayablesTab } from "./PoInvoicesPayablesTab"
import { PoPostApprovalTab } from "./PoPostApprovalTab"

function parseTab(raw: string | null): ProcurementTab {
  if (raw && PROCUREMENT_TABS.includes(raw as ProcurementTab)) return raw as ProcurementTab
  return "resumen"
}

interface ComprasProcurementWorkspaceProps {
  canRecordPayments?: boolean
}

const TAB_CONFIG: Array<{
  key: ProcurementTab
  label: string
  icon: React.ElementType
}> = [
  { key: "resumen", label: "Resumen", icon: LayoutDashboard },
  { key: "sin_factura", label: "Sin factura", icon: FileText },
  { key: "facturas", label: "Facturas / CxP", icon: Receipt },
  { key: "post_aprobacion", label: "Post-aprobación", icon: ClipboardList },
]

export function ComprasProcurementWorkspace({
  canRecordPayments = false,
}: ComprasProcurementWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [plants, setPlants] = useState<Array<{ id: string; name: string }>>([])
  const [plantId, setPlantId] = useState("")

  const tabFromUrl = useMemo(() => parseTab(searchParams.get("tab")), [searchParams])
  const [optimisticTab, setOptimisticTab] = useState<ProcurementTab | null>(null)
  const activeTab = optimisticTab ?? tabFromUrl

  useEffect(() => {
    if (!optimisticTab) return
    if (tabFromUrl === optimisticTab) setOptimisticTab(null)
  }, [tabFromUrl, optimisticTab])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/plants")
        const json = await res.json()
        if (json.plants) setPlants(json.plants)
      } catch {
        /* plants optional */
      }
    })()
  }, [])

  const setTab = useCallback(
    (tab: ProcurementTab) => {
      if (tab === activeTab) return
      setOptimisticTab(tab)
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", tab)
      const q = params.toString()
      startTransition(() => {
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
      })
    },
    [activeTab, pathname, router, searchParams],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
            <Link href="/compras">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver a compras
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Compras post-aprobación
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestión contable de OC aprobadas: comprobantes, facturas de proveedor y pagos.
            </p>
          </div>
        </div>
        <Select value={plantId || "__all__"} onValueChange={(v) => setPlantId(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todas las plantas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las plantas</SelectItem>
            {plants.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-1">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition",
              activeTab === key
                ? "border-b-2 border-primary text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "resumen" && (
        <ProcurementDashboardTab
          plantId={plantId || undefined}
          onNavigateTab={(tab) => setTab(parseTab(tab))}
        />
      )}
      {activeTab === "sin_factura" && (
        <PoWithoutInvoiceTab plantId={plantId || undefined} />
      )}
      {activeTab === "facturas" && (
        <PoInvoicesPayablesTab
          plantId={plantId || undefined}
          canRecordPayments={canRecordPayments}
        />
      )}
      {activeTab === "post_aprobacion" && (
        <PoPostApprovalTab plantId={plantId || undefined} />
      )}
    </div>
  )
}
