'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { FleetTreeNode } from '@/types/fleet'
import { PendientesPanel } from './pendientes-panel'
import { TrustMeter } from './trust-meter'
import { HistorialTab } from './historial-tab'
import { DetallesTab } from './detalles-tab'
import { ConfianzaTab } from './confianza-tab'
import { SaludTab } from './salud-tab'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { canFleetEdit, type FleetActor } from '@/lib/fleet/fleet-api-auth'
import { fleetNodeKindLabel } from '@/lib/fleet/field-labels'
import { Badge } from '@/components/ui/badge'
import type { UseFleetQuickviewResult } from '@/hooks/useFleetQuickview'

export function FleetInspector({
  selectedNode,
  globalTrustPct,
  onRefresh,
  quickview,
}: {
  selectedNode: FleetTreeNode | null
  globalTrustPct: number | null
  onRefresh: () => void
  quickview: UseFleetQuickviewResult
}) {
  const { profile } = useAuthZustand()
  const actor: FleetActor | null = profile
    ? {
        id: profile.id,
        role: profile.role,
        plant_id: profile.plant_id ?? null,
        business_unit_id: profile.business_unit_id ?? null,
      }
    : null
  const canEdit = actor != null && canFleetEdit(actor)

  if (!selectedNode || selectedNode.kind === 'root') {
    return (
      <div className="flex h-full flex-col gap-4 border-l border-border bg-muted/20 p-4">
        <div>
          <h3 className="text-sm font-medium">Resumen de confianza</h3>
          <TrustMeter value={globalTrustPct} />
        </div>
        <PendientesPanel />
        <div>
          <h3 className="text-sm font-medium">Últimos cambios</h3>
          <HistorialTab assetId={null} />
        </div>
      </div>
    )
  }

  const assetId =
    selectedNode.kind === 'asset'
      ? (selectedNode.payload?.assetId as string | undefined)
      : null

  const isAsset = selectedNode.kind === 'asset' && assetId

  return (
    <div className="flex h-full min-h-[320px] flex-col border-l border-border bg-background">
      <div className="border-b border-border bg-muted/10 px-3 py-3">
        {isAsset ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-normal">
                {fleetNodeKindLabel('asset')}
              </Badge>
              <span className="truncate text-sm font-semibold leading-tight">
                {selectedNode.label}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Confianza en árbol · {selectedNode.trust_pct}% — ver desglose en Confianza
            </p>
          </>
        ) : (
          <>
            <Badge variant="secondary" className="mb-1 text-[10px] font-normal">
              {fleetNodeKindLabel(selectedNode.kind)}
            </Badge>
            <p className="truncate font-medium">{selectedNode.label}</p>
            <p className="text-xs text-muted-foreground">
              {selectedNode.count} activos · confianza agregada {selectedNode.trust_pct}%
            </p>
          </>
        )}
      </div>
      <Tabs defaultValue="salud" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-2 mt-2 grid h-auto w-auto grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="salud" className="text-[11px] sm:text-xs">
            Salud
          </TabsTrigger>
          <TabsTrigger value="detalles" className="text-[11px] sm:text-xs">
            Detalles
          </TabsTrigger>
          <TabsTrigger value="confianza" className="text-[11px] sm:text-xs">
            Confianza
          </TabsTrigger>
          <TabsTrigger value="historial" className="text-[11px] sm:text-xs">
            Historial
          </TabsTrigger>
        </TabsList>
        <ScrollArea className="min-h-0 flex-1 px-3">
          <TabsContent value="salud" className="mt-2">
            {assetId ? (
              <SaludTab
                assetId={assetId}
                canEdit={canEdit}
                onVerified={onRefresh}
                quickview={quickview}
              />
            ) : (
              <p className="pb-4 text-xs text-muted-foreground">
                Seleccione un activo para ver salud operativa (preventivo, incidentes,
                checklists).
              </p>
            )}
          </TabsContent>
          <TabsContent value="detalles" className="mt-2 pb-4">
            <DetallesTab
              key={assetId ?? 'no-asset'}
              assetId={assetId}
              node={selectedNode}
              canEdit={canEdit}
              onSaved={onRefresh}
            />
          </TabsContent>
          <TabsContent value="confianza" className="mt-2 pb-4">
            <ConfianzaTab
              assetId={assetId}
              node={selectedNode}
              canEdit={canEdit}
              onVerified={onRefresh}
            />
          </TabsContent>
          <TabsContent value="historial" className="mt-2 pb-4">
            <HistorialTab assetId={assetId} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
