import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { buildDueLedger } from "@/lib/maintenance/due-engine";
import { preprocessPreventiveHistory } from "@/lib/maintenance/history-preprocess";
import { parseMaintenanceUnitString } from "@/lib/utils/cyclic-maintenance";

/**
 * Fleet-wide cyclic maintenance data-quality diagnostics.
 * Returns per-asset excluded history rows and overdue counts.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select(
        "id, asset_id, name, model_id, current_hours, current_kilometers, equipment_models(maintenance_unit)"
      )
      .eq("status", "operational")
      .limit(500);

    if (assetsError) {
      return NextResponse.json({ error: assetsError.message }, { status: 500 });
    }

    const modelIds = [...new Set((assets ?? []).map((a) => a.model_id).filter(Boolean))];
    const { data: allIntervals } = await supabase
      .from("maintenance_intervals")
      .select(
        "id, model_id, interval_value, name, type, maintenance_category, is_recurring, is_first_cycle_only"
      )
      .in("model_id", modelIds);

    const intervalsByModel = new Map<string, NonNullable<typeof allIntervals>>();
    for (const interval of allIntervals ?? []) {
      if (!interval.model_id) continue;
      if (!intervalsByModel.has(interval.model_id)) {
        intervalsByModel.set(interval.model_id, []);
      }
      intervalsByModel.get(interval.model_id)!.push(interval);
    }

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

    const diagnostics = (assets ?? []).map((asset) => {
      const intervals = intervalsByModel.get(asset.model_id ?? "") ?? [];
      const unit = parseMaintenanceUnitString(
        (asset as { equipment_models?: { maintenance_unit?: string } }).equipment_models
          ?.maintenance_unit
      );
      const currentValue =
        unit === "hours"
          ? Number(asset.current_hours) || 0
          : Number(asset.current_kilometers) || 0;
      const history = historyByAsset.get(asset.id) ?? [];

      const { excluded } = preprocessPreventiveHistory(history, unit, {
        knownIntervalIds: new Set(intervals.map((i) => i.id)),
      });

      let overdueCount = 0;
      if (intervals.length > 0) {
        const ledger = buildDueLedger({
          intervals,
          history,
          currentValue,
          unit,
        });
        overdueCount = ledger.byInterval.filter((r) => r.status === "overdue").length;
      }

      return {
        asset_id: asset.id,
        asset_code: asset.asset_id,
        asset_name: asset.name,
        excluded_history_count: excluded.length,
        excluded_reasons: excluded.reduce(
          (acc, e) => {
            acc[e.why] = (acc[e.why] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
        overdue_interval_count: overdueCount,
        has_issues: excluded.length > 0 || overdueCount > 0,
      };
    });

    const withIssues = diagnostics.filter((d) => d.has_issues);

    return NextResponse.json({
      scanned: diagnostics.length,
      with_issues: withIssues.length,
      assets: withIssues,
    });
  } catch (error) {
    console.error("fleet-diagnostics error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
