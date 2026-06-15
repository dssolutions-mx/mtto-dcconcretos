import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { previewCheckpointAbsorption } from "@/lib/maintenance/due-engine";
import { parseMaintenanceUnitString } from "@/lib/utils/cyclic-maintenance";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      assetId,
      intervalId,
      maintenancePlanId,
      meterValue,
      unit: unitOverride,
    } = body as {
      assetId?: string;
      intervalId?: string;
      maintenancePlanId?: string;
      meterValue?: number;
      unit?: "hours" | "kilometers";
    };

    if (!assetId || meterValue == null || meterValue <= 0) {
      return NextResponse.json(
        { error: "assetId y meterValue son requeridos" },
        { status: 400 }
      );
    }

    let resolvedIntervalId = intervalId ?? null;
    if (!resolvedIntervalId && maintenancePlanId) {
      const { data: plan } = await supabase
        .from("maintenance_plans")
        .select("interval_id")
        .eq("id", maintenancePlanId)
        .maybeSingle();
      resolvedIntervalId = plan?.interval_id ?? null;
    }

    if (!resolvedIntervalId) {
      return NextResponse.json(
        { error: "intervalId o maintenancePlanId con interval_id vinculado es requerido" },
        { status: 400 }
      );
    }

    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id, current_hours, current_kilometers, model_id, equipment_models(maintenance_unit)")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: "Activo no encontrado" }, { status: 404 });
    }

    const unit =
      unitOverride ??
      parseMaintenanceUnitString(
        (asset as { equipment_models?: { maintenance_unit?: string } }).equipment_models
          ?.maintenance_unit
      );
    const currentValue =
      unit === "hours"
        ? Number(asset.current_hours) || 0
        : Number(asset.current_kilometers) || 0;

    const { data: intervals } = await supabase
      .from("maintenance_intervals")
      .select(
        "id, interval_value, name, type, maintenance_category, is_recurring, is_first_cycle_only"
      )
      .eq("model_id", asset.model_id);

    const { data: history } = await supabase
      .from("maintenance_history")
      .select("id, maintenance_plan_id, hours, kilometers, date, type")
      .eq("asset_id", assetId);

    const absorbed = previewCheckpointAbsorption({
      intervals: intervals ?? [],
      history: history ?? [],
      currentValue: Math.max(currentValue, meterValue),
      unit,
      hypothetical: {
        maintenance_plan_id: resolvedIntervalId,
        meterValue,
      },
    });

    return NextResponse.json({
      absorbed,
      unit,
      meterValue,
    });
  } catch (error) {
    console.error("absorption-preview error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
