'use client';

import { useState, useEffect, use } from 'react';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Plus, Calendar, Wrench, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useAsset, useMaintenanceHistory } from "@/hooks/useSupabase";
import { createClient } from "@/lib/supabase";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

interface MaintenancePageProps {
  params: Promise<{
    id: string
  }>
}

interface CyclicMaintenanceInterval {
  interval_id: string;
  interval_value: number;
  name: string;
  description: string;
  type: string;
  maintenance_category: string;
  is_recurring: boolean;
  is_first_cycle_only: boolean;
  current_cycle: number;
  next_due_hour: number;
  status: string;
  cycle_length: number;
  component_id?: string;
  component_name?: string;
  component_hours?: number;
}

export default function MaintenancePage({ params }: MaintenancePageProps) {
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  
  const { asset, loading: assetLoading, error: assetError } = useAsset(assetId);
  const { history: maintenanceHistory, loading: historyLoading, error: historyError } = useMaintenanceHistory(assetId);
  const [isComposite, setIsComposite] = useState(false)
  const [parentCompositeId, setParentCompositeId] = useState<string | null>(null)
  const [combinedMaintenanceHistory, setCombinedMaintenanceHistory] = useState<any[] | null>(null)
  const [aggregatedUpcoming, setAggregatedUpcoming] = useState<any[] | null>(null)
  const [cyclicIntervals, setCyclicIntervals] = useState<CyclicMaintenanceInterval[]>([]);
  const [currentCycle, setCurrentCycle] = useState<number>(1);
  const [cycleLength, setCycleLength] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Detect composite context and load composite dashboard if needed
  useEffect(() => {
    async function detectComposite() {
      try {
        const supabase = createClient()
        const { data: a } = await supabase
          .from('assets')
          .select('id, is_composite')
          .eq('id', assetId)
          .single()
        if (a?.is_composite) {
          setIsComposite(true)
          const resp = await fetch(`/api/assets/composites/${assetId}/dashboard`)
          if (resp.ok) {
            const json = await resp.json()
            setCombinedMaintenanceHistory(json?.data?.maintenance_history || [])
            setAggregatedUpcoming(json?.data?.upcoming_maintenance || [])
          }
          return
        }
        const { data: rel } = await supabase
          .from('asset_composite_relationships')
          .select('composite_asset_id')
          .eq('component_asset_id', assetId)
          .eq('status', 'active')
          .maybeSingle()
        if (rel?.composite_asset_id) setParentCompositeId(rel.composite_asset_id)
      } catch (e) {
        console.error('Composite detection failed', e)
      }
    }
    detectComposite()
  }, [assetId])

  // Load cyclic maintenance intervals
  useEffect(() => {
    async function fetchCyclicMaintenanceIntervals() {
      if (!asset?.model_id && !isComposite) return;

      try {
        setLoading(true);
        const supabase = createClient();

        if (isComposite) {
          // For composite assets, aggregate intervals from all components
          const resp = await fetch(`/api/assets/composites/${assetId}/dashboard`)
          if (resp.ok) {
            const json = await resp.json()
            const components = json?.data?.components || []

            if (components.length === 0) {
              setLoading(false)
              return
            }

            // Get all unique model IDs from components
            const modelIds = Array.from(new Set(components.map((c: any) => c.model_id).filter(Boolean)))

            if (modelIds.length === 0) {
              setLoading(false)
              return
            }

            // Fetch intervals for all component models
            const { data: intervals, error: intervalsError } = await supabase
              .from("maintenance_intervals")
              .select(`
                *,
                maintenance_tasks(*)
              `)
              .in("model_id", modelIds);

            if (intervalsError) throw intervalsError;

            if (intervals && intervals.length > 0) {
              // Calculate aggregated cycle length (highest interval across all models)
              const maxInterval = Math.max(...intervals.map(i => i.interval_value));
              setCycleLength(maxInterval);

              // Calculate current cycle based on the component with highest hours
              const maxCurrentHours = Math.max(...components.map((c: any) => c.current_hours || 0));
              const currentCycleNum = Math.floor(maxCurrentHours / maxInterval) + 1;
              setCurrentCycle(currentCycleNum);

              // Process intervals with proper cyclic logic for each component
              const processedIntervals: CyclicMaintenanceInterval[] = [];

              // Group intervals by model for processing
              const intervalsByModel: Record<string, any[]> = {};
              intervals.forEach(interval => {
                if (!intervalsByModel[interval.model_id]) {
                  intervalsByModel[interval.model_id] = [];
                }
                intervalsByModel[interval.model_id].push(interval);
              });

              // Find the component for each model to get its maintenance history
              const componentByModel: Record<string, any> = {};
              components.forEach((c: any) => {
                if (c.model_id) {
                  componentByModel[c.model_id] = c;
                }
              });

              // Process each model's intervals with cyclic logic
              Object.entries(intervalsByModel).forEach(([modelId, modelIntervals]) => {
                const component = componentByModel[modelId];
                if (!component) return;

                const componentHours = component.current_hours || 0;
                const componentHistory = (json?.data?.maintenance_history || []).filter(
                  (m: any) => m.asset_id === component.id
                );

                // Find the highest maintenance performed in current cycle (for "covered" logic)
                const currentCycleStartHour = (currentCycleNum - 1) * maxInterval;
                const currentCycleEndHour = currentCycleNum * maxInterval;

                // Use preventive, plan-linked entries only for coverage/completion
                // CRITICAL: Only consider maintenance_history entries where maintenance_plan_id matches an actual interval
                // This excludes work orders and service orders NOT linked to cycle intervals
                const componentPreventiveHistory = componentHistory.filter((m: any) => {
                  if (m?.type !== 'Preventivo' || !m?.maintenance_plan_id) return false
                  // Verify maintenance_plan_id exists in the intervals array
                  return intervals.some((interval: any) => interval.id === m.maintenance_plan_id)
                })
                const currentCycleMaintenances = componentPreventiveHistory.filter((m: any) => {
                  const mHours = Number(m.hours) || 0;
                  return mHours > currentCycleStartHour && mHours < currentCycleEndHour;
                });

                const highestMaintenanceInCycle = currentCycleMaintenances.length > 0
                  ? Math.max(...currentCycleMaintenances.map((m: any) => Number(m.hours) || 0))
                  : 0;

                // Process each interval for this component
                modelIntervals.forEach(interval => {
                  const isRecurring = (interval as any).is_recurring !== false;
                  const isFirstCycleOnly = (interval as any).is_first_cycle_only === true;
                  const category = (interval as any).maintenance_category || 'standard';

                  // Calculate next due hour for current cycle
                  let nextDueHour: number | null = null;
                  let status = 'not_applicable';
                  let cycleForService = currentCycleNum;

                  if (!isFirstCycleOnly || currentCycleNum === 1) {
                    // Calculate the due hour for current cycle
                    nextDueHour = ((currentCycleNum - 1) * maxInterval) + interval.interval_value;

                    // Special case: if nextDueHour exceeds the current cycle end,
                    // calculate for next cycle instead
                    const currentCycleEndHour = currentCycleNum * maxInterval;
                    if ((nextDueHour ?? 0) > currentCycleEndHour) {
                      // This service belongs to next cycle
                      cycleForService = currentCycleNum + 1;
                      nextDueHour = (currentCycleNum * maxInterval) + interval.interval_value;

                      // Only show next cycle services if they're within reasonable range (e.g., 1000 hours)
                      if (Number(nextDueHour) - componentHours <= 1000) {
                        status = 'scheduled';
                      } else {
                        status = 'not_applicable';
                      }
                    } else {
                      // Current cycle logic (includes services that fall exactly at cycle boundary)
                      // Check if this specific interval was performed in the current cycle
                      const safeDue = Number(nextDueHour ?? 0)
                      const wasPerformedInCurrentCycle = safeDue > 0 && currentCycleMaintenances.some((m: any) => {
                        const maintenanceHours = Number(m.hours) || 0;
                        // The maintenance should match both the plan ID AND be in the right hour range for this cycle
                        const tolerance = 200; // Allow some tolerance for when maintenance is done early/late

                        return m.maintenance_plan_id === interval.id &&
                               Math.abs(maintenanceHours - safeDue) <= tolerance;
                      });

                      if (wasPerformedInCurrentCycle) {
                        status = 'completed';
                      } else {
                        // Plan-aware coverage: higher/equal interval (same unit/category) covers lower ones
                        // CRITICAL: Coverage is based SOLELY on interval value comparison
                        // If a higher interval service is performed, it covers ALL lower interval services (including future ones)
                        // Example: If 1500h service performed at 1150h, it covers 300h, 600h, 900h, 1200h, 1500h
                        // NO timing/position verification needed - purely interval value comparison
                        const isCoveredByHigher = currentCycleMaintenances.some((m: any) => {
                          const performedPlanId = m.maintenance_plan_id;
                          const performedInterval = (intervals as any[]).find((i: any) => i.id === performedPlanId);
                          const dueInterval = interval;
                          if (!performedInterval || !dueInterval) return false;
                          const sameUnit = performedInterval.type === dueInterval.type;
                          const sameCategory = (performedInterval as any).maintenance_category === (dueInterval as any).maintenance_category;
                          const categoryOk = (performedInterval as any).maintenance_category && (dueInterval as any).maintenance_category ? sameCategory : true;
                          // CRITICAL: Coverage based SOLELY on interval value comparison
                          // If performed interval value >= due interval value, it covers it
                          // Works forward: performing 1500h covers all intervals <= 1500h, even future ones
                          const higherOrEqual = Number(performedInterval.interval_value) >= Number(dueInterval.interval_value);
                          return sameUnit && categoryOk && higherOrEqual;
                        });

                        if (isCoveredByHigher) {
                          status = 'covered';
                        } else if (componentHours >= Number(nextDueHour)) {
                          status = 'overdue';
                        } else if (componentHours >= Number(nextDueHour) - 100) {
                          status = 'upcoming';
                        } else {
                          status = 'scheduled';
                        }
                      }
                    }
                  }

                  // Add component information to the interval
                  processedIntervals.push({
                    interval_id: interval.id,
                    interval_value: interval.interval_value,
                    name: interval.name,
                    description: interval.description || '',
                    type: interval.type,
                    maintenance_category: category,
                    is_recurring: isRecurring,
                    is_first_cycle_only: isFirstCycleOnly,
                    current_cycle: cycleForService,
                    next_due_hour: nextDueHour || 0,
                    status,
                    cycle_length: maxInterval,
                    component_id: component.id,
                    component_name: component.name,
                    component_hours: componentHours
                  });
                });
              });

              // Filter and sort - show relevant intervals for current cycle and near future
              const filtered = processedIntervals.filter(i => {
                // Show: overdue, upcoming, scheduled, covered
                // Don't show: not_applicable, completed (already done)
                return ['overdue', 'upcoming', 'scheduled', 'covered'].includes(i.status);
              });

              const sorted = filtered.sort((a, b) => {
                // First sort by cycle
                if (a.current_cycle !== b.current_cycle) {
                  return a.current_cycle - b.current_cycle;
                }

                // Then by status priority
                const statusOrder = { 'overdue': 4, 'upcoming': 3, 'scheduled': 2, 'covered': 1 };
                const statusA = statusOrder[a.status as keyof typeof statusOrder] || 0;
                const statusB = statusOrder[b.status as keyof typeof statusOrder] || 0;

                if (statusA !== statusB) return statusB - statusA;
                return a.interval_value - b.interval_value;
              });

              setCyclicIntervals(sorted);
            }
          }
        } else {
          // Original logic for non-composite assets
            const { data: intervals, error: intervalsError } = await supabase
            .from("maintenance_intervals")
            .select(`
              *,
              maintenance_tasks(*)
            `)
            .eq("model_id", asset!.model_id);

          if (intervalsError) throw intervalsError;

          if (intervals && intervals.length > 0) {
            // Calculate cycle length (highest interval)
            const maxInterval = Math.max(...intervals.map(i => i.interval_value));
            setCycleLength(maxInterval);

            // Calculate current cycle
            const currentHours = asset!.current_hours || 0;
            const currentCycleNum = Math.floor(currentHours / maxInterval) + 1;
            setCurrentCycle(currentCycleNum);

            // Find the highest maintenance performed in current cycle (for "covered" logic)
            const currentCycleStartHour = (currentCycleNum - 1) * maxInterval;
            const currentCycleEndHour = currentCycleNum * maxInterval;

            // Use preventive, plan-linked entries only for coverage/completion
            // CRITICAL: Fetch maintenance_plans to map maintenance_plan_id to interval_id
            const { data: maintenancePlans } = await supabase
              .from('maintenance_plans')
              .select('id, interval_id')
              .eq('asset_id', assetId);
            
            console.log(`[MAINT PAGE ${assetId}] Fetched maintenance_plans:`, maintenancePlans);
            
            // Create mapping: maintenance_plan_id -> interval_id
            const planToIntervalMap = new Map<string, string>();
            (maintenancePlans || []).forEach(plan => {
              if (plan.id && plan.interval_id) {
                planToIntervalMap.set(plan.id, plan.interval_id);
              }
            });
            
            console.log(`[MAINT PAGE ${assetId}] Plan to Interval Map:`, Array.from(planToIntervalMap.entries()));
            
            console.log(`[MAINT PAGE ${assetId}] Total maintenance history:`, maintenanceHistory.length);
            console.log(`[MAINT PAGE ${assetId}] Intervals:`, intervals.map(i => ({id: i.id, value: i.interval_value})));
            
            // CRITICAL: maintenance_history.maintenance_plan_id DIRECTLY stores maintenance_intervals.id!
            // Direct reference: maintenance_history.maintenance_plan_id → maintenance_intervals.id
            const preventiveHistory = maintenanceHistory.filter(m => {
              // Check for 'preventive' (English) or 'preventivo' (Spanish) - handle both languages and cases
              const typeLower = m?.type?.toLowerCase();
              const isPreventive = typeLower === 'preventive' || typeLower === 'preventivo';
              if (!isPreventive || !m?.maintenance_plan_id) return false
              
              // maintenance_plan_id IS the interval.id - check directly
              return intervals.some(interval => interval.id === m.maintenance_plan_id);
            });
            
            console.log(`[MAINT PAGE ${assetId}] Preventive history after filtering:`, preventiveHistory.length);
            console.log(`[MAINT PAGE ${assetId}] Preventive details:`, preventiveHistory.map(m => {
              // maintenance_plan_id is actually the interval_id which IS the interval.id
              const interval = intervals.find(i => i.id === m.maintenance_plan_id);
              return {
                date: m.date,
                maintenance_plan_id: m.maintenance_plan_id,
                interval_id: m.maintenance_plan_id,
                interval_value: interval?.interval_value,
                hours: m.hours
              };
            }));
            const currentCycleMaintenances = preventiveHistory.filter(m => {
              const mHours = Number(m.hours) || 0;
              // Exclude maintenance that marks the end of previous cycle (exactly at cycle boundary)
              return mHours > currentCycleStartHour && mHours < currentCycleEndHour;
            });
            
            console.log(`[MAINT PAGE ${assetId}] Current cycle: ${currentCycleNum}, Range: ${currentCycleStartHour}h - ${currentCycleEndHour}h`);
            console.log(`[MAINT PAGE ${assetId}] Current cycle maintenances:`, currentCycleMaintenances.length);
            console.log(`[MAINT PAGE ${assetId}] Current cycle details:`, currentCycleMaintenances.map(m => ({
              date: m.date,
              maintenance_plan_id: m.maintenance_plan_id,
              hours: m.hours,
              interval_value: intervals.find(i => i.id === m.maintenance_plan_id)?.interval_value
            })));

            const highestMaintenanceInCycle = currentCycleMaintenances.length > 0
              ? Math.max(...currentCycleMaintenances.map(m => Number(m.hours) || 0))
              : 0;

            // Process intervals for cyclic logic
            const processedIntervals: CyclicMaintenanceInterval[] = intervals.map(interval => {
              // Handle new fields with fallbacks for backward compatibility
              const isRecurring = (interval as any).is_recurring !== false; // Default to true
              const isFirstCycleOnly = (interval as any).is_first_cycle_only === true; // Default to false
              const category = (interval as any).maintenance_category || 'standard';

              // Calculate next due hour for current cycle
              let nextDueHour: number | null = null;
              let status = 'not_applicable';
              let cycleForService = currentCycleNum;

              if (!isFirstCycleOnly || currentCycleNum === 1) {
                // Calculate the due hour for current cycle
                nextDueHour = ((currentCycleNum - 1) * maxInterval) + interval.interval_value;

                // Special case: if nextDueHour exceeds the current cycle end,
                // calculate for next cycle instead
                const currentCycleEndHour = currentCycleNum * maxInterval;
                if ((nextDueHour ?? 0) > currentCycleEndHour) {
                  // This service belongs to next cycle
                  cycleForService = currentCycleNum + 1;
                  nextDueHour = (currentCycleNum * maxInterval) + interval.interval_value;

                  // Only show next cycle services if they're within reasonable range (e.g., 1000 hours)
                  if (Number(nextDueHour) - currentHours <= 1000) {
                    status = 'scheduled';
                  } else {
                    status = 'not_applicable';
                  }
                } else {
                  // Current cycle logic (includes services that fall exactly at cycle boundary)
                  // Check if this specific interval was performed in the current cycle
                  // CRITICAL: maintenance_plan_id IS the interval ID
                  const wasPerformedInCurrentCycle = currentCycleMaintenances.some(m => {
                    const matches = m.maintenance_plan_id === interval.id;
                    if (interval.interval_value === 1500 || matches) {
                      console.log(`[MAINT PAGE ${assetId}] Checking ${interval.interval_value}h completion:`, {
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
                    // Plan-aware coverage: higher/equal interval (same unit/category) covers lower ones
                    // CRITICAL: Coverage is based SOLELY on interval value comparison
                    // CRITICAL: maintenance_plan_id IS the interval ID
                    const isCoveredByHigher = currentCycleMaintenances.some(m => {
                      const performedInterval = intervals.find((i: any) => i.id === m.maintenance_plan_id);
                      const dueInterval = interval;
                      if (!performedInterval || !dueInterval) return false;
                      const sameUnit = performedInterval.type === dueInterval.type;
                      const sameCategory = (performedInterval as any).maintenance_category === (dueInterval as any).maintenance_category;
                      const categoryOk = (performedInterval as any).maintenance_category && (dueInterval as any).maintenance_category ? sameCategory : true;
                      // CRITICAL: Coverage based SOLELY on interval value comparison
                      // If performed interval value >= due interval value, it covers it
                      // Works forward: performing 1500h covers all intervals <= 1500h, even future ones
                      const higherOrEqual = Number(performedInterval.interval_value) >= Number(dueInterval.interval_value);
                      return sameUnit && categoryOk && higherOrEqual;
                    });

                    if (isCoveredByHigher) {
                      status = 'covered';
                    } else if (currentHours >= Number(nextDueHour)) {
                      status = 'overdue';
                    } else if (currentHours >= Number(nextDueHour) - 100) {
                      status = 'upcoming';
                    } else {
                      status = 'scheduled';
                    }
                  }
                }
              }

              return {
                interval_id: interval.id,
                interval_value: interval.interval_value,
                name: interval.name,
                description: interval.description || '',
                type: interval.type,
                maintenance_category: category,
                is_recurring: isRecurring,
                is_first_cycle_only: isFirstCycleOnly,
                current_cycle: cycleForService,
                next_due_hour: nextDueHour || 0,
                status,
                cycle_length: maxInterval
              };
            });

            // Filter and sort - show relevant intervals for current cycle and near future
            const filtered = processedIntervals.filter(i => {
              // Show: overdue, upcoming, scheduled, covered
              // Don't show: not_applicable, completed (already done)
              return ['overdue', 'upcoming', 'scheduled', 'covered'].includes(i.status);
            });

            const sorted = filtered.sort((a, b) => {
              // First sort by cycle
              if (a.current_cycle !== b.current_cycle) {
                return a.current_cycle - b.current_cycle;
              }

              // Then by status priority
              const statusOrder = { 'overdue': 4, 'upcoming': 3, 'scheduled': 2, 'covered': 1 };
              const statusA = statusOrder[a.status as keyof typeof statusOrder] || 0;
              const statusB = statusOrder[b.status as keyof typeof statusOrder] || 0;

              if (statusA !== statusB) return statusB - statusA;
              return a.interval_value - b.interval_value;
            });

            // Debug logs
            if (sorted.length === 0) {
              console.log("⚠️ No intervals found after filtering");
              console.log("Processed intervals:", processedIntervals.length);
              console.log("All statuses:", processedIntervals.map(i => `${i.interval_value}h: ${i.status}`));
            }

            setCyclicIntervals(sorted);
          }
        }
      } catch (err) {
        console.error("Error al cargar intervalos de mantenimiento cíclico:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    if ((isComposite || asset?.model_id) && !historyLoading) {
      fetchCyclicMaintenanceIntervals();
    }
  }, [asset, maintenanceHistory, historyLoading, isComposite]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'overdue': return 'destructive';
      case 'upcoming': return 'default';
      case 'scheduled': return 'outline';
      case 'covered': return 'secondary';
      case 'not_applicable': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'overdue': return 'Vencido';
      case 'upcoming': return 'Próximo';
      case 'scheduled': return 'Programado';
      case 'covered': return 'Cubierto';
      case 'not_applicable': return 'No aplicable';
      default: return status;
    }
  };

  const calculateCycleInfo = () => {
    if (!cycleLength) return null;

    let currentHours: number;
    if (isComposite) {
      // For composite assets, use the maximum current hours from all components
      if (combinedMaintenanceHistory && combinedMaintenanceHistory.length > 0) {
        const maxHours = Math.max(...combinedMaintenanceHistory.map((m: any) => Number(m.hours) || 0));
        currentHours = maxHours;
      } else {
        currentHours = 0;
      }
    } else {
      currentHours = asset?.current_hours || 0;
    }

    const hoursInCurrentCycle = currentHours % cycleLength;
    const nextCycleStartsAt = currentCycle * cycleLength;
    const hoursToNextCycle = nextCycleStartsAt - currentHours;

    return {
      hoursInCurrentCycle,
      nextCycleStartsAt,
      hoursToNextCycle,
      progressInCycle: (hoursInCurrentCycle / cycleLength) * 100
    };
  };

  const isLoading = assetLoading || historyLoading || loading;
  const anyError = assetError || historyError || error;

  const cycleInfo = calculateCycleInfo();
  
  // Decide which maintenance history to display (aggregated for composites)
  const displayMaintenanceHistory = (isComposite && combinedMaintenanceHistory)
    ? combinedMaintenanceHistory
    : maintenanceHistory;

  return (
    <DashboardShell>
      <DashboardHeader
        heading={isLoading ? "Cargando plan de mantenimiento..." : `Plan de Mantenimiento: ${asset?.name || ""}`}
        text={isLoading ? "" : parentCompositeId ? `Este activo pertenece a un Activo Compuesto` : isComposite ? `Vista compuesta (sin modelo propio)` : `Programación cíclica de mantenimientos para ${asset?.asset_id || ""}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/activos/${assetId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          {!isComposite && (
            <Button asChild>
              <Link href={`/activos/${assetId}/historial`}>
                <Calendar className="mr-2 h-4 w-4" />
                Ver Historial
              </Link>
            </Button>
          )}
          {parentCompositeId && (
            <Button asChild>
              <Link href={`/activos/${parentCompositeId}`}>
                <Wrench className="mr-2 h-4 w-4" />
                Ver Mantenimiento Compuesto
              </Link>
            </Button>
          )}
        </div>
      </DashboardHeader>

      {anyError && (
        <Alert variant="destructive">
          <AlertDescription>
            Error al cargar los datos: {anyError.message}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div className="h-6 w-1/3 bg-gray-200 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-4/6 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Composite aggregated upcoming */}
          {isComposite && (
            <Card>
              <CardHeader>
                <CardTitle>Mantenimientos Próximos (Compuesto)</CardTitle>
                <CardDescription>Servicios agregados de los componentes</CardDescription>
              </CardHeader>
              <CardContent>
                {!aggregatedUpcoming || aggregatedUpcoming.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">Sin servicios próximos</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Activo</TableHead>
                        <TableHead>Servicio</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Próximo</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aggregatedUpcoming.map((m: any) => (
                        <TableRow key={`${m.asset_id}-${m.interval_id}`}>
                          <TableCell>{m.asset_name}</TableCell>
                          <TableCell>{m.interval_name}</TableCell>
                          <TableCell>
                            <Badge variant={m.status === 'overdue' ? 'destructive' : m.status === 'upcoming' ? 'default' : 'outline'}>
                              {m.status === 'overdue' ? 'Vencido' : m.status === 'upcoming' ? 'Próximo' : m.status === 'covered' ? 'Cubierto' : 'Programado'}
                            </Badge>
                          </TableCell>
                          <TableCell>{m.target_value}h</TableCell>
                          <TableCell>
                            <Button size="sm" asChild variant={m.status === 'overdue' ? 'destructive' : 'default'}>
                              <Link href={`/activos/${m.asset_id}/mantenimiento/nuevo?planId=${m.interval_id}&cycleHour=${m.target_value}`}>
                                {m.status === 'overdue' ? '¡Urgente!' : 'Programar'}
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cycle Information Card */}
          {cycleInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Información del Ciclo de Mantenimiento
                </CardTitle>
                <CardDescription>
                  {isComposite
                    ? "Estado actual del ciclo de mantenimiento del activo compuesto (basado en el componente con más horas)"
                    : "Estado actual del ciclo de mantenimiento del equipo"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Ciclo Actual</div>
                    <div className="text-2xl font-bold text-blue-600">
                      Ciclo {currentCycle}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Horas Actuales</div>
                    <div className="text-2xl font-bold">
                      {isComposite
                        ? `${Math.max(...(combinedMaintenanceHistory || []).map((m: any) => Number(m.hours) || 0))}h (máx. componente)`
                        : `${asset?.current_hours || 0}h`
                      }
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Próximo Ciclo</div>
                    <div className="text-2xl font-bold text-green-600">
                      {cycleInfo.nextCycleStartsAt}h
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Faltan {cycleInfo.hoursToNextCycle}h
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Progreso del Ciclo</div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(cycleInfo.progressInCycle, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.round(cycleInfo.progressInCycle)}% completado
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {isComposite
                  ? "Mantenimientos del Ciclo Actual (Compuesto)"
                  : "Mantenimientos del Ciclo Actual"
                }
              </CardTitle>
              <CardDescription>
                {isComposite
                  ? `Mantenimientos programados para el Ciclo ${currentCycle} (agregados de todos los componentes)`
                  : `Mantenimientos programados para el Ciclo ${currentCycle}`
                }
                {cycleLength > 0 && ` (cada ${cycleLength} horas)`}
              </CardDescription>
                             <div className="mt-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                 <p>
                   <span className="font-medium">Sistema Cíclico:</span> Los mantenimientos se repiten cada {cycleLength} horas.
                   Después de completar el mantenimiento a las {cycleLength}h, el ciclo se reinicia y el próximo mantenimiento
                   será a las {cycleLength + (cyclicIntervals[0]?.interval_value || 0)}h.
                 </p>
                 <p className="mt-1">
                   <span className="font-medium">Lógica de Cobertura:</span> Un mantenimiento mayor puede "cubrir" mantenimientos menores
                   dentro del mismo ciclo. Por ejemplo, si se realiza el servicio de 600h, este cubre automáticamente el servicio de 300h en el mismo ciclo.
                 </p>
                 {isComposite && (
                   <p className="mt-1">
                     <span className="font-medium">Vista Compuesta:</span> Esta tabla muestra los intervalos de mantenimiento agregados de todos los componentes del activo compuesto.
                     Los estados se calculan basado en el componente que requiere el mantenimiento en cada momento.
                   </p>
                 )}
               </div>
                             <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                 <div className="flex items-center gap-2 text-xs">
                   <div className="h-3 w-3 rounded-full bg-red-600"></div>
                   <span>Vencido</span>
                 </div>
                 <div className="flex items-center gap-2 text-xs">
                   <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                   <span>Próximo (≤100h)</span>
                 </div>
                 <div className="flex items-center gap-2 text-xs">
                   <div className="h-3 w-3 rounded-full bg-green-500"></div>
                   <span>Programado</span>
                 </div>
                 <div className="flex items-center gap-2 text-xs">
                   <div className="h-3 w-3 rounded-full bg-blue-400"></div>
                   <span>Cubierto</span>
                 </div>
                 <div className="flex items-center gap-2 text-xs">
                   <div className="h-3 w-3 rounded-full bg-gray-400"></div>
                   <span>No aplicable</span>
                 </div>
               </div>
            </CardHeader>
            <CardContent>
              {cyclicIntervals.length === 0 ? (
                <div className="py-8 text-center border rounded-md bg-gray-50">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-2" />
                  <p className="text-lg font-medium">No hay intervalos de mantenimiento configurados</p>
                  <p className="text-muted-foreground">Configure intervalos en el modelo del equipo</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Servicio</TableHead>
                      {isComposite && (<TableHead>Componente</TableHead>)}
                      <TableHead>Descripción</TableHead>
                      <TableHead>Intervalo Original</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Próximo a las</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                                         {cyclicIntervals.map((interval) => {
                       const isOverdue = interval.status === 'overdue';
                       const isUpcoming = interval.status === 'upcoming';
                       const isCovered = interval.status === 'covered';
                       const isNotApplicable = interval.status === 'not_applicable';
                       
                       return (
                         <TableRow 
                           key={interval.interval_id} 
                           className={
                             isOverdue ? "bg-red-50" : 
                             isUpcoming ? "bg-amber-50" : 
                             isCovered ? "bg-blue-50" :
                             isNotApplicable ? "bg-gray-50" : "bg-green-50"
                           }
                        >
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant={getStatusBadgeVariant(interval.status)}
                                className="whitespace-nowrap text-xs inline-flex mb-1"
                              >
                                {interval.type} {interval.interval_value}h
                              </Badge>
                              <div className="text-xs font-medium">
                                Categoría: {interval.maintenance_category}
                              </div>
                              {interval.is_first_cycle_only && (
                                <div className="text-xs text-orange-600">
                                  Solo primer ciclo
                                </div>
                              )}
                            </div>
                          </TableCell>
                          {isComposite && (
                            <TableCell>
                              <div className="font-medium">{(interval as any).component_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {(interval as any).component_hours}h actuales
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="font-medium">{interval.name}</div>
                            {interval.description && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {interval.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">Cada {interval.interval_value} horas</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              En ciclo de {interval.cycle_length}h
                            </div>
                            <Badge variant="secondary" className="text-xs mt-1">
                              {interval.is_recurring ? 'Recurrente' : 'Una vez'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant={getStatusBadgeVariant(interval.status)}>
                                {getStatusLabel(interval.status)}
                              </Badge>
                              {interval.next_due_hour && asset?.current_hours && (
                                <div className="text-xs text-muted-foreground">
                                  {interval.status === 'overdue' ? (
                                    <span className="text-red-600 font-medium">
                                      Vencido por {asset.current_hours - interval.next_due_hour}h
                                    </span>
                                  ) : interval.status === 'upcoming' ? (
                                    <span className="text-amber-600 font-medium">
                                      Próximo en {interval.next_due_hour - asset.current_hours}h
                                    </span>
                                  ) : interval.status === 'scheduled' ? (
                                    <span className="text-green-600">
                                      Faltan {interval.next_due_hour - asset.current_hours}h
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {interval.next_due_hour ? (
                              <div className="space-y-1">
                                <div className="font-medium">{interval.next_due_hour}h</div>
                                <div className="text-xs text-muted-foreground">
                                  Ciclo {interval.current_cycle}
                                  {isComposite && (
                                    <div className="text-xs">
                                      {(interval as any).component_hours}h actuales
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">
                                No aplicable
                              </div>
                            )}
                          </TableCell>
                                                     <TableCell>
                             {interval.status === 'not_applicable' ? (
                               <Button 
                                 size="sm" 
                                 variant="outline"
                                 disabled
                                 className="opacity-50"
                               >
                                 No aplicable
                               </Button>
                             ) : interval.status === 'covered' ? (
                               <Button 
                                 size="sm" 
                                 variant="outline"
                                 disabled
                                 className="opacity-50"
                               >
                                 Cubierto
                               </Button>
                             ) : (
                               <Button
                                 size="sm"
                                 variant={isOverdue ? "destructive" : "default"}
                                 asChild
                               >
                                 <Link href={`/activos/${isComposite ? (interval as any).component_id : assetId}/mantenimiento/nuevo?planId=${interval.interval_id}&cycleHour=${interval.next_due_hour}`}>
                                   <Wrench className="h-4 w-4 mr-2" />
                                   {isOverdue ? "¡Urgente!" : isUpcoming ? "Programar" : "Registrar"}
                                 </Link>
                               </Button>
                             )}
                           </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimos Mantenimientos</CardTitle>
              <CardDescription>
                Los últimos 5 registros de mantenimiento realizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {displayMaintenanceHistory.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-muted-foreground">No hay registros de mantenimiento para este activo.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      {isComposite && (<TableHead>Activo</TableHead>)}
                      <TableHead>Tipo</TableHead>
                      <TableHead>Horas</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayMaintenanceHistory.slice(0, 5).map((maintenance: any) => (
                      <TableRow key={maintenance.id}>
                        <TableCell>{formatDate(maintenance.date)}</TableCell>
                        {isComposite && (
                          <TableCell>
                            <div className="font-medium">{maintenance.assets?.name || maintenance.asset_id}</div>
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge 
                            variant={maintenance.type === 'Preventivo' ? 'default' : 
                                    maintenance.type === 'Correctivo' ? 'destructive' : 'outline'}
                            className="whitespace-nowrap"
                          >
                            {maintenance.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{maintenance.hours}h</div>
                          {cycleLength > 0 && maintenance.hours && (
                            <div className="text-xs text-muted-foreground">
                              Ciclo {Math.floor(Number(maintenance.hours) / cycleLength) + 1}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{maintenance.description}</div>
                        </TableCell>
                        <TableCell>{maintenance.technician}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/activos/${isComposite ? maintenance.asset_id : assetId}/mantenimiento/${maintenance.id}`}>
                              Ver detalles
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              
              {displayMaintenanceHistory.length > 5 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" asChild>
                    <Link href={`/activos/${isComposite ? (displayMaintenanceHistory[0]?.asset_id || assetId) : assetId}/historial`}>
                      Ver todo el historial
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
} 
