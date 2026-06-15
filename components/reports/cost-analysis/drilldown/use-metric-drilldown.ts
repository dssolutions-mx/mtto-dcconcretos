'use client'

import { useCallback, useState } from 'react'
import type {
  DieselOperationalDetails,
  ManttoOperationalDetails,
} from '@/lib/reports/ingresos-gastos-operational-details'
import type { DrilldownMetric } from './drilldown-types'

export function useMetricDrilldown() {
  const [open, setOpen] = useState(false)
  const [metric, setMetric] = useState<DrilldownMetric | null>(null)
  const [focusMonth, setFocusMonth] = useState<string>('')
  const [operationalLoading, setOperationalLoading] = useState(false)
  const [operationalError, setOperationalError] = useState<string | null>(null)
  const [dieselDetails, setDieselDetails] = useState<DieselOperationalDetails | null>(null)
  const [manttoDetails, setManttoDetails] = useState<ManttoOperationalDetails | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setMetric(null)
    setOperationalError(null)
    setDieselDetails(null)
    setManttoDetails(null)
  }, [])

  const openDrilldown = useCallback(
    async (m: DrilldownMetric, month: string, scopePlantIds: string[]) => {
      setMetric(m)
      setFocusMonth(month)
      setOpen(true)
      setOperationalError(null)
      setDieselDetails(null)
      setManttoDetails(null)

      if (m !== 'diesel' && m !== 'mantto') return
      if (scopePlantIds.length === 0) {
        setOperationalError('Sin plantas en el alcance seleccionado.')
        return
      }

      const category = m === 'diesel' ? 'diesel' : 'mantto'
      setOperationalLoading(true)
      try {
        const resp = await fetch(
          `/api/reports/gerencial/ingresos-gastos/operational-details?month=${encodeURIComponent(month)}&category=${category}&scopePlantIds=${encodeURIComponent(scopePlantIds.join(','))}`
        )
        const json = await resp.json()
        if (!resp.ok) throw new Error(json.error || 'Error al cargar desglose')
        if (category === 'diesel') setDieselDetails(json as DieselOperationalDetails)
        else setManttoDetails(json as ManttoOperationalDetails)
      } catch (e: unknown) {
        setOperationalError(e instanceof Error ? e.message : 'Error al cargar desglose')
      } finally {
        setOperationalLoading(false)
      }
    },
    []
  )

  return {
    open,
    metric,
    focusMonth,
    setFocusMonth,
    operationalLoading,
    operationalError,
    dieselDetails,
    manttoDetails,
    openDrilldown,
    close,
  }
}
