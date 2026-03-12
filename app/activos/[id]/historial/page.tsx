"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AssetHistoryTimeline, type FilterType } from "@/components/assets/asset-history-timeline";
import { AssetHistoryMetricsSection } from "@/components/assets/asset-history-metrics-section";
import { ArrowLeft } from "lucide-react";
import { useAsset, useMaintenanceHistory, useIncidents } from "@/hooks/useSupabase";

const VALID_TYPE_PARAMS = ["pm", "correctivo", "inspeccion", "all"] as const;

function parseTypeParam(value: string | null): FilterType {
  if (value && VALID_TYPE_PARAMS.includes(value as FilterType)) {
    return value as FilterType;
  }
  return "all";
}

export default function AssetHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  const router = useRouter();
  const searchParams = useSearchParams();

  const { asset, loading } = useAsset(assetId);
  const { history: maintenanceHistory, loading: maintenanceLoading } = useMaintenanceHistory(assetId);
  const { incidents, loading: incidentsLoading } = useIncidents(assetId);

  const [filter, setFilter] = useState<FilterType>(() =>
    parseTypeParam(searchParams.get("type"))
  );

  useEffect(() => {
    setFilter(parseTypeParam(searchParams.get("type")));
  }, [searchParams]);

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    const path = `/activos/${assetId}/historial`;
    const url = newFilter === "all" ? path : `${path}?type=${newFilter}`;
    router.replace(url, { scroll: false });
  };

  return (
    <DashboardShell>
      <DashboardHeader
        heading={loading ? "Cargando historial..." : `Historial del Activo: ${asset?.name || assetId}`}
        text="Historial de mantenimientos, incidentes y métricas asociadas."
      >
        <Button variant="outline" asChild>
          <Link href={`/activos/${assetId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>

      <div className="space-y-6">
        <AssetHistoryTimeline
          assetId={assetId}
          maintenanceHistory={maintenanceHistory ?? []}
          incidents={incidents ?? []}
          filter={filter}
          onFilterChange={handleFilterChange}
          isLoading={maintenanceLoading || incidentsLoading}
        />

        <AssetHistoryMetricsSection maintenanceHistory={maintenanceHistory ?? []} />
      </div>
    </DashboardShell>
  );
}
