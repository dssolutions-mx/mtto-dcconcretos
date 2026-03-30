"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ConsumptionEntryForm } from "@/components/diesel-inventory/consumption-entry-form"
import { Loader2 } from "lucide-react"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function ConsumptionPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const wh = searchParams.get("warehouseId")
  const initialWarehouseId = wh && UUID_RE.test(wh) ? wh : null

  const handleSuccess = () => {
    router.push("/urea")
  }

  const handleCancel = () => {
    router.push("/urea")
  }

  return (
    <DashboardShell className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-12">
      <DashboardHeader
        heading="Registrar consumo de urea"
        text="Captura el consumo con evidencia fotográfica y validación automática."
      />

      <div className="max-w-2xl mx-auto w-full">
        <ConsumptionEntryForm
          productType="urea"
          initialWarehouseId={initialWarehouseId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </DashboardShell>
  )
}

export default function ConsumptionPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell className="px-4 sm:px-6 lg:px-8">
          <DashboardHeader
            heading="Registrar consumo de urea"
            text="Cargando formulario..."
          />
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DashboardShell>
      }
    >
      <ConsumptionPageContent />
    </Suspense>
  )
}
