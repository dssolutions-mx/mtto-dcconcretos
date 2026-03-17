"use client"

/**
 * Clean executive greeting for the dashboard hero slot.
 * Replaces the old action strip — contextual, calm, no redundancy.
 */
export function DashboardExecutiveHero({
  name,
  role,
}: {
  name: string
  role: string
}) {
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches"

  const dateStr = now.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const firstName = name.split(" ")[0] ?? name

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground capitalize tracking-wide">
        {dateStr}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {greeting}, {firstName}
      </h1>
      <p className="text-sm text-muted-foreground">{role}</p>
    </div>
  )
}
