import { redirect } from "next/navigation"

/**
 * Deprecated: Redirect to main checklist page with frequency tab.
 * Diarios/Semanales/Mensuales are now available under "Por frecuencia" tab.
 */
export default function WeeklyChecklistsRedirect() {
  redirect("/checklists?tab=frequency")
}
