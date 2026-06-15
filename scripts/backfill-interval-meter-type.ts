/**
 * Set maintenance_intervals.type to hours|kilometers from equipment_models.maintenance_unit
 * where type is legacy (Preventivo, etc.).
 *
 * Usage: npx tsx scripts/backfill-interval-meter-type.ts
 */
import { createClient } from "@supabase/supabase-js";
import { meterTypeForMaintenanceInterval } from "../lib/utils/maintenance-units";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: models, error: modelsError } = await supabase
    .from("equipment_models")
    .select("id, maintenance_unit");

  if (modelsError) throw modelsError;

  let updated = 0;
  for (const model of models ?? []) {
    const meterType = meterTypeForMaintenanceInterval(model.maintenance_unit);
    const { data: intervals, error } = await supabase
      .from("maintenance_intervals")
      .select("id, type")
      .eq("model_id", model.id);

    if (error) throw error;

    for (const interval of intervals ?? []) {
      const t = (interval.type ?? "").toLowerCase();
      if (t === "hours" || t === "kilometers" || t === "kilometres") continue;

      const { error: upErr } = await supabase
        .from("maintenance_intervals")
        .update({ type: meterType })
        .eq("id", interval.id);

      if (upErr) throw upErr;
      updated += 1;
    }
  }

  console.log(`Updated ${updated} interval row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
