/**
 * Normalize maintenance_history.completed_tasks (jsonb) for work order task checklists.
 * Supports:
 * - Legacy: only completed rows [{ task_id, completed: true, ... }]
 * - Current: full row list [{ task_id, description?, completed: boolean, ... }]
 */
export type TaskCompletionRow = {
  task_id?: string
  id?: string
  description?: string
  completed?: boolean
  completed_at?: string
}

export function taskKeyFromRequiredTask(task: { id?: string | null }, index: number): string {
  if (task.id != null && String(task.id).length > 0) return String(task.id)
  return `idx:${index}`
}

export function parseCompletedTasksJson(raw: unknown): {
  /** task_id → completed (true = done) */
  completedById: Map<string, boolean>
} {
  const completedById = new Map<string, boolean>()
  if (raw == null) return { completedById }

  let data: unknown = raw
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw)
    } catch {
      return { completedById }
    }
  }
  if (!Array.isArray(data)) return { completedById }

  for (const row of data as TaskCompletionRow[]) {
    const id = row.task_id ?? row.id
    if (!id) continue
    const key = String(id)
    if (row.completed === true) {
      completedById.set(key, true)
    } else if (row.completed === false) {
      completedById.set(key, false)
    } else {
      // Legacy rows only list completed work
      completedById.set(key, true)
    }
  }
  return { completedById }
}

export function isTaskMarkedCompleted(
  map: Map<string, boolean>,
  task: { id?: string | null; description?: string | null },
  index: number
): boolean {
  const k = taskKeyFromRequiredTask(task, index)
  if (map.has(k)) return map.get(k) === true
  if (task.id != null && String(task.id).length > 0) {
    const v = map.get(String(task.id))
    if (v !== undefined) return v === true
  }
  return false
}
