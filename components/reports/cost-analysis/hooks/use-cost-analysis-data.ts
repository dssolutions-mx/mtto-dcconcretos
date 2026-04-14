'use client'

import { useCallback, useState } from 'react'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'

export function useCostAnalysisData() {
  const [data, setData] = useState<CostAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (params: { months: string[]; businessUnitId: string | null; plantId: string | null }) => {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch('/api/reports/gerencial/analisis-costos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            months: params.months,
            businessUnitId: params.businessUnitId,
            plantId: params.plantId,
          }),
        })
        const json = await r.json()
        if (!r.ok) throw new Error(json.error || 'Error al cargar análisis')
        setData(json as CostAnalysisResponse)
      } catch (e: unknown) {
        setData(null)
        setError(e instanceof Error ? e.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { data, loading, error, load }
}
