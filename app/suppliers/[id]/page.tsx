"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { notFound, useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { SupplierForm } from "@/components/suppliers/SupplierForm"
import { createClient } from "@/lib/supabase"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import type { Supplier } from "@/types/suppliers"

const SupplierDetails = dynamic(
  () => import("@/components/suppliers/SupplierDetails").then((m) => ({ default: m.SupplierDetails })),
  { ssr: false, loading: () => <Skeleton className="h-[min(80vh,560px)] w-full rounded-xl" /> }
)

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const { hasWriteAccess } = useAuthZustand()
  const canVerify = hasWriteAccess("purchases")

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.from("suppliers").select("*").eq("id", id).single()
    if (error || !data) {
      setSupplier(null)
    } else {
      setSupplier(data as Supplier)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!loading && !supplier) {
    notFound()
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="outline" size="icon" className="shrink-0 mt-0.5" asChild>
            <Link href="/suppliers" aria-label="Volver al padrón">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <DashboardHeader
            heading={supplier?.name ?? "Proveedor"}
            text="Expediente, verificación y desempeño"
            id="supplier-detail-header"
          />
        </div>
        <Button variant="outline" asChild className="w-full md:w-auto shrink-0">
          <Link href="/suppliers/analytics">Análisis de Proveedores</Link>
        </Button>
      </div>

      {loading || !supplier ? (
        <Skeleton className="h-[min(80vh,560px)] w-full rounded-xl" />
      ) : (
        <SupplierDetails
          supplier={supplier}
          showVerificationPanel
          canVerifyPurchases={canVerify}
          onEdit={canVerify ? () => setEditOpen(true) : undefined}
        />
      )}

      {canVerify && supplier && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar proveedor</DialogTitle>
              <DialogDescription>Actualiza datos fiscales, contacto y condiciones.</DialogDescription>
            </DialogHeader>
            <SupplierForm
              supplier={supplier}
              onSuccess={() => {
                setEditOpen(false)
                void load()
              }}
              onCancel={() => setEditOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </DashboardShell>
  )
}
