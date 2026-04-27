'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ArrowLeft, PlusCircle, Minus, Check, Loader2, Wrench, Clock, AlertTriangle, Camera, FileText, ClipboardList, DollarSign, AlertCircle, Link2, ChevronDown, Star, ChevronRight } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { useAsset } from "@/hooks/useSupabase";
import { createClient } from "@/lib/supabase";
import { EvidenceUpload, type EvidencePhoto } from "@/components/ui/evidence-upload";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  getMaintenanceUnit, 
  getCurrentValue, 
  getMaintenanceValue,
  getUnitLabel, 
  getUnitDisplayName,
  type MaintenanceUnit 
} from "@/lib/utils/maintenance-units";
import { findEarliestUnpaidPreventiveDue } from "@/lib/utils/cyclic-preventive-due";
import { PartAutocomplete, type PartSuggestion } from "@/components/inventory/part-autocomplete";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MaintenancePart {
  name: string;
  partNumber?: string;
  quantity: number;
  estimatedCost?: string;
  source?: string;
  part_id?: string;
  catalogStatus?: 'matched' | 'unmatched' | 'manual';
}

// Add this interface to properly type the maintenance plan data
interface MaintenanceInterval {
  id: string;
  model_id: string | null;
  interval_value: number;
  hours?: number;
  days?: number;
  name: string;
  description: string | null;
  type: string;
  estimated_duration: number | null;
  created_at: string;
  updated_at: string;
  maintenance_tasks: MaintenanceTask[];
}

interface MaintenanceTask {
  id: string;
  description: string;
  task_parts: TaskPart[];
}

interface TaskPart {
  id: string;
  name: string;
  part_number?: string;
  quantity: number;
  cost?: string;
}

interface NewMaintenancePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function NewMaintenancePage({ params }: NewMaintenancePageProps) {
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const planIdParam = searchParams.get('planId');
  const intervalIdParam = searchParams.get('intervalId');
  // Links pass interval_id as planId; support both planId (maintenance_plans.id) and intervalId (maintenance_intervals.id)
  const rawParam = intervalIdParam || planIdParam;
  const { toast } = useToast();

  // Resolved maintenance_plans.id for work_orders.maintenance_plan_id FK (must NOT be interval_id)
  const [resolvedMaintenancePlanId, setResolvedMaintenancePlanId] = useState<string | null>(null);
  
  const { asset, loading: assetLoading, error: assetError } = useAsset(assetId);
  
  // Maintenance unit state
  const [maintenanceUnit, setMaintenanceUnit] = useState<MaintenanceUnit>('hours');
  
  // Planning-focused state variables
  const [plannedDate, setPlannedDate] = useState<Date>(new Date());
  const [maintenanceType, setMaintenanceType] = useState<string>("Preventivo");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [workDescription, setWorkDescription] = useState<string>("");
  const [workScope, setWorkScope] = useState<string>("");
  const [estimatedDuration, setEstimatedDuration] = useState<string>("");
  const [estimatedLaborCost, setEstimatedLaborCost] = useState<string>("");
  const [estimatedTotalCost, setEstimatedTotalCost] = useState<string>("");
  const [priority, setPriority] = useState<string>("Media");
  const [requiredParts, setRequiredParts] = useState<MaintenancePart[]>([]);
  
