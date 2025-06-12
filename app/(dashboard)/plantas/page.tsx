import { Suspense } from 'react'
import { PlantConfigurationPage } from '@/components/plants/plant-configuration-page'
import { Spinner } from '@/components/ui/spinner'

export default function PlantConfigurationPageRoute() {
  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<Spinner />}>
        <PlantConfigurationPage />
      </Suspense>
    </div>
  )
} 