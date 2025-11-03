'use client';

import { useState, useMemo, useEffect, use } from "react";
import { useAsset, useMaintenanceHistory, useIncidents, useUpcomingMaintenance } from "@/hooks/useSupabase";
import { useAuthZustand } from "@/hooks/use-auth-zustand";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BreadcrumbSetter } from "@/components/navigation/breadcrumb-setter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import {
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Edit,
  ExternalLink,
  Eye,
  FileText,
  History,
  MapPin,
  Plus,
  Truck,
  Users,
  Wrench,
  Camera,
  Calendar as CalendarIcon
} from "lucide-react"
import { format, formatDistance, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Asset, AssetWithModel, AssetWithOrganization, EquipmentModel } from "@/types";
import { createClient } from "@/lib/supabase";
import { CompletedChecklistEvidenceViewer } from "@/components/checklists/completed-checklist-evidence-viewer"
import { CreateCompositeAssetDialog } from "@/components/assets/dialogs/create-composite-asset-dialog"

// Define category type
type CategoryInfo = {
  label: string;
  color: string;
  icon: string;
};

type CategoryMap = {
  [key: string]: CategoryInfo;
};

// Map of category codes to more readable names and styling
const PHOTO_CATEGORIES: CategoryMap = {
  'frontal': { label: 'Vista Frontal', color: 'bg-blue-500', icon: '' },
  'trasera': { label: 'Vista Trasera', color: 'bg-green-500', icon: '' },
  'lateral': { label: 'Vista Lateral', color: 'bg-yellow-500', icon: '' },
  'interior': { label: 'Interior', color: 'bg-purple-500', icon: '' },
  'motor': { label: 'Motor', color: 'bg-red-500', icon: '' },
  'placa': { label: 'Placa/Serial', color: 'bg-indigo-500', icon: '' },
  'detalles': { label: 'Detalles', color: 'bg-orange-500', icon: '' },
  'daños': { label: 'Daños/Problemas', color: 'bg-red-700', icon: '' },
  'otros': { label: 'Otros', color: 'bg-gray-500', icon: '' },
};

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
  
  // Map the asset with equipment_models to use model property
  const asset = useMemo(() => {
    if (!rawAsset) return null;
    
    const assetWithModel: AssetWithModel = {
      ...rawAsset,
      model: (rawAsset as any).equipment_models as EquipmentModel
    };
    
    return assetWithModel;
  }, [rawAsset]);

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
        
        const currentHours = asset.current_hours || 0;
        
        // Calculate cycle length (highest interval - same as maintenance page)
        const maxInterval = Math.max(...maintenanceIntervals.map(i => i.interval_value));
        const currentCycle = Math.floor(currentHours / maxInterval) + 1;
        
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
        
        // Find the hour of the last preventive maintenance performed (plan-linked)
        const effectiveMaintenanceHistory = combinedMaintenanceHistory ?? maintenanceHistory
        
        console.log(`[ASSET ${assetId}] Total maintenance history:`, effectiveMaintenanceHistory.length);
        console.log(`[ASSET ${assetId}] Sample history entries:`, effectiveMaintenanceHistory.slice(0, 3).map((m: any) => ({
          date: m.date,
          type: m.type,
          maintenance_plan_id: m.maintenance_plan_id,
          hours: m.hours
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
            hours: m.hours
          };
        }));
      const allMaintenanceHours = preventiveHistory
        .map(m => Number(m.hours) || 0)
        .filter(h => h > 0)
        .sort((a, b) => b - a); // Sort from highest to lowest
      
      const lastMaintenanceHours = allMaintenanceHours.length > 0 ? allMaintenanceHours[0] : 0;
      
      // Find the highest maintenance performed in current cycle (for "covered" logic)
      const currentCycleStartHour = (currentCycle - 1) * maxInterval;
      const currentCycleEndHour = currentCycle * maxInterval;
      
        const currentCycleMaintenances = preventiveHistory.filter((m: any) => {
          const mHours = Number(m.hours) || 0;
          return mHours > currentCycleStartHour && mHours < currentCycleEndHour;
        });
        
        console.log(`[ASSET ${assetId}] Current cycle: ${currentCycle}, Range: ${currentCycleStartHour}h - ${currentCycleEndHour}h`);
        console.log(`[ASSET ${assetId}] Current cycle maintenances:`, currentCycleMaintenances.length);
        console.log(`[ASSET ${assetId}] Current cycle details:`, currentCycleMaintenances.map((m: any) => ({
          date: m.date,
          maintenance_plan_id: m.maintenance_plan_id,
          hours: m.hours,
          interval_value: maintenanceIntervals.find(i => i.id === m.maintenance_plan_id)?.interval_value
        })));
        
        const highestMaintenanceInCycle = currentCycleMaintenances.length > 0 
          ? Math.max(...currentCycleMaintenances.map(m => Number(m.hours) || 0))
          : 0;
        
        const upcomingList = maintenanceIntervals.map(interval => {
        const intervalHours = interval.interval_value || 0;
        
        // Handle new fields with fallbacks for backward compatibility
        const isRecurring = (interval as any).is_recurring !== false; // Default to true
        const isFirstCycleOnly = (interval as any).is_first_cycle_only === true; // Default to false
        
        // Calculate next due hour for current cycle (same logic as maintenance page)
        let nextDueHour: number | null = null;
        let status = 'not_applicable';
        let cycleForService = currentCycle;
        
        if (!isFirstCycleOnly || currentCycle === 1) {
          // Calculate the due hour and keep as non-null local number
          let computedDue = ((currentCycle - 1) * maxInterval) + intervalHours;
          
          // Special case: if computedDue exceeds the current cycle end, calculate for next cycle
          if (computedDue > currentCycleEndHour) {
            cycleForService = currentCycle + 1;
            computedDue = (currentCycle * maxInterval) + intervalHours;
            
            // Only show next cycle services if they're within reasonable range
            if (computedDue - currentHours <= 1000) {
              status = 'scheduled';
            } else {
              status = 'not_applicable';
            }
          } else {
                         // Current cycle logic - check if this specific interval was performed
            if (computedDue !== null) {
              const dueHour = computedDue; // Non-null variable for comparisons
               
              const wasPerformedInCurrentCycle = currentCycleMaintenances.some(m => {
                // CRITICAL: m.maintenance_plan_id contains the interval_id value from maintenance_plans
                // This interval_id IS the actual interval.id we're looking for
                const matches = m.maintenance_plan_id === interval.id;
                if (interval.interval_value === 1500 || matches) {
                  console.log(`[ASSET ${assetId}] Checking ${interval.interval_value}h completion:`, {
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
                // CRITICAL: Coverage is based SOLELY on interval value comparison
                // CRITICAL: Match via interval_id from maintenance_plans mapping
                const isCoveredByHigher = currentCycleMaintenances.some((m: any) => {
                  // CRITICAL: maintenance_plan_id IS the interval ID
                  const performedInterval = (maintenanceIntervals || []).find((i: any) => i.id === m.maintenance_plan_id);
                  const dueInterval = interval;
                  if (!performedInterval || !dueInterval) return false;
                  const sameUnit = performedInterval.type === dueInterval.type;
                  const sameCategory = (performedInterval as any).maintenance_category === (dueInterval as any).maintenance_category;
                  const categoryOk = (performedInterval as any).maintenance_category && (dueInterval as any).maintenance_category ? sameCategory : true;
                  // CRITICAL: Coverage based SOLELY on interval value comparison
                  // If performed interval value >= due interval value, it covers it
                  // Works forward: performing 1500h covers all intervals <= 1500h, even future ones
                  const higherOrEqual = Number(performedInterval.interval_value) >= Number(dueInterval.interval_value);
                  const covers = sameUnit && categoryOk && higherOrEqual;
                  
                  if (interval.interval_value <= 1500 && covers) {
                    console.log(`[ASSET ${assetId}] ${interval.interval_value}h covered by ${performedInterval.interval_value}h`);
                  }
                  
                  return covers;
                });
                if (isCoveredByHigher) {
                  status = 'covered';
                } else if (currentHours >= dueHour) {
                  status = 'overdue';
                } else if (currentHours >= dueHour - 100) {
                  status = 'upcoming';
                } else {
                  status = 'scheduled';
                }
              }
             }
          }
          // Persist computed due value to nullable variable for downstream UI calculations
          nextDueHour = computedDue;
        }
        
        // Calculate additional properties
        let progress = 0;
        let urgency = 'low';
        let valueRemaining = 0;
        let wasPerformed = false;
        let lastMaintenanceDate = null;
        
        if (nextDueHour !== null) {
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
                     } else if (status === 'overdue' && nextDueHour !== null) {
             progress = 100;
             const hoursOverdue = currentHours - nextDueHour;
             valueRemaining = -hoursOverdue;
             
             if (hoursOverdue > intervalHours * 0.5) {
               urgency = 'high';
             } else {
               urgency = 'medium';
             }
          } else if (status === 'upcoming') {
            const safeDue = Number((nextDueHour ?? intervalHours) || 0);
            progress = safeDue > 0 ? Math.round((currentHours / safeDue) * 100) : 0;
            const hoursRemaining = safeDue - currentHours;
             valueRemaining = hoursRemaining;
             
             if (hoursRemaining <= 50) {
               urgency = 'high';
             } else {
               urgency = 'medium';
             }
          } else if (status === 'scheduled') {
            const safeDue = Number((nextDueHour ?? intervalHours) || 0);
            progress = safeDue > 0 ? Math.round((currentHours / safeDue) * 100) : 0;
            const hoursRemaining = safeDue - currentHours;
             valueRemaining = hoursRemaining;
             urgency = 'low';
           }
        }
        
        return {
          intervalId: interval.id,
          intervalName: interval.description || `${interval.type} ${interval.interval_value}h`,
          type: interval.type,
          intervalValue: interval.interval_value,
          currentValue: currentHours,
          targetValue: nextDueHour || intervalHours,
          valueRemaining,
          status,
          urgency,
          progress,
          unit: 'hours',
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
              asset_id
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
        <div className="space-y-6">
          {/* Professional Clean Asset Header - Mobile Optimized */}
          <Card className="border-2">
            <CardHeader className="pb-3 md:pb-4">
              {/* Main Asset Title and Status */}
              <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2 min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold break-words">{asset?.name}</h1>
                  <div className="flex flex-col space-y-1 sm:space-y-0 sm:flex-row sm:items-center sm:gap-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">{asset?.asset_id}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="break-words">{asset?.model?.manufacturer} {asset?.model?.name || "Sin modelo"}</span>
                    {asset?.serial_number && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="break-words">S/N: {asset.serial_number}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 self-start">
                  {getStatusBadge(asset?.status || "")}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              {compositeContext.composite && (
                <div className="mb-4 p-3 border rounded-md bg-blue-50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-semibold">Activo Compuesto</span>{' '}
                      {compositeContext.composite.id !== assetId ? (
                        <>
                          — Parte de{' '}
                          <Link className="underline" href={`/activos/${compositeContext.composite.id}`}>
                            {compositeContext.composite.name}
                          </Link>
                        </>
                      ) : (
                        <span>— Vista unificada</span>
                      )}
                    </div>
                    {compositeContext.composite.id !== assetId && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/activos/${compositeContext.composite.id}`}>Ver vista unificada</Link>
                      </Button>
                    )}
                  </div>
                  {compositeContext.components.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {compositeContext.components.map((c: any) => (
                        <Link key={c.id} href={`/activos/${c.id}`}>
                          <Badge variant={c.id === assetId ? 'default' : 'outline'} className="cursor-pointer">
                            {c.asset_id || c.name}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Key Metrics Row - Professional Style */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-4 md:mb-6">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold">{asset?.current_hours || 0}h</div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">Horas Operación</div>
                </div>
                
                <div className="text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                    {asset?.current_kilometers || 0}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Kilómetros
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                    {(() => {
                      const effectiveHistory = combinedMaintenanceHistory ?? maintenanceHistory;
                      return (effectiveHistory.length > 0 && asset?.current_hours && effectiveHistory[0]?.hours)
                        ? `${asset.current_hours - effectiveHistory[0].hours}h`
                        : "0h";
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">Desde Último Mant.</div>
                </div>
                
                <div className="text-center">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold">
                    {(pendingIncidentsCount + 
                      pendingChecklists.length + 
                      upcomingMaintenances.filter(m => m.status === 'overdue' || (m.status === 'upcoming' && m.urgency === 'high')).length)}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">Tareas Pendientes</div>
                </div>
              </div>
              
              {/* Secondary Information and Actions - Mobile Optimized */}
              <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center lg:justify-between pt-4 border-t">
                <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="break-words">
                      {(() => {
                        if (compositeContext.composite && compositeContext.components.length > 0) {
                          const names = Array.from(new Set((compositeContext.components as any[]).map(c => c?.plants?.name).filter(Boolean)));
                          return names.length === 1 ? names[0] : 'Varios';
                        }
                        return (asset as any)?.plants?.name || asset?.location || 'Sin planta';
                      })()}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 flex-shrink-0" />
                    <span className="break-words">
                      {(() => {
                        if (compositeContext.composite && compositeContext.components.length > 0) {
                          const names = Array.from(new Set((compositeContext.components as any[]).map(c => c?.departments?.name).filter(Boolean)));
                          return names.length === 1 ? names[0] : 'Varios';
                        }
                        return (asset as any)?.departments?.name || asset?.department || 'Sin departamento';
                      })()}
                    </span>
                  </span>
                  {asset?.purchase_date && (
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span className="break-words">Compra: {formatDate(asset.purchase_date)}</span>
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:gap-2">
                  {ui.shouldShowInNavigation('work_orders') && (
                    <Button size="sm" asChild className="w-full sm:w-auto justify-center">
                      <Link href={`/activos/${assetId}/mantenimiento/nuevo`}>
                        <Wrench className="h-4 w-4 mr-2" />
                        Nueva Orden
                      </Link>
                    </Button>
                  )}
                  {ui.shouldShowInNavigation('maintenance') && (
                    <Button size="sm" variant="outline" asChild className="w-full sm:w-auto justify-center">
                      <Link href={`/activos/${assetId}/incidentes`}>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Incidente
                      </Link>
                    </Button>
                  )}
                  {/* Link to Service Orders filtered by this asset */}
                  <Button size="sm" variant="outline" asChild className="w-full sm:w-auto justify-center">
                    <Link href={`/servicios?assetId=${assetId}&asset=${encodeURIComponent(asset?.name || '')}`}>
                      <FileText className="h-4 w-4 mr-2" />
                      Órdenes de Servicio
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild className="w-full sm:w-auto justify-center">
                    <Link href={`/activos/${assetId}/reporte-produccion`}>
                      <FileText className="h-4 w-4 mr-2" />
                      Reporte Producción
                    </Link>
                  </Button>
                  {ui.canShowEditButton('assets') && (
                    <Button size="sm" variant="outline" asChild className="w-full sm:w-auto justify-center">
                      <Link href={`/activos/${assetId}/editar`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Link>
                    </Button>
                  )}
                  {!compositeContext.composite && (
                    <Button size="sm" className="w-full sm:w-auto justify-center" onClick={() => setOpenCreateComposite(true)}>
                      Crear Activo Compuesto
                    </Button>
                  )}
                  {compositeContext.composite && (
                    <Button size="sm" variant="outline" asChild className="w-full sm:w-auto justify-center">
                      <Link href={`/checklists/programar?assetId=${assetId}`}>
                        Programar Checklist Compuesto
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <CreateCompositeAssetDialog open={openCreateComposite} onOpenChange={setOpenCreateComposite} currentAssetId={assetId} />

          <Tabs defaultValue="status" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start mb-4 h-auto p-1 flex-wrap gap-1">
              <TabsTrigger value="status" className="text-xs sm:text-sm px-3 py-2">Estado & Mantenimiento</TabsTrigger>
              <TabsTrigger value="incidents" className="text-xs sm:text-sm px-3 py-2 relative">
                <span>Incidentes & Checklists</span>
                {(pendingIncidentsCount > 0 || pendingChecklists.length > 0) && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center min-w-[20px]">
                    {pendingIncidentsCount + pendingChecklists.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="technical" className="text-xs sm:text-sm px-3 py-2">Información Técnica</TabsTrigger>
              <TabsTrigger value="documentation" className="text-xs sm:text-sm px-3 py-2">Documentación</TabsTrigger>
            </TabsList>
            
            <TabsContent value="status" className="space-y-4">
              {/* Critical Alerts Section */}
              {(upcomingMaintenances.filter(m => m.status === 'overdue' || (m.status === 'upcoming' && m.urgency === 'high')).length > 0 || 
                pendingIncidentsCount > 0 ||
                pendingChecklists.length > 0) && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      {upcomingMaintenances.filter(m => m.status === 'overdue').length > 0 && (
                        <p><strong>{upcomingMaintenances.filter(m => m.status === 'overdue').length}</strong> mantenimiento(s) vencido(s)</p>
                      )}
                      {upcomingMaintenances.filter(m => m.status === 'upcoming' && m.urgency === 'high').length > 0 && (
                        <p><strong>{upcomingMaintenances.filter(m => m.status === 'upcoming' && m.urgency === 'high').length}</strong> mantenimiento(s) urgente(s)</p>
                      )}
                      {pendingIncidentsCount > 0 && (
                        <p><strong>{pendingIncidentsCount}</strong> incidente(s) pendiente(s)</p>
                      )}
                      {pendingChecklists.length > 0 && (
                        <p><strong>{pendingChecklists.length}</strong> checklist(s) pendiente(s)</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upcoming Maintenance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Próximos Mantenimientos
                    </CardTitle>
                    <CardDescription>
                      Mantenimientos programados para este activo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {upcomingLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : upcomingMaintenances.length === 0 ? (
                      <div className="text-center py-6 space-y-3">
                        <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
                        <div>
                          <p className="text-sm font-medium text-green-700">Mantenimientos al día</p>
                          <p className="text-xs text-muted-foreground mt-1">No hay mantenimientos vencidos o próximos</p>
                        </div>
                        <Button variant="outline" size="sm" asChild className="mt-2">
                          <Link href={`/activos/${assetId}/mantenimiento`}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Ver calendario completo
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {upcomingMaintenances.slice(0, 3).map((maintenance, index) => (
                          <div key={index} className={`border rounded-lg p-3 ${
                            maintenance.status === 'overdue' ? 'border-red-300 bg-red-50' : 
                            maintenance.status === 'upcoming' ? 'border-amber-300 bg-amber-50' : 
                            maintenance.status === 'covered' ? 'border-blue-300 bg-blue-50' :
                            'border-gray-200 bg-white'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                              <div className="min-w-0 flex-1">
                                <Badge 
                                  variant={
                                    maintenance.status === 'overdue' ? 'destructive' : 
                                    maintenance.status === 'upcoming' ? 'default' : 'outline'
                                  }
                                  className="mb-2"
                                >
                                  {maintenance.status === 'overdue' ? 'Vencido' : 
                                   maintenance.status === 'upcoming' ? 'Próximo' : 
                                   maintenance.status === 'scheduled' ? 'Programado' : 'Cubierto'}
                                </Badge>
                                <h4 className="font-medium text-sm sm:text-base break-words">{maintenance.intervalName}</h4>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={`text-xs self-start ${
                                  maintenance.urgency === 'high' ? 'border-red-500 text-red-600 bg-red-50' : 
                                  maintenance.urgency === 'medium' ? 'border-yellow-500 text-yellow-600 bg-yellow-50' : 
                                  'border-green-500 text-green-600 bg-green-50'
                                }`}
                              >
                                {maintenance.urgency === 'high' ? 'Alta prioridad' : 
                                 maintenance.urgency === 'medium' ? 'Media prioridad' : 'Baja prioridad'}
                              </Badge>
                            </div>
                            <div className="space-y-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 flex-shrink-0" />
                                <span className="break-words">
                                  {maintenance.unit === 'hours' ? 
                                    `${maintenance.currentValue}/${maintenance.targetValue} horas` : 
                                    `${maintenance.currentValue}/${maintenance.targetValue} km`}
                                  {maintenance.status === 'overdue' && maintenance.valueRemaining < 0 && (
                                    <span className="font-medium text-red-600 ml-2">
                                      (Excedido por {Math.abs(maintenance.valueRemaining)} {maintenance.unit === 'hours' ? 'h' : 'km'})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                                <span className="break-words">
                                  {maintenance.status === 'overdue' ? 
                                    `Vencido - debió realizarse antes de las ${maintenance.targetValue}h` :
                                    maintenance.status === 'covered' ?
                                      `Cubierto por mantenimiento posterior` :
                                    maintenance.valueRemaining > 0 ? 
                                      `Próximo en ${maintenance.valueRemaining} ${maintenance.unit === 'hours' ? 'horas' : 'km'}` :
                                      'Programado para el futuro'
                                  }
                                </span>
                              </div>
                              {maintenance.wasPerformed && maintenance.lastMaintenanceDate && (
                                <div className="flex items-center gap-2">
                                  <History className="h-4 w-4 flex-shrink-0" />
                                  <span className="break-words text-xs">
                                    Realizado: {formatDate(maintenance.lastMaintenanceDate)}
                                  </span>
                                </div>
                              )}
                              {!maintenance.wasPerformed && maintenance.status !== 'covered' && (
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-orange-500" />
                                  <span className="break-words text-xs text-orange-600">
                                    Nunca realizado
                                  </span>
                                </div>
                              )}
                            </div>
                            {(maintenance.status === 'overdue' || (maintenance.status === 'upcoming' && maintenance.urgency === 'high')) && (
                              <div className="mt-3 pt-2 border-t border-red-200">
                                <Button size="sm" variant={maintenance.status === 'overdue' ? "destructive" : "default"} asChild className="w-full">
                                  <Link href={`/activos/${assetId}/mantenimiento/nuevo?planId=${maintenance.intervalId}`}>
                                    <Wrench className="h-4 w-4 mr-2" />
                                    {maintenance.status === 'overdue' ? "¡Registrar Urgente!" : "Programar Mantenimiento"}
                                  </Link>
                                </Button>
                              </div>
                            )}
                            {maintenance.status === 'covered' && (
                              <div className="mt-3 pt-2 border-t border-blue-200">
                                <Button size="sm" variant="outline" disabled className="w-full opacity-50">
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Cubierto por mantenimiento posterior
                                </Button>
                              </div>
                            )}
                            {maintenance.status === 'upcoming' && maintenance.urgency !== 'high' && (
                              <div className="mt-3 pt-2 border-t border-amber-200">
                                <Button size="sm" variant="outline" asChild className="w-full">
                                  <Link href={`/activos/${assetId}/mantenimiento/nuevo?planId=${maintenance.intervalId}`}>
                                    <Wrench className="h-4 w-4 mr-2" />
                                    Programar Mantenimiento
                                  </Link>
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                        {upcomingMaintenances.length > 3 && (
                          <div className="mt-3 text-center">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/activos/${assetId}/mantenimiento`}>
                                Ver todos ({upcomingMaintenances.length}) mantenimientos
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Maintenance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Últimos Mantenimientos
                    </CardTitle>
                    <CardDescription>
                      Historial reciente de mantenimientos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {maintenanceLoading && !combinedMaintenanceHistory ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : (combinedMaintenanceHistory ?? maintenanceHistory).length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground">Sin historial de mantenimiento</p>
                        <Button variant="outline" className="mt-4" asChild>
                          <Link href={`/activos/${assetId}/mantenimiento/nuevo`}>
                            Registrar primer mantenimiento
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(combinedMaintenanceHistory ?? maintenanceHistory).slice(0, 4).map((maintenance: any) => (
                          <div key={maintenance.id} className="border rounded-md p-4 space-y-3">
                            <div className="flex flex-wrap justify-between gap-2">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={maintenance.type === 'Preventivo' ? 'default' :
                                            maintenance.type === 'Correctivo' ? 'destructive' : 'outline'}
                                    className="text-xs"
                                  >
                                    {maintenance.type}
                                  </Badge>
                                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {maintenance.hours || 0}h
                                  </span>
                                </div>
                                <h4 className="font-medium text-base">
                                  {formatDate(maintenance.date)}
                                </h4>
                                {maintenance.assets?.asset_id && (
                                  <div className="text-xs text-muted-foreground">
                                    Activo:
                                    <span className="ml-1 font-medium">{maintenance.assets.asset_id}</span>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                  {(() => {
                                    const intervalLabel = getIntervalLabelForMaintenance(maintenance);
                                    return intervalLabel ? (
                                      <span>
                                        Intervalo:
                                        <span className="ml-1 font-medium">{intervalLabel}</span>
                                      </span>
                                    ) : null;
                                  })()}
                                  {(() => {
                                    const po = poByWorkOrder?.[maintenance.work_order_id]
                                    const poCost = po?.adjusted_total_amount ?? po?.total_amount ?? po?.actual_amount ?? null
                                    const formatted = formatCurrency(poCost)
                                    return formatted ? (
                                      <span>
                                        Costo:
                                        <span className="ml-1 font-medium">{formatted}</span>
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {maintenance.technician || "No asignado"}
                            </p>
                            {/* Quick links to related entities when available */}
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/activos/${(maintenance as any).asset_id || assetId}/mantenimiento/${maintenance.id}`}>
                                  Ver detalles
                                </Link>
                              </Button>
                              {maintenance.work_order_id && (
                                <>
                                  <Button size="sm" variant="outline" asChild>
                                    <Link href={`/ordenes/${maintenance.work_order_id}`}>
                                      OT
                                    </Link>
                                  </Button>
                                  <Button size="sm" variant="outline" asChild>
                                    <Link href={`/servicios?workOrderId=${maintenance.work_order_id}`}>
                                      Servicio
                                    </Link>
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {(combinedMaintenanceHistory ?? maintenanceHistory).length > 4 && (
                          <div className="mt-2 text-center">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/activos/${assetId}/historial`}>
                                Ver historial completo
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Work Orders */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Órdenes de Trabajo
                    </CardTitle>
                    <CardDescription>
                      Órdenes de trabajo relacionadas con este activo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {workOrdersLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : workOrders.length === 0 ? (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button variant="outline" size="sm" asChild className="flex-1">
                            <Link href={`/ordenes?assetId=${assetId}&asset=${encodeURIComponent(asset?.name || '')}`}>
                              <FileText className="h-4 w-4 mr-2" />
                              Ver todas las OT
                            </Link>
                          </Button>
                          {ui.shouldShowInNavigation('work_orders') && (
                            <Button size="sm" asChild className="flex-1">
                              <Link href={`/ordenes/crear?assetId=${assetId}`}>
                                <Plus className="h-4 w-4 mr-2" />
                                Nueva OT
                              </Link>
                            </Button>
                          )}
                        </div>
                        
                        <div className="text-center py-4 border rounded-lg bg-muted/50">
                          <div className="flex flex-col items-center gap-2">
                            <Wrench className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Sin órdenes de trabajo</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                No hay órdenes de trabajo registradas para este activo
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button variant="outline" size="sm" asChild className="flex-1">
                            <Link href={`/ordenes?assetId=${assetId}&asset=${encodeURIComponent(asset?.name || '')}`}>
                              <FileText className="h-4 w-4 mr-2" />
                              Ver todas ({workOrders.length}+)
                            </Link>
                          </Button>
                          {ui.shouldShowInNavigation('work_orders') && (
                            <Button size="sm" asChild className="flex-1">
                              <Link href={`/ordenes/crear?assetId=${assetId}`}>
                                <Plus className="h-4 w-4 mr-2" />
                                Nueva OT
                              </Link>
                            </Button>
                          )}
                        </div>
                        
                        {workOrders.slice(0, 3).map((workOrder) => (
                          <div key={workOrder.id} className="border rounded-md p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <Badge 
                                  variant={workOrder.type === 'Preventivo' ? 'default' : 
                                          workOrder.type === 'Correctivo' ? 'destructive' : 'outline'}
                                  className="mb-1"
                                >
                                  {workOrder.type}
                                </Badge>
                                <h4 className="font-medium text-sm">{workOrder.order_id}</h4>
                              </div>
                              <Badge 
                                variant={
                                  workOrder.status === 'Completada' ? 'outline' : 
                                  workOrder.status === 'En Proceso' ? 'secondary' : 
                                  workOrder.status === 'Pendiente' ? 'default' : 'outline'
                                }
                                className="text-xs"
                              >
                                {workOrder.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {workOrder.description || 'Sin descripción'}
                            </p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>
                                {workOrder.technician_profile ? 
                                  [workOrder.technician_profile.nombre, workOrder.technician_profile.apellido].filter(Boolean).join(' ') || 'No asignado' : 
                                  'No asignado'}
                              </span>
                              <span>{formatDate(workOrder.planned_date || workOrder.created_at)}</span>
                            </div>
                            <div className="mt-2">
                              <Button size="sm" variant="outline" asChild className="w-full">
                                <Link href={`/ordenes/${workOrder.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver Detalles
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        {workOrders.length > 3 && (
                          <div className="mt-2 text-center">
                            <p className="text-sm text-muted-foreground">
                              {workOrders.length - 3} órdenes más...
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="incidents" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Incidents */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Incidentes Recientes
                    </CardTitle>
                    <CardDescription>
                      Últimos problemas reportados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {incidentsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : incidents.length === 0 ? (
                      <div className="text-center py-4">
                        <CheckCircle className="mx-auto h-8 w-8 text-green-500" />
                        <p className="text-muted-foreground mt-2">Sin incidentes reportados</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {incidents.slice(0, 3).map((incident) => (
                          <div key={incident.id} className="border rounded-md p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <Badge 
                                  variant={incident.type === 'Falla' ? 'destructive' : 'outline'}
                                  className="mb-1"
                                >
                                  {incident.type}
                                </Badge>
                                <h4 className="font-medium text-sm">{formatDate(incident.date)}</h4>
                              </div>
                              <Badge 
                                variant={
                                  incident.status?.toLowerCase() === 'resuelto' || incident.status?.toLowerCase() === 'resolved' ? 'outline' : 
                                  isPendingIncident(incident) ? 'destructive' : 'default'
                                }
                                className="flex items-center gap-1"
                              >
                                {incident.status?.toLowerCase() === 'resuelto' || incident.status?.toLowerCase() === 'resolved' ? (
                                  <CheckCircle className="h-3 w-3" />
                                ) : isPendingIncident(incident) ? (
                                  <AlertCircle className="h-3 w-3" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3" />
                                )}
                                {incident.status || 'En proceso'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{incident.reported_by}</p>
                            <p className="text-sm mt-1 line-clamp-2">{incident.description}</p>
                          </div>
                        ))}
                        {incidents.length > 3 && (
                          <div className="mt-2 text-center">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/activos/${assetId}/incidentes`}>
                                Ver todos ({incidents.length})
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pending Checklists */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Checklists Pendientes
                    </CardTitle>
                    <CardDescription>
                      Inspecciones por realizar
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pendingChecklistsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : pendingChecklists.length === 0 ? (
                      <div className="text-center py-4">
                        <CheckCircle className="mx-auto h-8 w-8 text-green-500" />
                        <p className="text-muted-foreground mt-2">Sin checklists pendientes</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingChecklists.slice(0, 3).map((checklist) => (
                          <div key={checklist.id} className="border rounded-md p-3 border-amber-200 bg-amber-50">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <Badge 
                                  variant="default"
                                  className="mb-1 bg-amber-500"
                                >
                                  Pendiente
                                </Badge>
                                <h4 className="font-medium text-sm">{formatDate(checklist.scheduled_date || checklist.created_at)}</h4>
                              </div>
                              <Badge 
                                variant={checklist.checklists?.frequency === 'diario' ? 'default' : 
                                        checklist.checklists?.frequency === 'semanal' ? 'secondary' : 'outline'}
                                className="text-xs"
                              >
                                {checklist.checklists?.frequency || 'N/A'}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium">{checklist.checklists?.name || 'Sin nombre'}</p>
                            <div className="mt-2">
                              <Button size="sm" variant="outline" className="w-full" asChild>
                                <Link href={`/checklists/ejecutar/${checklist.id}`}>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Ejecutar
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                        {pendingChecklists.length > 3 && (
                          <div className="mt-2 text-center">
                            <p className="text-sm text-muted-foreground">
                              {pendingChecklists.length - 3} más pendientes
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Completed Checklists */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5" />
                      Checklists Completados
                    </CardTitle>
                    <CardDescription>
                      Últimas inspecciones realizadas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {checklistsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : completedChecklists.length === 0 ? (
                      <div className="text-center py-4">
                        <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground mt-2">Sin checklists completados</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {completedChecklists.slice(0, 3).map((checklist) => (
                          <div key={checklist.id} className="border rounded-md p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <Badge 
                                  variant="outline"
                                  className="mb-1 bg-green-50 border-green-200 text-green-700"
                                >
                                  Completado
                                </Badge>
                                <h4 className="font-medium text-sm">{formatDate(checklist.completion_date || checklist.updated_at)}</h4>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={checklist.checklists?.frequency === 'diario' ? 'default' : 
                                          checklist.checklists?.frequency === 'semanal' ? 'secondary' : 'outline'}
                                  className="text-xs"
                                >
                                  {checklist.checklists?.frequency || 'N/A'}
                                </Badge>
                                <CompletedChecklistEvidenceViewer
                                  completedChecklistId={checklist.id}
                                  checklistName={checklist.checklists?.name || 'Sin nombre'}
                                  completionDate={checklist.completion_date || checklist.updated_at}
                                  technician={checklist.profiles ? 
                                    [checklist.profiles.nombre, checklist.profiles.apellido].filter(Boolean).join(' ') || 'No especificado' : 
                                    checklist.technician || 'No especificado'}
                                  assetName={asset?.name || 'Activo desconocido'}
                                  trigger={
                                    <Button variant="outline" size="sm" className="h-7 px-2">
                                      <Camera className="h-3 w-3 mr-1" />
                                      <span className="text-xs">Evidencias</span>
                                    </Button>
                                  }
                                />
                              </div>
                            </div>
                            <p className="text-sm font-medium">{checklist.checklists?.name || 'Sin nombre'}</p>
                            <p className="text-sm text-muted-foreground">
                              {checklist.profiles ? 
                                [checklist.profiles.nombre, checklist.profiles.apellido].filter(Boolean).join(' ') || 'No especificado' : 
                                checklist.technician || 'No especificado'}
                            </p>
                            
                            {/* Mostrar información adicional si hay lecturas de equipo */}
                            {(checklist.equipment_hours_reading || checklist.equipment_kilometers_reading) && (
                              <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                                {checklist.equipment_hours_reading && (
                                  <span className="mr-3">
                                    🕒 {checklist.equipment_hours_reading} horas
                                  </span>
                                )}
                                {checklist.equipment_kilometers_reading && (
                                  <span>
                                    🚗 {checklist.equipment_kilometers_reading} km
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* Botón para ver detalles del checklist completado */}
                            <div className="mt-3 pt-2 border-t">
                              <Button size="sm" variant="outline" asChild className="w-full">
                                <Link href={`/checklists/completado/${checklist.id}`}>
                                  <ClipboardCheck className="h-4 w-4 mr-2" />
                                  Ver Detalles
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                        {completedChecklists.length > 3 && (
                          <div className="mt-2 text-center">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/activos/${assetId}/historial-checklists`}>
                                Ver historial completo ({completedChecklists.length} checklists)
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="technical" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Especificaciones Técnicas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <dl className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Número de Serie</dt>
                          <dd className="text-lg">{asset?.serial_number || "No especificado"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Modelo</dt>
                          <dd className="text-lg">{asset?.model?.name || "No especificado"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Fabricante</dt>
                          <dd className="text-lg">{asset?.model?.manufacturer || "No especificado"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Unidad de Mantenimiento</dt>
                          <dd className="text-lg">{asset?.model?.maintenance_unit || "No especificada"}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <dl className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Horas Iniciales</dt>
                          <dd className="text-lg">{asset?.initial_hours !== null ? `${asset?.initial_hours} horas` : "No especificadas"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Kilómetros Iniciales</dt>
                          <dd className="text-lg">{asset?.initial_kilometers !== null ? `${asset?.initial_kilometers} km` : "No aplicable"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Categoría</dt>
                          <dd className="text-lg">{asset?.model?.category || "No especificada"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Año de Introducción</dt>
                          <dd className="text-lg">{asset?.model?.year_introduced || "No especificado"}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  
                  {asset?.notes && (
                    <>
                      <Separator className="my-6" />
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Notas Adicionales</h4>
                        <p className="text-sm">{asset.notes}</p>
                      </div>
                    </>
                  )}
                  
                  {asset?.photos && asset.photos.length > 0 && (
                    <>
                      <Separator className="my-6" />
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-4">Fotografías del Activo</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {asset.photos.map((photoUrl, index) => {
                            // Extract category from filename (if present)
                            const categoryMatch = photoUrl.match(/\/(\d+)-([^\/]+)-([^\/]+\.[^\/]+)$/);
                            const categoryCode = categoryMatch ? categoryMatch[2] : "otros";
                            const categoryInfo = PHOTO_CATEGORIES[categoryCode] || PHOTO_CATEGORIES.otros;
                            
                            // Extract original filename for additional context
                            const filename = categoryMatch ? categoryMatch[3] : photoUrl.split('/').pop() || "";
                            
                            return (
                              <div key={index} className="relative border rounded-lg overflow-hidden group">
                                <div className="absolute top-2 left-2 z-10">
                                  <Badge className={`${categoryInfo.color} text-white px-2 py-1`}>
                                    {categoryInfo.label}
                                  </Badge>
                                </div>
                                <img 
                                  src={photoUrl} 
                                  alt={`${categoryInfo.label} - ${filename}`} 
                                  className="w-full h-40 object-cover"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="truncate">{filename}</span>
                                    <a 
                                      href={photoUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-white hover:text-blue-300 transition-colors"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="documentation" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Documentación</CardTitle>
                    <CardDescription>Manuales y documentación técnica relacionada</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {asset?.insurance_documents && asset.insurance_documents.length > 0 ? (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-muted-foreground">Documentos de Seguro</h4>
                        <div className="space-y-2">
                          {asset.insurance_documents.map((docUrl, index) => {
                            // Extract filename from URL
                            const filename = docUrl.split('/').pop() || `Documento ${index + 1}`;
                            
                            return (
                              <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{filename}</span>
                                </div>
                                <a
                                  href={docUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <Button variant="ghost" size="sm">
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    Ver
                                  </Button>
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                        <h3 className="mt-4 text-lg font-medium">No hay documentos disponibles</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Los documentos técnicos se encuentran asociados al modelo de equipo.
                        </p>
                        {asset?.model && (
                          <Button variant="outline" className="mt-4" asChild>
                            <Link href={`/modelos/${asset.model.id}`}>
                              Ver documentación del modelo
                            </Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Información Financiera</CardTitle>
                    <CardDescription>Datos administrativos y financieros</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-4">
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Fecha de Compra</dt>
                        <dd className="text-lg">{formatDate(asset?.purchase_date || null)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Costo de Adquisición</dt>
                        <dd className="text-lg">{asset?.purchase_cost || "No especificado"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Garantía Válida Hasta</dt>
                        <dd className="text-lg">{formatDate(asset?.warranty_expiration || null)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Información de Registro</dt>
                        <dd className="text-lg">{asset?.registration_info || "No especificada"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Póliza de Seguro</dt>
                        <dd className="text-lg">{asset?.insurance_policy || "No especificada"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Seguro Válido Hasta</dt>
                        <dd className="text-lg">{formatDate(asset?.insurance_end_date || null)}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </DashboardShell>
  );
} 