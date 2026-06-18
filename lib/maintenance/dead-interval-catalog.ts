import { isPreventiveMaintenanceHistoryType } from "@/lib/utils/maintenance-units";

export type DeadIntervalMeta = {
  interval_value: number;
  type?: string | null;
};

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
