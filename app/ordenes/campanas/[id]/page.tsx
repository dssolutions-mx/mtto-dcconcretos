"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Wrench, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type CampaignDetail = {
  id: string
  name: string
  status: string
  theme?: string | null
  target_end?: string | null
  notes?: string | null
  progress_pct?: number
  work_order_count?: number
  completed_count?: number
  work_orders?: Array<{
    id: string
    order_id?: string | null
    description?: string | null
    status?: string | null
    priority?: string | null
    asset?: { asset_id?: string | null; name?: string | null; plants?: { name?: string } | null }
  }>
}

export default function CampaignDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { toast } = useToast()
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    fetch(`/api/campaigns/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCampaign)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [id])

  const updateStatus = async (status: string) => {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      load()
      toast({ title: "Estado actualizado" })
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </DashboardShell>
    )
  }

  if (!campaign) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Campaña no encontrada.</p>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader heading={campaign.name} text="Detalle de campaña">
        <Button asChild variant="outline" size="sm">
          <Link href="/ordenes/campanas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Select value={campaign.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planificada">Planificada</SelectItem>
              <SelectItem value="en_ejecucion">En ejecución</SelectItem>
              <SelectItem value="cerrada">Cerrada</SelectItem>
            </SelectContent>
          </Select>
          {campaign.target_end && (
            <span className="text-sm text-muted-foreground">
              Meta: {campaign.target_end}
            </span>
          )}
          <Badge variant="secondary">{campaign.work_order_count ?? 0} OTs</Badge>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Progreso</span>
            <span>
              {campaign.completed_count ?? 0}/{campaign.work_order_count ?? 0} (
              {campaign.progress_pct ?? 0}%)
            </span>
          </div>
          <Progress value={campaign.progress_pct ?? 0} />
        </div>

        {campaign.notes && (
          <p className="text-sm text-muted-foreground border rounded-lg p-3">
            {campaign.notes}
          </p>
        )}

        <div className="rounded-md border divide-y">
          {(campaign.work_orders ?? []).map((wo) => (
            <div
              key={wo.id}
              className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium">{wo.asset?.asset_id ?? "—"}</span>
                <span className="text-muted-foreground ml-2 truncate block sm:inline">
                  {wo.description?.slice(0, 80)}
                </span>
              </div>
              <Badge variant="outline">{wo.status}</Badge>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/ordenes/${wo.id}`}>
                  <Wrench className="h-3 w-3 mr-1" />
                  {wo.order_id ? `OT-${wo.order_id}` : "Ver"}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}
