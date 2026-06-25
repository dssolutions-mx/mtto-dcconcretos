import { Suspense } from 'react'
import { RHReportingGuard } from '@/components/auth/rh-reporting-guard'
import { CleanlinessReportsView } from '@/components/hr/reports/cleanliness-reports-view'
import { RhReportLoading } from '@/components/hr/reports/rh-report-states'

export default function CleanlinessReportsPage() {
  return (
    <RHReportingGuard>
      <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="py-8">
              <RhReportLoading rows={4} />
            </div>
          }
        >
          <CleanlinessReportsView />
        </Suspense>
      </div>
    </RHReportingGuard>
  )
}
