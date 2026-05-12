/**
 * Cotizador plant financial unified view: legacy MP costing vs FIFO MP costing.
 * From 2026-04 onward the report uses the FIFO-backed unified view.
 */

export const FIFO_FINANCIAL_CUTOFF_MONTH = '2026-04' as const

/** First-of-month date string (YYYY-MM-01) at which FIFO view applies (inclusive). */
export const FIFO_FINANCIAL_CUTOFF_PERIOD_START = `${FIFO_FINANCIAL_CUTOFF_MONTH}-01` as const

export const COTIZADOR_PLANT_FINANCIAL_UNIFIED_VIEW_LEGACY =
  'vw_plant_financial_analysis_unified' as const
export const COTIZADOR_PLANT_FINANCIAL_UNIFIED_VIEW_FIFO =
  'vw_plant_financial_analysis_unified_fifo' as const

/**
 * @param periodMonth First day of month as `YYYY-MM-01` (matches Cotizador `period_start`).
 */
export function cotizadorPlantFinancialUnifiedViewName(periodMonth: string): string {
  return periodMonth >= FIFO_FINANCIAL_CUTOFF_PERIOD_START
    ? COTIZADOR_PLANT_FINANCIAL_UNIFIED_VIEW_FIFO
    : COTIZADOR_PLANT_FINANCIAL_UNIFIED_VIEW_LEGACY
}

/** `month` as `YYYY-MM` — for refresh RPC routing. */
export function cotizadorUsesFifoFinancialPipeline(monthYm: string): boolean {
  return monthYm >= FIFO_FINANCIAL_CUTOFF_MONTH
}
