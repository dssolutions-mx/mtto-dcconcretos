import { CostAnalysisDashboard } from '@/components/reports/cost-analysis/cost-analysis-dashboard'
import { AnalisisCostosHeader } from './analisis-costos-header'

export default function AnalisisCostosPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AnalisisCostosHeader />
      </div>

      <CostAnalysisDashboard />
    </div>
  )
}
