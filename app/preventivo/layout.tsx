import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Mantenimiento Preventivo | Sistema de Gestión de Mantenimiento",
  description: "Gestión de mantenimiento preventivo basado en horas de operación",
}

export default function PreventiveLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
} 