'use client'

import { use } from "react"
import { CompletedChecklistDetailPage } from "@/components/checklists/completado/completed-checklist-detail-page"

export default function CompletedChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  return <CompletedChecklistDetailPage params={params} />
}
