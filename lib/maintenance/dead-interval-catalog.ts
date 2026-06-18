import { isPreventiveMaintenanceHistoryType } from "@/lib/utils/maintenance-units";

export type DeadIntervalMeta = {
  interval_value: number;
  type?: string | null;
};

/**
 * Runtime catalog for maintenance_plan_ids that are not on the asset's current model.
 *
 * Sources (in priority order):
 * 1. Live `maintenance_intervals` rows (foreign-model ids still in DB)
 * 2. `maintenance_history.interval_value_snapshot` (hard-deleted tiers; requires migration 20260611100000)
 *
 * Value-based remapping in history-preprocess matches by interval_value only — safe when
 * tiers are renamed or foreign, dangerous when values collide or cycle semantics change
 * (e.g. 300h meant "minor" under 900h cycle, now 300h is unrelated under 1000h cycle).
 * Prefer DB remaps + snapshots on write; use soft-delete / archive for future model edits.
 */
export function buildDeadIntervalCatalog(
  rows: Array<{ id: string; interval_value?: number | null; type?: string | null }>
): Map<string, DeadIntervalMeta> {
  const catalog = new Map<string, DeadIntervalMeta>();
  for (const row of rows ?? []) {
    const value = Number(row.interval_value) || 0;
    if (value > 0) {
      catalog.set(row.id, { interval_value: value, type: row.type ?? null });
    }
  }
  return catalog;
}

/** Preventive history rows whose plan id is not on the asset's current model. */
export function collectForeignPlanIds(
  history: Array<{ maintenance_plan_id?: string | null; type?: string | null }>,
  knownIntervalIds: Set<string>
): string[] {
  const ids = new Set<string>();
  for (const row of history ?? []) {
    const planId = row.maintenance_plan_id;
    if (!planId || knownIntervalIds.has(planId)) continue;
    if (!isPreventiveMaintenanceHistoryType(row.type)) continue;
    ids.add(planId);
  }
  return [...ids];
}

/** Fill catalog gaps from interval_value_snapshot on history rows (deleted tiers). */
export function enrichDeadIntervalCatalogFromHistory(
  catalog: Map<string, DeadIntervalMeta>,
  history: Array<{
    maintenance_plan_id?: string | null;
    interval_value_snapshot?: number | null;
    type?: string | null;
  }>,
  planIds: string[]
): Map<string, DeadIntervalMeta> {
  const result = new Map(catalog);
  if (!planIds.length) return result;

  const snapshotByPlanId = new Map<string, { value: number; type?: string | null }>();
  for (const row of history ?? []) {
    const planId = row.maintenance_plan_id;
    const snapshot = Number(row.interval_value_snapshot) || 0;
    if (!planId || snapshot <= 0) continue;
    if (!snapshotByPlanId.has(planId)) {
      snapshotByPlanId.set(planId, { value: snapshot, type: row.type ?? null });
    }
  }

  for (const planId of planIds) {
    if (result.has(planId)) continue;
    const snap = snapshotByPlanId.get(planId);
    if (snap) {
      result.set(planId, { interval_value: snap.value, type: snap.type ?? null });
    }
  }

  return result;
}

export async function fetchDeadIntervalCatalogForPlanIds(
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        in: (
          col: string,
          values: string[]
        ) => Promise<{ data: Array<{ id: string; interval_value?: number | null; type?: string | null }> | null; error: { message: string } | null }>;
      };
    };
  },
  planIds: string[]
): Promise<Map<string, DeadIntervalMeta>> {
  const unique = [...new Set(planIds)].filter(Boolean);
  if (!unique.length) return new Map();

  const { data, error } = await supabase
    .from("maintenance_intervals")
    .select("id, interval_value, type")
    .in("id", unique);

  if (error) throw new Error(error.message);
  return buildDeadIntervalCatalog(data ?? []);
}

/** Collect foreign/dead plan ids and resolve catalog from intervals + history snapshots. */
export async function resolveDeadIntervalCatalog(
  supabase: Parameters<typeof fetchDeadIntervalCatalogForPlanIds>[0],
  history: Array<{
    maintenance_plan_id?: string | null;
    interval_value_snapshot?: number | null;
    type?: string | null;
  }>,
  knownIntervalIds: Set<string>
): Promise<Map<string, DeadIntervalMeta>> {
  const planIds = collectForeignPlanIds(history, knownIntervalIds);
  const fromIntervals = await fetchDeadIntervalCatalogForPlanIds(supabase, planIds);
  return enrichDeadIntervalCatalogFromHistory(fromIntervals, history, planIds);
}
