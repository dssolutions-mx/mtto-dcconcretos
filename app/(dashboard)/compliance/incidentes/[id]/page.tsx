'use client'

import { use } from 'react'
import { ComplianceIncidentDetailPage } from '@/components/compliance/compliance-incident-detail-page'

export default function ComplianceIncidentDetailPageRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <ComplianceIncidentDetailPage incidentId={id} />
}
