'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Clock, Shield, Sparkles, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BonusPaySheetView } from '@/components/hr/bonus-decision-hub/bonus-pay-sheet-view'
import { OperatorBonusDetailView } from '@/components/hr/bonus-decision-hub/operator-bonus-detail-view'
import { DosificadorComplianceView } from '@/components/hr/bonus-decision-hub/dosificador-compliance-view'
import { MONTH_OPTIONS } from '@/components/hr/bonus-decision-hub/bonus-hub-shared'
import type { BonusHubFilters, BonusHubTab } from '@/components/hr/bonus-decision-hub/bonus-decision-hub'
import { RhReportPageShell } from './rh-report-page-shell'
import { RhMonthPeriodFilters } from './rh-month-period-filters'
import { useRhOrgFilters } from './use-rh-org-filters'

type BonusReportsViewProps = {
  initialTab?: BonusHubTab
  initialOperatorId?: string | null
  initialYear?: number
  initialMonth?: number
}

export function BonusReportsView({
  initialTab = 'nomina',
  initialOperatorId = null,
  initialYear,
  initialMonth,
}: BonusReportsViewProps) {
  const searchParams = useSearchParams()
  const now = new Date()
  const org = useRhOrgFilters()
  const { setPlant } = org
  const [activeTab, setActiveTab] = useState<BonusHubTab>(() => {
    const tab = searchParams.get('tab')
    return tab === 'detalle' || tab === 'dosificador' ? tab : initialTab
  })
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(
    () => searchParams.get('operator') ?? initialOperatorId
  )
  const [year, setYear] = useState(() => {
    const param = searchParams.get('year')
    const parsed = param ? parseInt(param, 10) : NaN
    return Number.isFinite(parsed) ? parsed : (initialYear ?? now.getUTCFullYear())
  })
  const [month, setMonth] = useState(() => {
    const param = searchParams.get('month')
    const parsed = param ? parseInt(param, 10) : NaN
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12
      ? parsed
      : (initialMonth ?? now.getUTCMonth() + 1)
  })

  useEffect(() => {
    const plantParam = searchParams.get('plant')
    if (plantParam) setPlant(plantParam)
  }, [searchParams, setPlant])

  const filters: BonusHubFilters = useMemo(
    () => ({
      businessUnit: org.filters.businessUnit,
      plant: org.filters.plant,
      year,
      month,
    }),
    [org.filters.businessUnit, org.filters.plant, year, month]
  )

  const periodLabel = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month)

  const plantQuery = org.filters.plant !== 'all' ? `&plant=${org.filters.plant}` : ''

  const relatedReports = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
        <Link href={`/rh/puntualidad?year=${year}&month=${month}${plantQuery}`}>
          <Clock className="h-3.5 w-3.5" />
          Puntualidad
        </Link>
      </Button>
      <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
        <Link href={`/rh/limpieza?year=${year}&month=${month}${plantQuery}`}>
          <Sparkles className="h-3.5 w-3.5" />
          Limpieza
        </Link>
      </Button>
      <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
        <Link href={`/rh/charlas?year=${year}&month=${month}${plantQuery}`}>
          <Shield className="h-3.5 w-3.5" />
          Charlas
        </Link>
      </Button>
    </div>
  )

  return (
    <RhReportPageShell
      variant="bonus"
      title="Centro de decisión de bonos"
      description="Nómina operador-primero, evidencia de puntualidad y limpieza, y cumplimiento del dosificador para el cierre mensual."
      filters={
        <RhMonthPeriodFilters
          businessUnit={org.filters.businessUnit}
          plant={org.filters.plant}
          year={year}
          month={month}
          businessUnits={org.businessUnits}
          plants={org.plants}
          orgLoading={org.loading}
          onBusinessUnitChange={org.setBusinessUnit}
          onPlantChange={org.setPlant}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
      }
    >
      {org.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {org.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Periodo: <span className="font-medium text-foreground">{periodLabel} {year}</span>
        </p>
        {relatedReports}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as BonusHubTab)}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 sm:grid-cols-3">
          <TabsTrigger value="nomina" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Nómina de bonos
          </TabsTrigger>
          <TabsTrigger value="detalle" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Detalle operador
          </TabsTrigger>
          <TabsTrigger value="dosificador" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Cumplimiento dosificador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nomina">
          <BonusPaySheetView
            filters={filters}
            onDrillDown={(operatorId) => {
              setSelectedOperatorId(operatorId)
              setActiveTab('detalle')
            }}
          />
        </TabsContent>

        <TabsContent value="detalle">
          <OperatorBonusDetailView
            filters={filters}
            selectedOperatorId={selectedOperatorId}
            onOperatorChange={setSelectedOperatorId}
          />
        </TabsContent>

        <TabsContent value="dosificador">
          <DosificadorComplianceView filters={filters} />
        </TabsContent>
      </Tabs>
    </RhReportPageShell>
  )
}
