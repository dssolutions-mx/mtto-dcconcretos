import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Ejecutar Checklist | Sistema de Gestión de Mantenimiento",
  description: "Ejecutar un checklist de mantenimiento",
}

export default function ChecklistExecutionLayout({
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