"use client";

import { useState, useMemo } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp, DollarSign, Calendar, AlertCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MaintenanceHistory } from "@/types";

interface CostDataPoint {
  month: string;
  preventivo: number;
  correctivo: number;
  total: number;
}

interface Metrics {
  totalMaintenanceCost: number;
  preventiveCost: number;
  correctiveCost: number;
  totalDowntime: number;
  mtbf: number;
  mttr: number;
  availability: string;
}

interface AssetHistoryMetricsSectionProps {
  maintenanceHistory: MaintenanceHistory[];
  defaultOpen?: boolean;
}

export function AssetHistoryMetricsSection({
  maintenanceHistory,
  defaultOpen = false,
}: AssetHistoryMetricsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { costHistory, metrics } = useMemo(() => {
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const monthlyData = new Map<string, { preventivo: number; correctivo: number; total: number }>();

    let totalCost = 0;
    let preventiveCost = 0;
    let correctiveCost = 0;
    let totalDowntime = 0;

    (maintenanceHistory || []).forEach((maintenance) => {
      const cost = maintenance.total_cost ? parseFloat(maintenance.total_cost.toString()) : 0;
      totalCost += cost;

      if (maintenance.type === "Preventivo") {
        preventiveCost += cost;
      } else {
        correctiveCost += cost;
      }

      const downtime = maintenance.hours ?? 0;
      totalDowntime += typeof downtime === "number" ? downtime : 0;

      if (maintenance.date) {
        const date = new Date(maintenance.date);
        const monthName = months[date.getMonth()];
        if (!monthlyData.has(monthName)) {
          monthlyData.set(monthName, { preventivo: 0, correctivo: 0, total: 0 });
        }
        const monthData = monthlyData.get(monthName)!;
        if (maintenance.type === "Preventivo") {
          monthData.preventivo += cost;
        } else {
          monthData.correctivo += cost;
        }
        monthData.total += cost;
      }
    });

    const costHistoryArray: CostDataPoint[] = Array.from(monthlyData.entries()).map(
      ([month, data]) => ({
        month,
        preventivo: data.preventivo,
        correctivo: data.correctivo,
        total: data.total,
      })
    );

    const mtbf =
      maintenanceHistory.length > 1 &&
      typeof maintenanceHistory[0]?.hours === "number" &&
      typeof maintenanceHistory[maintenanceHistory.length - 1]?.hours === "number"
        ? ((maintenanceHistory[0]?.hours ?? 0) - (maintenanceHistory[maintenanceHistory.length - 1]?.hours ?? 0)) /
          maintenanceHistory.length
        : 0;

    const mttr = totalDowntime > 0 && maintenanceHistory.length > 0 ? totalDowntime / maintenanceHistory.length : 0;
    const totalTime = mtbf * maintenanceHistory.length;
    const availability =
      totalTime > 0 ? (((totalTime - totalDowntime) / totalTime) * 100).toFixed(1) : "0";

    return {
      costHistory: costHistoryArray,
      metrics: {
        totalMaintenanceCost: totalCost,
        preventiveCost,
        correctiveCost,
        totalDowntime,
        mtbf,
        mttr,
        availability,
      },
    };
  }, [maintenanceHistory]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Métricas y costos</CardTitle>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {costHistory.length > 0 ? (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${value}`} />
                    <Legend />
                    <Bar dataKey="preventivo" name="Mantenimiento Preventivo" fill="#4f46e5" />
                    <Bar dataKey="correctivo" name="Mantenimiento Correctivo" fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No hay suficientes datos para mostrar el historial de costos
              </div>
            )}

            <Separator className="my-6" />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Resumen de Costos</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Costo Total</p>
                    <p className="text-2xl font-bold">${metrics.totalMaintenanceCost}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Costo Preventivo</p>
                    <p className="text-2xl font-bold">${metrics.preventiveCost}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Costo Correctivo</p>
                    <p className="text-2xl font-bold">${metrics.correctiveCost}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
