import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { buildDueLedger } from "@/lib/maintenance/due-engine";
import { parseMaintenanceUnitString } from "@/lib/utils/cyclic-maintenance";

/**
 * Preview how a proposed cycle-length change affects assets on this model.
 * POST body: { proposedMaxInterval: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: modelId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const proposedMaxInterval = Number(body.proposedMaxInterval);
    if (!proposedMaxInterval || proposedMaxInterval <= 0) {
      return NextResponse.json({ error: "proposedMaxInterval inválido" }, { status: 400 });
    }

    const { data: intervals } = await supabase
      .from("maintenance_intervals")
      .select(
        "id, interval_value, name, type, maintenance_category, is_recurring, is_first_cycle_only"
      )
      .eq("model_id", modelId);

    if (!intervals?.length) {
      return NextResponse.json({ assets: [], message: "Sin intervalos" });
    }

    const currentMax = Math.max(...intervals.map((i) => Number(i.interval_value) || 0));
    if (proposedMaxInterval === currentMax) {
      return NextResponse.json({
        currentMax,
        proposedMaxInterval,
        changed: false,
        assets: [],
      });
    }

    const proposedIntervals = intervals.map((i) => ({
      ...i,
      interval_value:
        Number(i.interval_value) === currentMax ? proposedMaxInterval : i.interval_value,
    }));

    const { data: assets } = await supabase
      .from("assets")
      .select(
        "id, asset_id, name, current_hours, current_kilometers, equipment_models(maintenance_unit)"
      )
      .eq("model_id", modelId)
      .limit(100);

    const assetIds = (assets ?? []).map((a) => a.id);
    const { data: allHistory } = await supabase
      .from("maintenance_history")
      .select("asset_id, maintenance_plan_id, hours, kilometers, date, type")
      .in("asset_id", assetIds);

    const historyByAsset = new Map<string, NonNullable<typeof allHistory>>();
    for (const row of allHistory ?? []) {
      if (!historyByAsset.has(row.asset_id)) historyByAsset.set(row.asset_id, []);
      historyByAsset.get(row.asset_id)!.push(row);
    }

    const previews = (assets ?? []).map((asset) => {
      const unit = parseMaintenanceUnitString(
        (asset as { equipment_models?: { maintenance_unit?: string } }).equipment_models
          ?.maintenance_unit
      );
      const currentValue =
        unit === "hours"
          ? Number(asset.current_hours) || 0
          : Number(asset.current_kilometers) || 0;
      const history = historyByAsset.get(asset.id) ?? [];

      const before = buildDueLedger({ intervals, history, currentValue, unit });
      const after = buildDueLedger({
        intervals: proposedIntervals,
        history,
        currentValue,
        unit,
      });

      const beforeOverdue = before.byInterval
        .filter((r) => r.status === "overdue")
        .map((r) => r.interval.interval_value);
      const afterOverdue = after.byInterval
        .filter((r) => r.status === "overdue")
        .map((r) => r.interval.interval_value);

      return {
        asset_id: asset.id,
        asset_code: asset.asset_id,
        asset_name: asset.name,
        before_overdue: beforeOverdue,
        after_overdue: afterOverdue,
        changed: JSON.stringify(beforeOverdue) !== JSON.stringify(afterOverdue),
      };
    });

    return NextResponse.json({
      currentMax,
      proposedMaxInterval,
      changed: true,
      assets: previews.filter((p) => p.changed),
      total_assets: previews.length,
    });
  } catch (error) {
    console.error("impact-preview error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
