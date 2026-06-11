'use client';

import { useState, useMemo, useEffect, use } from "react";
import { useAsset, useMaintenanceHistory, useIncidents } from "@/hooks/useSupabase";
import { useAuthZustand } from "@/hooks/use-auth-zustand";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BreadcrumbSetter } from "@/components/navigation/breadcrumb-setter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AssetWithModel, EquipmentModel } from "@/types";
import { createClient } from "@/lib/supabase";
import { CreateCompositeAssetDialog } from "@/components/assets/dialogs/create-composite-asset-dialog"
import { IncidentRegistrationDialog } from "@/components/assets/dialogs/incident-registration-dialog"
import { CompositeCouplingEditor } from "@/components/assets/composite-coupling-editor"
import { CompositeFuelSummary } from "@/components/assets/composite-fuel-summary"
import {
  AssetDetailHeader,
  AssetDetailKpis,
  AssetDetailActions,
} from "@/components/assets/activos-detail"
import { StatusMaintenanceTab } from "@/components/assets/activos-detail/tabs/status-maintenance-tab"
import { IncidentsChecklistsTab } from "@/components/assets/activos-detail/tabs/incidents-checklists-tab"
import { TechnicalInfoTab } from "@/components/assets/activos-detail/tabs/technical-info-tab"
import { DocumentationTab } from "@/components/assets/activos-detail/tabs/documentation-tab"
import { 
  getMaintenanceUnit,
  getRawModelMaintenanceUnit,
  getCurrentValue, 
  formatIntervalLabel,
  type MaintenanceUnit 
} from "@/lib/utils/maintenance-units";
import {
  computeCyclicIntervalResults,
  computeCyclicIntervalResultsForAsset,
  cyclicResultsToUpcomingUi,
  isActionableCyclicScheduleRow,
  type CyclicMaintenanceStatus,
} from "@/lib/utils/cyclic-maintenance";
import { expandAssetIdsForOperatorChecklists } from "@/lib/composite-operator-scope";

function sortUpcomingMaintenances(list: Array<{
  status: string;
  urgency?: string;
  targetValue?: number | null;
  intervalValue?: number | null;
}>) {
  const statusPriority = { overdue: 4, upcoming: 3, scheduled: 2, covered: 1 };
  const urgencyPriority = { high: 3, medium: 2, low: 1 };
  return [...list].sort((a, b) => {
    const priorityA = statusPriority[a.status as keyof typeof statusPriority] || 0;
    const priorityB = statusPriority[b.status as keyof typeof statusPriority] || 0;
    if (priorityA !== priorityB) return priorityB - priorityA;
    const urgencyA = urgencyPriority[a.urgency as keyof typeof urgencyPriority] || 0;
    const urgencyB = urgencyPriority[b.urgency as keyof typeof urgencyPriority] || 0;
    if (urgencyA !== urgencyB) return urgencyB - urgencyA;
    if (a.status === "overdue" && b.status === "overdue") {
      return (Number(a.targetValue) || 0) - (Number(b.targetValue) || 0);
    }
    return (Number(a.intervalValue) || 0) - (Number(b.intervalValue) || 0);
  });
}

function mapCompositeUpcomingRow(m: Record<string, unknown>, maintenanceUnit: MaintenanceUnit) {
  const target = Number(m.target_value) || 0;
  const current = Number(m.current_value) || 0;
  return {
    intervalId: m.interval_id,
    intervalName: m.interval_name,
    intervalDescription: m.interval_description,
    type: m.type,
    intervalValue: m.interval_value,
    currentValue: current,
    targetValue: target,
    valueRemaining: target - current,
    status: m.status,
    urgency: m.urgency,
    progress: target > 0 ? Math.round((current / target) * 100) : 0,
    unit: maintenanceUnit,
    estimatedDate: new Date().toISOString(),
    lastMaintenanceDate: null,
    wasPerformed: false,
    cycleForService: 0,
    cycleLength: 0,
  };
}

