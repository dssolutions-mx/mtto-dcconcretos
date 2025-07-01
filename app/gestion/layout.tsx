import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | Gestión Organizacional',
    default: 'Gestión Organizacional',
  },
  description: 'Sistema de gestión organizacional para plantas, personal y activos',
}

export default function GestionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      {children}
    </div>
  )
} 