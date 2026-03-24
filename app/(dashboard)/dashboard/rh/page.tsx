"use client"

import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardActionStrip } from "@/components/dashboard/dashboard-action-strip"
import {
  ClipboardCheck,
  FileText,
  KeyRound,
  Shield,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { effectiveRoleForPermissions, isRHOwnerRole } from "@/lib/auth/role-model"

const hubLinks: {
  href: string
  title: string
  sub: string
  icon: typeof Users
}[] = [
  {
    href: "/gestion/personal",
    title: "Gestión de personal",
    sub: "Altas, plantas y equipos",
    icon: Users,
  },
  {
    href: "/gestion/autorizaciones",
    title: "Autorizaciones",
    sub: "Límites y roles de compra",
    icon: Shield,
  },
  {
    href: "/gestion/credenciales",
    title: "Credenciales",
    sub: "Documentos y accesos",
    icon: KeyRound,
  },
  {
    href: "/rh/cumplimiento-checklists",
    title: "Cumplimiento checklists",
    sub: "Seguimiento RH",
    icon: ClipboardCheck,
  },
  {
    href: "/rh/limpieza",
    title: "Reportes de limpieza",
    sub: "Cumplimiento operativo",
    icon: Sparkles,
  },
  {
    href: "/compliance/incidentes",
    title: "Conciliación de incidencias",
    sub: "Cola y resolución",
    icon: FileText,
  },
]

export default function RHDashboard() {
  const { profile, isInitialized } = useAuthZustand()
  const router = useRouter()

  const isRH =
    !!profile &&
    isRHOwnerRole(effectiveRoleForPermissions(profile) ?? profile.business_role ?? profile.role)

  useEffect(() => {
    if (isInitialized && profile && !isRH) {
      router.push("/dashboard")
    }
  }, [isInitialized, profile, isRH, router])

  if (!isInitialized || !profile) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Cargando..." text="Preparando tu dashboard." />
      </DashboardShell>
    )
  }

  if (!isRH) {
    return null
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Bienvenido, ${profile.nombre} ${profile.apellido}`}
        text="Espacio de trabajo de Recursos Humanos: personal, cumplimiento y conciliación."
      />
      <DashboardActionStrip
        icon={FileText}
        count={0}
        label="incidencias en conciliación"
        href="/compliance/incidentes"
        ctaLabel="Conciliar"
      />

      <div className="mt-6 rounded-xl border border-primary/20 bg-muted/25 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <UserPlus className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Prioridad RH
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">Altas y movimientos de personal</p>
              <p className="mt-0.5 text-xs text-muted-foreground max-w-md">
                Abre el tablero de personal con el formulario de alta listo. Ahí gestionas usuarios, plantas y
                asignaciones en un solo lugar.
              </p>
            </div>
          </div>
          <Link
            href="/gestion/personal?registrar=1"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 min-h-[44px]"
          >
            <UserPlus className="h-4 w-4" />
            Ir a personal y registrar
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Accesos rápidos
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hubLinks.map(({ href, title, sub, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5 transition-colors hover:border-border hover:bg-muted/30 cursor-pointer"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 group-hover:bg-muted">
                <Icon className="h-4 w-4 text-foreground/80" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}
