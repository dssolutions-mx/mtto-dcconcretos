"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Wrench,
  AlertCircle,
  AlertTriangle,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MaintenanceHistory } from "@/types";

const INITIAL_PAGE_SIZE = 20;
const LOAD_MORE_SIZE = 20;

export type TimelineEventType = "pm" | "correctivo" | "inspeccion";

export type FilterType = "pm" | "correctivo" | "inspeccion" | "all";

interface TimelineEvent {
  id: string;
  date: string | null;
  type: TimelineEventType;
  source: "maintenance" | "incident";
  title: string;
  description: string;
  detailLabel: string;
  href: string;
}

function getEventType(item: { type?: string | null }, source: "maintenance" | "incident"): TimelineEventType {
  if (source === "incident") return "correctivo";
  const t = (item.type || "").toLowerCase();
  if (t === "preventivo") return "pm";
  if (t === "inspección" || t === "inspeccion") return "inspeccion";
  return "correctivo"; // Correctivo, Predictivo, Overhaul, etc.
}

const TYPE_CONFIG: Record<
  TimelineEventType,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  pm: { icon: Wrench, color: "text-blue-600", label: "PM" },
  correctivo: { icon: AlertCircle, color: "text-amber-600", label: "Correctivo" },
  inspeccion: { icon: ClipboardList, color: "text-emerald-600", label: "Inspección" },
};

interface AssetHistoryTimelineProps {
  assetId: string;
  maintenanceHistory: MaintenanceHistory[];
  incidents: any[];
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  isLoading: boolean;
}

export function AssetHistoryTimeline({
  assetId,
  maintenanceHistory,
  incidents,
  filter,
  onFilterChange,
  isLoading,
}: AssetHistoryTimelineProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

  const events = useMemo((): TimelineEvent[] => {
    const list: TimelineEvent[] = [];

    (maintenanceHistory || []).forEach((m) => {
      const eventType = getEventType(m, "maintenance");
      list.push({
        id: `m-${m.id}`,
        date: m.date,
        type: eventType,
        source: "maintenance",
        title: m.type || "Mantenimiento",
        description: m.description || "",
        detailLabel: m.technician || "",
        href: `/activos/${assetId}/mantenimiento/${m.id}`,
      });
    });

    (incidents || []).forEach((i) => {
      list.push({
        id: `i-${i.id}`,
        date: i.date,
        type: "correctivo",
        source: "incident",
        title: i.type || "Incidente",
        description: i.description || "",
        detailLabel: i.reported_by || "",
        href: `/activos/${assetId}/incidentes`,
      });
    });

    list.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    return list;
  }, [maintenanceHistory, incidents, assetId]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEvents.length;
  const showInspeccionChip = events.some((e) => e.type === "inspeccion");

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "dd/MM/yyyy", { locale: es });
  };

  const chips: { value: FilterType; label: string }[] = [
    { value: "pm", label: "PM" },
    { value: "correctivo", label: "Correctivo" },
    ...(showInspeccionChip ? [{ value: "inspeccion" as const, label: "Inspección" }] : []),
    { value: "all", label: "Todos" },
  ];

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + LOAD_MORE_SIZE);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onFilterChange(chip.value)}
            className={cn(
              "min-h-[44px] min-w-[44px] rounded-lg px-4 font-medium transition-colors",
              "border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              filter === chip.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-muted"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              Cargando historial...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No hay registros que coincidan con el filtro seleccionado.
            </div>
          ) : (
            <div className="divide-y">
              {visibleEvents.map((event) => {
                const config = TYPE_CONFIG[event.type];
                const Icon = config.icon;
                return (
                  <Link
                    key={event.id}
                    href={event.href}
                    className="flex min-h-[44px] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        event.type === "pm" && "bg-blue-100",
                        event.type === "correctivo" && "bg-amber-100",
                        event.type === "inspeccion" && "bg-emerald-100"
                      )}
                    >
                      <Icon className={cn("h-5 w-5", config.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">{formatDate(event.date)}</span>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            event.type === "pm" && "text-blue-600",
                            event.type === "correctivo" && "text-amber-600",
                            event.type === "inspeccion" && "text-emerald-600"
                          )}
                        >
                          {config.label}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {event.source === "maintenance" ? "Mantenimiento" : "Incidente"}
                        </span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {event.description || event.title}
                      </p>
                      {event.detailLabel && (
                        <p className="text-xs text-muted-foreground">{event.detailLabel}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {!isLoading && hasMore && (
            <div className="border-t p-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleLoadMore}
              >
                <ChevronDown className="mr-2 h-4 w-4" />
                Cargar más
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
