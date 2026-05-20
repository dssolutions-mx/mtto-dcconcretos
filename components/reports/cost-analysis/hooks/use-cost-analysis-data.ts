'use client'

import { useCallback, useRef, useState } from 'react'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'

export type CostAnalysisLoadParams = {
  months: string[]
  businessUnitId: string | null
  plantId: string | null
}

export function useCostAnalysisData() {
  const [data, setData] = useState<CostAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingParams, setPendingParams] = useState<CostAnalysisLoadParams | null>(null)
  const requestIdRef = useRef(0)

  const load = useCallback(async (params: CostAnalysisLoadParams) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    setPendingParams(params)
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
      if (requestId !== requestIdRef.current) return
      if (!r.ok) throw new Error(json.error || 'Error al cargar análisis')
      setData(json as CostAnalysisResponse)
    } catch (e: unknown) {
      if (requestId !== requestIdRef.current) return
      setData(null)
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
        setPendingParams(null)
      }
    }
  }, [])

  return { data, loading, error, load, pendingParams }
}
