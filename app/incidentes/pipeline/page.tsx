"use client"

import { Suspense } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RoutingRulesTab } from "@/components/incidents/tabs/routing-rules-tab"
import { DepartmentInboxTab } from "@/components/incidents/tabs/department-inbox-tab"
import { PipelineBoardTab } from "@/components/incidents/tabs/pipeline-board-tab"
import { RoutingLearningTab } from "@/components/incidents/tabs/routing-learning-tab"

function PipelinePageContent() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <DashboardHeader
          heading="Pipeline de incidencias"
          text="Ruteo por departamento, bandejas, aprendizaje y tablero de estado"
        />
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/incidentes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a incidentes
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="inbox" className="mt-2">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="pipeline">Tablero</TabsTrigger>
          <TabsTrigger value="inbox">Bandeja</TabsTrigger>
          <TabsTrigger value="rules">Reglas</TabsTrigger>
          <TabsTrigger value="learning">Aprendizaje</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-4">
          <PipelineBoardTab />
        </TabsContent>
        <TabsContent value="inbox" className="mt-4">
          <DepartmentInboxTab />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <RoutingRulesTab />
        </TabsContent>
        <TabsContent value="learning" className="mt-4">
          <RoutingLearningTab />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}

export default function IncidentPipelinePage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <DashboardHeader heading="Pipeline de incidencias" text="" />
        </DashboardShell>
      }
    >
      <PipelinePageContent />
    </Suspense>
  )
}
