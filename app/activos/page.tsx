'use client';

import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AssetsList } from "@/components/assets/assets-list"
import { FileDown, FileUp, PlusCircle } from "lucide-react"
import { useAssets } from '@/hooks/useSupabase';
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function AssetsPage() {
  const { assets, loading, error, refetch } = useAssets();
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Gestión de Activos"
        text="Administra tu inventario de equipos, documentación técnica y garantías."
      >
        <div className="flex gap-2">
          <Button variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline">
            <FileUp className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button asChild>
            <Link href="/activos/crear">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nuevo Activo
            </Link>
          </Button>
        </div>
      </DashboardHeader>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>Error al cargar los activos: {error.message}</AlertDescription>
        </Alert>
      )}
      <AssetsList assets={assets} isLoading={loading} onRefresh={refetch} />
    </DashboardShell>
  )
}
