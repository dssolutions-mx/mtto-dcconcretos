"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Gauge, MapPin, Loader2 } from "lucide-react";

interface Props {
  compositeId: string;
  syncHours: boolean;
  syncKm: boolean;
  canEdit: boolean;
}

export function CompositeCouplingEditor({ compositeId, syncHours: initialH, syncKm: initialKm, canEdit }: Props) {
  const [syncHours, setSyncHours] = useState(initialH);
  const [syncKm, setSyncKm] = useState(initialKm);
  const [saving, setSaving] = useState(false);

  const patch = async (field: "composite_sync_hours" | "composite_sync_kilometers", value: boolean) => {
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
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Acoplamiento de medidores</span>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      <div className="space-y-2">
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
        <p className="text-xs text-muted-foreground">Solo Gerencia o Gerente de Mantenimiento pueden modificar el acoplamiento.</p>
      )}
    </div>
  );
}
