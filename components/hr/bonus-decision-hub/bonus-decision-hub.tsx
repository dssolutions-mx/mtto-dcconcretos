'use client'

import { useEffect, useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BonusPaySheetView } from './bonus-pay-sheet-view'
import { OperatorBonusDetailView } from './operator-bonus-detail-view'
import { DosificadorComplianceView } from './dosificador-compliance-view'

export type BonusHubFilters = {
  businessUnit: string
  plant: string
  year: number
  month: number
}

export type BonusHubTab = 'nomina' | 'detalle' | 'dosificador'

type BonusDecisionHubProps = {
  initialTab?: BonusHubTab
  initialOperatorId?: string | null
}

export function BonusDecisionHub({
  initialTab = 'nomina',
  initialOperatorId = null,
}: BonusDecisionHubProps) {
  const now = new Date()
  const [activeTab, setActiveTab] = useState<BonusHubTab>(initialTab)
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(initialOperatorId)

  const [businessUnit, setBusinessUnit] = useState('all')
  const [plant, setPlant] = useState('all')
  const [year, setYear] = useState(now.getUTCFullYear())
  const [month, setMonth] = useState(now.getUTCMonth() + 1)

  const [businessUnits, setBusinessUnits] = useState<Array<{ id: string; name: string }>>([])
  const [plants, setPlants] = useState<
    Array<{ id: string; name: string; business_unit_id: string }>
  >([])

  useEffect(() => {
    async function loadOrg() {
      try {
        const [buRes, plantsRes] = await Promise.all([
          fetch('/api/business-units'),
          fetch('/api/plants'),
        ])
        if (buRes.ok) {
          const buData = await buRes.json()
          setBusinessUnits(buData.business_units ?? [])
        }
        if (plantsRes.ok) {
          const plantsData = await plantsRes.json()
          setPlants(plantsData.plants ?? [])
        }
      } catch (error) {
        console.error('[bonus-decision-hub] org data', error)
      }
    }
    void loadOrg()
  }, [])

  const filters: BonusHubFilters = useMemo(
    () => ({ businessUnit, plant, year, month }),
    [businessUnit, plant, year, month]
  )

  const filteredPlants = useMemo(() => {
    if (businessUnit === 'all') return plants
    return plants.filter((p) => p.business_unit_id === businessUnit)
  }, [plants, businessUnit])

  const handleDrillDown = (operatorId: string) => {
    setSelectedOperatorId(operatorId)
    setActiveTab('detalle')
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BonusHubTab)} className="space-y-6">
      <TabsList className="grid w-full grid-cols-1 gap-2 h-auto sm:grid-cols-3">
        <TabsTrigger value="nomina">Nómina de bonos</TabsTrigger>
        <TabsTrigger value="detalle">Detalle operador</TabsTrigger>
        <TabsTrigger value="dosificador">Cumplimiento dosificador</TabsTrigger>
      </TabsList>

      <TabsContent value="nomina">
        <BonusPaySheetView
          filters={filters}
          businessUnits={businessUnits}
          plants={filteredPlants}
          onBusinessUnitChange={setBusinessUnit}
          onPlantChange={setPlant}
          onYearChange={setYear}
          onMonthChange={setMonth}
          onDrillDown={handleDrillDown}
        />
      </TabsContent>

      <TabsContent value="detalle">
        <OperatorBonusDetailView
          filters={filters}
          businessUnits={businessUnits}
          plants={filteredPlants}
          selectedOperatorId={selectedOperatorId}
          onBusinessUnitChange={setBusinessUnit}
          onPlantChange={setPlant}
          onYearChange={setYear}
          onMonthChange={setMonth}
          onOperatorChange={setSelectedOperatorId}
        />
      </TabsContent>

      <TabsContent value="dosificador">
        <DosificadorComplianceView
          filters={filters}
          businessUnits={businessUnits}
          plants={filteredPlants}
          onBusinessUnitChange={setBusinessUnit}
          onPlantChange={setPlant}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
      </TabsContent>
    </Tabs>
  )
}
