/**
 * Date utility functions for consistent timezone handling
 * All functions work with UTC dates to avoid timezone inconsistencies
 */

/**
 * Get the start of today in UTC (00:00:00.000Z)
 */
export function getUTCToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * Get the start of a specific date in UTC
 */
export function getUTCDateStart(date: Date | string): Date {
  const d = new Date(date)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Check if a date is before today (UTC comparison)
 */
export function isDateOverdue(date: Date | string): boolean {
  const utcToday = getUTCToday()
  const utcDate = getUTCDateStart(date)
  return utcDate < utcToday
}

/**
 * Check if a date is today (UTC comparison)
 */
export function isDateToday(date: Date | string): boolean {
  const utcToday = getUTCToday()
  const utcDate = getUTCDateStart(date)
  return utcDate.getTime() === utcToday.getTime()
}

/**
 * Check if a date is within the next N days (UTC comparison)
 */
export function isDateWithinDays(date: Date | string, days: number): boolean {
  const utcToday = getUTCToday()
  const utcDate = getUTCDateStart(date)
  const futureDate = new Date(utcToday)
  futureDate.setUTCDate(futureDate.getUTCDate() + days)
  
  return utcDate > utcToday && utcDate <= futureDate
}

/**
 * Categorize checklist schedules by their due dates (UTC-based)
 */
export function categorizeSchedulesByDate<T extends { scheduled_date: string }>(
  schedules: T[]
): {
  overdue: T[]
  today: T[]
  upcoming: T[]
  future: T[]
} {
  const overdue = schedules.filter(schedule => isDateOverdue(schedule.scheduled_date))
  const today = schedules.filter(schedule => isDateToday(schedule.scheduled_date))
  const upcoming = schedules.filter(schedule => isDateWithinDays(schedule.scheduled_date, 7))
  const future = schedules.filter(schedule => 
    !isDateOverdue(schedule.scheduled_date) && 
    !isDateToday(schedule.scheduled_date) && 
    !isDateWithinDays(schedule.scheduled_date, 7)
  )

  return {
    overdue: overdue.sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()),
    today,
    upcoming: upcoming.sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()),
    future: future.sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
  }
}

/**
 * Get relative date description (in user's local timezone for display)
 */
export function getRelativeDateDescription(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  
  // Convert both to local date for relative comparison
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  
  const diffTime = localDate.getTime() - localToday.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  if (diffDays === -1) return 'Ayer'
  if (diffDays < 0) return `Hace ${Math.abs(diffDays)} días`
  if (diffDays <= 7) return `En ${diffDays} días`
  
  return date.toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Format date for display (in user's local timezone)
 */
export function formatDisplayDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Get schedule status based on due date (UTC comparison)
 */
export function getScheduleStatus(scheduledDate: string): 'overdue' | 'today' | 'upcoming' {
  if (isDateOverdue(scheduledDate)) return 'overdue'
  if (isDateToday(scheduledDate)) return 'today'
  return 'upcoming'
} 