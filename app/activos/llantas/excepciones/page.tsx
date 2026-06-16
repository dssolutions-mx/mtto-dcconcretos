'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { ExceptionsList } from '@/components/tires/exceptions-list'

export default function TireExceptionsPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Excepciones de llantas"
        text="Vista diaria para supervisores — problemas priorizados P1/P2/P3."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/activos/llantas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Inventario
          </Link>
        </Button>
      </DashboardHeader>
      <ExceptionsList />
    </DashboardShell>
  )
}
