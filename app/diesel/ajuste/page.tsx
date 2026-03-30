"use client"

import { DieselAdjustmentForm } from "@/components/diesel-inventory/diesel-adjustment-form"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { useRouter } from "next/navigation"

export default function DieselAdjustmentPage() {
  const router = useRouter()

  return (
    <DashboardShell className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-12">
      <DashboardHeader
        heading="Ajuste de inventario"
        text="Corrección de saldo en almacén con motivo documentado."
      />
      <div className="max-w-4xl mx-auto w-full">
        <DieselAdjustmentForm
          productType="diesel"
          onSuccess={() => {
            router.push("/diesel")
          }}
          onCancel={() => router.back()}
        />
      </div>
    </DashboardShell>
  )
}
