"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Gauge, MapPin, Loader2, Link as LinkIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

interface ComponentRow {
  id: string;
  name: string;
  asset_id?: string | null;
  current_hours?: number | null;
  current_kilometers?: number | null;
}

interface Props {
  compositeId: string;
  syncHours: boolean;
  syncKm: boolean;
  canEdit: boolean;
  components?: ComponentRow[];
}

export function CompositeCouplingEditor({
  compositeId,
  syncHours: initialH,
  syncKm: initialKm,
  canEdit,
  components = [],
}: Props) {
  const [syncHours, setSyncHours] = useState(initialH);
  const [syncKm, setSyncKm] = useState(initialKm);
  const [saving, setSaving] = useState(false);

  const patch = async (
    field: "composite_sync_hours" | "composite_sync_kilometers",
    value: boolean
  ) => {
    setSaving(true);
    try {
      await fetch(`/api/assets/composites/${compositeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleHours = async (v: boolean) => {
    setSyncHours(v);
    await patch("composite_sync_hours", v);
  };

  const handleKm = async (v: boolean) => {
    setSyncKm(v);
    await patch("composite_sync_kilometers", v);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Medidores por componente</span>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {/* Per-component readings table */}
      {components.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Componente</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5" />
                    Horómetro
                    {!syncHours && (
                      <span className="text-[10px] text-amber-600 font-normal ml-0.5">(independiente)</span>
                    )}
                  </span>
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Odómetro
                    {!syncKm && (
                      <span className="text-[10px] text-amber-600 font-normal ml-0.5">(independiente)</span>
                    )}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {components.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/activos/${c.id}`}
                      className="inline-flex items-center gap-1.5 font-medium hover:underline underline-offset-2"
                    >
                      <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      {c.asset_id || c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {c.current_hours != null ? (
                      <span className="font-semibold">{c.current_hours.toLocaleString("es-MX")} h</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {c.current_kilometers != null ? (
                      <span className="font-semibold">{c.current_kilometers.toLocaleString("es-MX")} km</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Separator />

      {/* Coupling toggles */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground mb-2">Acoplamiento entre componentes</p>
        <div className="flex items-center justify-between min-h-[44px] px-1">
          <div className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>Horómetro compartido</span>
          </div>
          <Switch
            checked={syncHours}
            onCheckedChange={handleHours}
            disabled={!canEdit || saving}
            aria-label="Compartir horómetro entre componentes"
          />
        </div>

        <div className="flex items-center justify-between min-h-[44px] px-1">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>Odómetro compartido</span>
          </div>
          <Switch
            checked={syncKm}
            onCheckedChange={handleKm}
            disabled={!canEdit || saving}
            aria-label="Compartir odómetro entre componentes"
          />
        </div>
      </div>

      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          Solo Gerencia o Gerente de Mantenimiento pueden modificar el acoplamiento.
        </p>
      )}
    </div>
  );
}
