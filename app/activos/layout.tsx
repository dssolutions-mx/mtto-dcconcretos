import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Activos | Sistema de Gestión de Mantenimiento",
  description: "Gestión de activos y equipos",
}

export default function AssetsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
} 