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
  getCurrentValue, 
  getMaintenanceValue, 
  getUnitLabel, 
  getUnitDisplayName,
  type MaintenanceUnit 
} from "@/lib/utils/maintenance-units";

export default function AssetDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  
  const { asset: rawAsset, loading, error } = useAsset(assetId);
  const { history: maintenanceHistory, loading: maintenanceLoading } = useMaintenanceHistory(assetId);
  const { incidents, loading: incidentsLoading } = useIncidents(assetId);
  const { ui } = useAuthZustand();
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
  const [compositeContext, setCompositeContext] = useState<{ composite: any | null; components: any[] }>({ composite: null, components: [] });
  const [compositeLoading, setCompositeLoading] = useState(false);
  const [openCreateComposite, setOpenCreateComposite] = useState(false);
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
          .select('id, name, is_composite, component_assets, primary_component_id')
          .eq('id', assetId)
          .single();
        if (aErr || !a) {
          setCompositeContext({ composite: null, components: [] });
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
            }
          } catch {}
          setCompositeContext({ composite: a, components });
          // Overwrite local page states with aggregated data when viewing composite
          try {
            (incidents as any).splice(0, (incidents as any).length, ...aggregatedIncidents);
          } catch {}
          try {
            setPendingChecklists(aggregatedPending);
          } catch {}
          try {
            setCompletedChecklists(aggregatedCompleted);
          } catch {}
          // Keep original hook data intact; store combined separately
          setCombinedMaintenanceHistory(aggregatedMaintenance);
          try {
            // Transform aggregated upcoming to page format if necessary
            const transformed = (aggregatedUpcoming || []).map((m: any) => ({
              intervalId: m.interval_id,
              intervalName: m.interval_name,
              intervalDescription: m.interval_description,
              type: m.type,
              intervalValue: m.interval_value,
              currentValue: m.current_value,
              targetValue: m.target_value,
              valueRemaining: (m.target_value - m.current_value),
              status: m.status,
              urgency: m.urgency,
              progress: m.target_value > 0 ? Math.round((m.current_value / m.target_value) * 100) : 0,
              unit: 'hours',
              estimatedDate: new Date().toISOString(),
              lastMaintenanceDate: null,
              wasPerformed: false,
              cycleForService: 0,
              cycleLength: 0
            }))
            setUpcomingMaintenances(transformed)
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
          setCompositeContext({ composite: null, components: [] });
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
        setCompositeContext({ composite: composite, components });
        // When part of a composite, also surface aggregated lists in page widgets
        try {
          (incidents as any).splice(0, (incidents as any).length, ...aggregatedIncidents);
        } catch {}
        try {
          setPendingChecklists(aggregatedPending);
        } catch {}
        try {
          setCompletedChecklists(aggregatedCompleted);
        } catch {}
        setCombinedMaintenanceHistory(aggregatedMaintenance);
        try {
          const transformed = (aggregatedUpcoming || []).map((m: any) => ({
            intervalId: m.interval_id,
            intervalName: m.interval_name,
            intervalDescription: m.interval_description,
            type: m.type,
            intervalValue: m.interval_value,
            currentValue: m.current_value,
            targetValue: m.target_value,
            valueRemaining: (m.target_value - m.current_value),
            status: m.status,
            urgency: m.urgency,
            progress: m.target_value > 0 ? Math.round((m.current_value / m.target_value) * 100) : 0,
            unit: 'hours',
            estimatedDate: new Date().toISOString(),
            lastMaintenanceDate: null,
            wasPerformed: false,
            cycleForService: 0,
            cycleLength: 0
          }))
          setUpcomingMaintenances(transformed)
        } catch {}
      } catch (e) {
        console.error('Error loading composite context', e);
        setCompositeContext({ composite: null, components: [] });
      } finally {
        setCompositeLoading(false);
      }
    };

    fetchCompositeContext();
  }, [assetId]);

  // Process and calculate upcoming maintenances with proper CYCLIC logic
  useEffect(() => {
    // If this is a composite view, upcoming is driven by aggregated API
    if (compositeContext.composite) {
      setUpcomingLoading(false);
      return;
    }
    if (!maintenanceIntervals.length || !asset) {
      setUpcomingMaintenances([]);
      setUpcomingLoading(false);
      return;
    }
    
    async function calculateUpcoming() {
      try {
        setUpcomingLoading(true);
        
        if (!asset) return;
        
        const currentValue = getCurrentValue(asset, maintenanceUnit);
        
        // Calculate cycle length (highest interval - same as maintenance page)
        const maxInterval = Math.max(...maintenanceIntervals.map(i => i.interval_value));
        const currentCycle = Math.floor(currentValue / maxInterval) + 1;
        
        // CRITICAL: Fetch maintenance_plans to map maintenance_plan_id to interval_id
        const supabase = createClient();
        const { data: maintenancePlans } = await supabase
          .from('maintenance_plans')
          .select('id, interval_id')
          .eq('asset_id', assetId);
        
        console.log(`[ASSET ${assetId}] Fetched maintenance_plans:`, maintenancePlans);
        
        // Create mapping: maintenance_plan_id -> interval_id
        const planToIntervalMap = new Map<string, string>();
        (maintenancePlans || []).forEach(plan => {
          if (plan.id && plan.interval_id) {
            planToIntervalMap.set(plan.id, plan.interval_id);
          }
        });
        
        console.log(`[ASSET ${assetId}] Plan to Interval Map:`, Array.from(planToIntervalMap.entries()));
        console.log(`[ASSET ${assetId}] Available intervals:`, maintenanceIntervals.map((i: any) => ({
          id: i.id,
          value: i.interval_value,
          type: i.type
        })));
        
        // Find the value of the last preventive maintenance performed (plan-linked)
        const effectiveMaintenanceHistory = combinedMaintenanceHistory ?? maintenanceHistory
        
        console.log(`[ASSET ${assetId}] Total maintenance history:`, effectiveMaintenanceHistory.length);
        console.log(`[ASSET ${assetId}] Sample history entries:`, effectiveMaintenanceHistory.slice(0, 3).map((m: any) => ({
          date: m.date,
          type: m.type,
          maintenance_plan_id: m.maintenance_plan_id,
          value: maintenanceUnit === 'kilometers' ? m.kilometers : m.hours
        })));
        
        // CRITICAL: maintenance_history.maintenance_plan_id DIRECTLY stores maintenance_intervals.id!
        // The field name is misleading - it should be called interval_id
        // Direct reference: maintenance_history.maintenance_plan_id → maintenance_intervals.id
        const preventiveHistory = effectiveMaintenanceHistory.filter((m: any) => {
          // Check for 'preventive' (English) or 'preventivo' (Spanish) - handle both languages and cases
          const typeLower = m?.type?.toLowerCase();
          const isPreventive = typeLower === 'preventive' || typeLower === 'preventivo';
          if (!isPreventive || !m?.maintenance_plan_id) {
            console.log(`[ASSET ${assetId}] Skipping non-preventive or null plan: type=${m?.type}, plan_id=${m?.maintenance_plan_id}`);
            return false;
          }
          
          // maintenance_plan_id IS the interval.id - check directly
          const found = maintenanceIntervals.some((interval: any) => interval.id === m.maintenance_plan_id);
          
          if (found) {
            console.log(`[ASSET ${assetId}] ✓ Found interval for maintenance_plan_id ${m.maintenance_plan_id}`);
          } else {
            console.log(`[ASSET ${assetId}] ❌ Interval ${m.maintenance_plan_id} NOT found in intervals array`);
          }
          return found;
        });
        
        console.log(`[ASSET ${assetId}] Preventive history after filtering:`, preventiveHistory.length);
        console.log(`[ASSET ${assetId}] Preventive history details:`, preventiveHistory.map((m: any) => {
          // maintenance_plan_id is actually the interval_id from maintenance_plans
          const interval = maintenanceIntervals.find(i => i.id === m.maintenance_plan_id);
          return {
            date: m.date,
            maintenance_plan_id: m.maintenance_plan_id,
            interval_id: m.maintenance_plan_id,
            interval_value: interval?.interval_value,
            value: getMaintenanceValue(m, maintenanceUnit)
          };
        }));
      const allMaintenanceValues = preventiveHistory
        .map(m => getMaintenanceValue(m, maintenanceUnit))
        .filter(v => v > 0)
        .sort((a, b) => b - a); // Sort from highest to lowest
      
      const lastMaintenanceValue = allMaintenanceValues.length > 0 ? allMaintenanceValues[0] : 0;
      
      // Find the highest maintenance performed in current cycle (for "covered" logic)
      const currentCycleStartValue = (currentCycle - 1) * maxInterval;
      const currentCycleEndValue = currentCycle * maxInterval;
      
        const currentCycleMaintenances = preventiveHistory.filter((m: any) => {
          const mValue = getMaintenanceValue(m, maintenanceUnit);
          return mValue > currentCycleStartValue && mValue < currentCycleEndValue;
        });
        
        console.log(`[ASSET ${assetId}] Current cycle: ${currentCycle}, Range: ${currentCycleStartValue}${getUnitLabel(maintenanceUnit)} - ${currentCycleEndValue}${getUnitLabel(maintenanceUnit)}`);
        console.log(`[ASSET ${assetId}] Current cycle maintenances:`, currentCycleMaintenances.length);
        console.log(`[ASSET ${assetId}] Current cycle details:`, currentCycleMaintenances.map((m: any) => ({
          date: m.date,
          maintenance_plan_id: m.maintenance_plan_id,
          value: getMaintenanceValue(m, maintenanceUnit),
          interval_value: maintenanceIntervals.find(i => i.id === m.maintenance_plan_id)?.interval_value
        })));
        
        const highestMaintenanceInCycle = currentCycleMaintenances.length > 0 
          ? Math.max(...currentCycleMaintenances.map(m => getMaintenanceValue(m, maintenanceUnit)))
          : 0;
        
        const upcomingList = maintenanceIntervals.map(interval => {
        const intervalValue = interval.interval_value || 0;
        
        // Handle new fields with fallbacks for backward compatibility
        const isRecurring = (interval as any).is_recurring !== false; // Default to true
        const isFirstCycleOnly = (interval as any).is_first_cycle_only === true; // Default to false
        
        // Calculate next due value for current cycle (unit-agnostic, same logic as maintenance page)
        let nextDueValue: number | null = null;
        let status = 'not_applicable';
        let cycleForService = currentCycle;
        
        if (!isFirstCycleOnly || currentCycle === 1) {
          // Calculate the due value and keep as non-null local number
          let computedDue = ((currentCycle - 1) * maxInterval) + intervalValue;
          
          // Special case: if computedDue exceeds the current cycle end, calculate for next cycle
          if (computedDue > currentCycleEndValue) {
            cycleForService = currentCycle + 1;
            computedDue = (currentCycle * maxInterval) + intervalValue;
            
            // Only show next cycle services if they're within reasonable range
            if (computedDue - currentValue <= 1000) {
              status = 'scheduled';
            } else {
              status = 'not_applicable';
            }
          } else {
            // Current cycle logic - check if this specific interval was performed
            if (computedDue !== null) {
              const dueValue = computedDue; // Non-null variable for comparisons
               
              const wasPerformedInCurrentCycle = currentCycleMaintenances.some(m => {
                // CRITICAL: m.maintenance_plan_id contains the interval_id value from maintenance_plans
                // This interval_id IS the actual interval.id we're looking for
                const matches = m.maintenance_plan_id === interval.id;
                if (interval.interval_value === 1500 || matches) {
                  console.log(`[ASSET ${assetId}] Checking ${interval.interval_value}${getUnitLabel(maintenanceUnit)} completion:`, {
                    maintenance_plan_id: m.maintenance_plan_id,
                    target_interval_id: interval.id,
                    matches
                  });
                }
                return matches;
              });
               
               if (wasPerformedInCurrentCycle) {
                 status = 'completed';
              } else {
                 // Plan-aware coverage: a higher/equal preventive interval in same unit/category covers lower ones
                // CRITICAL: Coverage requires BOTH interval value comparison AND timing check
                // CRITICAL: Match via interval_id from maintenance_plans mapping
                const isCoveredByHigher = currentCycleMaintenances.some((m: any) => {
                  // CRITICAL: maintenance_plan_id IS the interval ID
                  const performedInterval = (maintenanceIntervals || []).find((i: any) => i.id === m.maintenance_plan_id);
                  const dueInterval = interval;
                  if (!performedInterval || !dueInterval) return false;
                  const sameUnit = performedInterval.type === dueInterval.type;
                  const higherOrEqual = Number(performedInterval.interval_value) >= Number(dueInterval.interval_value);
                  const performedAtValue = getMaintenanceValue(m, maintenanceUnit);
                  const performedAfterDue = performedAtValue >= dueValue;
                  const covers = sameUnit && higherOrEqual && performedAfterDue;
                  
                  if (interval.interval_value <= 1500 && covers) {
                    console.log(`[ASSET ${assetId}] ${interval.interval_value}${getUnitLabel(maintenanceUnit)} covered by ${performedInterval.interval_value}${getUnitLabel(maintenanceUnit)} (performed at ${performedAtValue}${getUnitLabel(maintenanceUnit)}, due at ${dueValue}${getUnitLabel(maintenanceUnit)})`);
                  }
                  
                  return covers;
                });
                if (isCoveredByHigher) {
                  status = 'covered';
                } else if (currentValue >= dueValue) {
                  status = 'overdue';
                } else if (currentValue >= dueValue - 100) {
                  status = 'upcoming';
                } else {
                  status = 'scheduled';
                }
              }
             }
          }
          // Persist computed due value to nullable variable for downstream UI calculations
          nextDueValue = computedDue;
        }
        
        // Calculate additional properties
        let progress = 0;
        let urgency = 'low';
        let valueRemaining = 0;
        let wasPerformed = false;
        let lastMaintenanceDate = null;
        
        if (nextDueValue !== null) {
          if (status === 'completed') {
            progress = 100;
            urgency = 'low';
            valueRemaining = 0;
            wasPerformed = true;
            
            // Find the last maintenance of this type
            // CRITICAL: maintenance_plan_id IS the interval ID
            const lastMaintenanceOfType = currentCycleMaintenances.find(m => 
              m.maintenance_plan_id === interval.id
            );
            lastMaintenanceDate = lastMaintenanceOfType?.date || null;
          } else if (status === 'covered') {
            progress = 100;
            urgency = 'low';
            valueRemaining = 0;
                     } else if (status === 'overdue' && nextDueValue !== null) {
             progress = 100;
             const valueOverdue = currentValue - nextDueValue;
             valueRemaining = -valueOverdue;
             
             if (valueOverdue > intervalValue * 0.5) {
               urgency = 'high';
             } else {
               urgency = 'medium';
             }
          } else if (status === 'upcoming') {
            const safeDue = Number((nextDueValue ?? intervalValue) || 0);
            progress = safeDue > 0 ? Math.round((currentValue / safeDue) * 100) : 0;
            const valueRemainingCalc = safeDue - currentValue;
             valueRemaining = valueRemainingCalc;
             
             if (valueRemainingCalc <= 50) {
               urgency = 'high';
             } else {
               urgency = 'medium';
             }
          } else if (status === 'scheduled') {
            const safeDue = Number((nextDueValue ?? intervalValue) || 0);
            progress = safeDue > 0 ? Math.round((currentValue / safeDue) * 100) : 0;
            const valueRemainingCalc = safeDue - currentValue;
             valueRemaining = valueRemainingCalc;
             urgency = 'low';
           }
        }
        
        return {
          intervalId: interval.id,
          intervalName: interval.name || interval.description || `${interval.type} ${interval.interval_value}${getUnitLabel(maintenanceUnit)}`,
          intervalDescription: interval.description,
          type: interval.type,
          intervalValue: interval.interval_value,
          currentValue: currentValue,
          targetValue: nextDueValue || intervalValue,
          valueRemaining,
          status,
          urgency,
          progress,
          unit: maintenanceUnit === 'kilometers' ? 'kilometers' : 'hours',
          estimatedDate: new Date().toISOString(),
          lastMaintenanceDate,
          wasPerformed,
          cycleForService,
          cycleLength: maxInterval
        };
      });
      
      // Filter to show only relevant maintenances (same logic as maintenance page)
      const filteredUpcoming = upcomingList.filter(maintenance => {
        // Show: overdue, upcoming, covered, scheduled
        // Don't show: not_applicable, completed (already done)
        return ['overdue', 'upcoming', 'covered', 'scheduled'].includes(maintenance.status);
      });
      
      // Sort by priority: overdue first, then upcoming, then by urgency
      const sorted = filteredUpcoming.sort((a, b) => {
        const statusPriority = { 'overdue': 4, 'upcoming': 3, 'scheduled': 2, 'covered': 1 };
        const urgencyPriority = { 'high': 3, 'medium': 2, 'low': 1 };
        
        const priorityA = statusPriority[a.status as keyof typeof statusPriority] || 0;
        const priorityB = statusPriority[b.status as keyof typeof statusPriority] || 0;
        
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        
        const urgencyA = urgencyPriority[a.urgency as keyof typeof urgencyPriority] || 0;
        const urgencyB = urgencyPriority[b.urgency as keyof typeof urgencyPriority] || 0;
        
        if (urgencyA !== urgencyB) {
          return urgencyB - urgencyA;
        }
        
          return a.intervalValue - b.intervalValue;
        });
        
        setUpcomingMaintenances(sorted);
      } catch (error) {
        console.error('Error calculating upcoming maintenances:', error);
        setUpcomingMaintenances([]);
      } finally {
        setUpcomingLoading(false);
      }
    }
    
    calculateUpcoming();
  }, [maintenanceIntervals, asset, maintenanceHistory, assetId, combinedMaintenanceHistory]);
  
  // Add a new effect to fetch completed checklists
  useEffect(() => {
    if (assetId) {
      const fetchCompletedChecklists = async () => {
        try {
          setChecklistsLoading(true)
          const supabase = createClient()
          
          // Query completed_checklists directly like the history page does
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
              )
            `)
            .eq('asset_id', assetId)
            .order('completion_date', { ascending: false })
            .limit(10) // Limit to recent ones for the asset page
          
          if (error) {
            console.error('Error fetching completed checklists:', error)
            setCompletedChecklists([])
          } else {
            // Transform the data to match the expected structure
            const transformedData = (data || []).map((item: any) => ({
              ...item,
              checklists: Array.isArray(item.checklists) ? item.checklists[0] : item.checklists,
              profiles: Array.isArray(item.created_by_profile) ? item.created_by_profile[0] : item.created_by_profile
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
      const unit = interval.type === 'kilometers' ? 'km' : 'h';
      const base = interval.description || interval.name || '';
      if (base) return base;
      const value = Number(interval.interval_value) || 0;
      if (value > 0) return `${value}${unit}`;
      return null;
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
                combinedMaintenanceHistory={combinedMaintenanceHistory}
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
                assetName={asset?.name || ""}
                hasComposite={!!compositeContext.composite}
                setOpenCreateComposite={setOpenCreateComposite}
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