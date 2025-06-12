import { Suspense } from 'react'
import { PersonnelManagementPage } from '@/components/personnel/personnel-management-page'
import { Spinner } from '@/components/ui/spinner'

export default function PersonalPage() {
  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<Spinner />}>
        <PersonnelManagementPage />
      </Suspense>
    </div>
  )
} 