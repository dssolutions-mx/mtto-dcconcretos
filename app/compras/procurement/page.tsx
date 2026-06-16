import type { Metadata } from "next"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase-server"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ComprasProcurementWorkspace } from "@/components/compras/procurement/ComprasProcurementWorkspace"
import { Loader2 } from "lucide-react"

export const metadata: Metadata = {
  title: "Compras post-aprobación | Sistema de Gestión de Mantenimiento",
  description:
    "Espacio de trabajo de compras post-aprobación: facturas de proveedor, cuentas por pagar y pagos parciales.",
}

async function ProcurementPageContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let canRecordPayments = false
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    canRecordPayments =
      profile?.role === "GERENCIA_GENERAL" || profile?.role === "AREA_ADMINISTRATIVA"
  }

  return <ComprasProcurementWorkspace canRecordPayments={canRecordPayments} />
}

export default function ComprasProcurementPage() {
  return (
    <DashboardShell>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando espacio de compras...
          </div>
        }
      >
        <ProcurementPageContent />
      </Suspense>
    </DashboardShell>
  )
}
