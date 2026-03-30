"use client"

import { DieselEntryForm } from "@/components/diesel-inventory/diesel-entry-form"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { useRouter } from "next/navigation"

export default function DieselEntryPage() {
  const router = useRouter()

  return (
    <DashboardShell className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-12">
      <DashboardHeader
        heading="Registrar entrada de diesel"
        text="Entrada de producto al almacén con costo y evidencia si aplica."
      />
      <div className="max-w-4xl mx-auto w-full">
        <DieselEntryForm
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
