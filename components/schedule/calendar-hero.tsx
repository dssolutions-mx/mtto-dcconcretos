"use client"

import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { getRoleDisplayName } from "@/lib/auth/role-permissions"

export function CalendarHero() {
  const { profile } = useAuthZustand()
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches"

  const dateDesktop = now.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  })

  const dateMobile = now.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  })

  const firstName = profile?.nombre?.split(" ")[0] ?? profile?.nombre ?? "Usuario"
  const role = profile?.role ? getRoleDisplayName(profile.role) : ""

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <p className="text-xs font-medium text-muted-foreground capitalize tracking-wide truncate">
        <span className="sm:hidden">{dateMobile}</span>
        <span className="hidden sm:inline">{dateDesktop}</span>
      </p>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl truncate">
        {greeting}, <span className="font-bold">{firstName}</span>
      </h1>
      {role && (
        <p className="text-xs text-muted-foreground sm:text-sm truncate">{role}</p>
      )}
    </div>
  )
}
