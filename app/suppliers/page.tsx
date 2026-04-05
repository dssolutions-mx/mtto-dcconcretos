"use client"

import Link from "next/link"
import { BarChart3 } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Button } from "@/components/ui/button"
import { SupplierRegistry } from "@/components/suppliers/SupplierRegistry"
import { useIsMobile } from "@/hooks/use-mobile"

export default function SuppliersPage() {
  const isMobile = useIsMobile()

  return (
    <DashboardShell>
      {isMobile ? (
        <>
          <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-4 bg-background/95 backdrop-blur border-b md:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold truncate">Padrón de Proveedores</h1>
                <p className="text-xs text-muted-foreground truncate">
                  Evalúa, verifica y certifica proveedores; enlaza con compras y análisis
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/suppliers/analytics" aria-label="Análisis de proveedores">
                  <BarChart3 className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <SupplierRegistry />
        </>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <DashboardHeader
              heading="Padrón de Proveedores"
              text="Evalúa, verifica y certifica proveedores; enlaza con compras y análisis"
              id="suppliers-header"
            />
            <Button variant="outline" asChild className="w-full md:w-auto shrink-0">
              <Link href="/suppliers/analytics">
                <BarChart3 className="mr-2 h-4 w-4" />
                Análisis
              </Link>
            </Button>
          </div>
          <SupplierRegistry />
        </>
      )}
    </DashboardShell>
  )
}
