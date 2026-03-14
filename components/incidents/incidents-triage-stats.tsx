"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  Activity,
  Flame,
  AlertCircle,
  PlayCircle,
  CheckCircle2,
  TrendingUp,
} from "lucide-react"

interface IncidentsTriageStatsProps {
  totalIncidents: number
  criticalIncidents: number
  openIncidents: number
  inProgressIncidents: number
  resolvedIncidents: number
  recentIncidents: number
  resolutionRate?: number
  avgResolutionTime?: number
}

export function IncidentsTriageStats({
  totalIncidents,
  criticalIncidents,
  openIncidents,
  inProgressIncidents,
  resolvedIncidents,
  recentIncidents,
}: IncidentsTriageStatsProps) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-xl font-bold">{totalIncidents}</div>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              <div>
                <div className="text-xl font-bold text-red-600">{criticalIncidents}</div>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <div>
                <div className="text-xl font-bold text-orange-600">{openIncidents}</div>
                <p className="text-xs text-muted-foreground">Abiertos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-xl font-bold text-blue-600">{inProgressIncidents}</div>
                <p className="text-xs text-muted-foreground">En Progreso</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-xl font-bold text-green-600">{resolvedIncidents}</div>
                <p className="text-xs text-muted-foreground">Resueltos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <div>
                <div className="text-xl font-bold text-purple-600">{recentIncidents}</div>
                <p className="text-xs text-muted-foreground">Nuevos 7d</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
