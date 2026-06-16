'use client'

import { use } from 'react'
import { TireDetailPage } from '@/components/tires/tire-detail-page'

export default function TireDetailRoutePage({
  params,
}: {
  params: Promise<{ tireId: string }>
}) {
  const { tireId } = use(params)
  return <TireDetailPage tireId={tireId} />
}
