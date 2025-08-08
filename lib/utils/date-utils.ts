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
export function categorizeSchedulesByDate<T extends { scheduled_date?: string; scheduled_day?: string }>(
  schedules: T[]
): {
  overdue: T[]
  today: T[]
  upcoming: T[]
  future: T[]
} {
  const getDateString = (schedule: T) => (schedule.scheduled_day || schedule.scheduled_date || '')
  
  const overdue = schedules.filter(schedule => isDateOverdue(getDateString(schedule)))
  const today = schedules.filter(schedule => isDateToday(getDateString(schedule)))
  const upcoming = schedules.filter(schedule => isDateWithinDays(getDateString(schedule), 7))
  const future = schedules.filter(schedule => 
    !isDateOverdue(getDateString(schedule)) && 
    !isDateToday(getDateString(schedule)) && 
    !isDateWithinDays(getDateString(schedule), 7)
  )

  return {
    overdue: overdue.sort((a, b) => new Date(getDateString(a)).getTime() - new Date(getDateString(b)).getTime()),
    today,
    upcoming: upcoming.sort((a, b) => new Date(getDateString(a)).getTime() - new Date(getDateString(b)).getTime()),
    future: future.sort((a, b) => new Date(getDateString(a)).getTime() - new Date(getDateString(b)).getTime())
  }
}

/**
 * Get relative date description (using UTC-based comparison for consistency)
 */
export function getRelativeDateDescription(dateString: string): string {
  // Use UTC-based comparison for consistency with categorization logic
  const utcToday = getUTCToday()
  const utcDate = getUTCDateStart(dateString)
  
  const diffTime = utcDate.getTime() - utcToday.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  if (diffDays === -1) return 'Ayer'
  if (diffDays < 0) return `Hace ${Math.abs(diffDays)} días`
  if (diffDays <= 7) return `En ${diffDays} días`
  
  // Use UTC date for consistency - no timezone conversion
  const utcDateForDisplay = new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()))
  return utcDateForDisplay.toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Format date for display (using UTC for consistency)
 */
export function formatDisplayDate(dateString: string): string {
  // Use UTC date for consistency - no timezone conversion
  const utcDate = getUTCDateStart(dateString)
  const utcDateForDisplay = new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()))
  
  return utcDateForDisplay.toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Get schedule status based on due date (UTC comparison)
 */
export function getScheduleStatus(
  input: string | { scheduled_date?: string; scheduled_day?: string }
): 'overdue' | 'today' | 'upcoming' {
  const dateString = typeof input === 'string' ? input : (input.scheduled_day || input.scheduled_date || '')
  if (isDateOverdue(dateString)) return 'overdue'
  if (isDateToday(dateString)) return 'today'
  return 'upcoming'
}

/**
 * Format schedule date (prefers scheduled_day when provided)
 */
export function formatScheduleDisplayDate(input: string | { scheduled_date?: string; scheduled_day?: string }): string {
  const dateString = typeof input === 'string' ? input : (input.scheduled_day || input.scheduled_date || '')
  return formatDisplayDate(dateString)
}