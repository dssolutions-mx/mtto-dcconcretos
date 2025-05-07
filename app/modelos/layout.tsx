import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Modelos de Equipos | Sistema de Gestión de Mantenimiento",
  description: "Gestión de modelos de equipos y sus especificaciones de mantenimiento",
}

export default function ModelsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
} 