export default function AssetDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  
  const { asset: rawAsset, loading, error } = useAsset(assetId);
  const { history: maintenanceHistory, loading: maintenanceLoading } = useMaintenanceHistory(assetId);
  const { incidents, loading: incidentsLoading, refetch: refetchIncidents } = useIncidents(assetId);
  const { ui, profile } = useAuthZustand();
  const canEditCoupling = ['GERENCIA_GENERAL', 'GERENTE_MANTENIMIENTO', 'AREA_ADMINISTRATIVA'].includes(profile?.role ?? '');
  const [activeTab, setActiveTab] = useState("status");
  const [upcomingMaintenances, setUpcomingMaintenances] = useState<any[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [maintenanceIntervals, setMaintenanceIntervals] = useState<any[]>([]);
  const [completedChecklists, setCompletedChecklists] = useState<any[]>([]);
  const [checklistsLoading, setChecklistsLoading] = useState(true);
  const [pendingChecklists, setPendingChecklists] = useState<any[]>([]);
  const [pendingChecklistsLoading, setPendingChecklistsLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [workOrdersLoading, setWorkOrdersLoading] = useState(true);
  const [poByWorkOrder, setPoByWorkOrder] = useState<Record<string, any>>({});
  const [poLoading, setPoLoading] = useState<boolean>(false);
  // Aggregated maintenance history when part of a composite
  const [combinedMaintenanceHistory, setCombinedMaintenanceHistory] = useState<any[] | null>(null);
  // Composite context
  const [compositeContext, setCompositeContext] = useState<{ composite: any | null; components: any[]; sibling_drift: Record<string, { hours_stale: boolean; km_stale: boolean }> }>({ composite: null, components: [], sibling_drift: {} });
  const [compositeFuelSummary, setCompositeFuelSummary] = useState<{
    diesel_liters_30d: number;
    urea_liters_30d: number;
    recent_transactions: any[];
  } | null>(null);
  const [compositeLoading, setCompositeLoading] = useState(false);
  const [openCreateComposite, setOpenCreateComposite] = useState(false);
  const [reportIncidentOpen, setReportIncidentOpen] = useState(false);
  const [maintenanceUnit, setMaintenanceUnit] = useState<MaintenanceUnit>('hours');
  
  // Map the asset with equipment_models to use model property
  const asset = useMemo(() => {
    if (!rawAsset) return null;
    
    const assetWithModel: AssetWithModel = {
      ...rawAsset,
      model: (rawAsset as any).equipment_models as EquipmentModel
    };
    
    return assetWithModel;
  }, [rawAsset]);

  // Detect maintenance unit from asset model
  useEffect(() => {
    if (asset) {
      const unit = getMaintenanceUnit(asset);
      setMaintenanceUnit(unit);
    }
  }, [asset]);

  const breadcrumbItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Activos", href: "/activos" },
    { label: asset?.asset_id || asset?.name || "Detalle" },
  ];
  
  // Load maintenance intervals for this equipment model
  useEffect(() => {
    if (asset?.model_id) {
      const fetchMaintenanceIntervals = async () => {
        try {
          const supabase = createClient();
          
          const { data, error } = await supabase
            .from("maintenance_intervals")
            .select(`
              *,
              maintenance_tasks(*)
            `)
            .eq("model_id", asset.model_id!);
            
          if (error) throw error;
          setMaintenanceIntervals(data || []);
        } catch (err) {
          console.error("Error fetching maintenance intervals:", err);
        }
      };
      
      fetchMaintenanceIntervals();
    }
  }, [asset?.model_id]);
  
  // Load composite context (composite and its components, or parent composite if this is a component)
  useEffect(() => {
    const fetchCompositeContext = async () => {
      try {
        if (!assetId) return;
        setCompositeLoading(true);
        const supabase = createClient();

        // Fetch minimal fields to detect composite
        const { data: a, error: aErr } = await supabase
          .from('assets')
          .select('id, name, is_composite, component_assets, primary_component_id, composite_sync_hours, composite_sync_kilometers')
          .eq('id', assetId)
          .single();
        if (aErr || !a) {
          setCompositeContext({ composite: null, components: [], sibling_drift: {} });
          return;
        }

        // If this asset is a composite, load its components and aggregate dashboard
        if ((a as any).is_composite) {
          let components: any[] = [];
          let aggregatedIncidents: any[] = [];
          let aggregatedPending: any[] = [];
          let aggregatedCompleted: any[] = [];
          let aggregatedMaintenance: any[] = [];
          let aggregatedUpcoming: any[] = [];
          let siblingDrift: Record<string, { hours_stale: boolean; km_stale: boolean }> = {};
          try {
            const resp = await fetch(`/api/assets/composites/${assetId}/dashboard`);
            if (resp.ok) {
              const json = await resp.json();
              components = json?.data?.components || [];
              aggregatedIncidents = json?.data?.incidents || [];
              aggregatedPending = json?.data?.pending_schedules || [];
              aggregatedCompleted = json?.data?.completed_checklists || [];
              aggregatedMaintenance = json?.data?.maintenance_history || [];
              aggregatedUpcoming = json?.data?.upcoming_maintenance || [];
              siblingDrift = json?.data?.sibling_drift || {};
              const fs = json?.data?.fuel_summary;
              if (fs) {
                setCompositeFuelSummary({
                  diesel_liters_30d: Number(fs.diesel_liters_30d ?? 0),
                  urea_liters_30d: Number(fs.urea_liters_30d ?? 0),
                  recent_transactions: fs.recent_transactions ?? [],
                });
              } else {
                setCompositeFuelSummary(null);
              }
            }
          } catch {}
          setCompositeContext({ composite: a, components, sibling_drift: siblingDrift });
          // Overwrite local page states with aggregated data when viewing composite
          try {
            (incidents as any).splice(0, (incidents as any).length, ...aggregatedIncidents);
          } catch {}
          // Pending/completed checklists: loaded via effects using composite-expanded asset IDs
          // Keep original hook data intact; store combined separately
          setCombinedMaintenanceHistory(aggregatedMaintenance);
          try {
            // Transform aggregated upcoming to page format if necessary
            const transformed = (aggregatedUpcoming || []).map((m: Record<string, unknown>) =>
              mapCompositeUpcomingRow(m, maintenanceUnit)
            );
            setUpcomingMaintenances(sortUpcomingMaintenances(transformed));
          } catch {}
          return;
        }

        // Otherwise, check if this asset is part of a composite
        const { data: rel } = await supabase
          .from('asset_composite_relationships')
          .select('composite_asset_id')
          .eq('component_asset_id', assetId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (!rel) {
          setCompositeContext({ composite: null, components: [], sibling_drift: {} });
          setCombinedMaintenanceHistory(null);
          return;
        }

        let composite: any = null;
        let components: any[] = [];
        let aggregatedIncidents: any[] = [];
        let aggregatedPending: any[] = [];
        let aggregatedCompleted: any[] = [];
        let aggregatedMaintenance: any[] = [];
        let aggregatedUpcoming: any[] = [];
        try {
          const resp = await fetch(`/api/assets/composites/${rel.composite_asset_id}/dashboard`);
          if (resp.ok) {
            const json = await resp.json();
            composite = json?.data?.composite || null;
            components = json?.data?.components || [];
            aggregatedIncidents = json?.data?.incidents || [];
            aggregatedPending = json?.data?.pending_schedules || [];
            aggregatedCompleted = json?.data?.completed_checklists || [];
            aggregatedMaintenance = json?.data?.maintenance_history || [];
            aggregatedUpcoming = json?.data?.upcoming_maintenance || [];
          }
        } catch {}
        setCompositeContext({ composite: composite, components, sibling_drift: {} });
        // When part of a composite, also surface aggregated lists in page widgets
        try {
          (incidents as any).splice(0, (incidents as any).length, ...aggregatedIncidents);
        } catch {}
        // Pending/completed checklists: loaded via effects (expanded composite scope)
        // Aggregated history for the history tab only — upcoming stays per-asset (ledger below).
        setCombinedMaintenanceHistory(aggregatedMaintenance);
      } catch (e) {
        console.error('Error loading composite context', e);
        setCompositeContext({ composite: null, components: [], sibling_drift: {} });
      } finally {
        setCompositeLoading(false);
      }
    };

    fetchCompositeContext();
  }, [assetId]);

  // Upcoming maintenances: one ledger path per asset (composite parent uses dashboard API only).
  useEffect(() => {
    const isCompositeParentView = Boolean((asset as { is_composite?: boolean })?.is_composite);

    if (isCompositeParentView) {
      setUpcomingLoading(compositeLoading);
      return;
    }

    if (maintenanceLoading || !maintenanceIntervals.length || !asset) {
      if (!maintenanceLoading) {
        setUpcomingMaintenances([]);
      }
      setUpcomingLoading(maintenanceLoading || !asset);
      return;
    }

    try {
      setUpcomingLoading(true);

      const currentValue = getCurrentValue(asset, maintenanceUnit);
      const rawUnit = getRawModelMaintenanceUnit(asset);

      const intervalResults =
        rawUnit === "both"
          ? computeCyclicIntervalResultsForAsset({
              intervals: maintenanceIntervals,
              history: maintenanceHistory,
              currentHours: Number(asset.current_hours) || 0,
              currentKilometers: Number(asset.current_kilometers) || 0,
              rawMaintenanceUnit: rawUnit,
            })
          : computeCyclicIntervalResults({
              intervals: maintenanceIntervals,
              history: maintenanceHistory,
              currentValue,
              unit: maintenanceUnit,
            });

      const upcomingList = cyclicResultsToUpcomingUi(intervalResults, maintenanceUnit);
      const cycleLength = Math.max(
        ...maintenanceIntervals.map((i) => Number(i.interval_value) || 0),
        1
      );
      const currentCycleNum = Math.floor(currentValue / cycleLength) + 1;

      const filteredUpcoming = upcomingList.filter((maintenance) =>
        isActionableCyclicScheduleRow(
          maintenance.status as CyclicMaintenanceStatus,
          maintenance.cycleForService ?? 1,
          currentCycleNum
        )
      );

      setUpcomingMaintenances(sortUpcomingMaintenances(filteredUpcoming));
    } catch (error) {
      console.error("Error calculating upcoming maintenances:", error);
      setUpcomingMaintenances([]);
    } finally {
      setUpcomingLoading(false);
    }
  }, [
    maintenanceIntervals,
    asset,
    maintenanceHistory,
    maintenanceLoading,
    maintenanceUnit,
    compositeLoading,
  ]);
  
  // Add a new effect to fetch completed checklists
  useEffect(() => {
    if (assetId) {
      const fetchCompletedChecklists = async () => {
        try {
          setChecklistsLoading(true)
          const supabase = createClient()

          const aggregateIds = await expandAssetIdsForOperatorChecklists(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- client vs server Supabase generic
            supabase as any,
            [assetId]
          )
          const filterIds = aggregateIds.length > 0 ? aggregateIds : [assetId]

          // Include related asset row so composite views show which part was inspected
          const { data, error } = await supabase
            .from('completed_checklists')
            .select(`
              id,
              checklist_id,
              asset_id,
              technician,
              completion_date,
              notes,
              status,
              equipment_hours_reading,
              equipment_kilometers_reading,
              created_by,
              checklists (
                id,
                name,
                frequency
              ),
              created_by_profile:profiles!created_by (
                id,
                nombre,
                apellido
              ),
              assets (
                id,
                name,
                asset_id
              )
            `)
            .in('asset_id', filterIds)
            .order('completion_date', { ascending: false })
            .limit(24)
          
          if (error) {
            console.error('Error fetching completed checklists:', error)
            setCompletedChecklists([])
          } else {
            // Transform the data to match the expected structure
            const transformedData = (data || []).map((item: any) => ({
              ...item,
              checklists: Array.isArray(item.checklists) ? item.checklists[0] : item.checklists,
              profiles: Array.isArray(item.created_by_profile) ? item.created_by_profile[0] : item.created_by_profile,
              assets: Array.isArray(item.assets) ? item.assets[0] : item.assets,
            }))
            setCompletedChecklists(transformedData)
          }
        } catch (err) {
          console.error("Error fetching completed checklists:", err)
          setCompletedChecklists([])
        } finally {
          setChecklistsLoading(false)
        }
      }
      
      fetchCompletedChecklists()
    }
  }, [assetId])
  
  // Fetch Purchase Orders for maintenance history work orders (prefer for cost display)
  useEffect(() => {
    const fetchPurchaseOrdersForHistory = async () => {
      try {
        setPoLoading(true)
        const supabase = createClient()
        const effectiveHistory = (combinedMaintenanceHistory ?? maintenanceHistory) || []
        // Limit to recent set to avoid heavy queries
        const recent = effectiveHistory.slice(0, 20)
        const workOrderIds = Array.from(new Set(recent.map((m: any) => m.work_order_id).filter(Boolean)))
        if (workOrderIds.length === 0) {
          setPoByWorkOrder({})
          return
        }
        const { data, error } = await supabase
          .from('purchase_orders')
          .select('id, work_order_id, total_amount, adjusted_total_amount, actual_amount, status')
          .in('work_order_id', workOrderIds as string[])
        if (error) {
          console.error('Error fetching purchase orders for history:', error)
          setPoByWorkOrder({})
          return
        }
        const map: Record<string, any> = {}
        ;(data || []).forEach((po: any) => {
          if (po?.work_order_id) {
            map[po.work_order_id] = po
          }
        })
        setPoByWorkOrder(map)
      } catch (e) {
        console.error('Unexpected error fetching purchase orders for history:', e)
        setPoByWorkOrder({})
      } finally {
        setPoLoading(false)
      }
    }
    fetchPurchaseOrdersForHistory()
  }, [assetId, combinedMaintenanceHistory, maintenanceHistory])
  
  // Add a new effect to fetch pending checklists
  useEffect(() => {
    if (assetId) {
      const fetchPendingChecklists = async () => {
        try {
          setPendingChecklistsLoading(true)
          
          const response = await fetch(`/api/checklists/schedules?status=pendiente&assetId=${assetId}`)
          if (response.ok) {
            const result = await response.json()
            setPendingChecklists(result.data || [])
          } else {
            console.error('Error fetching pending checklists:', response.statusText)
            setPendingChecklists([])
          }
        } catch (err) {
          console.error("Error fetching pending checklists:", err)
          setPendingChecklists([])
        } finally {
          setPendingChecklistsLoading(false)
        }
      }
      
      fetchPendingChecklists()
    }
  }, [assetId])
  
  // Add a new effect to fetch work orders
  useEffect(() => {
    if (assetId) {
      const fetchWorkOrders = async () => {
        try {
          setWorkOrdersLoading(true)
          const supabase = createClient();
          
          const { data, error } = await supabase
            .from('work_orders')
            .select(`
              id,
              order_id,
              type,
              status,
              priority,
              description,
              planned_date,
              assigned_to,
              created_at,
              asset_id,
              incident_id
            `)
            .eq('asset_id', assetId)
            .order('created_at', { ascending: false })
            .limit(5) // Show only the 5 most recent work orders
          
          if (error) {
            console.error('Error fetching work orders:', error)
            setWorkOrders([])
          } else {
            // If we have work orders, also fetch technician names
            const workOrdersData = data || [];
            if (workOrdersData.length > 0) {
              const technicianIds = [...new Set(workOrdersData.filter(wo => wo.assigned_to).map(wo => wo.assigned_to))];
              
              if (technicianIds.length > 0) {
                const { data: techData } = await supabase
                  .from('profiles')
                  .select('id, nombre, apellido')
                  .in('id', technicianIds)
                
                // Map technician data to work orders
                const workOrdersWithTechnicians = workOrdersData.map(wo => ({
                  ...wo,
                  technician_profile: techData?.find(tech => tech.id === wo.assigned_to)
                }));
                
                setWorkOrders(workOrdersWithTechnicians);
              } else {
                setWorkOrders(workOrdersData);
              }
            } else {
              setWorkOrders(workOrdersData);
            }
          }
        } catch (err) {
          console.error("Error fetching work orders:", err)
          setWorkOrders([]);
        } finally {
          setWorkOrdersLoading(false);
        }
      }
      
      fetchWorkOrders()
    }
  }, [assetId])
  
  // Helper function to check if incident is pending (case-insensitive)
  const isPendingIncident = (incident: any) => {
    const status = incident.status?.toLowerCase();
    return status === 'pendiente' || 
           status === 'pending' || 
           status === 'en proceso' || 
           status === 'en progreso' ||
           status === 'abierto' ||
           status === 'open';
  };
  
  // Get pending incidents count
  const pendingIncidentsCount = incidents.filter(isPendingIncident).length;
  
  // Función para mostrar el estado con un color adecuado
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return <Badge className="bg-green-500">Operativo</Badge>
      case "maintenance":
        return <Badge className="bg-yellow-500">En Mantenimiento</Badge>
      case "repair":
        return <Badge className="bg-red-500">En Reparación</Badge>
      case "inactive":
        return <Badge variant="outline">Inactivo</Badge>
      default:
        return <Badge variant="secondary">{status || "Desconocido"}</Badge>
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };

  const formatCurrency = (value: number | string | null | undefined) => {
    const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
    if (!num || isNaN(Number(num))) return null;
    try {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(num));
    } catch {
      return `$${Number(num).toFixed(2)}`;
    }
  };

  const getIntervalLabelForMaintenance = (maintenance: any) => {
    try {
      const planId = maintenance?.maintenance_plan_id;
      if (!planId) return null;
      const interval = (maintenanceIntervals || []).find((i: any) => i.id === planId);
      if (!interval) return null;
      return formatIntervalLabel(interval, maintenanceUnit);
    } catch {
      return null;
    }
  };

  return (
    <DashboardShell>
      <DashboardHeader
        heading=""
        text=""
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/activos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Activos
            </Link>
          </Button>
        </div>
      </DashboardHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Error al cargar los datos del activo: {error.message}</AlertDescription>
        </Alert>
      )}

      <BreadcrumbSetter
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Activos", href: "/activos" },
          { label: loading ? "Cargando..." : (asset?.asset_id || asset?.name || "Detalle") },
        ]}
      />

      {loading ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="activos-detail-page space-y-6">
          <div data-stagger="0">
            <AssetDetailHeader
            asset={asset}
            assetId={assetId}
            compositeContext={compositeContext}
            formatDate={formatDate}
            getStatusBadge={getStatusBadge}
            kpis={
              <AssetDetailKpis
                asset={asset}
                maintenanceUnit={maintenanceUnit}
                maintenanceHistory={maintenanceHistory}
                combinedMaintenanceHistory={
                  (asset as { is_composite?: boolean }).is_composite
                    ? combinedMaintenanceHistory
                    : null
                }
                maintenanceIntervals={maintenanceIntervals}
                pendingTasksCount={
                  pendingIncidentsCount +
                  pendingChecklists.length +
                  upcomingMaintenances.filter(
                    (m) =>
                      m.status === "overdue" ||
                      (m.status === "upcoming" && m.urgency === "high")
                  ).length
                }
              />
            }
            actions={
              <AssetDetailActions
                assetId={assetId}
                hasComposite={!!compositeContext.composite}
                setOpenCreateComposite={setOpenCreateComposite}
                onReportIncidentClick={() => setReportIncidentOpen(true)}
                ui={ui as { shouldShowInNavigation: (m: string) => boolean; canShowEditButton: (m: string) => boolean }}
              />
            }
          />
          </div>

          {(() => {
            const overdueCount = upcomingMaintenances.filter((m) => m.status === "overdue").length
            const urgentCount = upcomingMaintenances.filter(
              (m) => m.status === "upcoming" && m.urgency === "high"
            ).length
            const hasCriticalAlerts =
              overdueCount > 0 ||
              urgentCount > 0 ||
              pendingIncidentsCount > 0 ||
              pendingChecklists.length > 0
            return hasCriticalAlerts ? (
              <Alert
                variant="destructive"
                className="rounded-xl border-l-4 border-l-red-500 transition-opacity duration-200"
                data-stagger="1"
              >
                <AlertTriangle className="h-4 w-4" aria-hidden />
                <AlertDescription>
                  <div className="space-y-1">
                    {overdueCount > 0 && (
                      <p>
                        <strong>{overdueCount}</strong> mantenimiento(s) vencido(s)
                      </p>
                    )}
                    {urgentCount > 0 && (
                      <p>
                        <strong>{urgentCount}</strong> mantenimiento(s) urgente(s)
                      </p>
                    )}
                    {pendingIncidentsCount > 0 && (
                      <p>
                        <strong>{pendingIncidentsCount}</strong> incidente(s) pendiente(s)
                      </p>
                    )}
                    {pendingChecklists.length > 0 && (
                      <p>
                        <strong>{pendingChecklists.length}</strong> checklist(s) pendiente(s)
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : null
          })()}

          <CreateCompositeAssetDialog open={openCreateComposite} onOpenChange={setOpenCreateComposite} currentAssetId={assetId} />
          <IncidentRegistrationDialog
            isOpen={reportIncidentOpen}
            onClose={() => setReportIncidentOpen(false)}
            assetId={assetId}
            onSuccess={() => {
              refetchIncidents();
              setReportIncidentOpen(false);
            }}
          />

          {/* Coupling editor — only on the composite's own page, not when viewing a component */}
          {compositeContext.composite?.id === assetId && (
            <div data-stagger="1.5" className="space-y-4">
              {compositeFuelSummary && (
                <CompositeFuelSummary
                  dieselLiters30d={compositeFuelSummary.diesel_liters_30d}
                  ureaLiters30d={compositeFuelSummary.urea_liters_30d}
                  recentTransactions={compositeFuelSummary.recent_transactions}
                />
              )}
              <CompositeCouplingEditor
                compositeId={assetId}
                syncHours={compositeContext.composite?.composite_sync_hours ?? false}
                syncKm={compositeContext.composite?.composite_sync_kilometers ?? false}
                primaryComponentId={compositeContext.composite?.primary_component_id ?? null}
                canEdit={canEditCoupling}
                components={compositeContext.components}
              />
            </div>
          )}

          <div data-stagger="2">
          <Tabs defaultValue="status" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start mb-4 h-auto p-1 flex-wrap gap-1 overflow-x-auto min-w-0">
              <TabsTrigger value="status" className="text-xs sm:text-sm px-3 py-2 cursor-pointer transition-colors duration-200 data-[state=active]:underline data-[state=active]:underline-offset-4">Estado & Mantenimiento</TabsTrigger>
              <TabsTrigger value="incidents" className="text-xs sm:text-sm px-3 py-2 cursor-pointer transition-colors duration-200 data-[state=active]:underline data-[state=active]:underline-offset-4">
                <span className="flex items-center gap-2">
                  Incidentes & Checklists
                  {(pendingIncidentsCount > 0 || pendingChecklists.length > 0) && (
                    <Badge variant="destructive" className="h-5 min-w-[20px] rounded-full px-1.5 text-xs shrink-0">
                      {pendingIncidentsCount + pendingChecklists.length}
                    </Badge>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="technical" className="text-xs sm:text-sm px-3 py-2 cursor-pointer transition-colors duration-200 data-[state=active]:underline data-[state=active]:underline-offset-4">Información Técnica</TabsTrigger>
              <TabsTrigger value="documentation" className="text-xs sm:text-sm px-3 py-2 cursor-pointer transition-colors duration-200 data-[state=active]:underline data-[state=active]:underline-offset-4">Documentación</TabsTrigger>
            </TabsList>
            
            <TabsContent value="status" className="space-y-4 mt-4">
              <StatusMaintenanceTab
                assetId={assetId}
                asset={asset}
                maintenanceUnit={maintenanceUnit}
                upcomingMaintenances={upcomingMaintenances}
                upcomingLoading={upcomingLoading}
                maintenanceHistory={maintenanceHistory}
                combinedMaintenanceHistory={combinedMaintenanceHistory}
                maintenanceIntervals={maintenanceIntervals}
                workOrders={workOrders}
                workOrdersLoading={workOrdersLoading}
                poByWorkOrder={poByWorkOrder}
                pendingIncidentsCount={pendingIncidentsCount}
                pendingChecklistsCount={pendingChecklists.length}
                formatDate={formatDate}
                formatCurrency={formatCurrency}
                ui={ui as { shouldShowInNavigation: (m: string) => boolean }}
              />
            </TabsContent>
            <TabsContent value="incidents" className="space-y-4 mt-4">
              <IncidentsChecklistsTab
                assetId={assetId}
                assetName={asset?.name || ""}
                incidents={incidents}
                incidentsLoading={incidentsLoading}
                pendingChecklists={pendingChecklists}
                pendingChecklistsLoading={pendingChecklistsLoading}
                completedChecklists={completedChecklists}
                checklistsLoading={checklistsLoading}
                isPendingIncident={isPendingIncident}
                formatDate={formatDate}
                onReportIncidentClick={() => setReportIncidentOpen(true)}
              />
            </TabsContent>
            <TabsContent value="technical" className="space-y-4 mt-4">
              <TechnicalInfoTab asset={asset} formatDate={formatDate} />
            </TabsContent>
            <TabsContent value="documentation" className="space-y-4 mt-4">
              <DocumentationTab asset={asset} formatDate={formatDate} />
            </TabsContent>
          </Tabs>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}