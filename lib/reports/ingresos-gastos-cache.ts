import { revalidateTag } from 'next/cache'

/** Use with `unstable_cache` / `fetch(..., { next: { tags } })` when server caching is added. */
export const INGRESOS_GASTOS_REPORT_TAG = 'ingresos-gastos-report'

export function revalidateIngresosGastosReportCache() {
  revalidateTag(INGRESOS_GASTOS_REPORT_TAG)
}
