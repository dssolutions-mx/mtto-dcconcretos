/**
 * Incident KPI rules shared by /incidentes and the manager snapshot generator.
 */

export function isIncidentResolvedForDashboard(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  return s === 'resolved' || s === 'resuelto' || s === 'cerrado'
}

export function incidentAgeDaysForDashboard(
  dateStr: string | null | undefined,
  createdAt: string | null | undefined,
  nowMs: number = Date.now(),
): number {
  const raw = dateStr ?? createdAt ?? ''
  const t = new Date(raw).getTime()
  if (!Number.isFinite(t)) return 0
  return Math.ceil(Math.abs(nowMs - t) / (1000 * 60 * 60 * 24))
}

export type IncidentDashboardStats = {
  total: number
  open: number
  resolved: number
  openOver7Days: number
}

export function aggregateIncidentDashboardStats(
  incidents: Iterable<{ status?: string | null; date?: string | null; created_at?: string | null }>,
  nowMs: number = Date.now(),
): IncidentDashboardStats {
  let open = 0
  let resolved = 0
  let openOver7Days = 0
  let total = 0
  for (const i of incidents) {
    total += 1
    if (isIncidentResolvedForDashboard(i.status)) {
      resolved += 1
    } else {
      open += 1
      if (incidentAgeDaysForDashboard(i.date, i.created_at, nowMs) >= 7) {
        openOver7Days += 1
      }
    }
  }
  return { total, open, resolved, openOver7Days }
}