  // New part form state (for PartAutocomplete add flow)
  const [newPart, setNewPart] = useState<{
    name: string;
    partNumber: string;
    part_id?: string;
    quantity: number;
    estimatedCost: string;
  }>({
    name: '',
    partNumber: '',
    part_id: undefined,
    quantity: 1,
    estimatedCost: ''
  });
  // Row being edited for "Vincular al catálogo"
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);
  
  const [maintenancePlan, setMaintenancePlan] = useState<any>(null);
  const [maintenanceStatus, setMaintenanceStatus] = useState<{
    isOverdue: boolean;
    isPending: boolean;
    daysOverdue?: number;
    hoursOverdue?: number;
    progress: number;
    lastMaintenanceDate?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  const [profiles, setProfiles] = useState<{ id: string; nombre: string | null; apellido: string | null }[]>([]);
  // Evidence state for planning documentation
  const [planningDocuments, setPlanningDocuments] = useState<EvidencePhoto[]>([]);
  // Cycles available when no planId in URL (standalone → preventive flow)
  type CycleOption = {
    id: string;
    label: string;
    interval_value: number;
    status: 'overdue' | 'upcoming' | 'scheduled' | 'covered' | 'completed' | 'not_applicable';
    nextDueValue: number;
    overdueBy?: number;
    dueIn?: number;
    isRecommended: boolean;
  };
  const [availableCycles, setAvailableCycles] = useState<CycleOption[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(false);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [showStickyFooter, setShowStickyFooter] = useState(false);
  const [showDocumentsDialog, setShowDocumentsDialog] = useState(false);
  
  useEffect(() => {
    async function fetchProfiles() {
      const supabase = createClient();
      const { data } = await supabase.from("profiles").select("id, nombre, apellido").order("nombre");
      setProfiles(data || []);
    }
    fetchProfiles();
  }, []);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setShowStickyFooter(!e?.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px -80px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Update maintenance unit when asset changes
  useEffect(() => {
    if (asset) {
      const unit = getMaintenanceUnit(asset);
      setMaintenanceUnit(unit);
    }
  }, [asset]);
  
  // Cargar el plan de mantenimiento si se proporcionó un ID
  // URL param may be maintenance_plans.id or maintenance_intervals.id (interval_id); resolve to maintenance_plans.id for WO FK
  useEffect(() => {
    async function fetchMaintenancePlan() {
      if (!rawParam) return;
      
      try {
        setLoading(true);
        setResolvedMaintenancePlanId(null);
        const supabase = createClient();
        
        // 1) Check if rawParam is already a valid maintenance_plans.id for this asset
        const { data: existingPlan } = await supabase
          .from("maintenance_plans")
          .select("id, interval_id")
          .eq("id", rawParam)
          .eq("asset_id", assetId)
          .single();
        
        let planData: any;
        let intervalIdForFetch = rawParam;
        
        if (existingPlan) {
          setResolvedMaintenancePlanId(existingPlan.id);
          intervalIdForFetch = existingPlan.interval_id;
        }
        
        // 2) Fetch interval data (from maintenance_intervals) for prefilling - use interval id
        const { data: intervalData, error: intervalError } = await supabase
          .from("maintenance_intervals")
          .select(`
            *,
            maintenance_tasks(
              *,
              task_parts(*)
            )
          `)
          .eq("id", intervalIdForFetch)
          .single();
          
        if (intervalError || !intervalData) {
          if (!existingPlan) throw intervalError || new Error("Intervalo no encontrado");
          planData = null; // We have plan but interval not found - resolvedMaintenancePlanId is set, skip prefilling
        } else {
          planData = intervalData;
        }
        
        // 3) If we didn't have existingPlan, resolve interval_id -> maintenance_plans.id
        if (!existingPlan && planData) {
          const { data: planByAssetInterval } = await supabase
            .from("maintenance_plans")
            .select("id")
            .eq("asset_id", assetId)
            .eq("interval_id", rawParam)
            .maybeSingle();
          
          if (planByAssetInterval?.id) {
            setResolvedMaintenancePlanId(planByAssetInterval.id);
          } else {
            // Create maintenance_plans row for this asset+interval
            const { data: insertedPlan, error: insertError } = await supabase
              .from("maintenance_plans")
              .insert({
                asset_id: assetId,
                interval_id: rawParam,
                interval_value: planData.interval_value ?? 0,
                name: planData.name ?? planData.description ?? "Mantenimiento",
                description: planData.description ?? null,
                status: "Programado",
              })
              .select("id")
              .single();
            
            if (insertError) {
              console.error("Error creating maintenance_plan:", insertError);
              throw insertError;
            }
            if (insertedPlan?.id) setResolvedMaintenancePlanId(insertedPlan.id);
          }
        }
        
        if (!planData) {
          setMaintenancePlan(null);
          setLoading(false);
          return;
        }
        
        setMaintenancePlan(planData);
        
        // Obtener el último mantenimiento de este tipo (maintenance_history may use interval_id in plan_id; use rawParam)
        const { data: lastMaintenanceData, error: historyError } = await supabase
          .from("maintenance_history")
          .select("*")
          .eq("maintenance_plan_id", rawParam)
          .eq("asset_id", assetId)
          .order("date", { ascending: false })
          .limit(1);
          
        if (historyError) {
          console.error("Error al cargar el último mantenimiento:", historyError);
          // No lanzar error, continuar con el flujo
        }
        
        // Calcular el estado del mantenimiento
        if (planData && asset) {
          // Get maintenance unit from asset model
          const maintenanceUnit = (asset as any).equipment_models?.maintenance_unit || 
                                  (asset as any).model?.maintenance_unit || 
                                  'hours';
          const isKilometers = maintenanceUnit === 'kilometers' || maintenanceUnit === 'kilometres';
          
          const lastMaintenance = lastMaintenanceData && lastMaintenanceData.length > 0 ? lastMaintenanceData[0] : null;
          let lastMaintenanceValue = 0;
          let lastMaintenanceDate = asset.last_maintenance_date;
          
          if (lastMaintenance) {
            lastMaintenanceValue = isKilometers 
              ? Number(lastMaintenance.kilometers) || 0 
              : Number(lastMaintenance.hours) || 0;
            lastMaintenanceDate = lastMaintenance.date;
          }
          
          // Calcular próximo mantenimiento por valor (horas o kilómetros)
          const interval = planData.interval_value || 0;
          const nextValue = lastMaintenanceValue + interval;
          
          // Calcular si está pendiente o vencido
          const currentValue = isKilometers 
            ? (asset.current_kilometers || 0) 
            : (asset.current_hours || 0);
          const valueOverdue = currentValue - nextValue;
          const isOverdue = valueOverdue >= 0;
          
          // Calcular el progreso
          let progress = 0;
          if (currentValue && lastMaintenanceValue && interval > 0) {
            const valueDiff = currentValue - lastMaintenanceValue;
            progress = Math.min(Math.round((valueDiff / interval) * 100), 100);
          }
          
          setMaintenanceStatus({
            isOverdue: isOverdue,
            isPending: progress >= 90,
            hoursOverdue: isOverdue ? valueOverdue : undefined,
            progress,
            lastMaintenanceDate: lastMaintenanceDate || undefined
          });
        }
        
        // Pre-rellenar campos basados en el plan
        if (planData) {
          setMaintenanceType("Preventivo");
          setWorkDescription(planData.description || "");
          
          // Establecer duración estimada si está disponible
          if (planData.estimated_duration) {
            setEstimatedDuration(planData.estimated_duration.toString());
          }
          
          // Cargar los repuestos requeridos de las tareas de mantenimiento + match al catálogo
          if (planData.maintenance_tasks && planData.maintenance_tasks.length > 0) {
            const taskPartsRaw: MaintenancePart[] = [];
            planData.maintenance_tasks.forEach((task: MaintenanceTask) => {
              if (task.task_parts && task.task_parts.length > 0) {
                task.task_parts.forEach((part: TaskPart) => {
                  taskPartsRaw.push({
                    name: part.name,
                    partNumber: part.part_number || undefined,
                    quantity: part.quantity,
                    estimatedCost: part.cost || undefined,
                    source: 'Plan de Mantenimiento'
                  });
                });
              }
            });

            // Match each task part to catalog
            const taskPartsWithMatch = await Promise.all(
              taskPartsRaw.map(async (part): Promise<MaintenancePart> => {
                const searchTerm = part.partNumber || part.name;
                if (!searchTerm) {
                  return { ...part, catalogStatus: 'manual' as const };
                }
                try {
                  const params = new URLSearchParams();
                  if (part.partNumber) params.set('part_number', part.partNumber);
                  if (part.name) params.set('name', part.name);
                  const res = await fetch(`/api/inventory/parts/match?${params}`);
                  const data = await res.json();
                  if (data.success && data.matched) {
                    return {
                      ...part,
                      part_id: data.matched.id,
                      partNumber: data.matched.part_number || part.partNumber,
                      name: data.matched.name || part.name,
                      estimatedCost: part.estimatedCost || (data.matched.default_unit_cost != null ? String(data.matched.default_unit_cost) : undefined),
                      catalogStatus: 'matched' as const
                    };
                  }
                  return { ...part, catalogStatus: 'unmatched' as const };
                } catch {
                  return { ...part, catalogStatus: 'unmatched' as const };
                }
              })
            );

            if (taskPartsWithMatch.length > 0) {
              setRequiredParts(taskPartsWithMatch);
            }
          }
        }
      } catch (err) {
        console.error("Error al cargar el plan de mantenimiento:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }
    
    if (rawParam) {
      fetchMaintenancePlan();
    }
  }, [rawParam, asset, assetId]);

  // Fetch available cycles when no planId (standalone → preventive flow)
  // Computes status (overdue/upcoming/scheduled) and recommends the most urgent
  useEffect(() => {
    async function fetchAvailableCycles() {
      if (rawParam || !asset || !assetId) return;
      try {
        setLoadingCycles(true);
        setAvailableCycles([]);
        const supabase = createClient();
        const unit = getMaintenanceUnit(asset);
        const currentValue = getCurrentValue(asset, unit);

        // Fetch maintenance history for status calculation
        const { data: maintenanceHistory = [] } = await supabase
          .from("maintenance_history")
          .select("maintenance_plan_id, hours, kilometers, date, type")
          .eq("asset_id", assetId);

        type IntervalLike = {
          id: string;
          name: string | null;
          interval_value: number;
          description?: string | null;
          type?: string | null;
          is_recurring?: boolean | null;
          is_first_cycle_only?: boolean | null;
        };
        let rawIntervals: { id: string; intervalId: string }[] = [];
        const intervalDetails: Map<string, IntervalLike> = new Map();

        // 1) Try maintenance_plans for this asset
        const { data: plans } = await supabase
          .from("maintenance_plans")
          .select("id, name, interval_value, interval_id")
          .eq("asset_id", assetId);

        if (plans && plans.length > 0) {
          rawIntervals = plans.map((p) => ({ id: p.id, intervalId: p.interval_id }));
          plans.forEach((p) => {
            intervalDetails.set(p.interval_id, {
              id: p.interval_id,
              name: p.name,
              interval_value: p.interval_value ?? 0,
              description: null,
              type: null,
              is_recurring: true,
              is_first_cycle_only: false,
            });
          });
        } else {
          // 2) Fallback: maintenance_intervals for asset model
          const modelId = (asset as any).model_id ?? (asset as any).equipment_models?.id;
          if (!modelId) {
            setLoadingCycles(false);
            return;
          }
          const { data: intervals } = await supabase
            .from("maintenance_intervals")
            .select("id, name, interval_value, description, type, is_recurring, is_first_cycle_only")
            .eq("model_id", modelId)
            .order("interval_value", { ascending: true });

          if (!intervals?.length) {
            setLoadingCycles(false);
            return;
          }
          rawIntervals = intervals.map((i) => ({ id: i.id, intervalId: i.id }));
          intervals.forEach((i) => intervalDetails.set(i.id, i as IntervalLike));
        }

        const detailIds = [...intervalDetails.keys()].filter(Boolean) as string[];
        if (detailIds.length > 0) {
          const { data: miEnrichment } = await supabase
            .from("maintenance_intervals")
            .select("id, type, is_recurring, is_first_cycle_only")
            .in("id", detailIds);
          (miEnrichment || []).forEach((row) => {
            const cur = intervalDetails.get(row.id);
            if (cur) {
              intervalDetails.set(row.id, {
                ...cur,
                type: row.type ?? cur.type ?? "hours",
                is_recurring: row.is_recurring ?? cur.is_recurring ?? true,
                is_first_cycle_only: row.is_first_cycle_only ?? cur.is_first_cycle_only ?? false,
              });
            }
          });
        }

        const intervals = rawIntervals
          .map((r) => {
            const det = intervalDetails.get(r.intervalId);
            if (!det) return null;
            return {
              id: r.id,
              intervalId: r.intervalId,
              name: det.name,
              interval_value: det.interval_value ?? 0,
              type: det.type ?? "hours",
              is_recurring: det.is_recurring !== false,
              is_first_cycle_only: det.is_first_cycle_only === true,
            };
          })
          .filter(Boolean) as {
            id: string;
            intervalId: string;
            name: string | null;
            interval_value: number;
            type: string;
            is_recurring: boolean;
            is_first_cycle_only: boolean;
          }[];

        if (intervals.length === 0) {
          setLoadingCycles(false);
          return;
        }

        const maxInterval = Math.max(...intervals.map((i) => i.interval_value));
        const currentCycleNum = Math.floor(currentValue / maxInterval) + 1;
        const currentCycleStartValue = (currentCycleNum - 1) * maxInterval;
        const currentCycleEndValue = currentCycleNum * maxInterval;

        const preventiveHistory = maintenanceHistory.filter((m: any) => {
          const typeLower = m?.type?.toLowerCase?.() ?? "";
          const isPreventive = typeLower === "preventive" || typeLower === "preventivo";
          if (!isPreventive || !m?.maintenance_plan_id) return false;
          return intervals.some((i) => i.intervalId === m.maintenance_plan_id);
        });
        const currentCycleMaintenances = preventiveHistory.filter((m: any) => {
          const mValue = getMaintenanceValue(m, unit);
          return mValue > currentCycleStartValue && mValue < currentCycleEndValue;
        });

        const catalogForCyclic = intervals.map((i) => ({
          id: i.intervalId,
          interval_value: i.interval_value,
          type: i.type,
        }));

        const processed: CycleOption[] = intervals.map((interval) => {
          const earliestUnpaid = findEarliestUnpaidPreventiveDue(
            {
              id: String(interval.intervalId),
              interval_value: interval.interval_value,
              type: interval.type,
            },
            {
              currentValue,
              maxInterval,
              currentCycle: currentCycleNum,
              preventiveHistory,
              maintenanceIntervals: catalogForCyclic,
              maintenanceUnit: unit,
              isRecurring: interval.is_recurring,
              isFirstCycleOnly: interval.is_first_cycle_only,
            }
          );

          let nextDueValue = (currentCycleNum - 1) * maxInterval + interval.interval_value;
          let status: CycleOption["status"] = "scheduled";
          let overdueBy: number | undefined;
          let dueIn: number | undefined;

          if (nextDueValue > currentCycleEndValue) {
            nextDueValue = currentCycleNum * maxInterval + interval.interval_value;
            if (nextDueValue - currentValue > 1000) status = "not_applicable";
          } else {
            const wasPerformed = currentCycleMaintenances.some((m: any) => m.maintenance_plan_id === interval.intervalId);
            if (wasPerformed) {
              status = "completed";
            } else {
              const dueVal = Number(nextDueValue);
              const isCovered = currentCycleMaintenances.some((m: any) => {
                const performed = intervals.find((i) => i.intervalId === m.maintenance_plan_id);
                if (!performed) return false;
                const sameUnit = performed.type === interval.type;
                const higherOrEqual = performed.interval_value >= interval.interval_value;
                const performedAtValue = getMaintenanceValue(m, unit);
                return sameUnit && higherOrEqual && performedAtValue >= dueVal;
              });
              if (isCovered) status = "covered";
              else if (currentValue >= nextDueValue) {
                status = "overdue";
                overdueBy = Math.round(currentValue - nextDueValue);
              } else if (currentValue >= nextDueValue - 100) {
                status = "upcoming";
                dueIn = Math.round(nextDueValue - currentValue);
              }
            }
          }

          if (earliestUnpaid !== null && earliestUnpaid.due <= currentValue) {
            status = "overdue";
            nextDueValue = earliestUnpaid.due;
            overdueBy = Math.round(currentValue - earliestUnpaid.due);
            dueIn = undefined;
          }

          const label = interval.name || `${interval.interval_value}${getUnitLabel(unit)}`;
          return {
            id: interval.id,
            label,
            interval_value: interval.interval_value,
            status,
            nextDueValue,
            overdueBy,
            dueIn,
            isRecommended: false
          };
        });

        const relevant = processed.filter((c) =>
          ["overdue", "upcoming", "scheduled"].includes(c.status)
        );
        const statusOrder: Record<string, number> = { overdue: 4, upcoming: 3, scheduled: 2, covered: 1 };
        relevant.sort((a, b) => {
          const diff = (statusOrder[b.status] || 0) - (statusOrder[a.status] || 0);
          if (diff !== 0) return diff;
          if (a.status === "overdue" && b.status === "overdue") {
            return (Number(a.nextDueValue) || 0) - (Number(b.nextDueValue) || 0);
          }
          return a.interval_value - b.interval_value;
        });
        if (relevant.length > 0) {
          relevant[0].isRecommended = true;
        }
        setAvailableCycles(relevant);
      } catch (err) {
        console.error("Error fetching cycles:", err);
      } finally {
        setLoadingCycles(false);
      }
    }
    fetchAvailableCycles();
  }, [rawParam, asset, assetId]);

  const handlePartSelect = (part: PartSuggestion | null) => {
    if (part) {
      setNewPart(prev => ({
        ...prev,
        name: part.name,
        partNumber: part.part_number || '',
        part_id: part.id,
        estimatedCost: part.default_unit_cost != null ? String(part.default_unit_cost) : prev.estimatedCost
      }));
    } else {
      setNewPart(prev => ({ ...prev, name: '', partNumber: '', part_id: undefined }));
    }
  };

  const handleManualPartEntry = (text: string) => {
    setNewPart(prev => ({ ...prev, name: text, part_id: undefined }));
  };

  const addPart = () => {
    if (!newPart.name || !newPart.quantity) return;
    const quantity = Number(newPart.quantity) || 1;
    if (quantity <= 0) return;

    setRequiredParts([
      ...requiredParts,
      {
        name: newPart.name,
        partNumber: newPart.partNumber || undefined,
        quantity,
        estimatedCost: newPart.estimatedCost || undefined,
        part_id: newPart.part_id,
        catalogStatus: newPart.part_id ? ('matched' as const) : ('manual' as const)
      }
    ]);
    setNewPart({ name: '', partNumber: '', part_id: undefined, quantity: 1, estimatedCost: '' });
  };

  const handleLinkPartSelect = (index: number, part: PartSuggestion | null) => {
    if (part) {
      setRequiredParts(prev => prev.map((p, i) =>
        i === index
          ? {
              ...p,
              name: part.name,
              partNumber: part.part_number || p.partNumber,
              part_id: part.id,
              estimatedCost: p.estimatedCost || (part.default_unit_cost != null ? String(part.default_unit_cost) : undefined),
              catalogStatus: 'matched' as const
            }
          : p
      ));
    }
    setEditingPartIndex(null);
  };
  
  const removePart = (index: number) => {
    setRequiredParts(requiredParts.filter((_, i) => i !== index));
  };
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  };
  
  const calculateEstimatedTotalCost = () => {
    const laborCost = Number(estimatedLaborCost) || 0;
    const partsCost = requiredParts.reduce((total, part) => {
      const cost = Number(part.estimatedCost) || 0;
      return total + (cost * part.quantity);
    }, 0);
    
    const total = laborCost + partsCost;
    setEstimatedTotalCost(total.toFixed(2));
  };
  
  useEffect(() => {
    calculateEstimatedTotalCost();
  }, [estimatedLaborCost, requiredParts]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!plannedDate || !maintenanceType || !workDescription) {
      toast({
        title: "Campos incompletos",
        description: "Por favor complete todos los campos obligatorios marcados con *",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      const supabase = createClient();
      
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error("Usuario no autenticado");
      }

      // FK work_orders.maintenance_plan_id must reference maintenance_plans.id, NOT maintenance_intervals.id
      const workOrderData = {
        asset_id: assetId,
        plant_id: asset?.plant_id ?? null,
        description: workDescription,
        scope: workScope || null,
        type: resolvedMaintenancePlanId || rawParam ? 'preventive' : 'corrective',
        requested_by: user.id,
        assigned_to: assignedTo ?? null,
        planned_date: plannedDate.toISOString(),
        estimated_duration: estimatedDuration ? Number(estimatedDuration) : 0,
        priority: priority,
        status: 'Pendiente',
        maintenance_plan_id: resolvedMaintenancePlanId || null,
        estimated_cost: estimatedTotalCost ? Number(estimatedTotalCost) : 0,
        creation_photos: planningDocuments.length > 0 ? planningDocuments.map(doc => ({
          url: doc.url,
          description: doc.description,
          category: doc.category,
          uploaded_at: doc.uploaded_at,
          bucket_path: doc.bucket_path
        })) : []
      };

      const { data: workOrderResult, error: workOrderError } = await supabase
        .from('work_orders')
        .insert(workOrderData)
        .select('id, order_id')
        .single();
      
      if (workOrderError) throw workOrderError;

      // Prepare update data for parts and tasks
      const updateData: Record<string, unknown> = {};

      // Agregar repuestos requeridos a la orden de trabajo (incluye part_id para catálogo)
      if (requiredParts.length > 0) {
        updateData.required_parts = requiredParts.map(part => ({
          name: part.name,
          part_number: part.partNumber || '',
          quantity: part.quantity,
          unit_price: part.estimatedCost ? Number(part.estimatedCost) : 0,
          total_price: part.estimatedCost ? Number(part.estimatedCost) * part.quantity : 0,
          ...(part.part_id && { part_id: part.part_id })
        }));
      }

      // Agregar tareas requeridas del plan de mantenimiento (siempre que el plan traiga tareas)
      if (maintenancePlan?.maintenance_tasks && maintenancePlan.maintenance_tasks.length > 0) {
        const tasksData = maintenancePlan.maintenance_tasks.map((task: MaintenanceTask & { type?: string; estimated_time?: number; requires_specialist?: boolean }) => ({
          id: task.id,
          description: task.description,
          type: task.type || 'standard',
          estimated_time: task.estimated_time ?? null,
          requires_specialist: task.requires_specialist ?? false,
          parts: (task.task_parts || []).map((part: TaskPart) => ({
            id: part.id,
            name: part.name,
            part_number: part.part_number || undefined,
            quantity: part.quantity,
            cost: part.cost ? Number(part.cost) : undefined
          }))
        }));
        updateData.required_tasks = tasksData;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('work_orders')
          .update(updateData)
          .eq('id', workOrderResult.id);

        if (updateError) throw updateError;
      }

      toast({
        title: "¡Orden de Trabajo programada exitosamente!",
        description: `Se ha generado la Orden de Trabajo ${workOrderResult.order_id} para mantenimiento ${resolvedMaintenancePlanId || rawParam ? 'preventivo' : 'correctivo'}. La orden está programada para ${format(plannedDate, "dd/MM/yyyy")} y lista para generar órdenes de compra si es necesario.`,
      });

      // Redirigir a la vista de órdenes de trabajo
      router.push(`/ordenes`);
      
    } catch (err) {
      console.error("Error al programar mantenimiento:", err);
      toast({
        title: "Error al programar mantenimiento",
        description: err instanceof Error ? err.message : "Ha ocurrido un error inesperado en el proceso de programación",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isLoading = assetLoading || loading;
  const anyError = assetError || error;
  
  return (
    <DashboardShell>
      <div className="mb-4">
        <DashboardHeader
          heading="Programar Mantenimiento Preventivo"
          text={`${asset?.name || "Activo"} — Crear orden de trabajo y programar mantenimiento`}
        >
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-normal">
              Origen: Activo
            </Badge>
            <Button variant="outline" asChild>
              <Link href={`/activos/${assetId}/mantenimiento`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
          </div>
        </DashboardHeader>
        <p className="text-xs text-muted-foreground mt-1">Etapa de planificación — los datos se usan para programar recursos y generar OC.</p>
      </div>
      
      {anyError && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="bg-destructive/15 text-destructive p-4 rounded-md">
              <p className="font-medium">Error: {anyError.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!rawParam && asset && (
        <Card className="mb-4 border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              ¿Qué ciclo desea programar?
            </CardTitle>
            <CardDescription className="text-xs">
              Seleccione el mantenimiento a realizar según el estado del activo. Se recomienda el más urgente.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingCycles ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analizando ciclos y estado del activo…
              </div>
            ) : availableCycles.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-2 py-2">
                <p>No hay ciclos de mantenimiento configurados para este activo.</p>
                <p>
                  <Link href={`/activos/${assetId}/mantenimiento`} className="text-primary underline hover:no-underline">
                    Configure los intervalos en la pestaña Mantenimiento
                  </Link>
                  {" "}para poder programar trabajo preventivo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  {getCurrentValue(asset, getMaintenanceUnit(asset))}{getUnitLabel(getMaintenanceUnit(asset))} actuales
                </p>
                {availableCycles.map((c) => {
                  const statusLabels: Record<string, string> = {
                    overdue: "Vencido",
                    upcoming: "Próximo",
                    scheduled: "Programado",
                    covered: "Cubierto por servicio mayor",
                  };
                  const statusVariant: Record<string, "destructive" | "default" | "outline" | "secondary"> = {
                    overdue: "destructive",
                    upcoming: "default",
                    scheduled: "outline",
                    covered: "secondary",
                  };
                  const statusText =
                    c.status === "overdue" && c.overdueBy != null
                      ? `Vencido hace ${c.overdueBy}${getUnitLabel(getMaintenanceUnit(asset))}`
                      : c.status === "upcoming" && c.dueIn != null
                        ? `En ${c.dueIn}${getUnitLabel(getMaintenanceUnit(asset))}`
                        : statusLabels[c.status] ?? c.status;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => router.replace(`/activos/${assetId}/mantenimiento/nuevo?planId=${c.id}`)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors",
                        "hover:bg-amber-100/80 hover:border-amber-300",
                        "focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2",
                        c.isRecommended && "ring-2 ring-amber-400 border-amber-300 bg-amber-100/60"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{c.label}</span>
                          {c.isRecommended && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                              Recomendado
                            </Badge>
                          )}
                          <Badge variant={statusVariant[c.status] ?? "outline"} className="text-xs">
                            {statusText}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cada {c.interval_value}{getUnitLabel(getMaintenanceUnit(asset))} · Vence a las {c.nextDueValue}{getUnitLabel(getMaintenanceUnit(asset))}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {maintenancePlan && (
        <Card className="mb-4 border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2 px-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Plan de Mantenimiento Programado
                  <Badge variant="outline" className="ml-2 whitespace-nowrap">
                    {maintenancePlan.type}
                    {maintenancePlan.interval_value && ` ${maintenancePlan.interval_value}${getUnitLabel(maintenanceUnit)}`}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Está programando el siguiente mantenimiento preventivo
                </CardDescription>
              </div>
              {maintenanceStatus && (
                <Badge
                  variant={maintenanceStatus.isOverdue ? "destructive" : maintenanceStatus.isPending ? "default" : "outline"}
                  className="text-sm px-3 py-1.5 shrink-0"
                >
                  {maintenanceStatus.isOverdue ? "VENCIDO" : maintenanceStatus.isPending ? "PENDIENTE" : "PROGRAMADO"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Descripción</dt>
                <dd className="text-sm font-medium line-clamp-2">{maintenancePlan.description}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Frecuencia</dt>
                <dd className="text-sm font-medium">
                  {maintenancePlan.interval_value && `Cada ${maintenancePlan.interval_value} ${getUnitDisplayName(maintenanceUnit)}`}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recursos</dt>
                <dd className="text-sm font-medium">
                  {maintenancePlan.maintenance_tasks?.length || 0} tareas / {requiredParts.length} repuestos
                </dd>
              </div>
            </dl>
            {maintenanceStatus && maintenanceStatus.progress > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {getUnitDisplayName(maintenanceUnit).charAt(0).toUpperCase() + getUnitDisplayName(maintenanceUnit).slice(1)} actuales: {getCurrentValue(asset || {}, maintenanceUnit)}{getUnitLabel(maintenanceUnit)}
                  </span>
                  <span>{maintenanceStatus.progress}% del intervalo</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all duration-200",
                      maintenanceStatus.progress >= 100 ? "bg-red-600" : maintenanceStatus.progress >= 75 ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(maintenanceStatus.progress, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {maintenanceStatus?.lastMaintenanceDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <Clock className="h-3.5 w-3.5" />
                Último mantenimiento: {formatDate(maintenanceStatus.lastMaintenanceDate)}
              </div>
            )}
            {maintenanceStatus?.isOverdue && (
              <div className="flex items-center gap-2 text-sm text-red-600 font-medium mt-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {maintenanceStatus.hoursOverdue !== undefined && (
                  <span>Vencido por {maintenanceStatus.hoursOverdue} {getUnitDisplayName(maintenanceUnit)}</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {rawParam && (
      <>
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Planificación del mantenimiento
            </CardTitle>
            <CardDescription className="text-xs">
              Fecha, tipo, prioridad y técnico asignado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="workDescription">Descripción del Trabajo Planificado *</Label>
              <Textarea
                id="workDescription"
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Describa el trabajo de mantenimiento a realizar y las actividades planificadas"
                rows={3}
                required
              />
              <p className="text-xs text-muted-foreground">
                Detalle las actividades y procedimientos planificados
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="plannedDate">Fecha Programada *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal cursor-pointer transition-colors duration-200",
                        !plannedDate && "text-muted-foreground"
                      )}
                    >
                      {plannedDate ? (
                        format(plannedDate, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={plannedDate}
                      onSelect={(date) => date && setPlannedDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Fecha tentativa cuando se realizará el mantenimiento
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Tipo de Mantenimiento</Label>
                <div>
                  <Badge variant="outline" className="capitalize font-normal">
                    Preventivo
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta página es para programar mantenimiento preventivo
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Prioridad</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="cursor-pointer transition-colors duration-200">
                    <SelectValue placeholder="Seleccione prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baja" className="cursor-pointer">Baja</SelectItem>
                    <SelectItem value="Media" className="cursor-pointer">Media</SelectItem>
                    <SelectItem value="Alta" className="cursor-pointer">Alta</SelectItem>
                    <SelectItem value="Crítica" className="cursor-pointer">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Técnico Asignado</Label>
                <Select value={assignedTo ?? "none"} onValueChange={(v) => setAssignedTo(v === "none" ? null : v)}>
                  <SelectTrigger id="assigned_to" className="cursor-pointer transition-colors duration-200">
                    <SelectValue placeholder="Seleccionar técnico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="cursor-pointer">No asignar</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                        {p.nombre && p.apellido ? `${p.nombre} ${p.apellido}` : p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Técnico responsable para ejecutar el trabajo
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="estimatedDuration">Duración Estimada (horas)</Label>
                <Input
                  id="estimatedDuration"
                  type="number"
                  step="0.5"
                  value={estimatedDuration}
                  onChange={(e) => setEstimatedDuration(e.target.value)}
                  placeholder="ej: 4.5"
                />
                <p className="text-xs text-muted-foreground">
                  Tiempo estimado para completar el mantenimiento
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Collapsible defaultOpen={false} className="group">
          <Card className="mt-6">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 px-4 pt-4 cursor-pointer transition-colors duration-200 hover:bg-muted/30 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    <CardTitle className="text-base">Estimación de costos (opcional)</CardTitle>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
                <CardDescription className="text-xs">
                  Calcule los costos para generar órdenes de compra
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="estimatedLaborCost">Costo Estimado de Mano de Obra ($)</Label>
                    <Input
                      id="estimatedLaborCost"
                      type="number"
                      step="0.01"
                      value={estimatedLaborCost}
                      onChange={(e) => setEstimatedLaborCost(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Incluye técnicos, horas extras, especialistas
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="estimatedTotalCost">Costo Total Estimado ($)</Label>
                    <Input
                      id="estimatedTotalCost"
                      type="number"
                      step="0.01"
                      value={estimatedTotalCost}
                      onChange={(e) => setEstimatedTotalCost(e.target.value)}
                      placeholder="0.00"
                      readOnly
                    />
                    <p className="text-xs text-muted-foreground">
                      Calculado: mano de obra + repuestos
                    </p>
                  </div>
                  
                  <div className="space-y-2 flex flex-col justify-end">
                    <Alert className="bg-green-50 border-green-200">
                      <AlertCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 text-sm">
                        Se usará para crear órdenes de compra y solicitar fondos
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        
        <Card className="mt-6">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-base flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />
              Repuestos y Materiales Requeridos
            </CardTitle>
            <CardDescription className="text-xs">
              Especifique los repuestos y materiales necesarios para este mantenimiento
              {maintenancePlan && requiredParts.length > 0 && (
                <span className="block mt-1 text-sm text-blue-600">
                  ✓ Se han cargado automáticamente los repuestos del plan de mantenimiento
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requiredParts.length > 0 ? (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium">Repuesto/Material</th>
                        <th className="text-left py-3 px-4 font-medium">Número de Parte</th>
                        <th className="text-left py-3 px-4 font-medium">Cantidad</th>
                        <th className="text-left py-3 px-4 font-medium">Costo Estimado</th>
                        <th className="text-left py-3 px-4 font-medium">Catálogo</th>
                        <th className="text-left py-3 px-4 font-medium">Origen</th>
                        <th className="text-left py-3 px-4 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requiredParts.map((part, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{part.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{part.partNumber || "-"}</td>
                          <td className="py-3 px-4">{part.quantity}</td>
                          <td className="py-3 px-4">{part.estimatedCost ? `$${part.estimatedCost}` : "-"}</td>
                          <td className="py-3 px-4">
                            {part.part_id ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge variant="default" className="text-xs bg-green-600">Vinculado</Badge>
                                {editingPartIndex === index ? (
                                  <div className="min-w-[200px]">
                                    <PartAutocomplete
                                      value=""
                                      onSelect={(p) => handleLinkPartSelect(index, p)}
                                      placeholder="Buscar para cambiar..."
                                      showPartNumber={true}
                                      allowManualEntry={false}
                                    />
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() => setEditingPartIndex(index)}
                                    className="h-7 px-2 text-xs"
                                  >
                                    Cambiar
                                  </Button>
                                )}
                              </div>
                            ) : editingPartIndex === index ? (
                              <div className="min-w-[200px]">
                                <PartAutocomplete
                                  value=""
                                  onSelect={(p) => handleLinkPartSelect(index, p)}
                                  placeholder="Buscar en catálogo..."
                                  showPartNumber={true}
                                  allowManualEntry={false}
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  {part.catalogStatus === 'unmatched' ? 'No encontrado' : 'Manual'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  type="button"
                                  onClick={() => setEditingPartIndex(index)}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Link2 className="h-3 w-3 mr-1" />
                                  Vincular
                                </Button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {part.source ? (
                              <Badge variant="outline" className="text-xs">
                                {part.source}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">Manual</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              {editingPartIndex === index && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  type="button"
                                  onClick={() => setEditingPartIndex(null)}
                                >
                                  Cancelar
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => removePart(index)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 border rounded-lg bg-gray-50">
                <PlusCircle className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p className="text-lg font-medium text-gray-600">No se han especificado repuestos</p>
                <p className="text-muted-foreground">Agregue los repuestos y materiales necesarios</p>
              </div>
            )}
            
            <div className="mt-6 p-4 border rounded-lg bg-blue-50">
              <h4 className="font-medium mb-4 text-blue-900">Agregar Nuevo Repuesto</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="partSearch">Buscar Parte del Catálogo</Label>
                  <PartAutocomplete
                    value={newPart.name || ""}
                    onSelect={handlePartSelect}
                    onManualEntry={handleManualPartEntry}
                    placeholder="Buscar por nombre o número de parte..."
                    showPartNumber={true}
                    allowManualEntry={true}
                  />
                  <p className="text-xs text-muted-foreground">
                    Busca en el catálogo de inventario o escribe manualmente
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPartQuantity">Cantidad *</Label>
                  <Input
                    id="newPartQuantity"
                    type="number"
                    min="1"
                    value={newPart.quantity}
                    onChange={(e) => setNewPart(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPartEstimatedCost">Costo Estimado ($)</Label>
                  <Input
                    id="newPartEstimatedCost"
                    type="number"
                    step="0.01"
                    value={newPart.estimatedCost}
                    onChange={(e) => setNewPart(prev => ({ ...prev, estimatedCost: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={addPart}
                  disabled={!newPart.name || !newPart.quantity}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Agregar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Planning Documentation Section */}
        <Card className="mt-6">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Evidencia de Creación
            </CardTitle>
            <CardDescription className="text-xs">
              Adjunte documentos de referencia, manuales, diagramas o fotos del estado actual del equipo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Incluya manuales de mantenimiento, diagramas, fotos del estado actual, especificaciones técnicas
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDocumentsDialog(true)}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Agregar Documentos
              </Button>
            </div>

            {planningDocuments.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {planningDocuments.map((doc) => (
                  <Card key={doc.id} className="overflow-hidden">
                    <div className="aspect-video relative bg-muted">
                      {doc.url.includes('image') || doc.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                        <img
                          src={doc.url}
                          alt={doc.description}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <Badge 
                        variant="secondary" 
                        className="absolute top-2 left-2 text-xs"
                      >
                        {doc.category}
                      </Badge>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate">
                        {doc.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {planningDocuments.length === 0 && (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No se han agregado documentos de planificación
                </p>
                <p className="text-xs text-muted-foreground">
                  Opcional: Agregue documentos de referencia para la ejecución
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div ref={footerRef} className="flex justify-between pt-6 pb-4 gap-2">
          <Button variant="outline" type="button" asChild className="cursor-pointer transition-colors duration-200">
            <Link href={`/activos/${assetId}/mantenimiento`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancelar
            </Link>
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="min-w-[200px] cursor-pointer transition-colors duration-200"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Programando...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Crear Orden de Trabajo
              </>
            )}
          </Button>
        </div>

        {showStickyFooter && (
          <div className="fixed bottom-0 left-0 right-0 z-10 bg-background/95 backdrop-blur border-t px-4 py-3 flex justify-end gap-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <Button variant="outline" type="button" asChild className="cursor-pointer transition-colors duration-200">
              <Link href={`/activos/${assetId}/mantenimiento`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancelar
              </Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="min-w-[200px] cursor-pointer transition-colors duration-200"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Programando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Crear Orden de Trabajo
                </>
              )}
            </Button>
          </div>
        )}
      </form>

      <EvidenceUpload
        open={showDocumentsDialog}
        onOpenChange={setShowDocumentsDialog}
        evidence={planningDocuments}
        setEvidence={setPlanningDocuments}
        context="maintenance"
        assetId={assetId}
        title="Evidencia de Creación"
        description="Suba documentos de referencia, manuales, diagramas, fotos del estado actual del equipo y cualquier documentación relevante para la planificación del mantenimiento"
      />
      </>
      )}
    </DashboardShell>
  );
} 