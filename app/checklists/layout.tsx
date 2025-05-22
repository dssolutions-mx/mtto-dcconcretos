import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Checklists | Sistema de Gestión de Mantenimiento",
  description: "Gestión de checklists para mantenimiento",
}

export default function ChecklistsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex-1 overflow-auto">
      {children}
    </div>
  )
} 