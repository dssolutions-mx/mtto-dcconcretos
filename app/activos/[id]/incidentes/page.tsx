'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

interface IncidentPageProps {
  params: Promise<{
    id: string
  }>
}

export default function IncidentPage({ params }: IncidentPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;

  useEffect(() => {
    router.replace(`/incidentes?assetId=${assetId}`);
  }, [router, assetId]);

  return (
    <DashboardShell>
      <DashboardHeader heading="Redirigiendo..." text="Cargando incidentes del activo" />
    </DashboardShell>
  );
} 