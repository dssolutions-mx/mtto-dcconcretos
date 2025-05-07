'use client';

import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AssetHistory } from "@/components/assets/asset-history";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAsset } from "@/hooks/useSupabase";

export default function AssetHistoryPage({ params }: { params: { id: string } }) {
  const assetId = params.id;
  
  // Fetch the asset name to display in the heading
  const { asset, loading } = useAsset(assetId);

  return (
    <DashboardShell>
      <DashboardHeader
        heading={loading ? `Cargando historial...` : `Historial del Activo: ${asset?.name || assetId}`}
        text="Historial completo de mantenimientos, incidentes, reemplazos de partes y costos asociados."
      >
        <Button variant="outline" asChild>
          <Link href={`/activos/${assetId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      <AssetHistory id={assetId} />
    </DashboardShell>
  );
}
