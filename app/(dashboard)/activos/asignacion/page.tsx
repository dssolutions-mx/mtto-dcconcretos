import { Suspense } from 'react'
import { AssetAssignmentPage } from '@/components/assets/asset-assignment-page'
import { Spinner } from '@/components/ui/spinner'

export default function AssetAssignmentPageRoute() {
  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<Spinner />}>
        <AssetAssignmentPage />
      </Suspense>
    </div>
  )
} 