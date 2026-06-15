import { buildDueLedger } from "../lib/maintenance/due-engine";

const sitrakBp01Intervals = [100, 300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300, 3600].map(
  (v) => ({
    id: `bp01-int-${v}`,
    interval_value: v,
    type: "Preventivo",
    is_recurring: true,
    is_first_cycle_only: v === 100,
  })
);

const bp01History = [
  { type: "Preventivo", maintenance_plan_id: "bp01-int-1800", hours: 1820, date: "2025-02-04" },
  { type: "Preventivo", maintenance_plan_id: "bp01-int-2700", hours: 2820, date: "2025-06-24" },
  { type: "preventive", maintenance_plan_id: "bp01-int-300", hours: 3934, date: "2025-12-12" },
  { type: "preventive", maintenance_plan_id: "bp01-int-1200", hours: 5024, date: "2026-05-27" },
];

const r = buildDueLedger({
  intervals: sitrakBp01Intervals,
  history: bp01History,
  currentValue: 5130,
  unit: "hours",
});

for (const v of [300, 600, 900, 1200, 1500, 3000, 3300, 3600, 2100]) {
  const row = r.byInterval.find((x) => x.interval.interval_value === v);
  console.log(v, row?.status, row?.nextDueValue, JSON.stringify(row?.reasons));
}
