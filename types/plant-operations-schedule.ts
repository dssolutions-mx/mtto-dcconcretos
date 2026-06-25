export type ScheduleDueStatus = 'on_time' | 'due_today' | 'overdue'

export type PlantOperationsDueConfig = {
  /** UTC date key YYYY-MM-DD; defaults to today UTC. */
  todayKey?: string
  /** Monthly bonus_closure deadline day (default 24). */
  deadlineDay?: number
}

export type PlantControlDueSummary = {
  dueStatus: ScheduleDueStatus
  scheduleId: string | null
  checklistName: string | null
  scheduledDay: string | null
  /** Days until monthly closure deadline; null when no monthly schedule. */
  monthlyClosureDaysRemaining: number | null
  /** Server draft exists for the pending schedule. */
  hasDraft?: boolean
  draftUpdatedAt?: string | null
  /** Operators with eligibility saved in bonus_closure draft. */
  bonusClosureDraftDecisions?: number | null
}
