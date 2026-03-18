"use client"

/**
 * Executive dashboard greeting — responsive for mobile + desktop.
 * Mobile: compact single-line date, smaller heading.
 * Desktop: full date string, larger heading.
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

  // Full date for desktop (e.g. "martes, 17 de marzo de 2026")
  const dateDesktop = now.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  // Compact date for mobile (e.g. "mar., 17 mar. 2026")
  const dateMobile = now.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  const firstName = name.split(" ")[0] ?? name

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      {/* Date — mobile gets abbreviated format to stay on one line */}
      <p className="text-xs font-medium text-muted-foreground capitalize tracking-wide truncate">
        <span className="sm:hidden">{dateMobile}</span>
        <span className="hidden sm:inline">{dateDesktop}</span>
      </p>

      {/* Greeting — scales down on narrow screens */}
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl truncate">
        {greeting}, <span className="font-bold">{firstName}</span>
      </h1>

      {/* Role subtitle */}
      <p className="text-xs text-muted-foreground sm:text-sm truncate">{role}</p>
    </div>
  )
}
