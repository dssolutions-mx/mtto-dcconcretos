import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | Gestión Organizacional',
    default: 'Gestión Organizacional',
  },
  description: 'Sistema de gestión organizacional con plantas, personal y activos',
}

export default function OrganizacionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
} 